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

// Database setup
const sequelize = new Sequelize('sc2024', 'sc2024', 'sc2024', {
    dialect: 'sqlite',
    storage: path.join(process.cwd(), 'sc2024.sqlite'),
    dialectOptions: {
        mode: SQLite.OPEN_READWRITE | SQLite.OPEN_CREATE | SQLite.OPEN_FULLMUTEX,
    },
});
await sequelize.sync().then(() => {
    console.log("Connection to DB was successful");
}).catch(err => {
    console.error("Unable to connect to DB", err);
});

// Load models
const ConfigModel = ConfigModelFn(sequelize);

// Setup config model in database if no config exists
const count = await sequelize.models.Config.count();
if(count === 0) {
    const config = new sequelize.models.Config();
    await config.save();
}

// Create and configure Express app
const app = express();
const port = process.env.PORT || 3000;
const mqttPort = process.env.MQTT_PORT || 1883;
const serialPort = process.env.SERIAL_PORT || '/dev/ttyACM0';
const serialBaudRate = !isNaN(Number(process.env.SERIAL_BAUD_RATE)) ? Number(process.env.SERIAL_BAUD_RATE) : 9600;
const serialPortUltrasonic = '/dev/ttyS0';
const serialBaudRateUltrasonic = 9600;

// Set static path
app.use(express.static('public'));

// Initialize updater
const updater = new Updater(sequelize, process.env.UPDATER_URL, process.env.UPDATER_SECRET, 10);
updater.start();

// Setup MQTT and AI control
(async function() {
    try {
        const mqttServer = new MQTTBroker({ db: sequelize });
        await mqttServer.start();

        const aiControl = new AIControl({ db: sequelize, mqtt: mqttServer });
        aiControl.start();

        // Serial parser for environment sensors
        const environmentSensorParser = new SerialParser(serialPort, serialBaudRate, async (data) => {
            if(data.includes('SENSOR_START') && data.includes('SENSOR_END')) {
                data = data.replace('SENSOR_START', '').replace('SENSOR_END', '');
                try {
                    const sensorData = JSON.parse(data);
                    sequelize.models.Config.handleEnvironmentUpdate(sensorData);
                    await mqttServer.publish('arduinoEnvironment/state', data);
                } catch (error) {
                    console.log('Parsing sensor data from serial port failed');
                }
            }
        });
        environmentSensorParser.start();

        // Serial parser for ultrasonic sensors
        const ultrasonicSensorParser = new SerialParser(serialPortUltrasonic, serialBaudRateUltrasonic, (buffer) => {
            if (buffer[0] === 0xFF) {
                const hexDistance = (buffer[1] << 8) + buffer[2];
                const distanceLevel = parseInt(hexDistance, 10);
                const distanceInPercentage = 100 - Math.min((distanceLevel / 250) * 100, 100);
                sequelize.models.Config.handleWaterLevelUpdate(parseFloat(distanceInPercentage.toFixed(2)));
                await mqttServer.publish('waterLevelSensor/state', JSON.stringify({ waterLevel: distanceInPercentage }));
            }
        }, { parserType: SerialParser.PARSER_TYPES.BYTE_LENGTH, parserOptions: { length: 4 } });
        ultrasonicSensorParser.start();

        // Initialize BME688 sensor
        const bme688 = new Bme688({ interval: 10 }, async (data) => {
            await mqttServer.publish('bme688/state', JSON.stringify({
                temperature: data.data.temperature,
                pressure: data.data.pressure,
                humidity: data.data.humidity,
                gasResistance: data.data.gas_resistance
            }));
        });
        bme688.start();

    } catch (error) {
        console.error('Initialization error:', error);
        process.exit(1);
    }
})();

// Start Express server
app.listen(port, () => {
    console.log(`Server started: http://localhost:${port}`);
});
