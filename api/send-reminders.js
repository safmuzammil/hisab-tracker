// Vercel Serverless Function: background reminders via Firebase Cloud Messaging.
// Call it every 1–5 minutes from a scheduler (cron-job.org, Google Apps Script trigger, or Vercel Cron on Pro):
//   GET https://<your-app>/api/send-reminders   with header  Authorization: Bearer <CRON_SECRET>
//   (or ?key=<CRON_SECRET> if your scheduler can't set headers)
import { admin, signAction } from './_firebase.js';
import * as Core from '../lib/core.js';

const WINDOW_MIN = 6;      // a reminder fires once inside [time, time + 6 min) — tolerates a 5-minute scheduler
const DAY = 86400000;

export default async function handler(req, res) {
    const secret = process.env.CRON_SECRET;
    const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.key;
    if (!secret || given !== secret) return res.status(401).json({ ok: false, error: 'unauthorized' });

    let db, messaging;
    try { ({ db, messaging } = admin()); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    try {
        const summary = await runReminders(db, messaging, Date.now());
        return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}

export async function runReminders(db, messaging, now) {
    const summary = { users: 0, sent: 0, removedTokens: 0, errors: [], messages: [] };
    const pushSnap = await db.collection('pushTokens').get();

    for (const pushDoc of pushSnap.docs) {
        const uid = pushDoc.id;
        try {
            const p = pushDoc.data() || {};
            const tokens = Object.entries(p.tokens || {}).map(([k, v]) => ({ k, token: v && v.token })).filter(x => x.token);
            if (!tokens.length) continue;
            summary.users++;

            const userSnap = await db.collection('users').doc(uid).get();
            if (!userSnap.exists) continue;
            const u = userSnap.data();
            const ctx = Core.ctxForTimeZone(now, p.tz || 'Asia/Kolkata');
            const sent = p.sentDay === ctx.todayKey ? { ...(p.sent || {}) } : {};
            const snoozes = p.snoozes || {};
            const outbox = [];
            const inWindow = min => min != null && ctx.minuteOfDay >= min && ctx.minuteOfDay < min + WINDOW_MIN;

            // Prayer timings for prayer-linked reminders (cached per day)
            let timings = p.prayerCache && p.prayerCache.date === ctx.todayKey ? p.prayerCache.timings : null;
            const loc = u.deen && u.deen.location;
            const needsPrayer = (u.tasks || []).some(t => t.prayerAnchor && t.prayerAnchor.prayer);
            if (!timings && loc && needsPrayer) {
                try {
                    const [y, m, d] = ctx.todayKey.split('-');
                    const r = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${loc.lat}&longitude=${loc.lng}&method=${loc.method || 2}`);
                    const j = await r.json();
                    if (j.code === 200) timings = j.data.timings;
                } catch (e) { /* try next run */ }
            }

            // 1) Task reminders (+ snoozed re-alerts)
            for (const t of u.tasks || []) {
                if ((t.currentTarget ?? 1) <= 0) continue;
                const st = Core.taskStatus(t, u.history || [], ctx);
                if (st.isDone || !st.isDueToday) continue;
                const snoozeUntil = Math.max(Number(snoozes[t.id] || 0), Number(t.snoozedUntil || 0));
                if (snoozeUntil > now) continue;
                const left = Math.max(0, st.target - st.doneAmt);
                const due = t.type === 'once' && t.dueDate ? Core.dueLabel(Core.daysBetweenKeys(ctx.todayKey, t.dueDate)) : '';
                const body = [due, st.target > 1 ? `${left} left` : '', t.prayerAnchor ? Core.describeAnchor(t.prayerAnchor) : ''].filter(Boolean).join(' · ') || 'Time to do this';
                const exp = now + DAY;
                const msg = { kind: 'task', taskId: t.id, uid, title: '⏰ ' + t.title, tag: 'task-' + t.id, exp: String(exp), sig: signAction(uid, t.id, exp) };

                if (snoozeUntil && now - snoozeUntil < WINDOW_MIN * 60000 && !sent['z:' + t.id + ':' + snoozeUntil]) {
                    outbox.push({ ...msg, body: body + ' · snoozed' }); sent['z:' + t.id + ':' + snoozeUntil] = 1; continue;
                }
                const rMin = Core.reminderMinute(t, timings);
                const key = `t:${t.id}:${rMin}`;
                if (inWindow(rMin) && !sent[key]) { outbox.push({ ...msg, body }); sent[key] = 1; }
            }

            // 2) Recurring bills — 09:00 on each day inside the reminder window
            if (inWindow(9 * 60)) {
                for (const b of (u.budget && u.budget.bills) || []) {
                    const bs = Core.billStatus(b, ctx);
                    if (!bs.inWindow || sent['b:' + b.id]) continue;
                    outbox.push({ kind: 'bill', billId: b.id, title: `💳 ${b.name} — ₹${Number(b.amount).toLocaleString('en-IN')}`, body: Core.dueLabel(bs.daysLeft), tag: 'bill-' + b.id });
                    sent['b:' + b.id] = 1;
                }
            }

            // 2b) Debts & loans with a due date, and the yearly zakat anniversary — 09:00
            if (inWindow(9 * 60)) {
                for (const d of (u.budget && u.budget.debts) || []) {
                    const ds = Core.debtStatus(d, ctx);
                    if (!ds.remind || sent['d:' + d.id]) continue;
                    const owe = d.type === 'borrowed';
                    outbox.push({ kind: 'debt', title: `🤝 ${owe ? 'Repay' : 'Collect from'} ${d.desc} — ₹${Math.round(ds.pending).toLocaleString('en-IN')}`, body: `${owe ? 'You owe' : 'Owed to you by'} ${d.desc}: ${Core.dueLabel(ds.daysLeft)}`, tag: 'debt-' + d.id });
                    sent['d:' + d.id] = 1;
                }
                const z = Core.zakatStatus(u.extra && u.extra.zakatDate, ctx);
                if (z.remind && !sent.zakat) {
                    outbox.push({ kind: 'zakat', title: '🕌 Zakat reminder', body: z.daysLeft === 0 ? 'Your zakat anniversary is today.' : `Your zakat anniversary is in ${z.daysLeft} day${z.daysLeft === 1 ? '' : 's'}.`, tag: 'zakat' });
                    sent.zakat = 1;
                }
            }

            // 3) Evening summary
            const eveMin = Core.hmToMin((u.settings && u.settings.eveningTime) || '21:00');
            if (inWindow(eveMin) && !sent.eod) {
                const left = (u.tasks || []).filter(t => (t.currentTarget ?? 1) > 0 && (t.type === 'daily' || t.type === 'once') && Core.taskStatus(t, u.history || [], ctx).isDueToday);
                if (left.length) outbox.push({ kind: 'summary', title: `🌙 ${left.length} task${left.length > 1 ? 's' : ''} left today`, body: left.slice(0, 3).map(t => '• ' + t.title).join('\n') + (left.length > 3 ? `\n+${left.length - 3} more` : ''), tag: 'eod-summary' });
                sent.eod = 1;
            }

            // 4) Weekly report — Sunday 20:00
            if (ctx.dow === 0 && inWindow(20 * 60) && !sent.week) {
                const r = Core.weeklyReport({ tasks: u.tasks, history: u.history, budget: u.budget, journal: u.journal, goodHabits: u.goodHabits }, ctx.startOfDay - 7 * DAY, ctx.startOfDay);
                outbox.push({ kind: 'report', title: '📊 Your week in Hisab', body: `${r.rate != null ? r.rate + '% of daily tasks done' : r.completed + ' tasks done'} · ₹${r.spent.toLocaleString('en-IN')} spent${r.best ? ' · Best: ' + r.best.title : ''}`, tag: 'weekly-report' });
                sent.week = 1;
            }

            // Send
            const dead = new Set();
            for (const m of outbox) {
                const data = Object.fromEntries(Object.entries(m).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
                const r = await messaging.sendEachForMulticast({ tokens: tokens.map(x => x.token), data, webpush: { headers: { Urgency: 'high', TTL: '3600' } } });
                summary.sent += r.successCount;
                summary.messages.push(data.title);
                r.responses.forEach((resp, i) => {
                    const code = resp.error && resp.error.code;
                    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') dead.add(tokens[i].k);
                });
            }

            const update = { sentDay: ctx.todayKey, sent, lastRun: now };
            if (timings) update.prayerCache = { date: ctx.todayKey, timings };
            const cleanedSnoozes = Object.fromEntries(Object.entries(snoozes).filter(([, v]) => Number(v) > now - DAY));
            update.snoozes = cleanedSnoozes;
            if (dead.size) {
                const kept = Object.fromEntries(Object.entries(p.tokens || {}).filter(([k]) => !dead.has(k)));
                update.tokens = kept; summary.removedTokens += dead.size;
                await pushDoc.ref.update({ ...update });
            } else {
                await pushDoc.ref.set(update, { merge: true });
            }
        } catch (e) {
            summary.errors.push(`${uid.slice(0, 6)}…: ${e.message}`);
        }
    }
    return summary;
}
