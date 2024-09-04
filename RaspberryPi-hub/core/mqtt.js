import net from 'net';
import aedes from 'aedes';

export default class MQTTBroker {
    #opts = {
        port: 1883,
        basicAuth: {
            username: 'admin',
            password: 'root'
        },
    };

    #server = null;
    #aedes  = null;
    #db     = null;

    constructor(opts = {}) {
        this.#opts = { ...this.#opts, ...opts };
        this.#db = this.#opts.db;
        this.#aedes = aedes();
        this.#server = net.createServer(this.#aedes.handle);

        // Authentication
        this.#aedes.authenticate = (client, username, password, callback) => {
            if (username && password) {
                password = Buffer.from(password, 'base64').toString();
                if (username === this.#opts.basicAuth.username && password === this.#opts.basicAuth.password) {
                    return callback(null, true);
                }
            }
            const error = new Error('Authentication Failed! Please enter valid credentials.');
            console.log('Authentication failed.');
            return callback(error, false);
        };

        // Handle publish events
        this.#aedes.on('publish', async (packet, client) => {
            if (client) {
                console.log(`MESSAGE_PUBLISHED: MQTT Client ${client ? client.id : 'AEDES BROKER_' + aedes.id} has published message "${packet.payload}" on ${packet.topic} to aedes broker ${aedes.id}`);

                let payload = null;
                try {
                    payload = JSON.parse(packet.payload);
                } catch (err) {
                    console.log(`PARSING_ERROR: MQTT Payload could not be parsed ${packet.payload}`);
                }

                if (packet.topic.includes('esp32lr20/state')) {
                    // Update relay state based on incoming payload
                    this.#db.models.Config.handleRelaysUpdate(payload);
                }
            }
        });
    }

    async start() {
        return new Promise((res, rej) => {
            this.#server.listen(this.#opts.port, () => {
                console.log('Aedes MQTT server started and listening on port ' + this.#opts.port);
                return res();
            });
        });
    }

    async publish(topic, payload) {
        return new Promise((resolve, reject) => {
            this.#aedes.publish({
                topic: topic,
                payload: payload
            }, (err) => {
                if (err) {
                    console.log(`MQTT failed to publish to topic ${topic}`);
                    console.log(err);
                    reject(err);
                }
                resolve();
            });
        });
    }
}
