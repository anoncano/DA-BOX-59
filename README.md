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
- `auth.js` – shared Firebase logic and toast notifications

The admin panel lets you adjust the inactivity timeout and the relay hold time.

Invite tokens can be generated from the admin panel. Opening a token link will
take the user to `register.html` where they can sign up. The login page no
longer links to registration directly, so invitees must use their token URL.
After registration, the user is redirected back to the login page.

Sample Firestore security rules are included in `firestore.rules`.

The Firebase configuration in `auth.js` points to a sample project. Replace the
credentials with your own Firebase project settings if you deploy this
application.
