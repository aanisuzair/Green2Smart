/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Fri Mar 01 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */

import net from 'net'
import aedes from 'aedes'

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
        this.#opts = Object.assign(this.#opts, opts);
        this.#db = this.#opts.db;
        this.#aedes = aedes();
        this.#server = net.createServer(this.#aedes.handle);

        // authentication
        this.#aedes.authenticate = (client, username, password, callback) => {
            if (username && password) {
                password = Buffer.from(password, 'base64').toString();
                if (username === this.#opts.basicAuth.username && password === this.#opts.basicAuth.password) {
                    return callback(null, true);
                }
            }
            const error = new Error('Authentication Failed!! Please enter valid credentials.');
            console.log('Authentication failed.')
            return callback(error, false)
        }

        // emitted when a client publishes a message packet on the topic
        this.#aedes.on('publish', async (packet, client) => {
            if (client) {
                console.log(`MESSAGE_PUBLISHED : MQTT Client ${(client ? client.id : 'AEDES BROKER_' + aedes.id)} has published message "${packet.payload}" on ${packet.topic} to aedes broker ${aedes.id}`);


                let payload = null;

                // Payload should always be json, try to parse it
                try {
                    payload = JSON.parse(packet.payload);
                } catch(err) {
                    console.log(`PARSING_ERROR : MQTT Payload could not be parsed ${packet.payload}`);
                }

                if(packet.topic.includes('esp32lr20/state')) {
                    // Handle relay update over mqtt
                    this.#db.models.Config.handleRelaysUpdate(payload);
                } else if(packet.topic.includes('esp32hykit/state')) {
                    // Handle hydroponic kit sensor update over mqtt
                    this.#db.models.Config.handleHydroponicsKitUpdate(payload);
                }
            }
        })
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
                if(err) {
                    console.log(`MQTT failed to publish to topic ${topic}`);
                    console.log(err);
                }
                resolve();
            })
        });
    }

}