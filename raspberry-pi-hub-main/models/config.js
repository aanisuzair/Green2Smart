/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Wed Feb 28 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */

import { DataTypes } from 'sequelize';


export default (sequelize) => {
    const Config = sequelize.define('Config', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        esp32lr20Relay1: DataTypes.STRING,
        esp32lr20Relay2: DataTypes.STRING,
        hydroponicsKitTemperature: DataTypes.FLOAT,
        hydroponicsKitPh: DataTypes.FLOAT,
        hydroponicsKitEc: DataTypes.FLOAT,
        environmentTemperature: DataTypes.FLOAT,
        environmentHumidity: DataTypes.FLOAT,
        environmentPressure: DataTypes.FLOAT,
        environmentMicrophone: DataTypes.INTEGER,
        lightIntensity: DataTypes.FLOAT,
        waterLevel: DataTypes.FLOAT,
    });

    Config.handleHydroponicsKitUpdate = async function (payload) {
        let config = await this.findOne();

        // Create config from scratch if it does not exist
        if (!config) {
            config = new this.constructor();
        }

        config.hydroponicsKitTemperature = payload.temp;
        config.hydroponicsKitPh = payload.ph;
        config.hydroponicsKitEc = payload.ec;

        await config.save();
    }
    Config.handleRelaysUpdate = async function (payload) {
        let config = await this.findOne();

        // Create config from scratch if it does not exist
        if (!config) {
            config = new this.constructor();
        }

        config.esp32lr20Relay1 = payload.relay1;
        config.esp32lr20Relay2 = payload.relay2;

        await config.save();
    }

    Config.handleEnvironmentUpdate = async function (payload) {
        let config = await this.findOne();

        // Create config from scratch if it does not exist
        if (!config) {
            config = new this.constructor();
        }

        config.environmentTemperature = payload.temp;
        config.environmentHumidity = payload.humidity;
        config.environmentPressure = payload.pressure;
        config.environmentMicrophone = payload.microphone;
        config.lightIntensity = payload.brightness;

        await config.save();
    }

    Config.handleWaterLevelUpdate = async function(distanceLevel) {
        let config = await this.findOne();

        // Create config from scratch if it does not exist
        if (!config) {
            config = new this.constructor();
        }

        config.waterLevel = distanceLevel;

        await config.save();
    }

    return Config;
};