/*
  esp32_relay_watch.ino
  Listens to the Firebase Realtime Database for two relay paths.
  When `/relaystate` becomes "unlocked" it toggles pin 13.
  When `/medRelaystate` becomes "unlocked" it toggles pin 12.
  The board locks the relay again after `/relayHoldTime/ms` milliseconds.
  If WiFi is unavailable, it starts an access point `DaBox-AP` so users can
  unlock by visiting `http://192.168.4.1/unlock?token=YOUR_CODE` using an
  offline token stored at `/offlineTokens`.
*/

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <vector>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define AP_SSID "DaBox-AP"
#define AP_PASSWORD "daboxpass"

const char* FIREBASE_URL = "https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app/";
const int MAIN_RELAY_PIN = 13;
const int MED_RELAY_PIN = 12;

bool mainUnlocked = false;
bool medUnlocked = false;
unsigned long mainStart = 0;
unsigned long medStart = 0;
int holdTime = 200;

unsigned long lastCheck = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastTokenFetch = 0;
WebServer server(80);
bool apMode = false;
std::vector<String> offlineTokens;

void fetchOfflineTokens() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(FIREBASE_URL) + "offlineTokens.json");
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    offlineTokens.clear();
    int pos = 0;
    while ((pos = payload.indexOf('"', pos)) != -1) {
      int end = payload.indexOf('"', pos + 1);
      if (end == -1) break;
      offlineTokens.push_back(payload.substring(pos + 1, end));
      pos = payload.indexOf('"', end + 1);
      if (pos == -1) break;
    }
  }
  http.end();
}

void startAP() {
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("Started AP at ");
  Serial.println(WiFi.softAPIP());
  server.on("/unlock", []() {
    String tok = server.arg("token");
    bool valid = false;
    for (const auto& t : offlineTokens) {
      if (t == tok) { valid = true; break; }
    }
    if (!valid) {
      server.send(403, "text/plain", "Invalid token");
      return;
    }
    if (!mainUnlocked && !medUnlocked) {
      mainUnlocked = true;
      digitalWrite(MAIN_RELAY_PIN, HIGH);
      mainStart = millis();
    }
    server.send(200, "text/plain", "Unlocking");
  });
  server.onNotFound([](){ server.send(200, "text/html", "<h1>DaBox Offline</h1>"); });
  server.begin();
}

void setup() {
  Serial.begin(115200);
  pinMode(MAIN_RELAY_PIN, OUTPUT);
  pinMode(MED_RELAY_PIN, OUTPUT);
  digitalWrite(MAIN_RELAY_PIN, LOW);
  digitalWrite(MED_RELAY_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    Serial.print('.');
    delay(500);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected");
    fetchOfflineTokens();
  } else {
    Serial.println("\n❌ WiFi Failed");
    apMode = true;
    startAP();
  }
}

void loop() {
  unsigned long now = millis();

  if (!apMode && now - lastTokenFetch > 60000) {
    lastTokenFetch = now;
    fetchOfflineTokens();
  }

  // Poll Firebase every 50ms
  if ((!mainUnlocked || !medUnlocked) && now - lastCheck > 50 && WiFi.status() == WL_CONNECTED) {
    lastCheck = now;

    // refresh hold time
    HTTPClient httpHold;
    httpHold.begin(String(FIREBASE_URL) + "relayHoldTime/ms.json");
    int holdCode = httpHold.GET();
    if (holdCode == 200) {
      String holdPayload = httpHold.getString();
      holdTime = holdPayload.toInt();
      Serial.print("⏱️ Updated holdTime: ");
      Serial.println(holdTime);
    }
    httpHold.end();

    if (!mainUnlocked) {
      HTTPClient http;
      http.begin(String(FIREBASE_URL) + "relaystate.json");
      int code = http.GET();
      if (code == 200) {
        String payload = http.getString();
        payload.trim();
        payload.replace("\"", "");
        if (payload == "unlocked") {
          digitalWrite(MAIN_RELAY_PIN, HIGH);
          mainStart = now;
          mainUnlocked = true;
          Serial.println("🔓 Main Relay ON");
        }
      }
      http.end();
    }

    if (!medUnlocked) {
      HTTPClient http;
      http.begin(String(FIREBASE_URL) + "medRelaystate.json");
      int code = http.GET();
      if (code == 200) {
        String payload = http.getString();
        payload.trim();
        payload.replace("\"", "");
        if (payload == "unlocked") {
          digitalWrite(MED_RELAY_PIN, HIGH);
          medStart = now;
          medUnlocked = true;
          Serial.println("🔓 Med Relay ON");
        }
      }
      http.end();
    }
  }

  if (mainUnlocked && now - mainStart >= holdTime) {
    digitalWrite(MAIN_RELAY_PIN, LOW);
    mainUnlocked = false;
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(String(FIREBASE_URL) + "relaystate.json");
      http.addHeader("Content-Type", "application/json");
      http.PUT("\"locked\"");
      http.end();
    }
    Serial.println("🔒 Main Relay OFF");
  }

  if (medUnlocked && now - medStart >= holdTime) {
    digitalWrite(MED_RELAY_PIN, LOW);
    medUnlocked = false;
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(String(FIREBASE_URL) + "medRelaystate.json");
      http.addHeader("Content-Type", "application/json");
      http.PUT("\"locked\"");
      http.end();
    }
    Serial.println("🔒 Med Relay OFF");
  }

  if (!apMode && now - lastHeartbeat > 10000 && WiFi.status() == WL_CONNECTED) {
    lastHeartbeat = now;
    HTTPClient http;
    http.begin(String(FIREBASE_URL) + "heartbeat.json");
    http.addHeader("Content-Type", "application/json");
    http.PUT(String(millis()));
    http.end();
    Serial.println("💓 Heartbeat sent");
  }

  if (apMode) {
    server.handleClient();
  }
}

