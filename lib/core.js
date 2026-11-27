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

// Flexible repeat rules for daily-type tasks:
//   {kind:'everyN', n, anchor:'YYYY-MM-DD'}  every N days counted from the anchor day
//   {kind:'nth', nth:1..4 | -1 (last), dow:0..6}  e.g. every 2nd Friday of the month
//   {kind:'monthday', day:1..31}  a fixed day of the month (clamped to the month's last day)
export function isActiveOnDate(task, dateKey, dow) {
    if (!isActiveOnDow(task, dow)) return false;
    const r = task && task.recur;
    if (!r || !r.kind) return true;
    const [y, m, d] = dateKey.split('-').map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (r.kind === 'everyN') {
        const n = Math.max(1, parseInt(r.n, 10) || 1);
        if (!r.anchor) return true;
        const diff = daysBetweenKeys(r.anchor, dateKey);
        return diff >= 0 && diff % n === 0;
    }
    if (r.kind === 'nth') {
        if (dow !== Number(r.dow)) return false;
        const nth = parseInt(r.nth, 10);
        if (nth === -1) return d + 7 > dim;
        return Math.ceil(d / 7) === nth;
    }
    if (r.kind === 'monthday') {
        const day = Math.min(Math.max(1, parseInt(r.day, 10) || 1), dim);
        return d === day;
    }
    return true;
}

export function describeRecur(r) {
    if (!r || !r.kind) return '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (r.kind === 'everyN') return `Every ${r.n} days`;
    if (r.kind === 'nth') { const o = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', '-1': 'last' }[r.nth] || r.nth; return `${o} ${days[r.dow]} of the month`; }
    if (r.kind === 'monthday') return `Monthly on day ${r.day}`;
    return '';
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
    const isActiveToday = task.type !== 'daily' || isActiveOnDate(task, ctx.todayKey, ctx.dow);
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

// Debts / loans with an optional due date (YYYY-MM-DD). Remind 1 day before, on the day, then at +1/+3/+7 days overdue.
export function debtStatus(debt, ctx) {
    const pending = (Number(debt.amount) || 0) - (Number(debt.repaid) || 0);
    if (!debt.due || pending <= 0) return { pending, active: false, remind: false, daysLeft: null };
    const daysLeft = daysBetweenKeys(ctx.todayKey, debt.due);
    const remind = daysLeft === 1 || daysLeft === 0 || daysLeft === -1 || daysLeft === -3 || daysLeft === -7;
    return { pending, active: true, remind, daysLeft };
}

// Yearly zakat anniversary: remind 7 days before, 1 day before, and on the day.
export function zakatStatus(zakatDate, ctx) {
    if (!zakatDate || !/^\d{4}-\d{2}-\d{2}$/.test(zakatDate)) return { set: false, remind: false, daysLeft: null };
    const [, zm, zd] = zakatDate.split('-').map(Number);
    const [cy] = ctx.todayKey.split('-').map(Number);
    const mk = y => `${y}-${pad(zm)}-${pad(Math.min(zd, new Date(Date.UTC(y, zm, 0)).getUTCDate()))}`;
    let next = mk(cy);
    if (daysBetweenKeys(ctx.todayKey, next) < 0) next = mk(cy + 1);
    const daysLeft = daysBetweenKeys(ctx.todayKey, next);
    return { set: true, next, daysLeft, remind: daysLeft === 7 || daysLeft === 1 || daysLeft === 0 };
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

// =====================================================================
// HIJRI CALENDAR (Umm al-Qura via Intl, with a ±days moon-sighting adjustment)
// =====================================================================
export const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];
let _hijriFmt = null;
const _hijriCache = new Map();
function hijriFmt() {
    if (!_hijriFmt) _hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
    return _hijriFmt;
}
// Hijri date of a Gregorian day key. adj shifts it (e.g. -1 if local sighting is a day behind).
export function hijriParts(key, adj = 0) {
    const ck = key + '|' + adj;
    if (_hijriCache.has(ck)) return _hijriCache.get(ck);
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + Number(adj || 0), 12));
    const out = { y: 0, m: 0, d: 0 };
    for (const p of hijriFmt().formatToParts(dt)) {
        if (p.type === 'year') out.y = parseInt(p.value, 10);
        else if (p.type === 'month') out.m = parseInt(p.value, 10);
        else if (p.type === 'day') out.d = parseInt(p.value, 10);
    }
    if (_hijriCache.size > 5000) _hijriCache.clear();
    _hijriCache.set(ck, out);
    return out;
}
export function hijriKey(key, adj = 0) { const h = hijriParts(key, adj); return `${h.y}-${pad(h.m)}-${pad(h.d)}`; }
export function hijriLabel(key, adj = 0, short = false) {
    if (!key) return '';
    const h = hijriParts(key, adj);
    const mn = HIJRI_MONTHS[h.m - 1] || '';
    return `${h.d} ${short ? mn.replace(/^(\S+).*$/, '$1') : mn} ${h.y}`;
}
// Gregorian day key for a Hijri date. A 30th that doesn't exist that year falls on the 1st of the next month.
export function gregFromHijri(hy, hm, hd, adj = 0) {
    hd = Math.max(1, Math.min(30, hd));
    // Anchor: 1 Muharram 1448 ≈ 2026-06-16 (Umm al-Qura). Estimate, then search.
    const est = Math.round((hy - 1448) * 354.36707 + (hm - 1) * 29.530589 + (hd - 1));
    const base = addDaysKey('2026-06-16', est);
    const cmp = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;
    const want = { y: hy, m: hm, d: hd };
    let best = null;
    for (let off = -6; off <= 6; off++) {
        const k = addDaysKey(base, off);
        const h = hijriParts(k, adj);
        const c = cmp(h, want);
        if (c === 0) return k;
        if (c > 0 && (!best || k < best)) best = k;   // first day after the wanted date
    }
    return best || base;
}
export function hijriAddYears(key, n = 1, adj = 0) { const h = hijriParts(key, adj); return gregFromHijri(h.y + n, h.m, h.d, adj); }

