const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')

//TODO: edit path/port
const port = new SerialPort({ path: 'COM13', baudRate: 9600 })

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))

function processData(data){
    //TODO: handel data
    console.log(data)
}

parser.on('data', processData)
