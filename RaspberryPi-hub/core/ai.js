// ai.js

export default class AIControl {
    #opts = {
        lightIntensityThreshold: 500, // Threshold for light to turn on/off
        lightTimeStart: 8 * 60 * 60 * 1000, // 8 AM start time
        lightTimeStop: 20 * 60 * 60 * 1000, // 8 PM stop time
        lightRelayName: 'relay1', // Relay for light
        pumpRelayName: 'relay2', // Relay for pump
        pumpOnTime1: { hour: 9, minute: 0 }, // First pump start time (9 AM)
        pumpOnTime2: { hour: 15, minute: 0 }, // Second pump start time (3 PM)
        pumpDuration: 10 * 60 * 1000 // Pump duration (10 minutes)
    };

    #db = null;
    #mqtt = null;
    #updateInterval = 5; // Interval in seconds
    #intervalId = null;
    #updateRunning = false; // To prevent overlapping executions
    #pumpEndTime1 = null;
    #pumpEndTime2 = null;

    constructor(opts = {}) {
        this.#opts = { ...this.#opts, ...opts };
        this.#db = this.#opts.db;
        this.#mqtt = this.#opts.mqtt;
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
        if (this.#updateRunning) {
            console.log('AI control loop is already running, skipping this interval.');
            return;
        }

        this.#updateRunning = true;

        try {
            const config = await this.#db.models.Config.findOne();

            // Light Control Logic
            const now = new Date();
            const startTime = new Date().setHours(8, 0, 0, 0); // 8 AM
            const stopTime = new Date().setHours(20, 0, 0, 0); // 8 PM
            const lightRelayName = `esp32lr20${this.#opts.lightRelayName.charAt(0).toUpperCase()}${this.#opts.lightRelayName.slice(1)}`;

            if (now >= startTime && now <= stopTime) {
                if (config.lightIntensity >= this.#opts.lightIntensityThreshold && config[lightRelayName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the light: ${lightRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.lightRelayName}/off`, '{}');
                } else if (config.lightIntensity < this.#opts.lightIntensityThreshold && config[lightRelayName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the light: ${lightRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.lightRelayName}/on`, '{}');
                }
            } else {
                if (config[lightRelayName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the light outside time range: ${lightRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.lightRelayName}/off`, '{}');
                }
            }

            // Pump Control Logic
            const pumpRelayName = `esp32lr20${this.#opts.pumpRelayName.charAt(0).toUpperCase()}${this.#opts.pumpRelayName.slice(1)}`;
            const nowTimeInMinutes = now.getHours() * 60 + now.getMinutes();

            const pumpOnTime1 = this.#opts.pumpOnTime1.hour * 60 + this.#opts.pumpOnTime1.minute;
            const pumpOnTime2 = this.#opts.pumpOnTime2.hour * 60 + this.#opts.pumpOnTime2.minute;

            if (nowTimeInMinutes === pumpOnTime1) {
                this.#pumpEndTime1 = new Date(now.getTime() + this.#opts.pumpDuration);
                if (config[pumpRelayName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the pump: ${pumpRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.pumpRelayName}/on`, '{}');
                }
            }

            if (nowTimeInMinutes === pumpOnTime2) {
                this.#pumpEndTime2 = new Date(now.getTime() + this.#opts.pumpDuration);
                if (config[pumpRelayName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the pump: ${pumpRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.pumpRelayName}/on`, '{}');
                }
            }

            // Check and stop the pump
            if (this.#pumpEndTime1 && now >= this.#pumpEndTime1) {
                this.#pumpEndTime1 = null;
                if (config[pumpRelayName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the pump after duration: ${pumpRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.pumpRelayName}/off`, '{}');
                }
            }

            if (this.#pumpEndTime2 && now >= this.#pumpEndTime2) {
                this.#pumpEndTime2 = null;
                if (config[pumpRelayName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the pump after duration: ${pumpRelayName}`);
                    await this.#mqtt.publish(`esp32lr20/cmd/${this.#opts.pumpRelayName}/off`, '{}');
                }
            }
        } catch (error) {
            console.error('Error in AI control loop:', error);
        } finally {
            this.#updateRunning = false;
        }
    }
}
