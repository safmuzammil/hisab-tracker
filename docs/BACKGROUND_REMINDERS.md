# Background reminders — one-time setup (~15 minutes)

Without this, reminders still work **while Hisab is open** (or installed and recently used).
With it, reminders arrive like a normal app notification even when Hisab is closed,
with **✓ Done / Snooze 10m / 1 hour** buttons. Bills, the evening summary and the Sunday
weekly report are also delivered this way.

## 1. Firebase: web app IDs + push key
1. Firebase Console → **hisab-1127d** → ⚙️ Project settings → **General** → *Your apps* → your Web app.
   Copy `messagingSenderId` and `appId` into `firebaseConfig` near the top of `app.js`.
2. Project settings → **Cloud Messaging** → *Web Push certificates* → **Generate key pair**.
   Copy the key into `FCM_VAPID_KEY` in `app.js`.
3. Firestore → **Rules** → paste the contents of `firestore.rules` → **Publish**
   (adds the `pushTokens` collection; your existing `users` rule is unchanged).

## 2. Service account for the server
Project settings → **Service accounts** → **Generate new private key** → downloads a JSON file.
**Never commit this file.** (`.gitignore` already blocks `client_secret_*.json`.)

## 3. Vercel environment variables
Vercel → your Hisab project → Settings → **Environment Variables**:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file contents, pasted as one value |
| `CRON_SECRET` | any long random string, e.g. from `openssl rand -hex 24` |
| `REMINDER_SECRET` | another long random string (signs the Snooze buttons) |

Redeploy. `package.json` installs `firebase-admin` for the functions automatically.

Test: open `https://<your-app>/api/send-reminders?key=<CRON_SECRET>` → should return
`{"ok":true,"users":0,...}` (0 until a device registers).

## 4. Run it every minute
Vercel's free plan only allows daily crons, so use one of these (both free):

**Option A — cron-job.org:** create a job → URL `https://<your-app>/api/send-reminders?key=<CRON_SECRET>` → every 1 minute.

**Option B — your existing Google Apps Script:** add this function, then Triggers → *Add trigger* →
`pingHisab` → Time-driven → Minutes timer → Every minute.
```js
function pingHisab() {
  UrlFetchApp.fetch('https://<your-app>/api/send-reminders', {
    headers: { Authorization: 'Bearer <CRON_SECRET>' }, muteHttpExceptions: true
  });
}
```
(Every 5 minutes also works — reminders then arrive up to 5 minutes late.)

## 5. Turn it on in the app
Sign in → bell icon (Settings) → **Turn on background reminders**. The button changes to
*"On · works when app is closed"*. Do this once on each phone/computer you use.

### Notes
- Prayer-linked reminders use the location you saved in **Deen → Prayer times → Use my location**.
- Snooze from a notification works without opening the app. *Done* opens Hisab briefly to log it,
  so your history and penalties stay correct.
- iPhone: background push requires iOS 16.4+ **and** Hisab added to the Home Screen.
