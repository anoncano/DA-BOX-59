/*
  esp32_relay_watch.ino
  Monitors the Realtime Database for the relay state.
  When `/relaystate` becomes "unlocked" it drives pin 13 HIGH. When
  `/medRelaystate` is "unlocked" it drives pin 12 HIGH. The board waits for the
  number of milliseconds stored at `/relayHoldTime/ms`, then sets the same pin
  LOW and writes "locked" back to whichever path triggered it.

  Requires the Firebase ESP Client library:
  https://github.com/mobizt/Firebase-ESP-Client
*/

#include <WiFi.h>
#include <WebServer.h>
#include <Firebase_ESP_Client.h>
#include <vector>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define AP_SSID "DaBox-AP"
#define AP_PASSWORD "daboxpass"

#define API_KEY "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o"
#define DATABASE_URL "https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long holdTimeMs = 3000;
bool unlocked = false;
unsigned long unlockStart = 0;
const int MAIN_RELAY_PIN = 13; // primary relay
const int MED_RELAY_PIN = 12;  // med relay
WebServer server(80);
bool apMode = false;
bool medTrigger = false;
std::vector<String> offlineTokens;
unsigned long lastTokenFetch = 0;

void fetchOfflineTokens() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (Firebase.RTDB.getJSON(&fbdo, "/offlineTokens")) {
    FirebaseJson &json = fbdo.jsonObject();
    offlineTokens.clear();
    FirebaseJsonData data;
    size_t count = json.iteratorBegin();
    for (size_t i = 0; i < count; i++) {
      json.iteratorGet(i, data);
      offlineTokens.push_back(String(data.key));
    }
    json.iteratorEnd();
  }
}

void startAP() {
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("Started AP at ");
  Serial.println(WiFi.softAPIP());
  server.on("/", []() {
    server.send(200, "text/html",
      "<h1>DaBox Offline</h1><a href='/unlock'>Unlock</a>");
  });
  server.on("/unlock", []() {
    String tok = server.arg("token");
    bool valid = false;
    for (const auto &t : offlineTokens) {
      if (t == tok) { valid = true; break; }
    }
    if (!valid) {
      server.send(403, "text/plain", "Invalid token");
      return;
    }
    if (!unlocked) {
      unlocked = true;
      digitalWrite(MAIN_RELAY_PIN, HIGH);
      unlockStart = millis();
    }
    server.send(200, "text/plain", "Unlocking");
  });
  server.begin();
}

void setup() {
  Serial.begin(115200);
  pinMode(MAIN_RELAY_PIN, OUTPUT);
  pinMode(MED_RELAY_PIN, OUTPUT);
  digitalWrite(MAIN_RELAY_PIN, LOW);
  digitalWrite(MED_RELAY_PIN, LOW);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected");
  } else {
    Serial.println(" failed");
    apMode = true;
    startAP();
  }

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  if (!apMode) {
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    fetchOfflineTokens();
  }
}

void loop() {
  if (!apMode && WiFi.status() == WL_CONNECTED && millis() - lastTokenFetch > 60000) {
    lastTokenFetch = millis();
    fetchOfflineTokens();
  }
  if (!apMode && WiFi.status() == WL_CONNECTED) {
    if (Firebase.RTDB.getString(&fbdo, "/relaystate")) {
      String state = fbdo.stringData();
      if (state == "unlocked" && !unlocked) {
        unlocked = true;
        medTrigger = false;
        Serial.println("Unlocked");
        digitalWrite(MAIN_RELAY_PIN, HIGH);
        if (Firebase.RTDB.getInt(&fbdo, "/relayHoldTime/ms")) {
          holdTimeMs = fbdo.intData();
        }
        unlockStart = millis();
      }
    }
    if (Firebase.RTDB.getString(&fbdo, "/medRelaystate")) {
      String state = fbdo.stringData();
      if (state == "unlocked" && !unlocked) {
        unlocked = true;
        medTrigger = true;
        Serial.println("Med Unlocked");
        digitalWrite(MED_RELAY_PIN, HIGH);
        if (Firebase.RTDB.getInt(&fbdo, "/relayHoldTime/ms")) {
          holdTimeMs = fbdo.intData();
        }
        unlockStart = millis();
      }
    }
  }

  if (unlocked && millis() - unlockStart >= holdTimeMs) {
    unlocked = false;
    Serial.println("Locking");
    digitalWrite(medTrigger ? MED_RELAY_PIN : MAIN_RELAY_PIN, LOW);
    if (!apMode && WiFi.status() == WL_CONNECTED) {
      if (medTrigger) {
        Firebase.RTDB.setString(&fbdo, "/medRelaystate", "locked");
      } else {
        Firebase.RTDB.setString(&fbdo, "/relaystate", "locked");
      }
    }
  }

  if (apMode) {
    server.handleClient();
  }

  delay(100);
}
