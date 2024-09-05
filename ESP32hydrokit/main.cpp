//This code is for the Atlas Scientific wifi hydroponics kit that uses the Adafruit huzzah32 as its computer.

#include <iot_cmd.h>
#include <WiFi.h>                                                //include wifi library 
#include <sequencer4.h>                                          //imports a 4 function sequencer 
#include <sequencer1.h>                                          //imports a 1 function sequencer 
#include <Ezo_i2c_util.h>                                        //brings in common print statements
#include <Ezo_i2c.h> //include the EZO I2C library from https://github.com/Atlas-Scientific/Ezo_I2c_lib
#include <Wire.h>    //include arduinos i2c library
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "wall02";
//const char* wifiPassword = "camperfurt";
const char* mqttServer = "192.168.20.1";
const char* mqttClientId = "esp32hykit";
const char* mqttUsername = "admin";
const char* mqttPassword = "root";
const int mqttPort = 1883;

WiFiClient wifiClient;
PubSubClient client(wifiClient);
long lastMsg = 0;
char msg[50];
int value = 0;

Ezo_board PH = Ezo_board(99, "PH");       //create a PH circuit object, who's address is 99 and name is "PH"
Ezo_board EC = Ezo_board(100, "EC");      //create an EC circuit object who's address is 100 and name is "EC"
Ezo_board RTD = Ezo_board(102, "RTD");    //create an RTD circuit object who's address is 102 and name is "RTD"
Ezo_board PMP = Ezo_board(103, "PMP");    //create an PMP circuit object who's address is 103 and name is "PMP"

Ezo_board device_list[] = {               //an array of boards used for sending commands to all or specific boards
  PH,
  EC,
  RTD,
  PMP
};

Ezo_board* default_board = &device_list[0]; //used to store the board were talking to

//gets the length of the array automatically so we dont have to change the number every time we add new boards
const uint8_t device_list_len = sizeof(device_list) / sizeof(device_list[0]);


//------For version 1.5 use these enable pins for each circuit------
const int EN_PH = 12;
const int EN_EC = 27;
const int EN_RTD = 15;
const int EN_AUX = 33;
//------------------------------------------------------------------

const unsigned long reading_delay = 1000;                 //how long we wait to receive a response, in milliseconds

unsigned int poll_delay = 2000 - reading_delay * 2 - 300; //how long to wait between polls after accounting for the times it takes to send readings

float k_val = 0;                                          //holds the k value for determining what to print in the help menu

bool polling  = true;                                     //variable to determine whether or not were polling the circuits

void step1();      //forward declarations of functions to use them in the sequencer before defining them
void step2();
void step3();
void step4();
Sequencer4 Seq(&step1, reading_delay,   //calls the steps in sequence with time in between them
               &step2, 300,
               &step3, reading_delay,
               &step4, poll_delay);


void setup() {
  pinMode(EN_PH, OUTPUT);                                                         //set enable pins as outputs
  pinMode(EN_EC, OUTPUT);
  pinMode(EN_RTD, OUTPUT);
  pinMode(EN_AUX, OUTPUT);
  digitalWrite(EN_PH, LOW);                                                       //set enable pins to enable the circuits
  digitalWrite(EN_EC, LOW);
  digitalWrite(EN_RTD, HIGH);
  digitalWrite(EN_AUX, LOW);

  Wire.begin();                           //start the I2C
  Serial.begin(9600);                     //start the serial communication to the computer
  Seq.reset();

  connectWiFi();
  client.setServer(mqttServer, mqttPort);
}

void loop() {
  // startet die Messung
  Seq.run();
  
  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();

  const float PH_reading = PH.get_last_received_reading();
  const float RTD_reading = RTD.get_last_received_reading();
  const float EC_reading = EC.get_last_received_reading();

  DynamicJsonDocument doc(128); // Allocate sufficient memory for the JSON data
  JsonObject jsonObject = doc.to<JsonObject>();

  // Add sensor readings as key-value pairs
  jsonObject["ph"] = PH_reading;
  jsonObject["temp"] = RTD_reading;
  jsonObject["ec"] = EC_reading;

  // Serialize the JSON object to a string
  String payload;
  serializeJson(doc, payload);
  publishMQTTMessage("hydroponic_kit/state", payload.c_str());

  delay(1000);
}

void connectWiFi() {
  WiFi.begin(ssid);
  while (!wifiIsConnected()) {
    Serial.println("Connecting to WiFi..");
    delay(500);
  }

  Serial.print("Connected to WiFi with IP: ");
  Serial.println(WiFi.localIP());
}

bool wifiIsConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void connectMQTT() {
  while(!client.connected()) {
    Serial.println("Connecting to MQTT broker...");
    if (client.connect(mqttClientId, mqttUsername, mqttPassword)) {
      Serial.println("connected");
    } else {
      Serial.print("failed with error: ");
      Serial.print(client.state());
      delay(1000);
    }
  }
}

void publishMQTTMessage(const char* topic, const char* payload) {
  client.publish(topic, payload);
  Serial.print("Published message: ");
  Serial.println(payload);
}

void step1() {
  //send a read command. we use this command instead of RTD.send_cmd("R");
  //to let the library know to parse the reading
  RTD.send_read_cmd();
}

void step2() {
  receive_and_print_reading(RTD);             //get the reading from the RTD circuit

  if ((RTD.get_error() == Ezo_board::SUCCESS) && (RTD.get_last_received_reading() > -1000.0)) { //if the temperature reading has been received and it is valid
    PH.send_cmd_with_num("T,", RTD.get_last_received_reading());
    EC.send_cmd_with_num("T,", RTD.get_last_received_reading());
  } else {                                                                                      //if the temperature reading is invalid
    PH.send_cmd_with_num("T,", 25.0);                                                           //send default temp = 25 deg C to PH sensor
    EC.send_cmd_with_num("T,", 25.0);
  }

  Serial.print(" ");
}

void step3() {
  //send a read command. we use this command instead of PH.send_cmd("R");
  //to let the library know to parse the reading
  PH.send_read_cmd();
  EC.send_read_cmd();
}

void step4() {
  receive_and_print_reading(PH);             //get the reading from the PH circuit
  if (PH.get_error() == Ezo_board::SUCCESS) {                                           //if the PH reading was successful (back in step 1)
  }
  Serial.print("  ");
  receive_and_print_reading(EC);             //get the reading from the EC circuit
  if (EC.get_error() == Ezo_board::SUCCESS) {                                           //if the EC reading was successful (back in step 1)
  }

  Serial.println();
}