// =====================================================================
// METAL PRICES — daily series with carry-forward, Indian premium and per-day overrides
// prices: { 'YYYY-MM-DD': { s: silver ₹/g, g: gold ₹/g, u: ₹ per USD } } (international, from the daily feed)
// overrides: { 'YYYY-MM-DD': { s?, g? } } — exact ₹/g, premium not applied
// =====================================================================
export function makePriceLookup(prices = {}, overrides = {}, premiumPct = 0) {
    const keys = Object.keys(prices).filter(k => prices[k]).sort();
    const mult = 1 + (Number(premiumPct) || 0) / 100;
    const lastAtOrBefore = (field, key) => {
        let lo = 0, hi = keys.length - 1, ans = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid] <= key) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
        for (let i = ans; i >= 0; i--) { const v = prices[keys[i]][field]; if (v > 0) return v; }
        for (let i = Math.max(0, ans + 1); i < keys.length; i++) { const v = prices[keys[i]][field]; if (v > 0) return v; }
        return 0;
    };
    return {
        silver: key => (overrides[key] && overrides[key].s > 0) ? overrides[key].s : lastAtOrBefore('s', key) * mult,
        gold: key => (overrides[key] && overrides[key].g > 0) ? overrides[key].g : lastAtOrBefore('g', key) * mult,
        usd: key => lastAtOrBefore('u', key),
        hasData: key => keys.length > 0 && keys[0] <= key,
    };
}

