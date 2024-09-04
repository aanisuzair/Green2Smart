#include <WiFi.h>
#include <PubSubClient.h>

#define RELAY1_PIN 33 // GPIO pin connected to Relay 1
#define RELAY2_PIN 25 // GPIO pin connected to Relay 2

// WiFi and MQTT settings
const char* ssid = "wall01";
//const char* password = "your_PASSWORD";
const char* mqtt_server = "10.42.0.1"; // IP address of your MQTT broker
const int mqtt_port = 1883;
const char* mqtt_user = "admin"; // MQTT username, if required
const char* mqtt_pass = "root"; // MQTT password, if required

WiFiClient espClient;
PubSubClient client(espClient);

// Topics
const char* relay1_cmd_topic = "esp32lr20/cmd/relay1";
const char* relay2_cmd_topic = "esp32lr20/cmd/relay2";
const char* relay_state_topic = "esp32lr20/state";

void setup() {
  Serial.begin(9600);
  
  // Initialize Relay Pins
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  
  // Start with relays off
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);

  // Attempt to connect to MQTT
  reconnect();
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESP32Client", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      // Subscribe to command topics
      client.subscribe(relay1_cmd_topic);
      client.subscribe(relay2_cmd_topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  // Convert payload to string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  // Handle relay control based on topic and payload
  if (String(topic) == relay1_cmd_topic) {
    if (message == "on") {
      digitalWrite(RELAY1_PIN, HIGH);
      publish_state();
    } else if (message == "off") {
      digitalWrite(RELAY1_PIN, LOW);
      publish_state();
    }
  } else if (String(topic) == relay2_cmd_topic) {
    if (message == "on") {
      digitalWrite(RELAY2_PIN, HIGH);
      publish_state();
    } else if (message == "off") {
      digitalWrite(RELAY2_PIN, LOW);
      publish_state();
    }
  }
}

void publish_state() {
  // Publish the current state of the relays
  String statePayload = "{";
  statePayload += "\"relay1\":\"";
  statePayload += digitalRead(RELAY1_PIN) == HIGH ? "on" : "off";
  statePayload += "\", \"relay2\":\"";
  statePayload += digitalRead(RELAY2_PIN) == HIGH ? "on" : "off";
  statePayload += "\"}";

  client.publish(relay_state_topic, statePayload.c_str());
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
