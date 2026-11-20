// Vercel Serverless Function: snooze a reminder straight from the notification (no app launch).
// Called by sw.js with a signature the server attached to the push, so no login is needed.
import { admin, verifyAction } from './_firebase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { uid, taskId, minutes, exp, sig } = body;
        if (!uid || !taskId || !verifyAction(uid, taskId, exp, sig)) return res.status(403).json({ ok: false, error: 'bad signature' });
        const mins = Math.min(24 * 60, Math.max(1, Number(minutes) || 10));
        const { db } = admin();
        await db.collection('pushTokens').doc(uid).set({ snoozes: { [taskId]: Date.now() + mins * 60000 } }, { merge: true });
        res.status(200).json({ ok: true, until: Date.now() + mins * 60000 });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}
