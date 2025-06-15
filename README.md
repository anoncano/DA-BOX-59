# DaBox 59

A minimal Firebase-based authentication demo with admin and general panels.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Start a development server
   ```bash
   npm start
   ```
   This uses `http-server` to serve the static files on `http://localhost:8080`.

3. Open `index.html` in your browser to log in.

## Project Structure

- `index.html` – login page
- `admin.html` – admin panel
- `general.html` – general user panel
- `register.html` – registration page used with invite tokens
- `auth.js` – shared Firebase logic and toast notifications (exposed as `showNotif`)

The admin panel lets you adjust the inactivity timeout and the relay hold time.
It also lists all non-admin users with a dropdown to change their roles. Role
changes are saved immediately when you pick a new value and a toast confirms the
update. Configuration documents are readable by any signed-in user so the
general panel can display the relay hold time. Admins are allowed to update any
user document so role changes persist.

Invite tokens can be generated from the admin panel. Opening a token link will
take the user to `register.html` where they can sign up. The login page no
longer links to registration directly, so invitees must use their token URL.
After registration, the user is redirected back to the login page.

Sample Firestore security rules are included in `firestore.rules`.

The Firebase configuration in `auth.js` points to a sample project. Replace the
credentials with your own Firebase project settings if you deploy this
application.

The general panel includes a **Delete** button. It currently serves as a
placeholder and only shows a notification. The underlying `deleteAccount` Cloud
Function is still provided in `functions/index.js` should you wish to wire it up
for actual account removal.

The large toggle on the general panel now updates the `config/relaystate`
document in Firestore. It then mirrors the state to the Realtime Database
instance at `https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app`.
If that write fails, it automatically retries against the legacy host
`https://da-box-59.firebaseio.com`. A toast is shown only when all writes fail
so normal operation continues even if one of the databases is temporarily
unreachable.
When pressed it sets the state to `unlocked` and reverts to `locked` after the
admin-defined relay hold time. Authenticated users can now update these values
as specified in `firestore.rules`. The interface uses
standard event listeners for better browser compatibility and pages now include
viewport metadata and responsive layout tweaks for improved usability on mobile
devices.

Firebase Hosting configuration files are included along with a GitHub Actions
workflow that deploys preview channels for pull requests and pushes to the live
site on merges to `main`.
