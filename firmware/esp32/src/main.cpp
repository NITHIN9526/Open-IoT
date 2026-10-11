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
struct Ack { String id; String valueText; } pending[2];
bool powerOn = false, configured = false, dirty = false;
double brightness = 100;
uint32_t lastReport = 0, lastReply = 0, lastConnect = 0, lastWifi = 0;
constexpr uint32_t REPORT_MS = 2000, FAILSAFE_MS = 30000;
void output() {
  const int duty = powerOn ? constrain((int)lround(brightness * 255.0 / 100.0), 0, 255) : 0;
  ledcWrite(0, LED_ACTIVE_LOW ? 255-duty : duty);
}
void off() { powerOn=false; output(); for(auto &a:pending) a.id=""; }
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
    int slot=-1;
    if(pin=="V1" && cmd["value"].is<bool>()) {
      if(strcmp(text,"true") && strcmp(text,"false")) continue;
      slot=0;powerOn=cmd["value"].as<bool>();
    } else if(pin=="V2" && cmd["value"].is<double>() && !cmd["value"].is<bool>()) {
      double v=cmd["value"].as<double>(); if(!isfinite(v)||v<0||v>100) continue;
      // Only permit a JSON numeric literal in the exact-value echo.
      bool safe=strlen(text)>0;
      for(const char *p=text;*p;p++) if(!((*p>='0'&&*p<='9')||*p=='.'||*p=='e'||*p=='E'||*p=='+'||*p=='-')) safe=false;
      if(!safe) continue;
      slot=1;brightness=v;
    } else continue;
    output();
    if(pending[slot].id!=id) dirty=true;
    pending[slot].id=id;pending[slot].valueText=text;
    Serial.printf("Applied %s | Power=%s | Brightness=%.1f%%\n",pin.c_str(),powerOn?"ON":"OFF",brightness);
  }
}
void report() {
  DynamicJsonDocument doc(2048);
  JsonObject t=doc.createNestedArray("telemetry").createNestedObject();
  t["pin"]="V0";t["value"]=round((24+2*sin(millis()/15000.0))*100)/100;
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
  ledcSetup(0,5000,8);ledcAttachPin(LED_PIN,0);off();
  IPAddress ip;
  bool privateIP=ip.fromString(MQTT_HOST) && (ip[0]==10 || (ip[0]==172&&ip[1]>=16&&ip[1]<=31) || (ip[0]==192&&ip[1]==168));
  if(strlen(DEVICE_ID)!=36 || strlen(DEVICE_TOKEN)!=43 || !privateIP) {Serial.println("Edit secrets.h: device UUID, token, private laptop IP.");return;}
  configured=true;upTopic=String("iot/")+DEVICE_ID+"/sync";downTopic=String("iot/")+DEVICE_ID+"/down";
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  mqtt.setServer(MQTT_HOST,MQTT_PORT);mqtt.setCallback(received);mqtt.setBufferSize(12288);mqtt.setKeepAlive(15);mqtt.setSocketTimeout(3);
  lastReply=millis();Serial.println("Open IoT MQTT demo. LED OFF at boot; V0 is simulated.");
}
void loop() {
  if(!configured){delay(50);return;}
  uint32_t now=millis();
  if(now-lastReply>FAILSAFE_MS && powerOn){off();Serial.println("No server reply for 30s: LED OFF. Dashboard retains last confirmed state.");}
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