// =====================================================================
// ZAKAT INPUTS — turn Hisab's budget data into money events for the hawl engine.
// keyOf(ms) must return the user's local 'YYYY-MM-DD' for a timestamp.
// Shafi'i: money lent stays your wealth (moving cash → receivable doesn't change it),
// borrowed money in hand is your wealth, and debts you owe are not deducted.
// =====================================================================
export function zakatInputsFromBudget(budget = {}, keyOf) {
    const z = budget.zakat || {};
    const start = z.startKey;
    if (!start) return null;
    const ev = [];
    const add = (key, amount, kind, label, heldSince) => { if (key && amount) ev.push({ key, amount, kind, label, heldSince: heldSince || key }); };
    for (const o of z.openings || []) {
        // An opening dated after tracking began enters on that day; one held from before keeps its earlier date.
        const k = o.heldSince && o.heldSince > start ? o.heldSince : start;
        add(k, Number(o.amount) || 0, 'opening', o.label || 'Starting balance', o.heldSince && o.heldSince < k ? o.heldSince : k);
    }
    for (const c of z.adjust || []) { const k = c.key; if (k >= start) add(k, Number(c.amount) || 0, 'correction', c.amount > 0 ? 'Balance correction (more)' : 'Balance correction (less)', c.amount > 0 ? (c.heldSince || k) : k); }
    for (const i of budget.income || []) { const k = keyOf(i.date); if (k >= start) add(k, Number(i.amount) || 0, 'income', i.desc || 'Income'); }
    for (const e of budget.expenses || []) { const k = keyOf(e.date); if (k >= start) add(k, -(Number(e.amount) || 0), 'expense', e.desc || 'Expense'); }
    for (const p of z.payments || []) { const k = keyOf(p.date); if (k >= start) add(k, -(Number(p.amount) || 0), 'zakat', 'Zakat paid'); }
    const recv = [];   // receivable changes (for the "payable when collected" note)
    for (const d of budget.debts || []) {
        const dk = keyOf(d.date);
        const amt = Number(d.amount) || 0;
        const pays = Array.isArray(d.payments) && d.payments.length ? d.payments.map(p => ({ key: keyOf(p.date), amount: Number(p.amount) || 0 }))
            : (Number(d.repaid) > 0 ? [{ key: dk, amount: Number(d.repaid) }] : []);
        if (d.type === 'borrowed') {
            if (dk >= start) add(dk, amt, 'borrowed', 'Borrowed from ' + (d.desc || ''));
            for (const p of pays) if (p.key >= start) add(p.key, -p.amount, 'repaid', 'Repaid ' + (d.desc || ''));
        } else {
            // Lent: wealth-neutral after tracking starts. A loan made before tracking started
            // isn't in the starting cash, so it enters as wealth held since the day it was lent.
            if (dk < start) {
                const paidBefore = pays.filter(p => p.key < start).reduce((s, p) => s + p.amount, 0);
                const pending = Math.max(0, amt - paidBefore);
                if (pending > 0) add(start, pending, 'receivable', 'Owed by ' + (d.desc || ''), dk);
                recv.push({ key: start, delta: pending });
            } else recv.push({ key: dk, delta: amt });
            for (const p of pays) if (p.key >= start) recv.push({ key: p.key, delta: -p.amount });
        }
    }
    // Same-day order: money in before money out, so a salary and the rent paid from it net correctly.
    ev.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : (b.amount > 0) - (a.amount > 0));
    recv.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    const assets = (z.assets || []).map(a => ({ ...a, heldSince: a.heldSince || start }));
    return { startKey: start, events: ev, receivables: recv, assets, adj: Number(z.hijriAdj) || 0, nisabGrams: Number(z.nisabGrams) || 595, premiumPct: z.premiumPct == null ? 10 : Number(z.premiumPct), prices: z.prices || {}, overrides: z.overrides || {}, payments: (z.payments || []).map(p => ({ key: keyOf(p.date), amount: Number(p.amount) || 0 })) };
}

