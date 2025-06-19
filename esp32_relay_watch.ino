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
#include <ArduinoOTA.h>
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
unsigned long lastWiFiCheck = 0;
bool wifiConnected = false;
WebServer server(80);
bool apMode = false;
bool otaStarted = false;
std::vector<String> offlineTokens;
const char* offlinePage = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font-family:sans-serif;text-align:center;padding-top:20px}</style></head><body><h1>DaBox Offline</h1><form action='/unlock'><input name='token' placeholder='Token'><button type='submit'>Unlock</button></form></body></html>";

void beginOTA() {
  if (otaStarted) return;
  ArduinoOTA.setHostname("DaBoxESP");
  ArduinoOTA.setPassword("daboxota");
  ArduinoOTA.begin();
  otaStarted = true;
  Serial.println("OTA ready");
}

bool connectWiFi(unsigned long timeout = 10000) {
  otaStarted = false;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeout) {
    Serial.print('.');
    delay(500);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected");
    beginOTA();
    return true;
  }
  Serial.println("\n❌ WiFi Failed - scanning for open networks");
  int n = WiFi.scanNetworks();
  int bestRSSI = -1000;
  String bestSSID = "";
  for (int i = 0; i < n; i++) {
    if (WiFi.encryptionType(i) == WIFI_AUTH_OPEN && WiFi.RSSI(i) > bestRSSI) {
      bestRSSI = WiFi.RSSI(i);
      bestSSID = WiFi.SSID(i);
    }
  }
  if (bestSSID.length()) {
    Serial.print("Connecting to open network: ");
    Serial.print(bestSSID);
    WiFi.begin(bestSSID.c_str());
    start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < timeout) {
      Serial.print('.');
      delay(500);
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ Connected to open network");
      beginOTA();
      return true;
    }
  }
  Serial.println("\n❌ No open networks available");
  return false;
}

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
  apMode = true;
  server.on("/", [](){ server.send(200, "text/html", offlinePage); });
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
  server.onNotFound([](){ server.send(200, "text/html", offlinePage); });
  server.begin();
  beginOTA();
}

void stopAP() {
  server.stop();
  WiFi.softAPdisconnect(true);
  apMode = false;
  otaStarted = false;
  Serial.println("Stopped AP");
}

void setup() {
  Serial.begin(115200);
  pinMode(MAIN_RELAY_PIN, OUTPUT);
  pinMode(MED_RELAY_PIN, OUTPUT);
  digitalWrite(MAIN_RELAY_PIN, LOW);
  digitalWrite(MED_RELAY_PIN, LOW);

  wifiConnected = connectWiFi();
  if (wifiConnected) {
    fetchOfflineTokens();
  } else {
    startAP();
  }
}

void loop() {
  unsigned long now = millis();

  if (now - lastWiFiCheck > 10000) {
    lastWiFiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      if (!apMode) {
        wifiConnected = connectWiFi();
        if (!wifiConnected) startAP();
      } else if (connectWiFi()) {
        stopAP();
        fetchOfflineTokens();
      }
    } else if (apMode) {
      stopAP();
      fetchOfflineTokens();
    }
  }

  if (!apMode && WiFi.status() == WL_CONNECTED && now - lastTokenFetch > 60000) {
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
  if (WiFi.status() == WL_CONNECTED || apMode) {
    ArduinoOTA.handle();
  }
}

