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
- The large toggle on the **General** panel switches between locked and unlocked, updating Firestore and the Realtime Database. The buttons stay in sync with the actual pin states via realtime listeners.
- **Report Issue** opens a form so users can submit feedback. Reports show up for admins on their panel.
- Admins can remove reports directly from the error list.
 - Login page includes a password reset button that emails a Firebase reset link using Firebase's default template and shows a reminder modal to check spam folders.
 - Sub users can invite others via **Invite Users** on the general panel.
- The `esp32_relay_watch.ino` sketch demonstrates how an ESP32 watches the database. It toggles pin **13** when `/relaystate` becomes `unlocked` and pin **12** when `/medRelaystate` is `unlocked`, then resets the relay after the configured hold time.
- The ESP always hosts an open access point `da-box-59` at `http://192.168.4.1`. Enter the offline PIN to access controls. Three pins are stored: `/offlinePinGeneral`, `/offlinePinSub` and `/offlinePinAdmin`, refreshed whenever WiFi reconnects.
- Links generated for offline use now open `http://192.168.4.1/?pin=PIN` so the control page loads immediately.
- If the primary WiFi can't be reached it tries a backup SSID before scanning for open networks and connecting to the strongest one so it stays online.
- Over-the-air updates are available via a simple `/update` endpoint so admins can upload new firmware directly from the web UI.
- The general panel reads `/offlinePinGeneral` for normal users, `/offlinePinSub` for sub admins and `/offlinePinAdmin` for admins to display the current PIN when the device goes offline.
- Admins use `/offlinePinAdmin` to reach the offline page where they can also upload firmware updates.
- A simple Kanban board on the admin page lets admins track tasks, drag them between columns, edit their text with a double click and remove cards.
 - Relay hold time saved from the admin panel is also stored in the Realtime Database at `/relayHoldTime/ms`. Both toggles write the same value whenever they unlock so hardware sees the latest hold time. The ESP writes `locked` back when the cycle ends so the UI only reverts once the board confirms.
 - The general panel shows a faint heart centered behind the toggles. It glows green when the ESP heartbeat updates and turns red when it stops.
- Admins can lock user accounts from the admin panel so locked users cannot sign in.
- Sub admins use a wizard to generate invitation links specifying the role and optional med access.
- Users can delete their account from the general panel after confirming in a modal. The deletion removes the Auth account and the user's Firestore document.
- Press <kbd>Enter</kbd> in the password field to submit the login form quickly.
- Admins can grant a **med** role. Users with this role see a second toggle on the general panel which writes to `medRelaystate`.
- The ESP32 watches `medRelaystate` as well and unlocks the relay when this value becomes `unlocked`.
 - When offline, the general panel keeps its help modal open until dismissed. It guides users to join the `da-box-59` AP and offers a copy button for the PIN and local link, which already embeds the PIN. Sub admins can also upload firmware from the ESP's local page.
Replace the Firebase configuration in `auth.js` with your own project details before deploying.