// =====================================================================
// HAWL ENGINE (Shafi'i): every amount has its own Hijri year; on any day total
// wealth is below nisab (nisabGrams × silver ₹/g that day), every year restarts the
// next day wealth is back at nisab. Spending is taken from the newest money first
// (the cautious choice: older money keeps its year).
// =====================================================================
export function hawlEngine(inp, todayKey) {
    if (!inp) return null;
    const adj = inp.adj || 0;
    const P = makePriceLookup(inp.prices, inp.overrides, inp.premiumPct);
    const start = inp.startKey;
    const MAXD = 900;
    let fromKey = start;
    if (daysBetweenKeys(start, todayKey) > MAXD) fromKey = addDaysKey(todayKey, -MAXD);
    const assetValue = (a, key) => {
        if (a.mode === 'grams') {
            const g = Number(a.grams) || 0;
            if (a.cat === 'gold') return g * ((Number(a.karat) || 24) / 24) * P.gold(key);
            if (a.cat === 'silver') return g * P.silver(key);
        }
        const v = Number(a.amount) || 0;
        return a.cur === 'USD' ? v * P.usd(key) : v;
    };
    // Tranches: money ones shrink with spending; asset ones carry their own value.
    const tr = [];
    const newTranche = (t) => {
        // Roll anniversaries that fell before tracking started (paid outside Hisab).
        let cs = t.heldSince;
        let due = hijriAddYears(cs, 1, adj);
        while (due < fromKey) { cs = due; due = hijriAddYears(cs, 1, adj); }
        t.cycleStart = cs; t.due = due; tr.push(t);
    };
    for (const a of inp.assets || []) if (a.heldSince <= todayKey) newTranche({ id: 'a:' + a.id, label: a.name || 'Asset', asset: a, heldSince: a.heldSince, amount: 0 });

    let ei = 0, ri = 0, recv = 0;
    const events = inp.events || [], recvEv = inp.receivables || [];
    const series = [], dues = [], breaks = [];
    let wasAbove = true, missingPrice = 0, minMargin = null;
    for (let key = fromKey; key <= todayKey; key = addDaysKey(key, 1)) {
        while (ei < events.length && events[ei].key <= key) {
            const e = events[ei++];
            if (e.key < fromKey && e.amount < 0) continue;
            if (e.amount > 0) newTranche({ id: 'm' + ei, label: e.label, kind: e.kind, heldSince: e.heldSince > key ? key : e.heldSince, amount: e.amount, added: e.key });
            else {
                let out = -e.amount;
                // LIFO: newest money first
                const money = tr.filter(t => !t.asset && t.amount > 0).sort((a, b) => (b.added || '') < (a.added || '') ? -1 : (b.added || '') > (a.added || '') ? 1 : (b.heldSince < a.heldSince ? -1 : 1));
                for (const t of money) { if (out <= 0) break; const use = Math.min(t.amount, out); t.amount -= use; out -= use; }
            }
        }
        while (ri < recvEv.length && recvEv[ri].key <= key) recv = Math.max(0, recv + recvEv[ri++].delta);
        let money = 0, assets = 0;
        for (const t of tr) { if (t.asset) { if (t.asset.heldSince <= key) { t.amount = assetValue(t.asset, key); assets += t.amount; } } else money += t.amount; }
        const wealth = Math.max(0, money + assets);
        const silver = P.silver(key);
        if (!silver) missingPrice++;
        const nisab = silver ? (inp.nisabGrams || 595) * silver : null;
        const above = nisab == null ? true : wealth >= nisab;
        if (nisab != null) { const m = wealth - nisab; if (minMargin == null || m < minMargin.margin) minMargin = { key, margin: m }; }
        series.push({ key, wealth: Math.round(wealth), nisab: nisab == null ? null : Math.round(nisab), above, receivable: Math.round(recv) });
        if (!above) {
            if (wasAbove) breaks.push({ key, wealth: Math.round(wealth), nisab: Math.round(nisab) });
            for (const t of tr) if (t.heldSince <= key) { t.cycleStart = null; t.due = null; }
        } else {
            // Back at nisab (or first day held while above): the year starts again today.
            for (const t of tr) if (t.cycleStart == null && t.heldSince <= key) { t.cycleStart = key; t.due = hijriAddYears(key, 1, adj); }
        }
        if (above) {
            const share = wealth > 0 ? Math.min(1, recv / wealth) : 0;
            for (const t of tr) {
                if (t.due !== key) continue;
                const base = t.amount;
                if (base > 0) dues.push({ key, hijri: hijriLabel(key, adj), label: t.label, kind: t.asset ? 'asset' : t.kind, since: t.cycleStart, base: Math.round(base), zakat: Math.round(base * 0.025 * 100) / 100, onReceivable: Math.round(base * 0.025 * share * 100) / 100 });
                t.cycleStart = key; t.due = hijriAddYears(key, 1, adj);
            }
        }
        wasAbove = above;
    }
    const last = series[series.length - 1] || { wealth: 0, nisab: null, above: true, receivable: 0 };
    const upcomingMap = new Map();
    for (const t of tr) {
        if (!t.due || t.amount <= 0) continue;
        const u = upcomingMap.get(t.due) || { key: t.due, hijri: hijriLabel(t.due, adj), base: 0, zakat: 0, parts: [] };
        u.base += t.amount; u.zakat += t.amount * 0.025; u.parts.push({ label: t.label, amount: Math.round(t.amount), since: t.cycleStart });
        upcomingMap.set(t.due, u);
    }
    const upcoming = [...upcomingMap.values()].sort((a, b) => a.key < b.key ? -1 : 1).map(u => ({ ...u, base: Math.round(u.base), zakat: Math.round(u.zakat * 100) / 100 }));
    const totalDue = dues.reduce((s, d) => s + d.zakat, 0);
    const paid = (inp.payments || []).filter(p => p.key >= fromKey).reduce((s, p) => s + p.amount, 0);
    return {
        fromKey, todayKey, series, dues, breaks, upcoming,
        wealth: last.wealth, nisab: last.nisab, above: last.above, receivable: last.receivable,
        silverToday: P.silver(todayKey), goldToday: P.gold(todayKey), usdToday: P.usd(todayKey),
        totalDue: Math.round(totalDue * 100) / 100, paid: Math.round(paid * 100) / 100,
        outstanding: Math.round((totalDue - paid) * 100) / 100,
        onReceivable: Math.round(dues.reduce((s, d) => s + d.onReceivable, 0) * 100) / 100,
        missingPrice, minMargin,
        tranches: tr.filter(t => t.amount > 0).map(t => ({ label: t.label, amount: Math.round(t.amount), since: t.cycleStart, due: t.due, asset: !!t.asset })),
    };
}

