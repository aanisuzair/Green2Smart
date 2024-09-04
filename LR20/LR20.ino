#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <EEPROM.h>

// GPIO pin defines
#define RELAY_PIN1 33 // Light relay
#define RELAY_PIN2 25 // Pump relay

// Function pre-declarations
void wifiConnect();
void wifiAutoReconnect();
void mqttReconnect();
void mqttPublishMessage(String topic, String msg);
void mqttUpdateState();
void mqttAutoReconnect();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void configLoad();
void configErase();
void configSave();

// INTERNAL STORE
typedef struct {
    uint8_t valid;  // 0=no configuration, 1=valid configuration
    uint8_t relay1; // Relay1 state: 0=off, 1=on (Light)
    uint8_t relay2; // Relay2 state: 0=off, 1=on (Pump)
} configData_t;

configData_t config; // Config storage

// WIFI DATA
const char *wifiSSID = "wall01";
//const char *wifiPassword = "camperfurt";

unsigned long wifiPreviousMillis = 0;
unsigned long wifiInterval = 30000; // WiFi reconnect interval

// MQTT DATA
const char *mqttBroker = "10.42.0.1";
const char *mqttClientId = "esp32lr20";
const char *mqttUsername = "admin";
const char *mqttPassword = "root";
const int mqttPort = 1883;

WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);
unsigned long mqttPreviousMillis = 0;
unsigned long mqttInterval = 5000;
unsigned long mqttStateDelay = 10000;
unsigned long mqttStateTimer = 0;

void wifiConnect() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID);

    Serial.print("Connecting to ");
    Serial.print(wifiSSID);
    Serial.println(" ...");

    int i = 0;
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(++i);
        Serial.print(' ');

        if (i > 30) {
            break;
        }
    }
}

void wifiAutoReconnect() {
    unsigned long currentMillis = millis();
    if ((WiFi.status() != WL_CONNECTED) && (currentMillis - wifiPreviousMillis >= wifiInterval)) {
        Serial.print(millis());
        Serial.println(" Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.reconnect();
        wifiPreviousMillis = currentMillis;
    }
}

void mqttReconnect() {
    if (!mqttClient.connected()) {
        Serial.println("Connecting to MQTT broker...");
        if (mqttClient.connect(mqttClientId, mqttUsername, mqttPassword)) {
            Serial.println("MQTT broker connected!");
            // Subscribe to MQTT topics for relay control
            mqttClient.subscribe((String(mqttClientId) + "/cmd/relay1/on").c_str());
            mqttClient.subscribe((String(mqttClientId) + "/cmd/relay1/off").c_str());
            mqttClient.subscribe((String(mqttClientId) + "/cmd/relay2/on").c_str());
            mqttClient.subscribe((String(mqttClientId) + "/cmd/relay2/off").c_str());
            mqttClient.subscribe((String(mqttClientId) + "/cmd/state").c_str());
        } else {
            Serial.print("MQTT connection failed, rc=");
            Serial.print(mqttClient.state());
            Serial.println(" try again in 5 seconds");
            mqttPreviousMillis = millis();
        }
    }
}

void mqttAutoReconnect() {
    if (!mqttClient.connected() && (millis() - mqttPreviousMillis >= mqttInterval)) {
        mqttReconnect();
    }
}

void mqttPublishMessage(String topic, String msg) {
    mqttClient.publish(topic.c_str(), msg.c_str());
}

void mqttUpdateState() {
    // Publish current relay states
    String msg = "{\"relay1\":\"" + String(config.relay1 == HIGH ? "on" : "off") + "\",\"relay2\":\"" + String(config.relay2 == HIGH ? "on" : "off") + "\"}";
    mqttPublishMessage(String(mqttClientId) + "/state", msg);
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
    String message = "";
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    Serial.print("Received message [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(message);

    String topicStr = String(topic);
    if (topicStr.equals(String(mqttClientId) + "/cmd/relay1/on")) {
        digitalWrite(RELAY_PIN1, HIGH);
        config.relay1 = HIGH;
    } else if (topicStr.equals(String(mqttClientId) + "/cmd/relay1/off")) {
        digitalWrite(RELAY_PIN1, LOW);
        config.relay1 = LOW;
    } else if (topicStr.equals(String(mqttClientId) + "/cmd/relay2/on")) {
        digitalWrite(RELAY_PIN2, HIGH);
        config.relay2 = HIGH;
    } else if (topicStr.equals(String(mqttClientId) + "/cmd/relay2/off")) {
        digitalWrite(RELAY_PIN2, LOW);
        config.relay2 = LOW;
    } else if (topicStr.equals(String(mqttClientId) + "/cmd/state")) {
        // State is published at the end of this function
    }

    configSave();
    mqttUpdateState();
}

void configLoad() {
    EEPROM.begin(4095);
    EEPROM.get(0, config);
    EEPROM.end();
}

void configErase() {
    EEPROM.begin(4095);
    for (int i = 0; i < sizeof(config); i++) {
        EEPROM.write(i, 0);
    }
    delay(500);
    EEPROM.commit();
    EEPROM.end();
}

void configSave() {
    config.valid = 1;
    EEPROM.begin(4095);
    EEPROM.put(0, config);
    delay(500);
    EEPROM.commit();
    EEPROM.end();
}

void setup() {
    Serial.begin(115200);
    configLoad();
    if (config.valid != 1) {
        configErase();
    }

    wifiConnect();

    mqttClient.setServer(mqttBroker, mqttPort);
    mqttClient.setCallback(mqttCallback);

    Serial.println("Initializing MQTT connection...");
    mqttReconnect();

    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());

    pinMode(RELAY_PIN1, OUTPUT);
    pinMode(RELAY_PIN2, OUTPUT);

    digitalWrite(RELAY_PIN1, config.relay1);
    digitalWrite(RELAY_PIN2, config.relay2);

    mqttUpdateState();
}

void loop() {
    wifiAutoReconnect();
    mqttAutoReconnect();
    mqttClient.loop();

    // Send the current state to MQTT at regular intervals
    if ((millis() - mqttStateTimer) > mqttStateDelay) {
        mqttUpdateState();
        mqttStateTimer = millis();
    }
}
