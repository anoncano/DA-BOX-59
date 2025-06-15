# Toggle Demo

This project is a small example showing how to use Firebase for authentication and data sync. It features a large toggle button whose state is stored in Firestore and mirrored to the Realtime Database at `https://da-box-59.firebaseio.com`.

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
- The **General** panel contains a big toggle that switches between locked and unlocked states. The value is written to Firestore and to the Realtime Database so other clients can react immediately.
- Use **Offline Code** to copy a placeholder token for future offline access.
- **Report Issue** opens a form to send feedback. Reports are stored under the `errors` collection for admins to view.
- Admins can generate invite links, adjust timeouts and review error reports in `admin.html`.

Replace the Firebase configuration in `auth.js` with your own project details if you deploy this demo.
