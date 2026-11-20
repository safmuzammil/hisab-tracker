// =========================================================
// Hisab shared core — pure functions used by BOTH the web app
// (app.js) and the server (api/*.js). No DOM, no Firebase.
// =========================================================

export const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');

// ---------- Time context ----------
// A "ctx" describes "now" in the user's own timezone, so the server (UTC)
// and the phone agree on what "today" and "this week" mean.
export function ctxFromLocalDate(d = new Date()) {
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return buildCtx(d.getTime(), d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getDay(), startOfDay);
}

export function ctxForTimeZone(nowMs, timeZone = 'Asia/Kolkata') {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'
    }).formatToParts(new Date(nowMs)).forEach(p => { parts[p.type] = p.value; });
    const y = +parts.year, m = +parts.month, d = +parts.day, hh = +parts.hour % 24, mm = +parts.minute, ss = +parts.second;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const startOfDay = nowMs - ((hh * 60 + mm) * 60 + ss) * 1000 - (nowMs % 1000);
    return buildCtx(nowMs, y, m, d, hh, mm, dow, startOfDay);
}

function buildCtx(nowMs, y, m, d, hh, mm, dow, startOfDay) {
    const todayKey = `${y}-${pad(m)}-${pad(d)}`;
    const startOfWeek = startOfDay - dow * DAY;
    const daysIntoMonth = d - 1;
    const startOfMonth = startOfDay - daysIntoMonth * DAY;
    return {
        nowMs, y, m, d, hh, mm, dow, todayKey, startOfDay, startOfWeek, startOfMonth,
        minuteOfDay: hh * 60 + mm,
        monthKey: `${y}-${pad(m)}`,
        weekKey: keyFromStart(startOfWeek, y, m, d, dow)
    };
}
function keyFromStart(_ms, y, m, d, dow) {
    const dt = new Date(Date.UTC(y, m - 1, d - dow));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDaysKey(dateKey, n) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function daysBetweenKeys(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}
function dowOfKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

export const hmToMin = hm => { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const minToHm = min => { const v = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; };

// ---------- Tasks ----------
export function isActiveOnDow(task, dow) {
    return !task.activeDays || task.activeDays.length === 0 || task.activeDays.includes(dow);
}

export function periodKey(task, ctx) {
    if (task.type === 'weekly') return 'w' + ctx.weekKey;
    if (task.type === 'monthly') return 'm' + ctx.monthKey;
    if (task.type === 'once') return 'once';
    return 'd' + ctx.todayKey;
}

export function taskStatus(task, history, ctx) {
    const target = task.baseTarget || 1;
    const yearDone = (task.currentTarget ?? 1) <= 0;
    let since = ctx.startOfDay;
    if (task.type === 'weekly') since = ctx.startOfWeek;
    if (task.type === 'monthly') since = ctx.startOfMonth;
    const logs = (history || []).filter(h => h && h.taskId === task.id && h.actionType === 'complete');
    let doneAmt;
    if (task.type === 'once') doneAmt = logs.reduce((s, h) => s + (h.amount || 1), 0);
    else if (task.type === 'daily') doneAmt = logs.filter(h => h.fulfilledDateKey ? h.fulfilledDateKey === ctx.todayKey : h.timestamp >= ctx.startOfDay).reduce((s, h) => s + (h.amount || 1), 0);
    else doneAmt = logs.filter(h => h.timestamp >= since).reduce((s, h) => s + (h.amount || 1), 0);
    const isActiveToday = task.type !== 'daily' || isActiveOnDow(task, ctx.dow);
    const isDone = task.type === 'once' ? yearDone : (yearDone || doneAmt >= target);
    const isDueToday = !isDone && (
        (task.type === 'daily' && isActiveToday) || task.type === 'weekly' || task.type === 'monthly' ||
        (task.type === 'once' && (!task.dueDate || task.dueDate <= ctx.todayKey))
    );
    return { doneAmt, target, isDone, isActiveToday, isDueToday };
}

// Reminder minute-of-day for a task, or null. Prayer-anchored reminders need today's timings.
export function reminderMinute(task, timings) {
    if (task.prayerAnchor && task.prayerAnchor.prayer) {
        const t = timings && timings[task.prayerAnchor.prayer];
        const base = hmToMin(t);
        if (base == null) return null;
        return base + (Number(task.prayerAnchor.offset) || 0);
    }
    return hmToMin(task.reminderTime);
}

export function describeAnchor(anchor) {
    if (!anchor || !anchor.prayer) return '';
    const off = Number(anchor.offset) || 0;
    if (off === 0) return `At ${anchor.prayer}`;
    return off > 0 ? `${off}m after ${anchor.prayer}` : `${-off}m before ${anchor.prayer}`;
}

// ---------- Recurring bills ----------
// A bill is { id, name, amount, dueDay (1-31), category, remindBefore (days), paid: { 'YYYY-MM': expenseId } }
export function billDueKey(bill, ctx, monthOffset = 0) {
    const dt = new Date(Date.UTC(ctx.y, ctx.m - 1 + monthOffset, 1));
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = Math.min(Math.max(1, Number(bill.dueDay) || 1), last);
    return { key: `${y}-${pad(m)}-${pad(d)}`, monthKey: `${y}-${pad(m)}` };
}

// The occurrence that currently matters: this month's if unpaid, otherwise next month's.
export function billStatus(bill, ctx) {
    const cur = billDueKey(bill, ctx, 0);
    // A bill added after this month's due date starts next month
    const paidReal = !!(bill.paid && bill.paid[cur.monthKey]);
    const startsNext = !paidReal && !!(bill.startKey && cur.key < bill.startKey);
    const paidCur = paidReal;
    const occ = (paidReal || startsNext) ? billDueKey(bill, ctx, 1) : cur;
    const paid = !!(bill.paid && bill.paid[occ.monthKey]);
    const daysLeft = daysBetweenKeys(ctx.todayKey, occ.key);
    const remind = Number(bill.remindBefore ?? 2);
    return {
        dueKey: occ.key, monthKey: occ.monthKey, paid, paidThisMonth: paidCur, startsNext, daysLeft,
        overdue: !paid && daysLeft < 0,
        inWindow: !paid && daysLeft <= remind
    };
}

export function dueLabel(daysLeft) {
    if (daysLeft < 0) return `Overdue ${-daysLeft}d`;
    if (daysLeft === 0) return 'Due today';
    if (daysLeft === 1) return 'Due tomorrow';
    return `Due in ${daysLeft}d`;
}

// ---------- Weekly report ----------
export function weeklyReport({ tasks = [], history = [], budget = {}, journal = {}, goodHabits = [] }, startMs, endMs) {
    const inRange = h => h && h.timestamp >= startMs && h.timestamp < endMs;
    const logs = history.filter(inRange);
    const completes = logs.filter(h => h.actionType === 'complete' && (h.category === 'tasks' || !h.category));
    const missed = logs.filter(h => h.actionType === 'missed');
    // Scheduled daily slots vs fulfilled
    let slots = 0, hit = 0;
    for (let t = startMs; t < endMs; t += DAY) {
        const dow = new Date(t + DAY / 2).getDay();
        tasks.filter(x => x.type === 'daily' && (x.createdAt || 0) < t + DAY && isActiveOnDow(x, dow)).forEach(x => {
            slots++;
            const amt = history.filter(h => h.taskId === x.id && h.actionType === 'complete' && h.timestamp >= t && h.timestamp < t + DAY).reduce((s, h) => s + (h.amount || 1), 0);
            if (amt >= (x.baseTarget || 1)) hit++;
        });
    }
    const spent = (budget.expenses || []).filter(e => e.date >= startMs && e.date < endMs).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const penalties = logs.reduce((s, h) => s + (h.donationAdded || 0) + (h.coveredBySurplus || 0), 0);
    const goodLogs = logs.filter(h => h.actionType === 'good').length;
    const badLogs = logs.filter(h => h.actionType === 'bad').length;
    const hizb = logs.filter(h => h.actionType === 'deen_hizb').reduce((s, h) => s + (h.amount || 0), 0)
        + completes.filter(h => /hizb/i.test(h.title || '')).reduce((s, h) => s + (h.amount || 0), 0);
    const swalath = logs.filter(h => h.actionType === 'deen_swalath').reduce((s, h) => s + (h.amount || 0), 0);
    let journalDays = 0;
    for (const [k, v] of Object.entries(journal || {})) {
        const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d, 12).getTime();
        if (t >= startMs && t < endMs && v && v.trim()) journalDays++;
    }
    // per-task hit rate for highlights
    const perTask = tasks.filter(x => x.type === 'daily').map(x => {
        let s = 0, h = 0;
        for (let t = startMs; t < endMs; t += DAY) {
            const dow = new Date(t + DAY / 2).getDay();
            if ((x.createdAt || 0) >= t + DAY || !isActiveOnDow(x, dow)) continue;
            s++;
            const amt = history.filter(l => l.taskId === x.id && l.actionType === 'complete' && l.timestamp >= t && l.timestamp < t + DAY).reduce((a, l) => a + (l.amount || 1), 0);
            if (amt >= (x.baseTarget || 1)) h++;
        }
        return { title: x.title, slots: s, hit: h, rate: s ? h / s : 0 };
    }).filter(x => x.slots > 0).sort((a, b) => b.rate - a.rate);
    return {
        rate: slots ? Math.round((hit / slots) * 100) : null, slots, hit,
        completed: completes.length, missed: missed.length, spent, penalties,
        goodLogs, badLogs, hizb, swalath, journalDays,
        best: perTask[0] || null, worst: perTask.length > 1 ? perTask[perTask.length - 1] : null
    };
}

// ---------- Quick-add natural language parser ----------
const DOW = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const TAGS = ['health', 'study', 'deen', 'finance', 'personal'];

export function parseQuickAdd(input, ctx) {
    let s = ' ' + String(input || '').replace(/\s+/g, ' ').trim() + ' ';
    const out = { type: 'once', activeDays: null, dueDate: '', reminderTime: '', prayerAnchor: null, donationPenalty: 0, baseTarget: 1, tags: [] };
    const cut = re => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
    const dowRe = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs?|rsday)?|fri(?:day)?|sat(?:urday)?)';

    // tags  #health
    let m;
    while ((m = s.match(/\s#(\w+)/))) { s = s.replace(m[0], ' '); const t = m[1].toLowerCase(); if (TAGS.includes(t) && !out.tags.includes(t)) out.tags.push(t); }

    // penalty  ₹50 | rs 50 | rs.50 | penalty 50
    if ((m = cut(/\s(?:₹\s?|rs\.?\s?|inr\s?|penalty\s+₹?)(\d+(?:\.\d+)?)(?=\s)/i))) out.donationPenalty = Number(m[1]);

    // amount per period  x3 | 3 times | 3x
    if ((m = cut(/\s(?:x\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?(?:x|times))(?=\s)/i))) out.baseTarget = Number(m[1] || m[2]);

    // prayer anchor  "after fajr" | "15 min after asr" | "before maghrib"
    if ((m = cut(/\s(?:(\d+)\s?(?:m|min|mins|minutes)\s+)?(after|before)\s+(fajr|dhuhr|zuhr|duhr|asr|maghrib|isha)(?=\s)/i))) {
        let p = m[3].toLowerCase(); if (p === 'zuhr' || p === 'duhr') p = 'dhuhr';
        const prayer = p[0].toUpperCase() + p.slice(1);
        const mins = m[1] ? Number(m[1]) : (m[2].toLowerCase() === 'after' ? 10 : -15);
        out.prayerAnchor = { prayer, offset: m[2].toLowerCase() === 'after' ? Math.abs(mins) : -Math.abs(mins) };
    } else if ((m = cut(/\s(?:at\s+)?(fajr|dhuhr|zuhr|asr|maghrib|isha)(?:\s+time)?(?=\s)/i))) {
        let p = m[1].toLowerCase(); if (p === 'zuhr') p = 'dhuhr';
        out.prayerAnchor = { prayer: p[0].toUpperCase() + p.slice(1), offset: 0 };
    }

    // time  at 9 | 9am | 9:30 pm | 21:00 | noon | morning/evening/night
    if ((m = cut(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i))) {
        let h = Number(m[1]) % 12; if (m[3].toLowerCase() === 'pm') h += 12;
        out.reminderTime = `${pad(h)}:${pad(Number(m[2] || 0))}`;
    } else if ((m = cut(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/))) {
        out.reminderTime = `${pad(Number(m[1]))}:${m[2]}`;
    } else if ((m = cut(/\sat\s+(\d{1,2})(?=\s)/i))) {
        const h = Number(m[1]); out.reminderTime = `${pad(h < 7 ? h + 12 : h)}:00`;
    } else if ((m = cut(/\s(?:at\s+)?(noon|midnight|morning|afternoon|evening|night|tonight)(?=\s)/i))) {
        out.reminderTime = { noon: '12:00', midnight: '00:00', morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00', tonight: '21:00' }[m[1].toLowerCase()];
    }

    // recurrence
    if ((m = cut(/\s(?:every\s*day|daily|each day)(?=\s)/i))) out.type = 'daily';
    else if ((m = cut(/\s(?:every\s*week|weekly|each week)(?=\s)/i))) out.type = 'weekly';
    else if ((m = cut(/\s(?:every\s*month|monthly|each month)(?=\s)/i))) out.type = 'monthly';
    else if ((m = cut(/\s(?:every\s+)?weekdays(?=\s)/i))) { out.type = 'daily'; out.activeDays = [1, 2, 3, 4, 5]; }
    else if ((m = cut(/\s(?:every\s+)?weekends?(?=\s)/i))) { out.type = 'daily'; out.activeDays = [0, 6]; }
    else if ((m = cut(new RegExp(`\\s(?:every|on every|each)\\s+(${dowRe}(?:\\s*(?:,|and|&)?\\s*${dowRe})*)(?=\\s)`, 'i')))) {
        const days = [...m[1].toLowerCase().matchAll(new RegExp(dowRe, 'gi'))].map(x => DOW[x[0].toLowerCase()]);
        out.type = 'daily'; out.activeDays = [...new Set(days)].sort();
    }

    // one-time due date (only when not recurring)
    if (out.type === 'once') {
        if ((m = cut(/\s(?:due\s+)?today(?=\s)/i))) out.dueDate = ctx.todayKey;
        else if ((m = cut(/\s(?:due\s+)?(?:tomorrow|tmrw|tmr)(?=\s)/i))) out.dueDate = addDaysKey(ctx.todayKey, 1);
        else if ((m = cut(/\sin\s+(\d+)\s+(day|days|week|weeks)(?=\s)/i))) out.dueDate = addDaysKey(ctx.todayKey, Number(m[1]) * (/week/i.test(m[2]) ? 7 : 1));
        else if ((m = cut(/\snext\s+week(?=\s)/i))) out.dueDate = addDaysKey(ctx.todayKey, 7 - ctx.dow + 1);
        else if ((m = cut(new RegExp(`\\s(?:(?:due|on|by)\\s+)?(next\\s+)?${dowRe}(?=\\s)`, 'i')))) {
            const target = DOW[m[2].toLowerCase()];
            let diff = (target - ctx.dow + 7) % 7; if (diff === 0) diff = 7;
            out.dueDate = addDaysKey(ctx.todayKey, diff);
        }
        else if ((m = cut(/\s(?:(?:due|on|by)\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?=\s)/i))
            || (m = cut(/\s(?:(?:due|on|by)\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i))) {
            const a = m[1], b = m[2];
            const day = /^\d/.test(a) ? Number(a) : Number(b);
            const mon = MONTHS[(/^\d/.test(a) ? b : a).toLowerCase()];
            let y = ctx.y; let key = `${y}-${pad(mon)}-${pad(day)}`;
            if (key < ctx.todayKey) key = `${y + 1}-${pad(mon)}-${pad(day)}`;
            out.dueDate = key;
        }
        else if ((m = cut(/\s(?:(?:due|on|by)\s+)(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i)) || (m = cut(/\s(?:the\s+)?(\d{1,2})(st|nd|rd|th)(?=\s)/i))) {
            const day = Number(m[1]);
            if (day >= 1 && day <= 31) {
                let mon = ctx.m, y = ctx.y;
                if (day < ctx.d) { mon++; if (mon > 12) { mon = 1; y++; } }
                const last = new Date(Date.UTC(y, mon, 0)).getUTCDate();
                out.dueDate = `${y}-${pad(mon)}-${pad(Math.min(day, last))}`;
            }
        }
    }

    // Clean title
    let title = s.replace(/\s+(on|at|by|due|every|for|and|,)\s*$/i, ' ').replace(/^\s*(remind me to|remind me|todo|to)\s+/i, ' ').replace(/\s+/g, ' ').trim();
    title = title.replace(/[,\-–]+$/, '').trim();
    out.title = title ? title[0].toUpperCase() + title.slice(1) : '';
    return out;
}

export function describeParsed(p, ctx) {
    const bits = [];
    const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (p.type === 'daily') bits.push(p.activeDays ? p.activeDays.map(d => dn[d]).join(' ') : 'Every day');
    else if (p.type === 'weekly') bits.push('Weekly');
    else if (p.type === 'monthly') bits.push('Monthly');
    else bits.push('One-time');
    if (p.dueDate) {
        const diff = daysBetweenKeys(ctx.todayKey, p.dueDate);
        bits.push(diff === 0 ? 'due today' : diff === 1 ? 'due tomorrow' : `due ${dn[dowOfKey(p.dueDate)]} ${p.dueDate.slice(8)}/${p.dueDate.slice(5, 7)}`);
    }
    if (p.prayerAnchor) bits.push(describeAnchor(p.prayerAnchor));
    if (p.reminderTime && !p.prayerAnchor) bits.push(p.reminderTime);
    if (p.baseTarget > 1) bits.push(`×${p.baseTarget}`);
    if (p.donationPenalty) bits.push(`₹${p.donationPenalty} penalty`);
    if (p.tags.length) bits.push(p.tags.map(t => '#' + t).join(' '));
    return bits;
}
