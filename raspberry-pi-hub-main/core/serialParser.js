import {ByteLengthParser, SerialPort} from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export default class SerialParser {

    static PARSER_TYPES = {
        READLINE: ReadlineParser,
        BYTE_LENGTH: ByteLengthParser
    }

    #parser;
    #dataCallback;
    #serialPort;
    #baudRate;
    #parserType;
    #parserOptions;

    constructor(serialPort, baudRate, dataCallback, opts = {parserType: this.constructor.PARSER_TYPES.READLINE, parserOptions: {delimiter: '\r\n'}}) {
        this.#dataCallback = dataCallback;
        this.#serialPort = serialPort;
        this.#baudRate = baudRate;
        this.#parserType = opts.parserType || ReadlineParser;
        this.#parserOptions = opts.parserOptions || {delimiter: '\r\n'};
    }

    start() {
        const port = new SerialPort({ path: this.#serialPort, baudRate: this.#baudRate });
        port.on('error', error => {
            console.error(`Failed to open serial port on ${this.#serialPort}, no device found`);
        });
        this.#parser = port.pipe(new this.#parserType(this.#parserOptions));
        this.#parser.on('data', this.#dataCallback);
        this.#parser.on('error', error => {
            console.log('Failed to read from serial port on '+ this.#serialPort);
        });
        console.log(`Starting SerialParser on port ${this.#serialPort} with baud rate ${this.#baudRate}`);
    }

}