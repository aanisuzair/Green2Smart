import pkg from 'bme680-sensor';

const { Bme680 } = pkg;

const bme680 = new Bme680(1, 0x77);

export default class Bme688 {
    #onDataCallback;
    #interval = 10;

    /**
     *
     * @param {Object} opts
     * @param {Number} opts.interval - Interval to check for new data in seconds
     * @param {Function} onDataCallback - Function to call when new data is available
     */
    constructor(opts = { interval: 10 }, onDataCallback) {
        this.#onDataCallback = onDataCallback;
        this.#interval = opts.interval * 1000;
    }

    start() {
        bme680.initialize().then(async () => {
            console.info('BME688 Sensor initialized');
            setInterval(async () => {
                this.#onDataCallback(await bme680.getSensorData());
            }, this.#interval);
        });
    }

}