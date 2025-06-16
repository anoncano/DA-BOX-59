/*
  esp32_relay_watch.ino
  Monitors the Realtime Database for the relay state.
  When `/relaystate` becomes "unlocked" it toggles pin 13 HIGH, waits for the
  number of milliseconds stored at `/relayHoldTime/ms`, then sets the pin LOW
  and writes "locked" back to `/relaystate`.

  Requires the Firebase ESP Client library:
  https://github.com/mobizt/Firebase-ESP-Client
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define API_KEY "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o"
#define DATABASE_URL "https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long holdTimeMs = 3000;
bool unlocked = false;
unsigned long unlockStart = 0;
const int RELAY_PIN = 13;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println(" connected");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.RTDB.getString(&fbdo, "/relaystate")) {
    String state = fbdo.stringData();
    if (state == "unlocked" && !unlocked) {
      unlocked = true;
      Serial.println("Unlocked");
      digitalWrite(RELAY_PIN, HIGH);
      if (Firebase.RTDB.getInt(&fbdo, "/relayHoldTime/ms")) {
        holdTimeMs = fbdo.intData();
      }
      unlockStart = millis();
    }
  }

  if (unlocked && millis() - unlockStart >= holdTimeMs) {
    unlocked = false;
    Serial.println("Locking");
    digitalWrite(RELAY_PIN, LOW);
    Firebase.RTDB.setString(&fbdo, "/relaystate", "locked");
  }

  delay(200);
}
