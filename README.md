# Toggle Demo

This is a lightweight example showing how Firebase authentication and a realtime toggle could work together. The toggle state is stored in Firestore and mirrored to your project's Realtime Database.

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

## Usage

- **Login** on the landing page.
- On the **General** panel, the large toggle flips between locked and unlocked. The value is written to Firestore and the Realtime Database so other clients update instantly.
- **Offline Code** copies a placeholder token to the clipboard for later use.
- **Report Issue** opens a form to send feedback. Reports are saved for admins to review.

Replace the Firebase configuration in `auth.js` with your own project details if you deploy this demo.
