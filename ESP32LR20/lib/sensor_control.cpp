#include "sensor_control.h"
SensorControl sensorControl;

void SensorControl::initSensors(){
    HS300x.begin();
    BARO.begin();
    PDM.onReceive(onPDMdata);
    APDS.begin();
    //1 for mono, 2 for stereo
    //16000 the sample rate to use in Hz
    PDM.begin(1, 16000);
 }

float SensorControl::readTemperature(){
    return HS300x.readTemperature();
}

float SensorControl::readHumidity(){
    return HS300x.readHumidity();
}

float SensorControl::readPressure(){
    return BARO.readPressure();
}

float SensorControl::readBrightness() {
    if(APDS.colorAvailable()) {
        int r = 0;
        int g = 0;
        int b = 0;
        APDS.readColor(r, g, b);
        // Calculate brightness in lux from rgb values
        lastBrightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    } else {
        return lastBrightness;
    }
}

void SensorControl::onPDMdata() {
  // query the number of bytes available
  int bytesAvailable = PDM.available();

  // read into the sample buffer
  PDM.read(sensorControl.sampleBuffer, bytesAvailable);
  sensorControl.samplesRead = bytesAvailable / 2;
}