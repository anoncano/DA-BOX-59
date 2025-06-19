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
- Sub users can generate invitation links via **Copy Token**, which now displays a QR code for easy sharing.
- Use **Offline Code** to save a PIN locally. If the app goes offline the PIN is shown so users can still unlock the ESP.
- New users see a short guide on first login.
- Sub users also get a second relay toggle.
- The `esp32_relay_watch.ino` sketch demonstrates how an ESP32 watches the database and resets the relay after the configured hold time.
Replace the Firebase configuration in `auth.js` with your own project details before deploying.
