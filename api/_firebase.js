// Shared Firebase Admin init for Vercel functions.
// Env: FIREBASE_SERVICE_ACCOUNT = the full JSON of a service-account key (Firebase Console → Project settings → Service accounts → Generate new private key)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import crypto from 'node:crypto';

export function admin() {
    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
        initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    return { db: getFirestore(), messaging: getMessaging() };
}

// Signed links let the service worker snooze a reminder without opening the app.
export function signAction(uid, taskId, exp) {
    const secret = process.env.REMINDER_SECRET || process.env.CRON_SECRET || '';
    return crypto.createHmac('sha256', secret).update(`${uid}|${taskId}|${exp}`).digest('hex').slice(0, 32);
}
export function verifyAction(uid, taskId, exp, sig) {
    if (!sig || !exp || Date.now() > Number(exp)) return false;
    const good = signAction(uid, taskId, exp);
    return good.length === String(sig).length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(String(sig)));
}
