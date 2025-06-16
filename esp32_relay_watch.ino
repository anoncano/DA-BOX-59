/*
  esp32_relay_watch.ino
  Monitors the Realtime Database for the relay state.
  When `/relaystate` becomes "unlocked" it prints a message, waits for the
  number of milliseconds stored at `/relayHoldTime/ms`, then writes "locked"
  back to `/relaystate`.

  Requires the Firebase ESP Client library:
  https://github.com/mobizt/Firebase-ESP-Client
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define API_KEY "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o"
#define DATABASE_URL "https://da-box-59.firebaseio.com"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long holdTimeMs = 3000;
bool unlocked = false;
unsigned long unlockStart = 0;

void setup() {
  Serial.begin(115200);
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
      if (Firebase.RTDB.getInt(&fbdo, "/relayHoldTime/ms")) {
        holdTimeMs = fbdo.intData();
      }
      unlockStart = millis();
    }
  }

  if (unlocked && millis() - unlockStart >= holdTimeMs) {
    unlocked = false;
    Serial.println("Locking");
    Firebase.RTDB.setString(&fbdo, "/relaystate", "locked");
  }

  delay(200);
}
