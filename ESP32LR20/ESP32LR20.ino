#include <Arduino.h> // default lib
#include <WiFi.h> // lib used to handle wifi connetion
#include <PubSubClient.h> // lib used to handle mqtt
#include <EEPROM.h> // lib used to store config files

// GPIO pin defines
#define RELAY_PIN1 33
#define RELAY_PIN2 25

// function overview / pre-declaration for use in other functions
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

// ------ INTERNAL STORE -------
typedef struct
{
    uint8_t valid;  // 0=no configuration, 1=valid configuration
    uint8_t relay1; // stores state of the relay 0 = off / 1 = on
    uint8_t relay2; // stores state of the relay 0 = off / 1 = on
} configData_t;

configData_t config; // stores config

// ------ WIFI DATA -------
const char *wifiSSID = "wall01";
//const char *wifiPassword = "camperfurt";

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

/**
 * This function will create a connection tho the given wifi, 
 * defined in the const variables before
 */
void wifiConnect()
{
    // Connect to the network
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID);

    // print status to serial port
    Serial.print("Connecting to ");
    Serial.print(wifiSSID);
    Serial.println(" ...");

    // try the connection 30 seconds
    int i = 0;
    while (WiFi.status() != WL_CONNECTED)
    { // Wait for the Wi-Fi to connect
        delay(1000);
        Serial.print(++i);
        Serial.print(' ');

        if (i > 30)
        {
            break;
        }
    }
}

/**
 * This function will handle a auto-reconnect to the given wifi
 * with an delay of wifiInterval (Default: 30s) between the next try
 */
void wifiAutoReconnect()
{
    unsigned long currentMillis = millis();
    // if WiFi is down, try reconnecting
    if ((WiFi.status() != WL_CONNECTED) && (currentMillis - wifiPreviousMillis >= wifiInterval))
    {
        Serial.print(millis());
        Serial.println("Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.reconnect();
        wifiPreviousMillis = currentMillis;
    }
}

/**
 * This function will handle connect and reconnect of the mqtt client.
 */
void mqttReconnect()
{
    if (!mqttClient.connected())
    {
        Serial.println("Try to connect MQTT");
        if (mqttClient.connect(mqttClientId, mqttUsername, mqttPassword))
        {
            Serial.println("Public MQTT broker connected!");
            size_t len;
            {
                String key = String(mqttClientId) + "/cmd/relay1/on";
                len = key.length() + 1;
                char strBuffer[len];
                key.toCharArray(strBuffer, len);
                mqttClient.subscribe(strBuffer);
            }
            {
                String key = String(mqttClientId) + "/cmd/relay1/off";
                len = key.length() + 1;
                char strBuffer[len];
                key.toCharArray(strBuffer, len);
                mqttClient.subscribe(strBuffer);
            }
            {
                String key = String(mqttClientId) + "/cmd/relay2/on";
                len = key.length() + 1;
                char strBuffer[len];
                key.toCharArray(strBuffer, len);
                mqttClient.subscribe(strBuffer);
            }
            {
                String key = String(mqttClientId) + "/cmd/relay2/off";
                len = key.length() + 1;
                char strBuffer[len];
                key.toCharArray(strBuffer, len);
                mqttClient.subscribe(strBuffer);
            }
            {
                String key = String(mqttClientId) + "/cmd/state";
                len = key.length() + 1;
                char strBuffer[len];
                key.toCharArray(strBuffer, len);
                mqttClient.subscribe(strBuffer);
            }
        }
        else
        {
            Serial.println("Public MQTT broker not connected! Error: " + mqttClient.state());
            Serial.println(" retrying in 5 seconds");
            mqttPreviousMillis = millis();
        }
    }
}

/**
 * This function will handle a auto-reconnect to the given mqtt broker
 * with an delay of mqttInterval (Default: 5s) between the next try
 */
void mqttAutoReconnect()
{
    // handle reconnect mqtt with a 5 second delay
    if (!mqttClient.connected() && mqttPreviousMillis + mqttInterval < millis())
    {
        mqttReconnect();
    }
}

/**
 * This function will help u to sent messages to the mqtt broker by topic and message text
 */
void mqttPublishMessage(String topic, String msg)
{
    size_t len = topic.length() + 1;
    char topicArray[len];
    topic.toCharArray(topicArray, len);

    size_t lenP = msg.length() + 1;
    char payloadArray[lenP];
    msg.toCharArray(payloadArray, lenP);

    mqttClient.publish(topicArray, payloadArray);
}

/**
 * This function will sent the current relays states (on or off) as json to the mqtt broker
 */
void mqttUpdateState()
{
    String msg = "{\"relay1\":\"";
    msg += (config.relay1 == HIGH ? "on" : "off");
    msg += "\",\"relay2\":\"";
    msg += (config.relay2 == HIGH ? "on" : "off");
    msg += "\"}";
    mqttPublishMessage(String(mqttClientId) + "/state", msg);
}

/**
 * This function will handle all incoming messages by the mqtt broker
 */
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
    else if (topicStr.equals(String(mqttClientId) + "/cmd/state"))
    {
        // do nothing, because the state is sent at the end of this function    
    }

    configSave();
    mqttUpdateState();
}

/**
 * This function will load the stored data from "disc"
 */
void configLoad()
{
    // Loads configuration from EEPROM into RAM
    EEPROM.begin(4095);
    EEPROM.get(0, config);
    EEPROM.end();
}

/**
 * This function will erase the stored data at the "disc"
 */
void configErase()
{
    // Reset EEPROM bytes to '0' for the length of the data structure
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

/**
 * This function will save the stored data to "disc"
 */
void configSave()
{
    config.valid = 1;
    // Save configuration from RAM into EEPROM
    EEPROM.begin(4095);
    EEPROM.put(0, config);
    delay(500);
    EEPROM.commit(); // Only needed for ESP8266 to get data written
    EEPROM.end();    // Free RAM copy of structure
}

/**
 * This function is called after boot by default, it is used to setup all needed stuff for the program
 */
void setup()
{
    Serial.begin(9600);

    // initial setup/load of the config
    configLoad();
    if (config.valid != 1)
    {
        configErase();
    }

    // start wifi connection
    wifiConnect();

    // start mqtt connection
    mqttClient.setClient(mqttWifiClient);
    mqttClient.setServer(mqttBroker, mqttPort);
    mqttClient.setCallback(mqttCallback);

    Serial.println("Start MQTT_Connect");
    mqttReconnect();
    // Print local IP address and start web server
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP()); // show ip address when connected on serial monitor.

    // setup pin modes
    pinMode(RELAY_PIN1, OUTPUT);
    pinMode(RELAY_PIN2, OUTPUT);

    // setup pins by lates config
    digitalWrite(RELAY_PIN1, config.relay1);
    digitalWrite(RELAY_PIN2, config.relay2);

    // initial state send to mqtt broker
    mqttUpdateState();
}

/**
 * This function is called by the esp every round. So here the work will happen!
 */
void loop()
{
    // handle auto reconnect wifi/mqtt if needed
    wifiAutoReconnect();
    mqttAutoReconnect();

    // handle mqtt loop
    mqttClient.loop();

    // send every DELAY a state to MQTT
    if ((millis() - mqttStateTimer) > mqttStateDelay)
    {
        mqttUpdateState();
        mqttStateTimer = millis();
    }
}