// =====================================================================
// MONTHLY MONEY SUMMARY — ym = 'YYYY-MM'
// =====================================================================
export function monthMoney(budget = {}, ym, keyOf) {
    const inM = ms => keyOf(ms).slice(0, 7) === ym;
    const income = (budget.income || []).filter(i => inM(i.date));
    const expenses = (budget.expenses || []).filter(e => inM(e.date));
    const sum = a => a.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const byCat = {}, bySrc = {};
    for (const e of expenses) byCat[e.category || 'other'] = (byCat[e.category || 'other'] || 0) + (Number(e.amount) || 0);
    for (const i of income) bySrc[i.source || 'other'] = (bySrc[i.source || 'other'] || 0) + (Number(i.amount) || 0);
    let lent = 0, borrowed = 0, gotBack = 0, paidBack = 0;
    for (const d of budget.debts || []) {
        if (inM(d.date)) { if (d.type === 'lent') lent += Number(d.amount) || 0; else borrowed += Number(d.amount) || 0; }
        for (const p of d.payments || []) if (inM(p.date)) { if (d.type === 'lent') gotBack += Number(p.amount) || 0; else paidBack += Number(p.amount) || 0; }
    }
    const zakat = sum(((budget.zakat || {}).payments || []).filter(p => inM(p.date)));
    const inc = sum(income), spent = sum(expenses);
    return {
        ym, income: inc, spent, saved: inc - spent, rate: inc > 0 ? Math.round((inc - spent) / inc * 100) : null,
        byCat, bySrc, top: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 3).map(e => ({ desc: e.desc, amount: Number(e.amount) || 0 })),
        lent, borrowed, gotBack, paidBack, zakat, count: expenses.length,
    };
}

