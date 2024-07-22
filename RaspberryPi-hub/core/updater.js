/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Thu Mar 07 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */

import axios from 'axios';
import crypto from 'node:crypto';

/**
 * This class will handle update of values every 10 seconds to the Dashboard.
 */
export default class Update {

    #db = null;
    #updateUrl ="https://sc2024.ve-plant.com/teams/team02";
    #secret ="cvAh3913!avkg#23AD";
    #updateInterval = 10;
    #intervalId = null;
    #updateRunning = false; // if request is running, the interval will not trigged

    /**
     * Initialize the Cron-Job to update the dashboard service
     * @param {*} db sequelize database object
     * @param {String} updateUrl Update url of the dashboard includes the team id
     * @param {String} secret Team secret code for the update
     * @param {Integer} interval Default: 10s
     */
    constructor(db, updateUrl, secret, interval = 10) {
        this.#db = db;
        this.#updateUrl = updateUrl;
        this.#secret = secret;
        this.#updateInterval = interval;
    }

    start() {
        this.#intervalId = setInterval(async () => {
            await this.#loop();
        }, 1000 * this.#updateInterval);
    }

    stop() {
        clearInterval(this.#intervalId);
    }

    async #loop() {
        // do nothing
        if (this.#updateRunning === true) {
            return;
        }

        console.log('run update of values to the dashboard');
        this.#updateRunning = true;

        try {
            const config = await this.#db.models.Config.findOne();
            const relay1Val = config.esp32lr20Relay1?.toLowerCase() === 'on'? 1 : 0;
            const relay2Val = config.esp32lr20Relay2?.toLowerCase() === 'on'? 1 : 0;
            const payload = {
                team: {
                    relay1: relay1Val,
                    relay2: relay2Val,
                    ec: config.hydroponicsKitEc,
                    ph: config.hydroponicsKitPh,
                    lightIntensity: config.lightIntensity,
                    temperature: config.environmentTemperature,
                    waterLevel: config.waterLevel,
                }
            };

            // create checksum in correct direction of values
            const timestamp = parseInt(Date.now() / 1000);
            let checksumMsg = String(timestamp);
            checksumMsg += String((relay1Val !== null || relay1Val !== void 0) ? relay1Val : '');
            checksumMsg += String((relay2Val !== null || relay2Val !== void 0) ? relay2Val : '');
            checksumMsg += String(config.hydroponicsKitEc ?? '');
            checksumMsg += String(config.hydroponicsKitPh ?? '');
            checksumMsg += String(config.lightIntensity ?? '');
            checksumMsg += String(config.environmentTemperature ?? '');
            checksumMsg += String(config.waterLevel ?? '');
            checksumMsg += this.#secret;
            const hash = crypto.createHash('sha1');
            let checksum = hash.update(checksumMsg, 'utf-8').digest('hex');
            
            // set update to dashboard
            axios.put(this.#updateUrl + '?t=' + timestamp + '&c=' + checksum, payload)
                .then((response) => {
                    this.#updateRunning = false;
                })
                .catch((error) => {
                    console.log('Could not run update to dashboard');
                    this.#updateRunning = false;
                });
        } catch (error) {
            console.log('Could not run update to dashboard');
            this.#updateRunning = false;
        }
    }
}