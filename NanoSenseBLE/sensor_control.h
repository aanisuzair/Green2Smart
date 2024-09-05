#ifndef SENSOR_CONTROL
#define SENSOR_CONTROL
#include <Arduino_HS300x.h>
#include <Arduino_LPS22HB.h>
#include <PDM.h>
#include <Arduino_APDS9960.h>
#include <math.h>

class SensorControl{
    static void onPDMdata();
    public:
    short sampleBuffer[256];
    volatile int samplesRead;

    void initSensors();

    float readTemperature();
    float readHumidity();
    float readPressure();
    float readBrightness();

    private:
    float lastBrightness = 0.0;
};

extern SensorControl sensorControl;
#endif