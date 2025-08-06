#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <EEPROM.h>

// GPIO pin defines
#define RELAY_PIN1 33
#define RELAY_PIN2 25

// ------ INTERNAL STORE -------
typedef struct
{
    uint8_t valid;  // 0=no configuration, 1=valid configuration
    uint8_t relay1; // stores state of the relay 0 = off / 1 = on
    uint8_t relay2; // stores state of the relay 0 = off / 1 = on
} configData_t;

configData_t config; // stores config

// ------ WIFI DATA -------
const char *wifiSSID = "wall02";
unsigned long wifiPreviousMillis = 0;
unsigned long wifiInterval = 30000;

// ------ MQTT DATA -------
const char *mqttBroker = "10.42.0.1";
const char *mqttClientId = "esp32lr20";
const char *mqttUsername = "admin";
const char *mqttPassword = "root";
const int mqttPort = 1883;
WiFiClient mqttWifiClient;
PubSubClient mqttClient;

unsigned long mqttPreviousMillis = 0;
unsigned long mqttInterval = 5000;
unsigned long mqttStateDelay = 10000;
unsigned long mqttStateTimer = 0;

// Function declarations
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

void wifiConnect()
{
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID);

    Serial.print("Connecting to ");
    Serial.print(wifiSSID);
    Serial.println(" ...");

    int i = 0;
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(1000);
        Serial.print(++i);
        Serial.print(' ');
        if (i > 30)
        {
            break;
        }
    }
}

void wifiAutoReconnect()
{
    unsigned long currentMillis = millis();
    if ((WiFi.status() != WL_CONNECTED) && (currentMillis - wifiPreviousMillis >= wifiInterval))
    {
        Serial.print(millis());
        Serial.println(" Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.reconnect();
        wifiPreviousMillis = currentMillis;
    }
}

void mqttReconnect()
{
    if (!mqttClient.connected())
    {
        Serial.println("Try to connect MQTT");
        if (mqttClient.connect(mqttClientId, mqttUsername, mqttPassword))
        {
            Serial.println("MQTT broker connected!");

            String topics[] = {
                "/cmd/relay1/on", "/cmd/relay1/off",
                "/cmd/relay2/on", "/cmd/relay2/off",
                "/cmd/state"
            };

            for (String t : topics)
            {
                String fullTopic = String(mqttClientId) + t;
                char buffer[fullTopic.length() + 1];
                fullTopic.toCharArray(buffer, sizeof(buffer));
                mqttClient.subscribe(buffer);
            }
        }
        else
        {
            Serial.print("MQTT connection failed, state: ");
            Serial.println(mqttClient.state());
            mqttPreviousMillis = millis();
        }
    }
}

void mqttAutoReconnect()
{
    if (!mqttClient.connected() && mqttPreviousMillis + mqttInterval < millis())
    {
        mqttReconnect();
    }
}

void mqttPublishMessage(String topic, String msg)
{
    char topicArray[topic.length() + 1];
    char payloadArray[msg.length() + 1];

    topic.toCharArray(topicArray, sizeof(topicArray));
    msg.toCharArray(payloadArray, sizeof(payloadArray));

    mqttClient.publish(topicArray, payloadArray);
}

void mqttUpdateState()
{
    String msg = "{\"relay1\":\"";
    msg += (digitalRead(RELAY_PIN1) == HIGH ? "on" : "off");
    msg += "\",\"relay2\":\"";
    msg += (digitalRead(RELAY_PIN2) == HIGH ? "on" : "off");
    msg += "\"}";

    mqttPublishMessage(String(mqttClientId) + "/state", msg);

    // Debugging
    Serial.printf("MQTT State Updated: relay1=%d (pin=%d), relay2=%d (pin=%d)\n",
                  config.relay1, digitalRead(RELAY_PIN1),
                  config.relay2, digitalRead(RELAY_PIN2));
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    Serial.print("Incoming message [");
    Serial.print(topic);
    Serial.print("]: ");
    for (unsigned int i = 0; i < length; ++i)
    {
        Serial.print((char)payload[i]);
    }
    Serial.println();

    String topicStr = String(topic);

    if (topicStr.equals(String(mqttClientId) + "/cmd/relay1/on"))
    {
        digitalWrite(RELAY_PIN1, HIGH);
        config.relay1 = HIGH;
    }
    else if (topicStr.equals(String(mqttClientId) + "/cmd/relay1/off"))
    {
        digitalWrite(RELAY_PIN1, LOW);
        config.relay1 = LOW;
    }
    else if (topicStr.equals(String(mqttClientId) + "/cmd/relay2/on"))
    {
        digitalWrite(RELAY_PIN2, HIGH);
        config.relay2 = HIGH;
    }
    else if (topicStr.equals(String(mqttClientId) + "/cmd/relay2/off"))
    {
        digitalWrite(RELAY_PIN2, LOW);
        config.relay2 = LOW;
    }

    configSave();
    mqttUpdateState();
}

void configLoad()
{
    EEPROM.begin(4095);
    EEPROM.get(0, config);
    EEPROM.end();
}

void configErase()
{
    EEPROM.begin(4095);
    uint16_t len = sizeof(config);
    for (int i = 0; i < len; i++)
    {
        EEPROM.write(i, 0);
    }
    delay(500);
    EEPROM.commit();
    EEPROM.end();
}

void configSave()
{
    config.valid = 1;
    EEPROM.begin(4095);
    EEPROM.put(0, config);
    delay(500);
    EEPROM.commit();
    EEPROM.end();
}

void setup()
{
    Serial.begin(9600);

    configLoad();
    if (config.valid != 1)
    {
        config.relay1 = LOW;
        config.relay2 = LOW;
        configSave();
    }

    wifiConnect();

    mqttClient.setClient(mqttWifiClient);
    mqttClient.setServer(mqttBroker, mqttPort);
    mqttClient.setCallback(mqttCallback);

    Serial.println("Start MQTT_Connect");
    mqttReconnect();

    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());

    pinMode(RELAY_PIN1, OUTPUT);
    pinMode(RELAY_PIN2, OUTPUT);

    digitalWrite(RELAY_PIN1, config.relay1);
    digitalWrite(RELAY_PIN2, config.relay2);

    mqttUpdateState(); rpi
    
}

void loop()
{
    wifiAutoReconnect();
    mqttAutoReconnect();

    mqttClient.loop();

    if ((millis() - mqttStateTimer) > mqttStateDelay)
    {
        mqttUpdateState();
        mqttStateTimer = millis();
    }
}
