# DaBox Control

This app provides a simple interface for unlocking and locking a relay using Firebase. The toggle state is stored in Firestore and mirrored to your project's Realtime Database so hardware clients update instantly.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the static server
   ```bash
   npm start
   ```
   Then open `index.html` in your browser.
- The large toggle on the **General** panel switches between locked and unlocked, updating Firestore and the Realtime Database.
- **Report Issue** opens a form so users can submit feedback. Reports show up for admins on their panel.
- Admins can remove reports directly from the error list.
- Sub users can generate invitation links via **Copy Token** on the general panel.
- The `esp32_relay_watch.ino` sketch demonstrates how an ESP32 watches the database. It toggles pin **13** when `/relaystate` becomes `unlocked` and pin **12** when `/medRelaystate` is `unlocked`, then resets the relay after the configured hold time.
- If WiFi isn't available, the sketch starts a fallback access point `DaBox-AP` with a simple `/unlock` endpoint.
- Generating an **Offline Code** on the general panel stores a token under `offlineTokens/` in the Realtime Database. When the board falls back to AP mode you can unlock by visiting `http://192.168.4.1/unlock?token=YOUR_CODE`.
- Relay hold time saved from the admin panel is also stored in the Realtime Database at `/relayHoldTime/ms`. Both toggles write the same value whenever they unlock so hardware sees the latest hold time.
- The general panel shows a green "Device online" message when a heartbeat is received from the ESP and turns red when the heartbeat stops.
- Admins can grant a **med** role. Users with this role see a second toggle on the general panel which writes to `medRelaystate`.
- The ESP32 watches `medRelaystate` as well and unlocks the relay when this value becomes `unlocked`.
Replace the Firebase configuration in `auth.js` with your own project details before deploying.
