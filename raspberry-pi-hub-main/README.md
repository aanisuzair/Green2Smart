# Raspberry PI Hub

Node.js based Server with web interface and mqtt. Reached by the IP and the PORT 3000

```
http://<ip>:3000/
```

The MQTT Server runs at port `1883` with the login `admin` and password `root` by default.

# Getting Started

Just install all node modules with `npm install`. 

Then run the program in dev with `npm run develop` or in production with `node start`

# ENV-Variables

`.env example`
```javascript
UPDATER_URL="https://sc24.ve-plant.com/teamXX" // used for updates team number XX should be changed
UPDATER_SECRET="secret" // used for checksum
PORT=3000 // web port
MQTT_PORT=1883 // mqtt default port
SERIAL_PORT="COM8" // used for nano sense
SERIAL_BAUD_RATE="9600" // used to read on the com port
```