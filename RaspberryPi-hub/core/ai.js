export default class AIControl {

    #opts = {
        lightIntensityThreshold: 500, // Default: 500 when should the light turn on/off if the sun is bright enough
        lightTimeStart: 8 * 60 * 60 * 1000, // Default: 8am when should the light start (time / clock) in milliseconds
        lightTimeStop: 20 * 60 * 60 * 1000, // Default: 8pm when should the light stop (time / clock) in milliseconds
        lightRelayName: 'relay1', // relay1 is the name of the pump used for mqtt
        pumpRelayName: 'relay2', // relay2 is the name of the light used for mqtt
        pumpOnTime1: { hour: 9, minute: 0 }, // First pump start time (9 AM)
        pumpOnTime2: { hour: 15, minute: 0 }, // Second pump start time (3 PM)
        pumpDuration: 10 * 60 * 1000 // Pump duration in milliseconds (5 minutes)
    };
    #db = null;
    #mqtt = null;
    #updateInterval = 5;
    #intervalId = null;
    #updateRunning = false; // if request is running, the interval will not be triggered
    #pumpEndTime1 = null;
    #pumpEndTime2 = null;

    constructor(opts = {}) {
        this.#opts = Object.assign(this.#opts, opts);
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
        // do nothing
        if (this.#updateRunning === true) {
            console.log('AI control loop is already running, skipping this interval.');
            return;
        }

        this.#updateRunning = true;

        console.log('run ai control loop');

        try {
            const config = await this.#db.models.Config.findOne();

            // check light turn on off
            const now = new Date();
            const dateStart = new Date();
            const dateStop = new Date();
            
            // set time in start and end date
            dateStart.setHours(8, 0, 0, 0); // 8 AM
            dateStop.setHours(20, 0, 0, 0); // 8 PM

            console.log(`Current time: ${now}`);
            console.log(`Light time range: ${dateStart} to ${dateStop}`);
            console.log(`Current light intensity: ${config.lightIntensity}`);
            const lightConfigName = 'esp32lr20' + this.#opts.lightRelayName.charAt(0).toLocaleUpperCase() + this.#opts.lightRelayName.slice(1);
            console.log(`Light relay state: ${config[lightConfigName]}`);

            // check light can be lighted in time?
            if (dateStart <= now && dateStop >= now) {
                if (config.lightIntensity >= this.#opts.lightIntensityThreshold) {
                    if (config[lightConfigName]?.toLowerCase() === 'on') {
                        // Turn off the light if the intensity is above the threshold
                        console.log(`Turning off the light: ${lightConfigName}`);
                        await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/off', '{}');
                    }
                } else {
                    if (config[lightConfigName]?.toLowerCase() === 'off') {
                        // Turn on the light if the intensity is below the threshold
                        console.log(`Turning on the light: ${lightConfigName}`);
                        await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/on', '{}');
                    }
                }
            } else {
                // Ensure the light is off outside the specified time range
                if (config[lightConfigName]?.toLowerCase() === 'on') {
                    // Turn off the light if outside the specified time range
                    console.log(`Turning off the light outside time range: ${lightConfigName}`);
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/off', '{}');
                }
            }

            // Pump logic
            const pumpConfigName = 'esp32lr20' + this.#opts.pumpRelayName.charAt(0).toLocaleUpperCase() + this.#opts.pumpRelayName.slice(1);
            console.log(`Pump relay state: ${config[pumpConfigName]}`);
            const nowHours = now.getHours();
            const nowMinutes = now.getMinutes();
            const nowTime = nowHours * 60 + nowMinutes;

            const pumpOnTime1 = this.#opts.pumpOnTime1.hour * 60 + this.#opts.pumpOnTime1.minute;
            const pumpOnTime2 = this.#opts.pumpOnTime2.hour * 60 + this.#opts.pumpOnTime2.minute;

            // Check if it's time to start the pump
            if (nowTime === pumpOnTime1) {
                this.#pumpEndTime1 = new Date(now.getTime() + this.#opts.pumpDuration);
                if (config[pumpConfigName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the pump: ${pumpConfigName}`);
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/on', '{}');
                }
            }

            if (nowTime === pumpOnTime2) {
                this.#pumpEndTime2 = new Date(now.getTime() + this.#opts.pumpDuration);
                if (config[pumpConfigName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the pump: ${pumpConfigName}`);
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/on', '{}');
                }
            }

            // Check if it's time to stop the pump
            if (this.#pumpEndTime1 && now >= this.#pumpEndTime1) {
                this.#pumpEndTime1 = null;
                if (config[pumpConfigName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the pump after duration: ${pumpConfigName}`);
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/off', '{}');
                }
            }

            if (this.#pumpEndTime2 && now >= this.#pumpEndTime2) {
                this.#pumpEndTime2 = null;
                if (config[pumpConfigName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the pump after duration: ${pumpConfigName}`);
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/off', '{}');
                }
            }

        } catch (error) {
            console.log(error);
        } finally {
            this.#updateRunning = false;
        }
    }
}
