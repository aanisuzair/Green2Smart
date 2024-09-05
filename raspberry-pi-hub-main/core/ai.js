export default class AIControl {
    #opts = {
        lightIntensityThreshold: 800, // Default: 800 when should the light turn on/off if the sun is bright enough
        lightTimeStart: 8 * 60 * 60 * 1000, // Default: 8am when should the light start (time / clock) in milliseconds
        lightTimeStop: 20 * 60 * 60 * 1000, // Default: 8pm when should the light stop (time / clock) in milliseconds
        lightRelayName: 'relay2', // Corrected: relay2 is the name of the light used for mqtt
        pumpRelayName: 'relay1', // Corrected: relay1 is the name of the pump used for mqtt
        pumpOnTime1: { hour: 8, minute: 0 }, // First pump start time (8 AM)
        pumpOnTime2: { hour: 16, minute: 0 }, // Second pump start time (4 PM)
        pumpDuration: 7 * 60 * 1000 // Pump duration in milliseconds (7 minutes)
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
        if (this.#updateRunning === true) {
            console.log('AI control loop is already running, skipping this interval.');
            return;
        }

        this.#updateRunning = true;

        console.log('run ai control loop');

        try {
            const config = await this.#db.models.Config.findOne();

            // Light Control Logic
            this.#handleLightControl(config);

            // Pump Control Logic
            this.#handlePumpControl(config);

        } catch (error) {
            console.log(error);
        } finally {
            this.#updateRunning = false;
        }
    }

    #handleLightControl(config) {
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

        if (dateStart <= now && dateStop >= now) {
            if (config.lightIntensity >= this.#opts.lightIntensityThreshold) {
                if (config[lightConfigName]?.toLowerCase() === 'on') {
                    console.log(`Turning off the light: ${lightConfigName}`);
                    this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/off', '{}');
                }
            } else {
                if (config[lightConfigName]?.toLowerCase() === 'off') {
                    console.log(`Turning on the light: ${lightConfigName}`);
                    this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/on', '{}');
                }
            }
        } else {
            if (config[lightConfigName]?.toLowerCase() === 'on') {
                console.log(`Turning off the light outside time range: ${lightConfigName}`);
                this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/off', '{}');
            }
        }
    }

    #handlePumpControl(config) {
        const now = new Date();
        const nowTime = now.getHours() * 60 + now.getMinutes();
        const pumpOnTime1 = this.#opts.pumpOnTime1.hour * 60 + this.#opts.pumpOnTime1.minute;
        const pumpOnTime2 = this.#opts.pumpOnTime2.hour * 60 + this.#opts.pumpOnTime2.minute;
        const pumpConfigName = 'esp32lr20' + this.#opts.pumpRelayName.charAt(0).toLocaleUpperCase() + this.#opts.pumpRelayName.slice(1);

        // Ensure pump is off outside of scheduled times
        if ((nowTime < pumpOnTime1 || nowTime >= pumpOnTime1 + this.#opts.pumpDuration / (60 * 1000)) &&
            (nowTime < pumpOnTime2 || nowTime >= pumpOnTime2 + this.#opts.pumpDuration / (60 * 1000))) {
            if (config[pumpConfigName]?.toLowerCase() === 'on') {
                console.log(`Turning off the pump outside scheduled times: ${pumpConfigName}`);
                this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/off', '{}');
            }
        }

        // Check if it's time to start the pump
        if (nowTime >= pumpOnTime1 && nowTime < pumpOnTime1 + this.#opts.pumpDuration / (60 * 1000)) {
            if (config[pumpConfigName]?.toLowerCase() === 'off') {
                console.log(`Turning on the pump: ${pumpConfigName}`);
                this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/on', '{}');
            }
        }

        if (nowTime >= pumpOnTime2 && nowTime < pumpOnTime2 + this.#opts.pumpDuration / (60 * 1000)) {
            if (config[pumpConfigName]?.toLowerCase() === 'off') {
                console.log(`Turning on the pump: ${pumpConfigName}`);
                this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/on', '{}');
            }
        }
    }
}
