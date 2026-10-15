#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h>
#include <time.h>
#include <initializer_list>
#include "secrets.h"

WiFiClient transport;
PubSubClient mqtt(transport);
String upTopic, downTopic;
struct Ack { String id; String valueText; } pending[CHANNEL_COUNT];
bool states[CHANNEL_COUNT] = {};
bool configured = false, dirty = false;
uint32_t lastReport = 0, lastReply = 0, lastConnect = 0, lastWifi = 0;
constexpr uint32_t REPORT_MS = 2000, FAILSAFE_MS = 30000;
void output() {
  for (size_t i=0; i<CHANNEL_COUNT; i++)
    digitalWrite(CHANNELS[i].gpio, states[i] != CHANNELS[i].activeLow ? HIGH : LOW);
}
void off() { for (size_t i=0; i<CHANNEL_COUNT; i++) states[i]=false; output(); for(auto &a:pending) a.id=""; }
int64_t timestamp(const char *s) {
  if(!s || strlen(s)!=24) return -1;
  int y,mo,d,h,mi,se,ms;
  if(sscanf(s,"%d-%d-%dT%d:%d:%d.%dZ",&y,&mo,&d,&h,&mi,&se,&ms)!=7) return -1;
  struct tm t={}; t.tm_year=y-1900; t.tm_mon=mo-1;t.tm_mday=d;t.tm_hour=h;t.tm_min=mi;t.tm_sec=se;
  time_t v=mktime(&t);return v<0 ? -1 : (int64_t)v*1000+ms;
}
void received(char *topic, byte *payload, unsigned int length) {
  if(downTopic!=topic || length>8192) return;
  DynamicJsonDocument doc(16384);
  if(deserializeJson(doc,payload,length) || !doc["commands"].is<JsonArray>()) return;
  int64_t now=timestamp(doc["serverTime"] | ""); if(now<0) return;
  lastReply=millis();
  for(const char *field : {"acknowledged", "ignored"}) {
    for(JsonVariantConst id:doc[field].as<JsonArrayConst>())
      for(auto &a:pending) if(a.id==(id.as<const char*>() ? id.as<const char*>() : "")) a.id="";
  }
  for(JsonObjectConst cmd:doc["commands"].as<JsonArrayConst>()) {
    String id=cmd["id"] | ""; String pin=cmd["pin"] | "";
    const char *text=cmd["valueText"] | "";
    // Clean session, no retained downlinks, and conservative TTL margin.
    // This is LAN demo expiry protection, not hard real-time safety.
    if(id.length()!=36 || timestamp(cmd["expiresAt"] | "")-now<1000 || strlen(text)>32) continue;
    if (!cmd["value"].is<bool>()) continue;
    bool value=cmd["value"].as<bool>();
    if (strcmp(text, value ? "true" : "false")) continue;
    int slot=-1;
    for (size_t i=0; i<CHANNEL_COUNT; i++) if (pin==CHANNELS[i].pin) slot=i;
    if (slot<0) continue;
    states[slot]=value; output();
    if(pending[slot].id!=id) dirty=true;
    pending[slot].id=id;pending[slot].valueText=text;
    Serial.printf("Applied %s: %s\n",pin.c_str(),value?"ON":"OFF");
  }
}
void report() {
  DynamicJsonDocument doc(4096);
  doc.createNestedArray("telemetry"); // No synthetic temperature or brightness channel.
  JsonArray acks=doc.createNestedArray("acknowledgements");
  for(const auto &a:pending) if(a.id.length()) {
    JsonObject ack=acks.createNestedObject();ack["id"]=a.id;
    // Echo the server's original literal, avoiding floating-point conversion mismatch.
    ack["value"]=serialized(a.valueText);
  }
  String body;serializeJson(doc,body);
  if(mqtt.publish(upTopic.c_str(),body.c_str(),false)) {dirty=false;lastReport=millis();}
}
void setup() {
  Serial.begin(115200);setenv("TZ","UTC0",1);tzset();
  for (const auto &channel:CHANNELS) {
    digitalWrite(channel.gpio, channel.activeLow ? HIGH : LOW);
    pinMode(channel.gpio,OUTPUT);
  }
  off();
  IPAddress ip;
  bool privateIP=ip.fromString(MQTT_HOST) && (ip[0]==10 || (ip[0]==172&&ip[1]>=16&&ip[1]<=31) || (ip[0]==192&&ip[1]==168));
  if(strlen(DEVICE_ID)!=36 || strlen(DEVICE_TOKEN)!=43 || !privateIP) {Serial.println("Edit secrets.h: device UUID, token, private laptop IP.");return;}
  configured=true;upTopic=String("iot/")+DEVICE_ID+"/sync";downTopic=String("iot/")+DEVICE_ID+"/down";
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  mqtt.setServer(MQTT_HOST,MQTT_PORT);mqtt.setCallback(received);mqtt.setBufferSize(12288);mqtt.setKeepAlive(15);mqtt.setSocketTimeout(3);
  lastReply=millis();Serial.println("Open IoT switches. All outputs OFF at boot.");
}
void loop() {
  if(!configured){delay(50);return;}
  uint32_t now=millis();
  if(now-lastReply>FAILSAFE_MS){off();lastReply=now;Serial.println("No server reply for 30s: outputs OFF. Dashboard retains last confirmed state.");}
  if(WiFi.status()!=WL_CONNECTED){if(now-lastWifi>10000){lastWifi=now;WiFi.reconnect();}delay(10);return;}
  if(!mqtt.connected()) {
    if(now-lastConnect>=5000){lastConnect=now;
      if(mqtt.connect(DEVICE_ID,"device",DEVICE_TOKEN)) {
        if(mqtt.subscribe(downTopic.c_str(),0)){dirty=true;Serial.println("MQTT connected. Sending telemetry.");}
        else mqtt.disconnect();
      } else Serial.printf("MQTT connection failed: %d\n",mqtt.state());
    }
    delay(10);return;
  }
  mqtt.loop();
  // Publish outside callback: PubSubClient shares its receive/send packet buffer.
  if(mqtt.connected() && (dirty || millis()-lastReport>=REPORT_MS)) report();
  delay(2);
}