// ---------- Sync merge (per-item, newest change wins) ----------
// Every item edited on a device gets `updatedAt` stamped when it is saved. When two
// devices disagree about an item, the one changed most recently wins. Items that have
// never been stamped (older data) fall back to the earlier rules.
function stampOf(o) { return Number(o && o.updatedAt) || 0; }
function pickNewer(l, c) {
    const lu = stampOf(l), cu = stampOf(c);
    if (!lu && !cu) return null;
    return lu > cu ? 'l' : 'c';
}
function legacyTaskMerge(lt, ct, todayStr) {
    const isLocalDoneToday = lt.lastCompletedDay === todayStr;
    const isCloudDoneToday = ct.lastCompletedDay === todayStr;
    const effectiveCompletedDay = isLocalDoneToday ? lt.lastCompletedDay : (isCloudDoneToday ? ct.lastCompletedDay : lt.lastCompletedDay || ct.lastCompletedDay);
    let mergedTarget = ct.currentTarget;
    if (isLocalDoneToday && !isCloudDoneToday) mergedTarget = lt.currentTarget;
    else if (typeof lt.currentTarget === 'number' && typeof ct.currentTarget === 'number') mergedTarget = Math.min(lt.currentTarget, ct.currentTarget);
    return { ...ct, ...lt, lastCompletedDay: effectiveCompletedDay, currentTarget: mergedTarget, isCompleted: (mergedTarget <= 0) || lt.isCompleted || ct.isCompleted };
}
// Tasks and archived tasks are merged together so archiving / unarchiving moves cleanly.
export function mergeTaskSets(local, cloud, isDeleted = () => false, todayStr = new Date().toDateString()) {
    const recs = new Map();
    const add = (arr, side, loc) => (arr || []).forEach(t => {
        if (!t || t.id === undefined || t.id === null || isDeleted(t.id)) return;
        const id = String(t.id);
        if (!recs.has(id)) recs.set(id, {});
        const r = recs.get(id);
        if (!r[side]) { r[side] = t; r[side + 'loc'] = loc; }
    });
    add(cloud.tasks, 'c', 'a'); add(cloud.archived, 'c', 'z');
    add(local.tasks, 'l', 'a'); add(local.archived, 'l', 'z');
    const tasks = [], archived = [];
    for (const r of recs.values()) {
        let item, loc;
        if (r.l && !r.c) { item = r.l; loc = r.lloc; }
        else if (r.c && !r.l) { item = r.c; loc = r.cloc; }
        else {
            const w = pickNewer(r.l, r.c);
            if (w === 'l') { item = r.l; loc = r.lloc; }
            else if (w === 'c') { item = r.c; loc = r.cloc; }
            else { item = legacyTaskMerge(r.l, r.c, todayStr); loc = (r.lloc === 'z' || r.cloc === 'z') ? 'z' : 'a'; }
        }
        (loc === 'z' ? archived : tasks).push(item);
    }
    return { tasks, archived };
}
// Generic list of {id,...} records (habits). Unstamped conflicts keep the cloud copy.
export function mergeById(localArr, cloudArr, isDeleted = () => false) {
    const out = new Map();
    for (const c of cloudArr || []) if (c && c.id != null && !isDeleted(c.id)) out.set(String(c.id), c);
    for (const l of localArr || []) {
        if (!l || l.id == null || isDeleted(l.id)) continue;
        const id = String(l.id), c = out.get(id);
        if (!c) out.set(id, l);
        else if (pickNewer(l, c) === 'l') out.set(id, l);
    }
    return Array.from(out.values());
}
