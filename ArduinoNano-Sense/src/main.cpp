#include <Arduino.h>
#include "sensor_control.h"

void printSensorData();

void setup() {
    Serial.begin(9600);
    Serial.println("start Sensors...");
    sensorControl.initSensors();
}

void loop() {
    printSensorData();
    delay(5000); // Only Print values all 5 Seconds
}

void printSensorData() {
    String message = "SENSOR_START{\"temp\":\"";
    message += String(sensorControl.readTemperature(), 2);
    message += "\",\"humidity\":\"";
    message += String(sensorControl.readHumidity(), 2);
    message += "\",\"pressure\":\"";
    message += String(sensorControl.readPressure(), 2);
    message += "\",\"microphone\":\"";
    message += String(sensorControl.sampleBuffer[0]);
    sensorControl.samplesRead = 0;
    message += "\",\"brightness\":\"";
    message += String(sensorControl.readBrightness(), 2);
    message += "\"}SENSOR_END";
    
    Serial.println(message);
}
