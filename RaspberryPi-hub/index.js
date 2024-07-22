
import { Sequelize } from 'sequelize';
import SQLite from 'sqlite3';
import path from 'path';
import express from 'express';
import PagesController from './controllers/pagesController.js';
import MQTTBroker from './core/mqtt.js';
import ConfigModelFn from './models/config.js';
import SerialParser from './core/serialParser.js';
import Updater from './core/updater.js';
import AIControl from './core/ai.js';
import Bme688 from './core/bme688.js';
import 'dotenv/config';

const routes = {
    '/': {
        controllerClass: PagesController,
        controller: 'pages',
        action: 'index',
        method: 'get',
    },
};

// database storage
const sequelize = new Sequelize('sc2024', 'sc2024', 'sc2024', {
    dialect: 'sqlite',
    storage: path.join(process.cwd(), 'sc2024.sqlite'), // or ':memory:'
    dialectOptions: {
        // Your sqlite3 options here
        // for instance, this is how you can configure the database opening mode:
        mode: SQLite.OPEN_READWRITE | SQLite.OPEN_CREATE | SQLite.OPEN_FULLMUTEX,
    },
});
sequelize.sync()
.then(() => {
    console.log("Connection to DB was successful");
})
.catch(err => {
    console.error("Unable to connect to DB", err);
}); 

// load models
const ConfigModel = ConfigModelFn(sequelize);

// Setup config model in database if no config does yet exist
const count = await sequelize.models.Config.count();
if(count === 0) {
    const config = new sequelize.models.Config();
    await config.save();
}

// create
const app = express();
const port = process.env.PORT || 3000;
const mqttPort = process.env.MQTT_PORT || 1883;
const serialPort = process.env.SERIAL_PORT || '/dev/ttyACM0';
const serialBaudRate = !isNaN(Number(process.env.SERIAL_BAUD_RATE)) ? Number(process.env.SERIAL_BAUD_RATE) : 9600;
const serialPortUltrasonic = '/dev/ttyS0'; // Update this to the correct serial port
const serialBaudRateUltrasonic = 9600; // Hardcoded because its defined by the sensor

// instances
let mqttServer; // Will later be the mqtt server instance

// set static path
app.use(express.static('public'));

// setup routes
const routesKeys = Object.keys(routes);
routesKeys.forEach(key => {
    const routeOptions = routes[key];
    app[routeOptions.method](key, async (req, res) => {
        const controller = new routeOptions.controllerClass(req, res, {...routeOptions, ...{db: sequelize}});
        try {
            const fnName = 'action' + routeOptions.action[0].toUpperCase() + routeOptions.action.slice(1);
            await controller[fnName]();
        } catch (error) {
            console.error(error);
        }
    });
});

// start web server with listing on defined port
app.listen(port, () => {
    console.log('Server start: http://localhost:' + port);
});

// initialize updater
const updater = new Updater(sequelize, process.env.UPDATER_URL, process.env.UPDATER_SECRET, 10);
updater.start();

// setup up mqtt + ai control
(async function(){
    try {
        mqttServer = new MQTTBroker({
            db: sequelize
        });
        await mqttServer.start();
    } catch (error) {
        console.log(error);
        process.exit();
    }

    // initialize ai control
    const aiControl = new AIControl({
        db: sequelize,
        mqtt: mqttServer,
    });
    aiControl.start();

    try {
        const environmentSensorParser = new SerialParser(serialPort, serialBaudRate, async (data) => {
            // Check if the serial data is our sensor information
            if(data.includes('SENSOR_START') && data.includes('SENSOR_END')) {
                data = data.replace('SENSOR_START', '').replace('SENSOR_END', '');
                let sensorData;
                // Try to parse JSON from serial data
                try {
                    sensorData = JSON.parse(data);
                } catch(error) {
                    console.log('Parsing sensor data from serial port failed');
                }

                if(sensorData) {
                    sequelize.models.Config.handleEnvironmentUpdate(sensorData);
                }

                // Publish environment sensor data to mqtt
                await mqttServer?.publish('arduinoEnvironment/state', data);
            }
        });
        environmentSensorParser.start();
    } catch(error) {
        console.log(`Failed to open serial port on ${serialPort}`);
    }

    try {
        // Save current distance level in RAM
        let distanceLevel = 0;
        let isDistanceLevelValid = false; // Flag to check if distance level is valid

        // Start up serial parser for ultrasonic sensor
        const ultrasonicSensorParser = new SerialParser(serialPortUltrasonic, serialBaudRateUltrasonic, (buffer) => {
            if (buffer[0] === 0xFF) {
                const hexDistance = (buffer[1] << 8) + buffer[2]; // Properly combine the bytes
                distanceLevel = parseInt(hexDistance, 10);
                isDistanceLevelValid = true; // Set flag to true when a valid distance level is received
            }
        }, {
            parserType: SerialParser.PARSER_TYPES.BYTE_LENGTH,
            parserOptions: {
                length: 4
            }
        });
        ultrasonicSensorParser.start();

        // Check and perform calculation in a loop
        setInterval(async () => {
            if (isDistanceLevelValid) {
                let distanceInPercentage = 100 - Math.min((distanceLevel / 250) * 100, 100); // Proper calculation
                distanceInPercentage = parseFloat(distanceInPercentage.toFixed(2)); // Ensure the value is a number, not a string

                // Save water level to database
                await sequelize.models.Config.handleWaterLevelUpdate(distanceInPercentage);

                // Log the water level data to the terminal
                console.log(`Water Level: ${distanceInPercentage} %`);

                // Publish distance sensor
                await mqttServer?.publish('waterLevelSensor/state', JSON.stringify({
                    waterLevel: distanceInPercentage
                }));

                // Reset the flag until a new valid distance is received
                isDistanceLevelValid = false;
            } else {
                // Reduced frequency for "No data" message
                console.log("No valid distance level received yet. Waiting for data...");
            }
        }, 1000); // Check every 5 seconds
    } catch (error) {
        console.log("Failed to open serial port on ${serialPortUltrasonic}");
    }

    try {
        const bme688 = new Bme688({ interval: 10 },async (data) => {
            // Publish environment sensor data to mqtt
            await mqttServer?.publish('bme688/state', JSON.stringify({
                temperature: data.data.temperature,
                pressure: data.data.pressure,
                humidity: data.data.humidity,
                gasResistance: data.data.gas_resistance
            }));
        });
        bme688.start();
    } catch(error) {
        console.log(`Failed to connect to bme688 sensor`);
    }
})();
