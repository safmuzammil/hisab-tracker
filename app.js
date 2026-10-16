// ==========================================
// FIREBASE CLOUD SERVER INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPw0XqzplPvH6KxbcJxwYNdyjfdPDntNo",
    authDomain: "hisab-1127d.firebaseapp.com",
    projectId: "hisab-1127d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
let currentUser = null;

document.getElementById('google-signin-button').innerHTML = `
    <button onclick="loginWithGoogle()" style="background:#fff; color:#000; display:flex; align-items:center; gap:10px; width:100%; justify-content:center; padding:12px; border-radius:8px; font-weight:bold;">
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20"> Continue with Google
    </button>`;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        showProfile({ name: user.displayName, email: user.email, picture: user.photoURL });
        listenToFirebase(); 
    } else {
        currentUser = null;
        document.getElementById('login-prompt').style.display = 'block';
        document.getElementById('auth-container').style.display = 'none';
        hasInitialCloudSync = true;
        migrateLegacyTasks();
        processAutomaticPenalties(); 
        render();
    }
});

function loginWithGoogle() { 
    setPersistence(auth, browserLocalPersistence).then(() => { return signInWithPopup(auth, provider); })
    .then((result) => { currentUser = result.user; showProfile({ name: currentUser.displayName, email: currentUser.email, picture: currentUser.photoURL }); listenToFirebase(); })
    .catch((error) => { console.error(error); alert("Login Failed: " + error.message); }); 
}

function logout() { signOut(auth).then(() => { location.reload(); }); }

function showProfile(user) {
    document.getElementById('login-prompt').style.display = 'none';
    const authContainer = document.getElementById('auth-container');
    authContainer.style = 'display: flex; justify-content: space-between; align-items: center; background: var(--card); padding: 10px 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border);';
    authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${user.picture}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid #333;">
            <div style="line-height: 1.2; text-align:left;">
                <div style="font-weight: bold; font-size: 1rem; color: #fff;">${user.name}</div>
                <div style="font-size: 0.75rem; color: #aaa;">${user.email}</div>
            </div>
        </div>
        <button onclick="logout()" style="background: transparent; border: 1px solid #444; color: #aaa; padding: 6px 12px; margin: 0; width: auto; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
            Logout
        </button>
    `;
}

// ==========================================
// APP STATE & STORAGE
// ==========================================
let lastModifiedLocal = parseInt(localStorage.getItem('hisab_last_modified')) || 0; 
let tasks = JSON.parse(localStorage.getItem('hisab_tasks')) || [];
let activityHistory = JSON.parse(localStorage.getItem('hisab_history')) || [];
let badHabits = JSON.parse(localStorage.getItem('hisab_bad_habits')) || []; 
let goodHabits = JSON.parse(localStorage.getItem('hisab_good_habits')) || []; 
let bonusPoints = parseInt(localStorage.getItem('hisab_bonus_points')) || 0;
let charityData = JSON.parse(localStorage.getItem('hisab_charity')) || { pending: 0, paid: 0, surplus: 0 }; 
if (isNaN(charityData.pending) || charityData.pending == null) charityData.pending = 0;
if (isNaN(charityData.paid) || charityData.paid == null) charityData.paid = 0;
if (isNaN(charityData.surplus) || charityData.surplus == null) charityData.surplus = 0;

let deenData = JSON.parse(localStorage.getItem('hisab_deen')) || {};
if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };
if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
if (!deenData.zakatInputs) deenData.zakatInputs = { cash: 0, gold: 0, invest: 0 };
if (!deenData.quran) deenData.quran = [];
if (!deenData.dhikr) deenData.dhikr = [];

let budgetData = JSON.parse(localStorage.getItem('hisab_budget')) || { limit: 0, expenses: [], debts: [] };
if (!budgetData.debts) budgetData.debts = [];
let backlogData = JSON.parse(localStorage.getItem('hisab_backlog')) || [];

let tasksProgressChart = null;
let badHabitsChart = null;
let showAllQada = false;
let currentHistoryFilter = 'all';
let active30DayTaskId = null;
let selected30DayDateKey = null;

// ==========================================
// DATE HELPERS FOR ACCURATE DAY BOUNDARIES
// ==========================================
function toDateKey(dateInput) {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getDayBounds(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    const noon = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    return { start, end, noon };
}

function isLogOnDateKey(log, dateKey) {
    if (log.missedDateKey === dateKey || log.fulfilledDateKey === dateKey) return true;
    const { start, end } = getDayBounds(dateKey);
    return log.timestamp >= start && log.timestamp <= end;
}

// ==========================================
// GOOGLE SHEETS LIVE SYNC ('RawLogs')
// ==========================================
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxnUQz9WnM2X3tAIL3o2JdZO3u28SBBN5MlD8CF_mQKZ634qzto5AWiawyX7cjmqn00/exec";

function syncToGoogleSheets(logEntry) {
    if (!GOOGLE_SHEETS_URL) return;
    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(logEntry)
    }).catch(err => console.error("Google Sheets sync failed:", err));
}

// ==========================================
// STALE-TAB LOCK & CLOUD SYNC LOGIC
// ==========================================
let hasInitialCloudSync = false;

function listenToFirebase() {
    if (!currentUser) return;
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const parsed = docSnap.data();
            const cloudModified = parsed.lastModified || 0;

            if (!hasInitialCloudSync || cloudModified > lastModifiedLocal) {
                tasks = parsed.tasks || []; 
                activityHistory = parsed.history || []; 
                badHabits = parsed.badHabits || []; 
                goodHabits = parsed.goodHabits || [];
                bonusPoints = parsed.bonusPoints || 0;
                charityData = parsed.charity || charityData;
                if (isNaN(charityData.surplus)) charityData.surplus = 0;
                budgetData = parsed.budget || budgetData;
                if (!budgetData.debts) budgetData.debts = [];
                backlogData = parsed.backlog || backlogData;
                
                if (parsed.deen) { 
                    deenData = parsed.deen; 
                    if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
                    if (!deenData.zakatInputs) deenData.zakatInputs = { cash: 0, gold: 0, invest: 0 };
                    if (!deenData.quran) deenData.quran = [];
                    if (!deenData.dhikr) deenData.dhikr = [];
                }
                if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
                if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };

                lastModifiedLocal = cloudModified;
                localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString());
                hasInitialCloudSync = true;
                
                let legacyChanged = migrateLegacyTasks();
                let autoChanged = processAutomaticPenalties();
                if (legacyChanged || autoChanged) {
                    saveData();
                } else {
                    saveDataLocallyOnly();
                }
                render();
                return; 
            }

            hasInitialCloudSync = true;
            let legacyChanged = migrateLegacyTasks();
            let autoChanged = processAutomaticPenalties(); 
            
            if (legacyChanged || autoChanged) { saveData(); }
            else { saveDataLocallyOnly(); }
            render();
        } else { 
            hasInitialCloudSync = true;
            migrateLegacyTasks();
            processAutomaticPenalties();
            saveData(); 
        }
    });
}

function migrateLegacyTasks() {
    let needsSave = false;
    tasks.forEach(t => {
        if (!t.createdAt || isNaN(new Date(t.createdAt).getTime())) { t.createdAt = parseInt(t.id) || Date.now(); needsSave = true; }
        if (!t.legacyMigrated) {
            const periodsLeftToday = getPeriodsLeft(t.type || 'daily', Date.now());
            t.totalYearlyTarget = getPeriodsLeft(t.type || 'daily', t.createdAt) * (t.baseTarget || 1);
            t.currentTarget = periodsLeftToday * (t.baseTarget || 1);
            t.legacyMigrated = true;
            t.isCompleted = false;
            needsSave = true;
        }
    });
    return needsSave;
}

// ==========================================
// FIXED MORNING MISSED TASKS & PENALTY ENGINE
// Strictly checks up to YESTERDAY (never marks today's pending tasks as missed!)
// ==========================================
function processAutomaticPenalties() {
    if (!hasInitialCloudSync) return false;

    let needsSave = false;
    let totalPenaltyAdded = 0;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayDate = new Date(todayStart - 86400000);
    const yesterdayKey = toDateKey(yesterdayDate);
    let yesterdayMissedTitles = [];

    tasks.forEach(t => {
        if (t.type === 'daily' && (t.isMaxOnceDaily || (t.donationPenalty && t.donationPenalty > 0))) {
            const createdStart = new Date(t.createdAt || Date.now());
            createdStart.setHours(0, 0, 0, 0);

            if (!t.lastEvaluatedDateKey) {
                if (t.penaltyCheckDate) {
                    const parsedOld = new Date(t.penaltyCheckDate);
                    parsedOld.setHours(0, 0, 0, 0);
                    const initDate = new Date(Math.min(parsedOld.getTime(), todayStart) - 86400000);
                    t.lastEvaluatedDateKey = toDateKey(Math.max(createdStart.getTime() - 86400000, initDate.getTime()));
                } else {
                    t.lastEvaluatedDateKey = toDateKey(new Date(todayStart - 86400000));
                }
                needsSave = true;
            }

            let cursor = getDayBounds(t.lastEvaluatedDateKey).start + 86400000;
            while (cursor < todayStart) {
                const checkKey = toDateKey(cursor);
                const { start, noon } = getDayBounds(checkKey);

                if (start >= createdStart.getTime()) {
                    const doneLogs = activityHistory.filter(h =>
                        h.taskId === t.id &&
                        h.actionType === 'complete' &&
                        isLogOnDateKey(h, checkKey)
                    );
                    const amountDone = doneLogs.reduce((s, h) => s + (h.amount || 1), 0);
                    const alreadyMarkedMissed = activityHistory.some(h =>
                        h.taskId === t.id &&
                        h.actionType === 'missed' &&
                        isLogOnDateKey(h, checkKey)
                    );

                    if (amountDone < (t.baseTarget || 1) && !alreadyMarkedMissed) {
                        let dayPenalty = 0;
                        let strictPenaltyTriggered = false;
                        let addedPenalty = 0;
                        let coveredSurplus = 0;

                        if (t.isMaxOnceDaily) {
                            t.missedCount = (t.missedCount || 0) + 1;
                            if (t.missedCount >= 5) {
                                dayPenalty += 50;
                                strictPenaltyTriggered = true;
                                t.missedCount = 0;
                            }
                        }
                        if (t.donationPenalty > 0) {
                            dayPenalty += t.donationPenalty;
                        }

                        if (dayPenalty > 0) {
                            const res = applyPenalty(dayPenalty);
                            addedPenalty = res.addedToPending;
                            coveredSurplus = res.coveredBySurplus;
                            totalPenaltyAdded += dayPenalty;
                        }

                        const missedLog = {
                            id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
                            taskId: t.id,
                            category: 'tasks',
                            taskType: t.type,
                            timestamp: noon,
                            missedDateKey: checkKey,
                            strict50Applied: strictPenaltyTriggered,
                            title: `Missed (${checkKey}): ${t.title}`,
                            actionType: 'missed',
                            amount: t.baseTarget || 1,
                            donationAdded: addedPenalty,
                            coveredBySurplus: coveredSurplus
                        };
                        activityHistory.push(missedLog);
                        syncToGoogleSheets(missedLog);

                        t.currentTarget = Math.max(0, (t.currentTarget || 0) - (t.baseTarget || 1));
                        if (t.currentTarget <= 0) t.isCompleted = true;

                        if (checkKey === yesterdayKey) {
                            yesterdayMissedTitles.push(`${t.title}${dayPenalty > 0 ? ` (₹${dayPenalty})` : ''}`);
                        }
                        needsSave = true;
                    } else if (amountDone >= (t.baseTarget || 1)) {
                        if (t.isMaxOnceDaily) t.missedCount = 0;
                    }
                }

                t.lastEvaluatedDateKey = checkKey;
                t.penaltyCheckDate = new Date(todayStart).toDateString();
                needsSave = true;
                cursor += 86400000;
            }
        }
    });

    renderMorningMissedBanner(yesterdayKey, yesterdayMissedTitles, totalPenaltyAdded);
    return needsSave;
}

function renderMorningMissedBanner(yesterdayKey, newMissedList = [], penaltyAdded = 0) {
    const banner = document.getElementById('yesterday-recap-banner') || document.getElementById('morning-missed-banner');
    if (!banner) return;

    const yesterdayMissedLogs = activityHistory.filter(h =>
        h.category === 'tasks' &&
        h.actionType === 'missed' &&
        isLogOnDateKey(h, yesterdayKey)
    );

    if (yesterdayMissedLogs.length === 0) {
        banner.style.display = 'none';
        return;
    }

    const itemsHtml = yesterdayMissedLogs.map(log => {
        const task = tasks.find(t => t.id === log.taskId);
        const taskName = task ? task.title : log.title.replace(/^Missed.*?:\s*/, '');
        const pen = (log.donationAdded || 0) + (log.coveredBySurplus || 0);
        return `<li style="margin-bottom:6px;">
            <strong>${taskName}</strong> ${pen > 0 ? `<span style="color:var(--charity);">(Penalty: ₹${pen})</span>` : ''} 
            ${task ? `<button onclick="openTask30DayModal('${task.id}', '${yesterdayKey}')" style="background:rgba(3,218,198,0.18); color:var(--success); border:1px solid var(--success); padding:3px 10px; font-size:0.75rem; width:auto; min-height:28px; margin:0 0 0 8px; border-radius:6px;">Fulfill & Refund</button>` : ''}
        </li>`;
    }).join('');

    banner.style.display = 'block';
    banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div>
                <div style="font-weight:bold; color:var(--danger); font-size:0.95rem; margin-bottom:6px;">
                    ⚠️ Yesterday's Missed Tasks (${yesterdayKey})
                </div>
                <ul style="margin:0; padding-left:18px; font-size:0.85rem; color:#eee;">
                    ${itemsHtml}
                </ul>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:8px;">
                    💡 Tap <strong>Fulfill & Refund</strong> or open any task's <strong>📅 30-Day History</strong> to complete missed days and deduct penalties!
                </div>
            </div>
            <button class="btn-icon" onclick="this.closest('.yesterday-recap-banner').style.display='none'" style="min-width:34px; min-height:34px; font-size:0.85rem;">✖</button>
        </div>
    `;

    if (newMissedList.length > 0 && "Notification" in window && Notification.permission === "granted") {
        const notifKey = `hisab_morning_notif_${yesterdayKey}`;
        if (!localStorage.getItem(notifKey)) {
            new Notification(`Hisab: Yesterday's Missed Tasks (${yesterdayKey})`, {
                body: `Missed yesterday: ${newMissedList.join(', ')}. Tap to review or fulfill retroactively.`,
                icon: "icon.png"
            });
            localStorage.setItem(notifKey, '1');
        }
    }
}

function saveDataLocallyOnly() { 
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks)); localStorage.setItem('hisab_history', JSON.stringify(activityHistory)); localStorage.setItem('hisab_bad_habits', JSON.stringify(badHabits)); localStorage.setItem('hisab_good_habits', JSON.stringify(goodHabits)); localStorage.setItem('hisab_bonus_points', bonusPoints.toString()); localStorage.setItem('hisab_charity', JSON.stringify(charityData)); localStorage.setItem('hisab_deen', JSON.stringify(deenData)); localStorage.setItem('hisab_budget', JSON.stringify(budgetData)); localStorage.setItem('hisab_backlog', JSON.stringify(backlogData));
}

async function syncDataToFirebase() { 
    if (currentUser && hasInitialCloudSync) { 
        try { await setDoc(doc(db, "users", currentUser.uid), { tasks, history: activityHistory, badHabits, goodHabits, bonusPoints, charity: charityData, deen: deenData, budget: budgetData, backlog: backlogData, lastModified: lastModifiedLocal }); } catch(e) { console.error("Firebase sync failed", e); } 
    } 
}

function saveData() { lastModifiedLocal = Date.now(); localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString()); saveDataLocallyOnly(); syncDataToFirebase(); }

// ==========================================
// VISUAL EFFECTS ENGINE
// ==========================================
function triggerSadEffect(event) {
    if (!event) return;
    const btn = event.target.closest('button');
    if (btn) { btn.classList.add('shake-angry'); setTimeout(() => btn.classList.remove('shake-angry'), 400); }
    const emojis = ['😡', '😞', '📉', '💸'];
    const icon = emojis[Math.floor(Math.random() * emojis.length)];
    const floatEl = document.createElement('div'); floatEl.className = 'floating-emoji'; floatEl.innerText = icon; floatEl.style.left = (event.clientX - 20) + 'px'; floatEl.style.top = (event.clientY - 20) + 'px'; document.body.appendChild(floatEl);
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    setTimeout(() => floatEl.remove(), 1200);
}

function triggerHappyEffect(event) {
    if (!event) return;
    const emojis = ['🌟', '✨', '🎉', '🏆'];
    const icon = emojis[Math.floor(Math.random() * emojis.length)];
    const floatEl = document.createElement('div'); floatEl.className = 'floating-emoji'; floatEl.innerText = icon; floatEl.style.left = (event.clientX - 20) + 'px'; floatEl.style.top = (event.clientY - 20) + 'px'; document.body.appendChild(floatEl);
    if (typeof confetti === 'function') confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    setTimeout(() => floatEl.remove(), 1200);
}

// ==========================================
// CHARITY & SURPLUS WALLET LOGIC
// ==========================================
function applyPenalty(penaltyAmount) {
    let remainingPenalty = penaltyAmount;
    let coveredBySurplus = 0;
    if ((charityData.surplus || 0) > 0) {
        if (charityData.surplus >= remainingPenalty) {
            charityData.surplus -= remainingPenalty;
            coveredBySurplus = remainingPenalty;
            remainingPenalty = 0;
        } else {
            coveredBySurplus = charityData.surplus;
            remainingPenalty -= charityData.surplus;
            charityData.surplus = 0;
        }
    }
    if (remainingPenalty > 0) {
        charityData.pending += remainingPenalty;
    }
    return { addedToPending: remainingPenalty, coveredBySurplus };
}

function refundPenaltyFromLog(missedLog) {
    if (!missedLog) return 0;
    let totalRefunded = 0;
    if (missedLog.donationAdded && missedLog.donationAdded > 0) {
        charityData.pending = Math.max(0, charityData.pending - missedLog.donationAdded);
        totalRefunded += missedLog.donationAdded;
    }
    if (missedLog.coveredBySurplus && missedLog.coveredBySurplus > 0) {
        charityData.surplus = (charityData.surplus || 0) + missedLog.coveredBySurplus;
        totalRefunded += missedLog.coveredBySurplus;
    }
    return totalRefunded;
}

function payDonation() {
    const input = document.getElementById('donation-pay-amount');
    const amount = parseFloat(input.value) || 0;
    if (amount <= 0) return alert("Please enter a valid amount to pay.");
    charityData.pending -= amount;
    if (charityData.pending < 0) charityData.pending = 0;
    charityData.paid += amount;
    input.value = '';
    saveData(); 
    if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f6e58d', '#03dac6', '#ffffff'] });
}

// ==========================================
// TASKS & SPIRITUAL AUTOMATION ENGINE
// ==========================================
function applyDeenAutomation(taskTitle, amountDelta) {
    const tName = (taskTitle || '').toLowerCase();
    if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
    if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };

    if (tName.includes('hizb')) {
        deenData.quranStats.totalHizb = Math.max(0, (deenData.quranStats.totalHizb || 0) + amountDelta);
        deenData.quranStats.totalJuz = Math.floor(deenData.quranStats.totalHizb / 2);
        deenData.quranStats.totalKhatm = Math.floor(deenData.quranStats.totalHizb / 60);
    }
    if (tName.includes('swalath') || tName.includes('salawat') || tName.includes('salawaat') || tName.includes('darood') || tName.includes('durood')) {
        deenData.swalathStats.total = Math.max(0, (deenData.swalathStats.total || 0) + amountDelta);
    }
}

function getPeriodsLeft(type, dateObj) {
    const now = new Date(); const currentYear = now.getFullYear(); let start = new Date(dateObj);
    if (isNaN(start.getTime())) start = new Date(); 
    if (start.getFullYear() < currentYear) { start = new Date(currentYear, 0, 1); }
    start.setHours(0, 0, 0, 0); const eoy = new Date(currentYear, 11, 31, 23, 59, 59); const msPerDay = 1000 * 60 * 60 * 24; const daysLeft = Math.round((eoy.getTime() - start.getTime()) / msPerDay) + 1; 
    if (type === 'daily') return daysLeft; if (type === 'weekly') return Math.ceil(daysLeft / 7); if (type === 'monthly') return (12 - start.getMonth()); return 1; 
}

function saveTask() { 
    const id = document.getElementById('task-id').value; const title = document.getElementById('task-title').value.trim(); const type = document.getElementById('task-type').value; const baseTarget = parseFloat(document.getElementById('task-base-target').value) || 1; const donationPenalty = parseFloat(document.getElementById('task-donation').value) || 0; const reminderTime = document.getElementById('task-reminder-time').value; const isMaxOnceDaily = document.getElementById('task-is-max-once').checked;
    if (!title) return alert('Enter a task name'); 
    if (id) { 
        const task = tasks.find(t => t.id === id); task.title = title; task.reminderTime = reminderTime; task.donationPenalty = donationPenalty; task.isMaxOnceDaily = isMaxOnceDaily;
        const creationTime = task.createdAt || Date.now(); const newPeriodsLeft = getPeriodsLeft(type, creationTime); const newTotalYearly = newPeriodsLeft * baseTarget; const targetDiff = newTotalYearly - (task.totalYearlyTarget || 0);
        task.type = type; task.baseTarget = baseTarget; task.totalYearlyTarget = newTotalYearly; task.currentTarget = Math.max(0, (task.currentTarget || 0) + targetDiff); task.isCompleted = task.currentTarget <= 0;
    } else { 
        const creationTime = Date.now(); const periodsLeft = getPeriodsLeft(type, creationTime); const totalYearlyTarget = periodsLeft * baseTarget;
        const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
        tasks.push({ id: creationTime.toString(), createdAt: creationTime, title, type, baseTarget, totalYearlyTarget, currentTarget: totalYearlyTarget, reminderTime, donationPenalty, isMaxOnceDaily, missedCount: 0, penaltyCheckDate: new Date().toDateString(), lastEvaluatedDateKey: yesterdayKey, isCompleted: false, legacyMigrated: true }); 
    } 
    cancelEdit(); closeModal('task-modal'); saveData(); render(); 
}

function editTask(id) { 
    const task = tasks.find(t => t.id === id); if (!task) return; 
    document.getElementById('form-title').innerText = '✏️ Edit Task'; document.getElementById('btn-save-task').innerText = 'Save Changes'; document.getElementById('btn-cancel-edit').style.display = 'inline-block'; 
    document.getElementById('task-id').value = task.id; document.getElementById('task-title').value = task.title; document.getElementById('task-type').value = task.type || 'daily'; document.getElementById('task-base-target').value = task.baseTarget; 
    document.getElementById('task-donation').value = task.donationPenalty || ''; document.getElementById('task-reminder-time').value = task.reminderTime || ''; document.getElementById('task-is-max-once').checked = task.isMaxOnceDaily || false; 
    openModal('task-modal');
}

function cancelEdit() { 
    document.getElementById('form-title').innerText = '➕ Add New Task'; document.getElementById('btn-save-task').innerText = 'Save Task'; document.getElementById('btn-cancel-edit').style.display = 'none'; 
    document.getElementById('task-id').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-type').value = 'daily'; document.getElementById('task-base-target').value = ''; document.getElementById('task-donation').value = ''; document.getElementById('task-reminder-time').value = ''; document.getElementById('task-is-max-once').checked = false;
}

function deleteTask(id) { if (confirm("Delete this task?")) { tasks = tasks.filter(t => t.id !== id); saveData(); render(); } }

function logProgress(id) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    const inputEl = document.getElementById(`input-${id}`);
    const amountDone = parseFloat(inputEl ? inputEl.value : task.baseTarget) || task.baseTarget || 1;
    if (amountDone <= 0) return;

    const todayStr = new Date().toDateString();
    const todayKey = toDateKey(Date.now());

    // If this task was already marked missed today, automatically reverse today's missed log & refund penalty
    const missedTodayLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, todayKey));
    missedTodayLogs.forEach(mLog => {
        refundPenaltyFromLog(mLog);
        task.currentTarget += (mLog.amount || 1);
        syncToGoogleSheets({ actionType: 'undo', id: mLog.id });
        activityHistory = activityHistory.filter(h => h.id !== mLog.id);
    });

    if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 }, colors: ['#bb86fc', '#03dac6', '#f6e58d'] });
    task.lastCompletedDay = todayStr;
    if (task.isMaxOnceDaily) task.missedCount = 0;
    
    let newLog = { id: Date.now().toString(), taskId: task.id, category: 'tasks', taskType: task.type, timestamp: Date.now(), fulfilledDateKey: todayKey, title: "Completed: " + task.title, actionType: 'complete', amount: amountDone };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    task.currentTarget = Math.max(0, (task.currentTarget || 0) - amountDone);
    if (task.currentTarget <= 0) task.isCompleted = true; 
    
    applyDeenAutomation(task.title, amountDone);

    saveData(); render();
}

function markMissed(id, event) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    if (confirm(`Mark "${task.title}" as missed manually?`)) {
        triggerSadEffect(event);
        let addedPenalty = 0; let coveredSurplus = 0;
        if (task.donationPenalty > 0) { 
            const penaltyRes = applyPenalty(task.donationPenalty);
            addedPenalty = penaltyRes.addedToPending;
            coveredSurplus = penaltyRes.coveredBySurplus;
        }

        let newLog = { id: Date.now().toString(), taskId: task.id, category: 'tasks', taskType: task.type, timestamp: Date.now(), missedDateKey: toDateKey(Date.now()), title: "Missed: " + task.title, actionType: 'missed', amount: task.baseTarget || 1, donationAdded: addedPenalty, coveredBySurplus: coveredSurplus };
        activityHistory.push(newLog);
        syncToGoogleSheets(newLog);

        task.currentTarget = Math.max(0, (task.currentTarget || 0) - (task.baseTarget || 1));
        if (task.currentTarget <= 0) task.isCompleted = true;
        saveData(); render();
    }
}

// ==========================================
// UPGRADED 30-DAY PER-TASK INTERACTIVE CALENDAR,
// DAY INSPECTOR, UNDO, & PENALTY DEDUCTION ENGINE
// ==========================================
// ==========================================
// HELPER: CHECK IF A LOG BELONGS TO A YYYY-MM-DD DATE KEY
// ==========================================
let active30DayHabitId = null;
let active30DayHabitKind = 'good'; // 'good' or 'bad'
let selectedHabit30DayDateKey = null;

function isLogOnDateKey(log, dateKey) {
    if (log.missedDateKey === dateKey || log.fulfilledDateKey === dateKey || log.habitDateKey === dateKey) return true;
    const { start, end } = getDayBounds(dateKey);
    return log.timestamp >= start && log.timestamp <= end;
}

// ==========================================
// 30-DAY PER-TASK INTERACTIVE CALENDAR,
// DAY INSPECTOR, UNDO, & PENALTY DEDUCTION ENGINE
// ==========================================
function openTask30DayModal(taskId, initialDateKey = null) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    active30DayTaskId = taskId;

    document.getElementById('task-30day-title').innerText = `📅 ${task.title}`;
    const grid = document.getElementById('task-30day-grid');
    const summaryEl = document.getElementById('task-30day-summary');
    grid.innerHTML = '';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayKey = toDateKey(todayStart);

    if (!selected30DayDateKey || initialDateKey) {
        selected30DayDateKey = initialDateKey || todayKey;
    }

    let doneDaysCount = 0;
    let missedDaysCount = 0;

    // Render last 30 days (from 29 days ago up to today)
    for (let i = 29; i >= 0; i--) {
        const cellDate = new Date(todayStart - i * 86400000);
        const dateKey = toDateKey(cellDate);
        const shortLabel = cellDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const weekdayLabel = cellDate.toLocaleDateString(undefined, { weekday: 'short' });

        const doneLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'complete' && isLogOnDateKey(h, dateKey));
        const missedLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, dateKey));

        const amountDone = doneLogs.reduce((s, h) => s + (h.amount || 1), 0);
        const penaltyDay = missedLogs.reduce((s, h) => s + (h.donationAdded || 0) + (h.coveredBySurplus || 0), 0);

        const cell = document.createElement('div');
        let statusClass = 'status-unlogged';
        let iconHtml = i === 0 ? '⏳' : '⚪';
        let metaHtml = i === 0 ? 'Today' : 'Unlogged';

        if (amountDone >= (task.baseTarget || 1) || doneLogs.length > 0) {
            doneDaysCount++;
            statusClass = 'status-done';
            iconHtml = '✅';
            metaHtml = `${amountDone} done`;
        } else if (missedLogs.length > 0) {
            missedDaysCount++;
            const displayPenalty = penaltyDay > 0 ? penaltyDay : (task.donationPenalty || 0);
            statusClass = 'status-missed';
            iconHtml = '❌';
            metaHtml = displayPenalty > 0 ? `-₹${displayPenalty}` : 'Missed';
        }

        const isSelected = (dateKey === selected30DayDateKey);
        cell.className = `cal-day-card ${statusClass}${isSelected ? 'selected-day' : ''}`;
        cell.innerHTML = `
            <div class="cal-date-top">${shortLabel}</div>
            <div class="cal-weekday">${weekdayLabel}</div>
            <div class="cal-icon-mid">${iconHtml}</div>
            <div class="cal-meta-bot">${metaHtml}</div>
        `;

        cell.onclick = () => {
            selected30DayDateKey = dateKey;
            openTask30DayModal(task.id, dateKey);
        };

        grid.appendChild(cell);
    }

    summaryEl.innerHTML = `
        <span class="badge done-badge">✅ Completed: ${doneDaysCount}d</span>
        <span class="badge" style="background:rgba(255,82,82,0.15); color:var(--danger); border:1px solid rgba(255,82,82,0.35);">❌ Missed: ${missedDaysCount}d</span>
        <span class="badge donation">💸 Task Penalty Rate: ₹${task.donationPenalty || (task.isMaxOnceDaily ? '50 / 5d' : 0)}</span>
        <span class="badge target">⚖️ Pending Wallet: ₹${charityData.pending}</span>
    `;

    render30DayInspector(task, selected30DayDateKey);
    openModal('task-30day-modal');
}

function render30DayInspector(task, dateKey) {
    const inspector = document.getElementById('task-30day-inspector');
    if (!inspector || !task || !dateKey) return;

    const doneLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'complete' && isLogOnDateKey(h, dateKey));
    const missedLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, dateKey));
    const amountDone = doneLogs.reduce((s, h) => s + (h.amount || 1), 0);

    const loggedPenalty = missedLogs.reduce((s, h) => s + (h.donationAdded || 0) + (h.coveredBySurplus || 0), 0);
    const taskPenaltyRate = task.donationPenalty || 0;
    const effectiveRefund = loggedPenalty > 0 ? loggedPenalty : (taskPenaltyRate > 0 ? Math.min(charityData.pending, taskPenaltyRate) : 0);

    const [y, m, d] = dateKey.split('-').map(Number);
    const readableDate = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

    inspector.style.display = 'block';

    if (doneLogs.length > 0) {
        inspector.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Selected Date</div>
                    <div style="font-size:1.05rem; font-weight:800; color:var(--success);">✅ ${readableDate}</div>
                </div>
                <span class="badge done-badge" style="margin:0;">Logged: ${amountDone} /${task.baseTarget || 1}</span>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="undoTaskDayLogs('${task.id}', '${dateKey}')" style="background:rgba(255, 82, 82, 0.16); color:var(--danger); border:1px solid rgba(255, 82, 82, 0.4); flex:1; margin:0;">
                    ↩️ Undo Completion on ${dateKey}
                </button>
                <button onclick="fulfillMissedTaskDay('${task.id}', '${dateKey}')" style="background:var(--card); color:var(--primary); border:1px solid var(--primary); flex:1; margin:0;">
                    ➕ Log Extra Units
                </button>
            </div>
        `;
    } else if (missedLogs.length > 0) {
        inspector.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Selected Date (Missed)</div>
                    <div style="font-size:1.05rem; font-weight:800; color:var(--danger);">❌ ${readableDate}</div>
                </div>
                <span class="badge donation" style="margin:0;">
                    💸 Refund on Completion: ₹${effectiveRefund}
                </span>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                <div style="width:95px; flex-shrink:0;">
                    <input type="number" id="inspector-amount-input" value="${task.baseTarget || 1}" step="any" min="0.1" style="margin:0; text-align:center; font-weight:bold;">
                </div>
                <button onclick="fulfillMissedTaskDay('${task.id}', '${dateKey}', true)" style="background:var(--success); color:#000; flex:1; margin:0;">
                    ✅ Fulfill Task & Deduct ₹${effectiveRefund} Penalty
                </button>
            </div>
            <button onclick="undoTaskDayLogs('${task.id}', '${dateKey}')" style="background:transparent; color:var(--text-muted); border:1px solid var(--border); width:100%; margin:0; min-height:38px; font-size:0.82rem;">
                ↩️ Remove Missed Status (Undo Missed Log Only)
            </button>
        `;
    } else {
        inspector.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Selected Date (Unlogged)</div>
                    <div style="font-size:1.05rem; font-weight:800; color:#fff;">⚪ ${readableDate}</div>
                </div>
                ${effectiveRefund > 0 ? `<span class="badge donation" style="margin:0;">💸 Deducts ₹${effectiveRefund} Penalty</span>` : `<span class="badge target" style="margin:0;">Target: ${task.baseTarget || 1}</span>`}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <div style="width:95px; flex-shrink:0;">
                    <input type="number" id="inspector-amount-input" value="${task.baseTarget || 1}" step="any" min="0.1" style="margin:0; text-align:center; font-weight:bold;">
                </div>
                <button onclick="fulfillMissedTaskDay('${task.id}', '${dateKey}', true)" style="background:var(--primary); color:#000; flex:1; margin:0;">
                    ✅ Mark Completed${effectiveRefund > 0 ? ` (& Deduct ₹${effectiveRefund})` : ''}
                </button>
                <button onclick="markTaskMissedOnDate('${task.id}', '${dateKey}')" style="background:rgba(255,82,82,0.15); color:var(--danger); border:1px solid rgba(255,82,82,0.35); width:auto; padding:0 14px; margin:0;" title="Mark Missed on this Date">
                    ❌ Missed
                </button>
            </div>
        `;
    }
}

function fulfillMissedTaskDay(taskId, dateKey, fromInspector = false) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const { noon } = getDayBounds(dateKey);
    const missedLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, dateKey));

    let amountDone = task.baseTarget || 1;
    const inspectorInput = document.getElementById('inspector-amount-input');
    if (fromInspector && inspectorInput) {
        amountDone = parseFloat(inspectorInput.value);
    } else {
        const inputVal = prompt(`Complete "${task.title}" for ${dateKey}.\nEnter units completed:`, task.baseTarget || 1);
        if (inputVal === null) return;
        amountDone = parseFloat(inputVal);
    }

    if (isNaN(amountDone) || amountDone <= 0) return alert("Please enter a valid positive number.");

    let refundedAmount = 0;
    missedLogs.forEach(mLog => {
        refundedAmount += refundPenaltyFromLog(mLog);
        task.currentTarget += (mLog.amount || 1);
        syncToGoogleSheets({ actionType: 'undo', id: mLog.id });
        activityHistory = activityHistory.filter(h => h.id !== mLog.id);
    });

    if (refundedAmount === 0 && charityData.pending > 0) {
        if (task.donationPenalty > 0) {
            const deduct = Math.min(charityData.pending, task.donationPenalty);
            charityData.pending = Math.max(0, charityData.pending - deduct);
            refundedAmount += deduct;
        } else if (task.isMaxOnceDaily && missedLogs.length > 0) {
            const recentStrictLog = activityHistory.find(h => h.taskId === task.id && h.actionType === 'missed' && h.strict50Applied && (h.donationAdded > 0 || h.coveredBySurplus > 0));
            if (recentStrictLog) {
                refundedAmount += refundPenaltyFromLog(recentStrictLog);
                recentStrictLog.donationAdded = 0;
                recentStrictLog.coveredBySurplus = 0;
                recentStrictLog.strict50Applied = false;
            }
        }
    }

    if (missedLogs.length > 0 && task.isMaxOnceDaily && (task.missedCount || 0) > 0) {
        task.missedCount = Math.max(0, task.missedCount - 1);
    }

    const retroLog = {
        id: Date.now().toString(),
        taskId: task.id,
        category: 'tasks',
        taskType: task.type,
        timestamp: noon,
        fulfilledRetroactively: true,
        fulfilledDateKey: dateKey,
        penaltyRefunded: refundedAmount,
        title: `Completed (${dateKey}):${task.title}`,
        actionType: 'complete',
        amount: amountDone
    };
    activityHistory.push(retroLog);
    syncToGoogleSheets(retroLog);

    task.currentTarget = Math.max(0, (task.currentTarget || 0) - amountDone);
    task.isCompleted = task.currentTarget <= 0;

    applyDeenAutomation(task.title, amountDone);

    if (typeof confetti === 'function') confetti({ particleCount: 55, spread: 65, origin: { y: 0.75 } });

    saveData();
    render();
    selected30DayDateKey = dateKey;
    openTask30DayModal(taskId, dateKey);
}

function undoTaskDayLogs(taskId, dateKey) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const dayLogs = activityHistory.filter(h => h.taskId === task.id && isLogOnDateKey(h, dateKey));
    if (dayLogs.length === 0) return;

    if (!confirm(`Undo ${dayLogs.length} log(s) for "${task.title}" on ${dateKey}?`)) return;

    dayLogs.forEach(entry => {
        if (entry.actionType === 'complete') {
            task.currentTarget += (entry.amount || 1);
            task.isCompleted = task.currentTarget <= 0;
            applyDeenAutomation(task.title, -(entry.amount || 1));
            if (entry.penaltyRefunded && entry.penaltyRefunded > 0) {
                applyPenalty(entry.penaltyRefunded);
            }
        } else if (entry.actionType === 'missed') {
            task.currentTarget += (entry.amount || 1);
            task.isCompleted = task.currentTarget <= 0;
            refundPenaltyFromLog(entry);
            if (task.isMaxOnceDaily && (task.missedCount || 0) > 0) {
                task.missedCount = Math.max(0, task.missedCount - 1);
            }
        }
        syncToGoogleSheets({ actionType: 'undo', id: entry.id });
        activityHistory = activityHistory.filter(h => h.id !== entry.id);
    });

    saveData();
    render();
    selected30DayDateKey = dateKey;
    openTask30DayModal(taskId, dateKey);
}

function markTaskMissedOnDate(taskId, dateKey) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const { noon } = getDayBounds(dateKey);
    let addedPenalty = 0;
    let coveredSurplus = 0;
    if (task.donationPenalty > 0) {
        const res = applyPenalty(task.donationPenalty);
        addedPenalty = res.addedToPending;
        coveredSurplus = res.coveredBySurplus;
    }

    const missedLog = {
        id: Date.now().toString(),
        taskId: task.id,
        category: 'tasks',
        taskType: task.type,
        timestamp: noon,
        missedDateKey: dateKey,
        title: `Missed (${dateKey}):${task.title}`,
        actionType: 'missed',
        amount: task.baseTarget || 1,
        donationAdded: addedPenalty,
        coveredBySurplus: coveredSurplus
    };
    activityHistory.push(missedLog);
    syncToGoogleSheets(missedLog);

    task.currentTarget = Math.max(0, (task.currentTarget || 0) - (task.baseTarget || 1));
    task.isCompleted = task.currentTarget <= 0;

    saveData();
    render();
    selected30DayDateKey = dateKey;
    openTask30DayModal(taskId, dateKey);
}

function renderTasks() {
    const container = document.getElementById('task-list-container'); if (!container) return; container.innerHTML = '';
    const filterView = document.getElementById('task-view-filter') ? document.getElementById('task-view-filter').value : 'all';
    const categories = [ { id: 'daily', title: '📅 Daily Tasks', filter: t => t.type === 'daily' }, { id: 'weekly', title: '📆 Weekly Tasks', filter: t => t.type === 'weekly' }, { id: 'monthly', title: '🗓️ Monthly Tasks', filter: t => t.type === 'monthly' }, { id: 'once', title: '🎯 One-Time Tasks', filter: t => t.type === 'once' } ];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    categories.forEach(cat => {
        if (filterView !== 'all' && cat.id !== filterView) return;
        const filteredTasks = tasks.filter(cat.filter); if (filteredTasks.length === 0) return;
        
        filteredTasks.forEach(task => {
            let timeThreshold = startOfDay;
            if (task.type === 'weekly') timeThreshold = startOfWeek;
            if (task.type === 'monthly') timeThreshold = startOfMonth;

            const periodLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'complete' && h.timestamp >= timeThreshold);
            task.amountDonePeriod = periodLogs.reduce((sum, log) => sum + (log.amount || 1), 0);
            
            if (task.type === 'once') {
                task.isDoneForPeriod = task.currentTarget <= 0;
            } else {
                task.isDoneForPeriod = (task.amountDonePeriod >= (task.baseTarget || 1)) || (task.currentTarget <= 0);
            }
        });

        filteredTasks.sort((a, b) => (a.isDoneForPeriod ? 1 : 0) - (b.isDoneForPeriod ? 1 : 0));

        const section = document.createElement('div'); section.innerHTML = `<h3 style="margin-top:25px; color:#ddd; font-size:1.05rem; border-bottom:1px solid var(--border); padding-bottom:6px;">${cat.title}</h3>`;
        
        filteredTasks.forEach(task => {
            const div = document.createElement('div'); div.className = `task-item ${task.isDoneForPeriod ? 'banked' : ''}`;
            let badgeLabel = "Done Today"; if (task.type === 'weekly') badgeLabel = "Done This Week"; if (task.type === 'monthly') badgeLabel = "Done This Month";

            const thirtyDaysAgo = startOfDay - 29 * 86400000;
            const missed30Count = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && h.timestamp >= thirtyDaysAgo).length;

            let statusHTML = task.currentTarget <= 0 ? `<span class="badge done-badge">✅ Completed for Year!</span>` : `<span class="badge target">Remaining in year: ${Math.round(task.currentTarget * 100) / 100}</span>`;
            let reminderHtml = task.reminderTime ? `<span class="badge reminder">🔔 ${task.reminderTime}</span>` : ``;
            let donationHtml = task.donationPenalty ? `<span class="badge donation">💸 Penalty: ₹${task.donationPenalty}</span>` : ``;
            let strictHtml = task.isMaxOnceDaily ? `<span class="badge" style="background:#2a2a35; color:#ccc;">Strict Streak: ${task.missedCount || 0}/5</span>` : '';
            let donePeriodHtml = task.amountDonePeriod > 0 ? `<span class="badge done-badge">✅ ${badgeLabel}:${task.amountDonePeriod}</span>` : '';
            let missedBadgeHtml = missed30Count > 0 ? `<span class="badge" style="background:rgba(255,82,82,0.18); color:var(--danger); border:1px solid rgba(255,82,82,0.4); cursor:pointer;" onclick="openTask30DayModal('${task.id}')">⚠️ ${missed30Count} Missed (Tap to Fulfill)</span>` : '';

            let miniWeekHtml = '';
            if (task.type === 'daily') {
                let pills = '';
                for (let d = 6; d >= 0; d--) {
                    const pDate = new Date(startOfDay - d * 86400000);
                    const dKey = toDateKey(pDate);
                    const dayShort = d === 0 ? 'Today' : pDate.toLocaleDateString(undefined, { weekday: 'short' });
                    const isDone = activityHistory.some(h => h.taskId === task.id && h.actionType === 'complete' && isLogOnDateKey(h, dKey));
                    const isMiss = !isDone && activityHistory.some(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, dKey));
                    const pClass = isDone ? 'done' : (isMiss ? 'missed' : '');
                    const pIcon = isDone ? '✅' : (isMiss ? '❌' : '⚪');
                    pills += `<span class="day-pill ${pClass}" onclick="openTask30DayModal('${task.id}', '${dKey}')" title="Inspect ${dKey}">${pIcon}${dayShort}</span>`;
                }
                miniWeekHtml = `<div class="mini-week-strip">${pills}</div>`;
            }

            div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title" style="${task.isDoneForPeriod ? 'text-decoration:line-through; opacity:0.8;' : ''}">${task.isDoneForPeriod ? '✅ ' : ''}${task.title}</div>
                    <div class="task-badges">
                        <span class="badge" style="background:#252530; color:#ccc;">Target: ${task.baseTarget} /${task.type}</span>
                        ${statusHTML}${reminderHtml}${donationHtml}${strictHtml}${donePeriodHtml}${missedBadgeHtml}
                    </div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="openTask30DayModal('${task.id}')" title="30-Day History & Fulfill Missed">📅</button>
                    <button class="btn-icon" onclick="editTask('${task.id}')" title="Edit Task">✏️</button>
                    <button class="btn-icon" onclick="deleteTask('${task.id}')" title="Delete Task">🗑️</button>
                </div>
            </div>
            ${miniWeekHtml}${task.currentTarget > 0 ? `<div class="task-action-row">${(task.donationPenalty && !task.isMaxOnceDaily) ? `<button class="btn-task-action missed" onclick="markMissed('${task.id}', event)">❌ Missed</button>` : ''}<div class="task-input-box"><input type="number" step="any" id="input-${task.id}" value="${task.baseTarget}" min="0.1"></div><button class="btn-task-action done" onclick="logProgress('${task.id}')">${task.isDoneForPeriod ? '➕ Log More' : '✔️ Complete'}</button></div>` : ''}`;
            section.appendChild(div);
        });
        container.appendChild(section);
    });
}

// ==========================================
// GOOD HABITS, BAD HABITS & 30-DAY HABIT CALENDAR
// ==========================================
function addGoodHabit() {
    const id = document.getElementById('good-habit-id').value;
    const title = document.getElementById('good-habit-title').value.trim();
    const rewardType = document.getElementById('good-habit-reward-type').value; 
    const rewardValue = parseFloat(document.getElementById('good-habit-reward-value').value) || 0;
    
    if (!title) return alert("Enter a good habit name.");
    if (rewardValue <= 0) return alert("Enter a valid reward value.");

    if (id) {
        const habit = goodHabits.find(h => h.id === id);
        if (habit) { habit.title = title; habit.rewardType = rewardType; habit.rewardValue = rewardValue; }
    } else {
        goodHabits.push({ id: Date.now().toString(), title, rewardType, rewardValue, annualCount: 0 });
    }
    cancelEditGoodHabit(); closeModal('good-habit-modal'); saveData(); renderHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function editGoodHabit(id) {
    const habit = goodHabits.find(h => h.id === id); if (!habit) return;
    document.getElementById('good-habit-form-title').innerText = '✏️ Edit Good Habit';
    document.getElementById('good-habit-id').value = habit.id;
    document.getElementById('good-habit-title').value = habit.title;
    document.getElementById('good-habit-reward-type').value = habit.rewardType || 'reduce';
    document.getElementById('good-habit-reward-value').value = habit.rewardValue || '';
    document.getElementById('btn-save-good-habit').innerText = 'Save Changes';
    document.getElementById('btn-cancel-edit-good-habit').style.display = 'block';
    openModal('good-habit-modal');
}

function cancelEditGoodHabit() {
    document.getElementById('good-habit-form-title').innerText = '🌟 Add Good Habit';
    document.getElementById('good-habit-id').value = '';
    document.getElementById('good-habit-title').value = '';
    document.getElementById('good-habit-reward-type').value = 'reduce';
    document.getElementById('good-habit-reward-value').value = '';
    document.getElementById('btn-save-good-habit').innerHTML = 'Save Good Habit';
    document.getElementById('btn-cancel-edit-good-habit').style.display = 'none';
}

function logGoodHabit(id, event, customDateKey = null) {
    const habit = goodHabits.find(h => h.id === id); if (!habit) return;
    if (event) triggerHappyEffect(event);
    
    let pointsAdded = 0; let penaltyReduced = 0; let surplusAdded = 0;

    if (habit.rewardType === 'points') {
        bonusPoints += habit.rewardValue; pointsAdded = habit.rewardValue;
    } else if (habit.rewardType === 'reduce') {
        let val = habit.rewardValue;
        if (charityData.pending > 0) {
            if (charityData.pending >= val) {
                charityData.pending -= val;
                penaltyReduced = val;
            } else {
                penaltyReduced = charityData.pending;
                surplusAdded = val - charityData.pending;
                charityData.pending = 0;
                charityData.surplus = (charityData.surplus || 0) + surplusAdded;
            }
        } else {
            charityData.surplus = (charityData.surplus || 0) + val;
            surplusAdded = val;
        }
    }
    
    habit.annualCount++;
    const logTime = customDateKey ? getDayBounds(customDateKey).noon : Date.now();
    const dateKeyUsed = customDateKey || toDateKey(Date.now());
    let newLog = { id: Date.now().toString(), taskId: habit.id, category: 'habits', timestamp: logTime, habitDateKey: dateKeyUsed, title: `Logged Good (${dateKeyUsed}): ` + habit.title, actionType: 'good', amount: 1, pointsAdded, penaltyReduced, surplusAdded };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    saveData(); renderHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function deleteGoodHabit(id) {
    if(confirm("Delete this good habit tracker?")) { goodHabits = goodHabits.filter(h => h.id !== id); saveData(); renderHabits(); }
}

function renderGoodHabits() {
    const container = document.getElementById('good-habit-list-container'); 
    const displayPoints = document.getElementById('display-bonus-points');
    const displaySurplus = document.getElementById('display-surplus-wallet-habits');
    if(displayPoints) displayPoints.innerText = bonusPoints.toLocaleString();
    if(displaySurplus) displaySurplus.innerText = (charityData.surplus || 0).toLocaleString();
    if (!container) return;
    
    container.innerHTML = '';
    if (goodHabits.length === 0) { container.innerHTML = '<p style="color:#aaa; text-align:center;">No good habits tracked yet.</p>'; return; }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    goodHabits.forEach(habit => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--success)';
        let rewardText = habit.rewardType === 'points' ? `🏆 +${habit.rewardValue} Points` : `🌟 Bank ₹${habit.rewardValue} Surplus / Reduce Penalty`;
        
        const todayLogs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'good' && h.timestamp >= startOfDay);
        const timesDoneToday = todayLogs.reduce((sum, log) => sum + (log.amount || 1), 0);
        let doneTodayHtml = timesDoneToday > 0 ? `<span class="badge done-badge">⭐ Done Today: ${timesDoneToday}</span>` : '';

        let pills = '';
        for (let d = 6; d >= 0; d--) {
            const pDate = new Date(startOfDay - d * 86400000);
            const dKey = toDateKey(pDate);
            const dayShort = d === 0 ? 'Today' : pDate.toLocaleDateString(undefined, { weekday: 'short' });
            const countDay = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'good' && isLogOnDateKey(h, dKey)).reduce((s, l) => s + (l.amount || 1), 0);
            const pClass = countDay > 0 ? 'done' : '';
            const pIcon = countDay > 0 ? `🌟${countDay > 1 ? countDay : ''}` : '⚪';
            pills += `<span class="day-pill ${pClass}" onclick="openHabit30DayModal('${habit.id}', 'good', '${dKey}')" title="Inspect ${dKey}">${pIcon}${dayShort}</span>`;
        }

        div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title" style="color:var(--success);">${habit.title}</div>
                    <div class="task-badges"><span class="badge" style="background:#252530; color:#fff;">Annual Total: ${habit.annualCount}</span><span class="badge" style="background:rgba(3, 218, 198, 0.1); color:var(--success);">${rewardText}</span>${doneTodayHtml}</div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="openHabit30DayModal('${habit.id}', 'good')" title="30-Day Habit Streak">📅</button>
                    <button class="btn-icon" onclick="editGoodHabit('${habit.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteGoodHabit('${habit.id}')">🗑️</button>
                </div>
            </div>
            <div class="mini-week-strip">${pills}</div>
            <div class="task-action-row"><button class="btn-task-action" style="background:var(--success); color:#000;" onclick="logGoodHabit('${habit.id}', event)">+1 Log Good Habit</button></div>
        `;
        container.appendChild(div);
    });
}

function addBadHabit() {
    const id = document.getElementById('bad-habit-id').value;
    const title = document.getElementById('bad-habit-title').value.trim(); 
    const donationPenalty = parseFloat(document.getElementById('bad-habit-donation').value) || 0;
    if (!title) return alert("Enter a habit name.");
    
    if (id) {
        const habit = badHabits.find(h => h.id === id);
        if (habit) { habit.title = title; habit.donationPenalty = donationPenalty; }
    } else {
        badHabits.push({ id: Date.now().toString(), title, donationPenalty, annualCount: 0 });
    }
    cancelEditBadHabit(); closeModal('bad-habit-modal'); saveData(); renderHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function editBadHabit(id) {
    const habit = badHabits.find(h => h.id === id); if (!habit) return;
    document.getElementById('bad-habit-form-title').innerText = '✏️ Edit Bad Habit';
    document.getElementById('bad-habit-id').value = habit.id;
    document.getElementById('bad-habit-title').value = habit.title;
    document.getElementById('bad-habit-donation').value = habit.donationPenalty || '';
    document.getElementById('btn-save-bad-habit').innerText = 'Save Changes';
    document.getElementById('btn-cancel-edit-bad-habit').style.display = 'block';
    openModal('bad-habit-modal');
}

function cancelEditBadHabit() {
    document.getElementById('bad-habit-form-title').innerText = '🚫 Add Bad Habit';
    document.getElementById('bad-habit-id').value = '';
    document.getElementById('bad-habit-title').value = '';
    document.getElementById('bad-habit-donation').value = '';
    document.getElementById('btn-save-bad-habit').innerHTML = 'Save Bad Habit';
    document.getElementById('btn-cancel-edit-bad-habit').style.display = 'none';
}

function logBadHabit(id, event, customDateKey = null) {
    const habit = badHabits.find(h => h.id === id); if (!habit) return;
    if (event) triggerSadEffect(event);
    let addedPenalty = 0; let coveredSurplus = 0;
    if (habit.donationPenalty > 0) { 
        const penaltyRes = applyPenalty(habit.donationPenalty);
        addedPenalty = penaltyRes.addedToPending;
        coveredSurplus = penaltyRes.coveredBySurplus;
    }
    habit.annualCount++;
    
    const logTime = customDateKey ? getDayBounds(customDateKey).noon : Date.now();
    const dateKeyUsed = customDateKey || toDateKey(Date.now());
    let newLog = { id: Date.now().toString(), taskId: habit.id, category: 'habits', timestamp: logTime, habitDateKey: dateKeyUsed, title: `Logged Bad (${dateKeyUsed}): ` + habit.title, actionType: 'bad', amount: 1, donationAdded: addedPenalty, coveredBySurplus: coveredSurplus };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    saveData(); renderHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function deleteBadHabit(id) {
    if(confirm("Delete this bad habit tracker?")) { badHabits = badHabits.filter(h => h.id !== id); saveData(); renderHabits(); }
}

function renderBadHabits() {
    const container = document.getElementById('bad-habit-list-container'); if (!container) return; container.innerHTML = '';
    if (badHabits.length === 0) { container.innerHTML = '<p style="color:#aaa; text-align:center;">No bad habits tracked yet.</p>'; return; }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    badHabits.forEach(habit => {
        const div = document.createElement('div'); div.className = 'task-item bad-log';
        let donationHtml = habit.donationPenalty ? `<span class="badge donation">💸 Penalty: ₹${habit.donationPenalty}</span>` : ``;
        
        const todayLogs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'bad' && h.timestamp >= startOfDay);
        const timesDoneToday = todayLogs.reduce((sum, log) => sum + (log.amount || 1), 0);
        let doneTodayHtml = timesDoneToday > 0 ? `<span class="badge" style="background:rgba(255, 82, 82, 0.2); color:var(--danger);">⚠️ Logged Today: ${timesDoneToday}</span>` : '';

        let pills = '';
        for (let d = 6; d >= 0; d--) {
            const pDate = new Date(startOfDay - d * 86400000);
            const dKey = toDateKey(pDate);
            const dayShort = d === 0 ? 'Today' : pDate.toLocaleDateString(undefined, { weekday: 'short' });
            const countDay = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'bad' && isLogOnDateKey(h, dKey)).reduce((s, l) => s + (l.amount || 1), 0);
            const pClass = countDay > 0 ? 'missed' : 'done';
            const pIcon = countDay > 0 ? `⚠️${countDay}` : '🛡️';
            pills += `<span class="day-pill ${pClass}" onclick="openHabit30DayModal('${habit.id}', 'bad', '${dKey}')" title="Inspect ${dKey}">${pIcon} ${dayShort}</span>`;
        }

        div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title" style="color:var(--bad);">${habit.title}</div>
                    <div class="task-badges"><span class="badge" style="background:#252530; color:#fff;">Annual Total: ${habit.annualCount}</span>${donationHtml}${doneTodayHtml}</div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="openHabit30DayModal('${habit.id}', 'bad')" title="30-Day Vice History">📅</button>
                    <button class="btn-icon" onclick="editBadHabit('${habit.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteBadHabit('${habit.id}')">🗑️</button>
                </div>
            </div>
            <div class="mini-week-strip">${pills}</div>
            <div class="task-action-row"><button class="btn-task-action bad" onclick="logBadHabit('${habit.id}', event)">+1 Log Occurrence</button></div>
        `;
        container.appendChild(div);
    });
}

function openHabit30DayModal(habitId, kind = 'good', initialDateKey = null) {
    const list = kind === 'good' ? goodHabits : badHabits;
    const habit = list.find(h => h.id === habitId);
    if (!habit) return;

    active30DayHabitId = habitId;
    active30DayHabitKind = kind;

    const titleEl = document.getElementById('habit-30day-title');
    titleEl.innerText = `${kind === 'good' ? '🌟' : '🚫'} ${habit.title} (Last 30 Days)`;
    titleEl.style.color = kind === 'good' ? 'var(--success)' : 'var(--bad)';

    const grid = document.getElementById('habit-30day-grid');
    const summaryEl = document.getElementById('habit-30day-summary');
    grid.innerHTML = '';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayKey = toDateKey(todayStart);

    if (!selectedHabit30DayDateKey || initialDateKey) {
        selectedHabit30DayDateKey = initialDateKey || todayKey;
    }

    let activeDays = 0;
    let totalCount30 = 0;

    for (let i = 29; i >= 0; i--) {
        const cellDate = new Date(todayStart - i * 86400000);
        const dateKey = toDateKey(cellDate);
        const shortLabel = cellDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const weekdayLabel = cellDate.toLocaleDateString(undefined, { weekday: 'short' });

        const logs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === kind && isLogOnDateKey(h, dateKey));
        const count = logs.reduce((s, l) => s + (l.amount || 1), 0);

        const cell = document.createElement('div');
        let statusClass = 'status-unlogged';
        let iconHtml = '⚪';
        let metaHtml = '0';

        if (kind === 'good') {
            if (count > 0) {
                activeDays++;
                totalCount30 += count;
                statusClass = 'status-done';
                iconHtml = '🌟';
                metaHtml = `+${count}x`;
            } else {
                metaHtml = i === 0 ? 'Today' : '—';
            }
        } else {
            if (count > 0) {
                activeDays++;
                totalCount30 += count;
                statusClass = 'status-missed';
                iconHtml = '⚠️';
                metaHtml = `${count}x`;
            } else {
                statusClass = 'status-done';
                iconHtml = '🛡️';
                metaHtml = 'Clean';
            }
        }

        const isSelected = (dateKey === selectedHabit30DayDateKey);
        cell.className = `cal-day-card ${statusClass} ${isSelected ? 'selected-day' : ''}`;
        cell.innerHTML = `
            <div class="cal-date-top">${shortLabel}</div>
            <div class="cal-weekday">${weekdayLabel}</div>
            <div class="cal-icon-mid">${iconHtml}</div>
            <div class="cal-meta-bot">${metaHtml}</div>
        `;
        cell.onclick = () => {
            selectedHabit30DayDateKey = dateKey;
            openHabit30DayModal(habit.id, kind, dateKey);
        };
        grid.appendChild(cell);
    }

    if (kind === 'good') {
        summaryEl.innerHTML = `
            <span class="badge done-badge">🌟 Active Days: ${activeDays}/30</span>
            <span class="badge target">Total Logged (30d): ${totalCount30}x</span>
            <span class="badge done-badge">🌟 Surplus Wallet: ₹${charityData.surplus || 0}</span>
        `;
    } else {
        summaryEl.innerHTML = `
            <span class="badge done-badge">🛡️ Clean Days: ${30 - activeDays}/30</span>
            <span class="badge" style="background:rgba(255,82,82,0.16); color:var(--danger);">⚠️ Triggered Days: ${activeDays} (${totalCount30}x)</span>
            <span class="badge donation">⚖️ Pending Penalty: ₹${charityData.pending || 0}</span>
        `;
    }

    renderHabit30DayInspector(habit, kind, selectedHabit30DayDateKey);
    openModal('habit-30day-modal');
}

function renderHabit30DayInspector(habit, kind, dateKey) {
    const inspector = document.getElementById('habit-30day-inspector');
    if (!inspector || !habit || !dateKey) return;

    const logs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === kind && isLogOnDateKey(h, dateKey));
    const count = logs.reduce((s, l) => s + (l.amount || 1), 0);

    const [y, m, d] = dateKey.split('-').map(Number);
    const readableDate = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

    inspector.style.display = 'block';
    inspector.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            <div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Selected Date</div>
                <div style="font-size:1.05rem; font-weight:800; color:${kind === 'good' ? 'var(--success)' : 'var(--bad)'};">${readableDate}</div>
            </div>
            <span class="badge ${count > 0 ? (kind === 'good' ? 'done-badge' : 'donation') : 'target'}" style="margin:0;">
                Logged on this date: ${count}x
            </span>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="logHabitOnDate('${habit.id}', '${kind}', '${dateKey}')" style="background:${kind === 'good' ? 'var(--success)' : 'var(--bad)'}; color:${kind === 'good' ? '#000' : '#fff'}; flex:1; margin:0;">
                ➕ Log +1 on ${dateKey}
            </button>
            ${count > 0 ? `
                <button onclick="undoHabitDayLog('${habit.id}', '${kind}', '${dateKey}')" style="background:rgba(255, 82, 82, 0.16); color:var(--danger); border:1px solid rgba(255, 82, 82, 0.4); flex:1; margin:0;">
                    ↩️ Undo Last Entry (${dateKey})
                </button>
            ` : ''}
        </div>
    `;
}

function logHabitOnDate(habitId, kind, dateKey) {
    if (kind === 'good') {
        logGoodHabit(habitId, null, dateKey);
    } else {
        logBadHabit(habitId, null, dateKey);
    }
    openHabit30DayModal(habitId, kind, dateKey);
}

function undoHabitDayLog(habitId, kind, dateKey) {
    const logs = activityHistory.filter(h => h.taskId === habitId && h.actionType === kind && isLogOnDateKey(h, dateKey));
    if (logs.length === 0) return;

    const entry = logs[logs.length - 1];
    if (kind === 'bad') {
        const habit = badHabits.find(h => h.id === entry.taskId);
        if (habit) habit.annualCount = Math.max(0, habit.annualCount - (entry.amount || 1));
        refundPenaltyFromLog(entry);
    } else if (kind === 'good') {
        const habit = goodHabits.find(h => h.id === entry.taskId);
        if (habit) habit.annualCount = Math.max(0, habit.annualCount - (entry.amount || 1));
        if (entry.pointsAdded) bonusPoints = Math.max(0, bonusPoints - entry.pointsAdded);
        if (entry.penaltyReduced) charityData.pending += entry.penaltyReduced;
        if (entry.surplusAdded) charityData.surplus = Math.max(0, (charityData.surplus || 0) - entry.surplusAdded);
    }

    syncToGoogleSheets({ actionType: 'undo', id: entry.id });
    activityHistory = activityHistory.filter(h => h.id !== entry.id);

    saveData();
    render();
    openHabit30DayModal(habitId, kind, dateKey);
}

function renderHabits() { renderGoodHabits(); renderBadHabits(); }
// ==========================================
// DEEN TAB DIRECT LOGGING & RENDERING
// ==========================================
function logSwalathDirect() {
    const input = document.getElementById('swalath-input-amount');
    const amount = parseInt(input ? input.value : 100) || 0;
    if (amount <= 0) return alert("Please enter a valid amount.");

    if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };
    deenData.swalathStats.total += amount;

    let newLog = { 
        id: Date.now().toString(), 
        taskId: 'swalath-direct', 
        category: 'deen', 
        timestamp: Date.now(), 
        title: `Logged Swalath (+${amount})`, 
        actionType: 'deen_swalath', 
        amount: amount 
    };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    if (input) input.value = '100';
    if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#03dac6', '#bb86fc'] });
    saveData();
    render();
}

function logHizbDirect() {
    const input = document.getElementById('hizb-input-amount');
    const amount = parseFloat(input ? input.value : 1) || 0;
    if (amount <= 0) return alert("Please enter a valid Hizb amount.");

    if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
    deenData.quranStats.totalHizb += amount;
    deenData.quranStats.totalJuz = Math.floor(deenData.quranStats.totalHizb / 2);
    deenData.quranStats.totalKhatm = Math.floor(deenData.quranStats.totalHizb / 60);

    let newLog = { 
        id: Date.now().toString(), 
        taskId: 'hizb-direct', 
        category: 'deen', 
        timestamp: Date.now(), 
        title: `Logged Hizb (+${amount})`, 
        actionType: 'deen_hizb', 
        amount: amount 
    };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    if (input) input.value = '1';
    if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#bb86fc', '#f6e58d'] });
    saveData();
    render();
}

// ==========================================
// UNDO & FILTERED HISTORY MODAL
// ==========================================
function undoAction(historyId) {
    const entry = activityHistory.find(h => h.id === historyId); if (!entry) return;
    
    if (confirm(`Undo "${entry.title}"?`)) {
        if (entry.actionType === 'complete' || entry.actionType === 'missed') {
            const task = tasks.find(t => t.id === entry.taskId);
            
            if (task) { 
                task.currentTarget += entry.amount; 
                task.isCompleted = task.currentTarget <= 0; 
                if (entry.actionType === 'complete' && task.isMaxOnceDaily) { 
                    task.lastCompletedDay = ''; 
                } 
                if (entry.actionType === 'complete') {
                    applyDeenAutomation(task.title, -entry.amount);
                    if (entry.penaltyRefunded && entry.penaltyRefunded > 0) {
                        applyPenalty(entry.penaltyRefunded);
                    }
                }
            } else if (entry.category === 'deen' && entry.taskId && entry.taskId.startsWith('dhikr-')) {
                const idx = parseInt(entry.taskId.replace('dhikr-', ''));
                if (deenData.dhikr[idx]) {
                    deenData.dhikr[idx].current = Math.max(0, deenData.dhikr[idx].current - entry.amount);
                    deenData.dhikr[idx].completed = deenData.dhikr[idx].current >= deenData.dhikr[idx].target;
                }
            }
        } 
        else if (entry.actionType === 'deen_swalath') {
            if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };
            deenData.swalathStats.total = Math.max(0, deenData.swalathStats.total - entry.amount);
        }
        else if (entry.actionType === 'deen_hizb') {
            if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
            deenData.quranStats.totalHizb = Math.max(0, deenData.quranStats.totalHizb - entry.amount);
            deenData.quranStats.totalJuz = Math.floor(deenData.quranStats.totalHizb / 2);
            deenData.quranStats.totalKhatm = Math.floor(deenData.quranStats.totalHizb / 60);
        }
        else if (entry.actionType === 'bad') {
            const habit = badHabits.find(h => h.id === entry.taskId); if (habit) { habit.annualCount = Math.max(0, habit.annualCount - entry.amount); }
        }
        else if (entry.actionType === 'good') {
            const habit = goodHabits.find(h => h.id === entry.taskId); if (habit) { habit.annualCount = Math.max(0, habit.annualCount - entry.amount); }
            if (entry.pointsAdded) bonusPoints = Math.max(0, bonusPoints - entry.pointsAdded);
            if (entry.penaltyReduced) charityData.pending += entry.penaltyReduced;
            if (entry.surplusAdded) charityData.surplus = Math.max(0, (charityData.surplus || 0) - entry.surplusAdded);
        }
        
        if (entry.donationAdded) { charityData.pending = Math.max(0, charityData.pending - entry.donationAdded); }
        if (entry.coveredBySurplus) { charityData.surplus = (charityData.surplus || 0) + entry.coveredBySurplus; }
        
        syncToGoogleSheets({ actionType: 'undo', id: historyId });
        
        activityHistory = activityHistory.filter(h => h.id !== historyId);
        saveData(); render(); openHistory(currentHistoryFilter); 
    }
}

function filterHistory(category, btnElement) {
    currentHistoryFilter = category;
    if (btnElement) {
        document.querySelectorAll('.hist-filter-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }
    openHistory(category);
}

function openHistory(filter = 'all') {
    document.getElementById('history-modal').style.display = 'block'; const list = document.getElementById('history-list'); list.innerHTML = '';
    
    let filteredHistory = activityHistory;
    if (filter !== 'all') {
        filteredHistory = activityHistory.filter(h => (h.category || 'tasks') === filter);
    }

    if (filteredHistory.length === 0) { list.innerHTML = '<p style="color:#aaa;">No activity logs recorded for this category yet.</p>'; return; }
    
    const sorted = [...filteredHistory].sort((a, b) => b.timestamp - a.timestamp);
    sorted.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString(); const div = document.createElement('div');
        let borderColor = 'var(--success)';
        if (item.actionType === 'bad' || item.actionType === 'missed') borderColor = 'var(--bad)';
        
        div.style = `background:#252530; padding:15px; border-radius:12px; margin-bottom:10px; border-left: 5px solid ${borderColor}`;
        
        let fulfillBtn = '';
        if (item.actionType === 'missed' && item.taskId) {
            const dKey = item.missedDateKey || toDateKey(item.timestamp);
            fulfillBtn = `<button onclick="closeHistory(); openTask30DayModal('${item.taskId}', '${dKey}')" style="background:var(--success); color:#000; border:none; padding:6px 12px; font-size:0.85rem; margin:0 8px 0 0; width:auto; border-radius:6px;">✅ Fulfill & Refund Penalty</button>`;
        }

        let undoBtn = `<button onclick="undoAction('${item.id}')" style="background:transparent; border:1px solid #aaa; padding:6px 12px; font-size:0.85rem; color:#ccc; margin:0; width:auto; border-radius:6px;">↩️ Undo</button>`;
        let detailText = '';
        if (item.donationAdded) detailText += `<div style="color:var(--charity); font-size:0.85rem; margin-top:4px;">💸 Added penalty: ₹${item.donationAdded}</div>`;
        if (item.coveredBySurplus) detailText += `<div style="color:var(--success); font-size:0.85rem; margin-top:4px;">🌟 Covered by Surplus Credit: ₹${item.coveredBySurplus}</div>`;
        if (item.penaltyRefunded) detailText += `<div style="color:var(--success); font-size:0.85rem; margin-top:4px;">💸 Refunded penalty: ₹${item.penaltyRefunded}</div>`;
        if (item.pointsAdded) detailText += `<div style="color:var(--success); font-size:0.85rem; margin-top:4px;">🏆 Added points: ${item.pointsAdded}</div>`;
        if (item.penaltyReduced) detailText += `<div style="color:var(--success); font-size:0.85rem; margin-top:4px;">💸 Reduced penalty by: ₹${item.penaltyReduced}</div>`;
        if (item.surplusAdded) detailText += `<div style="color:var(--success); font-size:0.85rem; margin-top:4px;">🌟 Banked Surplus Credit: ₹${item.surplusAdded}</div>`;

        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><strong style="font-size:1.05rem; color:#fff;">${item.title}</strong></div><div style="font-size:0.8rem; color:#aaa; margin-top:5px;">${date}</div>${detailText}<div style="margin-top:10px; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">${fulfillBtn}${undoBtn}</div>`;
        list.appendChild(div);
    });
}
function closeHistory() { document.getElementById('history-modal').style.display = 'none'; }

// ==========================================
// DASHBOARD & DUAL CHARTS
// ==========================================
function updateDashboard() { 
    let spiritContainer = document.getElementById('spiritual-milestones');
    if (!spiritContainer) {
        spiritContainer = document.createElement('div');
        spiritContainer.id = 'spiritual-milestones';
        spiritContainer.style = "display:flex; gap:10px; margin-bottom:20px;";
        const dashTab = document.getElementById('tab-dashboard');
        if (dashTab) dashTab.insertBefore(spiritContainer, dashTab.firstChild);
    }

    const espiritualHTML = `
        <div style="flex:1; background:var(--card); padding:15px; border-radius:14px; border:1px solid var(--border); border-top: 3px solid #bb86fc; text-align:center;">
            <div style="font-size:0.85rem; color:#aaa;">Total Khatms</div>
            <div style="font-size:1.8rem; font-weight:bold; color:#bb86fc;">${deenData.quranStats?.totalKhatm || 0}</div>
            <div style="font-size:0.75rem; color:#888;">${deenData.quranStats?.totalJuz || 0} Juz / ${deenData.quranStats?.totalHizb || 0} Hizb</div>
        </div>
        <div style="flex:1; background:var(--card); padding:15px; border-radius:14px; border:1px solid var(--border); border-top: 3px solid #03dac6; text-align:center;">
            <div style="font-size:0.85rem; color:#aaa;">Total Swalath</div>
            <div style="font-size:1.8rem; font-weight:bold; color:#03dac6;">${(deenData.swalathStats?.total || 0).toLocaleString()}</div>
            <div style="font-size:0.75rem; color:#888;">Live Deen Milestone</div>
        </div>
    `;
    spiritContainer.innerHTML = espiritualHTML;

    document.getElementById('donation-pending').innerText = charityData.pending.toLocaleString(); 
    document.getElementById('donation-paid').innerText = charityData.paid.toLocaleString();
    const dashSurplus = document.getElementById('display-surplus-wallet');
    if (dashSurplus) dashSurplus.innerText = (charityData.surplus || 0).toLocaleString();
    const dashBonus = document.getElementById('display-bonus-points-dash');
    if (dashBonus) dashBonus.innerText = (bonusPoints || 0).toLocaleString();

    let dTotal = 0, dComp = 0, wTotal = 0, wComp = 0, mTotal = 0, mComp = 0, oTotal = 0, oComp = 0;
    const now = new Date(); const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); const startOfYear = new Date(now.getFullYear(), 0, 1).getTime(); 

    let dayPts = 0, weekPts = 0, monthPts = 0, yearPts = 0; 
    activityHistory.forEach(r => { 
        if (r.actionType === 'complete') {
            if (r.timestamp >= startOfDay) dayPts += r.amount; if (r.timestamp >= startOfWeek) weekPts += r.amount; if (r.timestamp >= startOfMonth) monthPts += r.amount; if (r.timestamp >= startOfYear) yearPts += r.amount; 
        }
    }); 
    
    const elDay = document.getElementById('day-completed'); if (elDay) elDay.innerText = Math.round(dayPts*100)/100; 
    const elWeek = document.getElementById('week-completed'); if (elWeek) elWeek.innerText = Math.round(weekPts*100)/100; 
    const elMonth = document.getElementById('month-completed'); if (elMonth) elMonth.innerText = Math.round(monthPts*100)/100; 
    const elYear = document.getElementById('year-completed'); if (elYear) elYear.innerText = Math.round(yearPts*100)/100; 

    tasks.forEach(t => {
        let total = t.totalYearlyTarget || 1; let pending = Math.max(0, t.currentTarget || 0); let completed = Math.max(0, Math.min(total, total - pending)); 
        if(t.type === 'daily') { dTotal += total; dComp += completed; } if(t.type === 'weekly') { wTotal += total; wComp += completed; } if(t.type === 'monthly') { mTotal += total; mComp += completed; } if(t.type === 'once') { oTotal += total; oComp += completed; }
    });
    
    const dPct = dTotal > 0 ? parseFloat(((dComp / dTotal) * 100).toFixed(1)) : 0; const wPct = wTotal > 0 ? parseFloat(((wComp / wTotal) * 100).toFixed(1)) : 0; const mPct = mTotal > 0 ? parseFloat(((mComp / mTotal) * 100).toFixed(1)) : 0; const oPct = oTotal > 0 ? parseFloat(((oComp / oTotal) * 100).toFixed(1)) : 0;

    const tCanvas = document.getElementById('tasksProgressChart'); 
    if (tCanvas) {
        const ctx = tCanvas.getContext('2d'); if (tasksProgressChart) tasksProgressChart.destroy(); 
        tasksProgressChart = new Chart(ctx, { type: 'bar', data: { labels: ['Daily', 'Weekly', 'Monthly', 'Once'], datasets: [{ label: 'Annual Completion (%)', data: [dPct, wPct, mPct, oPct], backgroundColor: '#03dac6', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: '#2a2a35' }, ticks: { color: '#aaa', callback: v => v + "%" } }, x: { ticks: { color: '#aaa' } } }, plugins: { legend: { labels: { color: '#fff' } } } } }); 
    }

    const bCanvas = document.getElementById('badHabitsChart');
    if (bCanvas && badHabits.length > 0) {
        const labels = badHabits.map(h => h.title); const data = badHabits.map(h => h.annualCount); const ctx = bCanvas.getContext('2d'); if (badHabitsChart) badHabitsChart.destroy();
        badHabitsChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Occurrences This Year', data: data, backgroundColor: '#cf6679', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#2a2a35' }, ticks: { color: '#aaa', stepSize: 1 } }, x: { ticks: { color: '#aaa' } } }, plugins: { legend: { labels: { color: '#fff' } } } } });
    }
}

// ==========================================
// DEEN TAB
// ==========================================
function renderDeen() { 
    if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
    if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };

    const swalathEl = document.getElementById('deen-total-swalath');
    if (swalathEl) swalathEl.innerText = (deenData.swalathStats.total || 0).toLocaleString();

    const hizbEl = document.getElementById('deen-total-hizb');
    const juzEl = document.getElementById('deen-total-juz');
    const khatmEl = document.getElementById('deen-total-khatm');
    if (hizbEl) hizbEl.innerText = deenData.quranStats.totalHizb || 0;
    if (juzEl) juzEl.innerText = deenData.quranStats.totalJuz || 0;
    if (khatmEl) khatmEl.innerText = deenData.quranStats.totalKhatm || 0;

    const deenSummary = document.getElementById('deen-spiritual-summary');
    if (deenSummary) {
        deenSummary.innerHTML = `
            <div style="flex:1; background:var(--card); padding:15px; border-radius:14px; border:1px solid var(--border); border-top: 3px solid #bb86fc; text-align:center;">
                <div style="font-size:0.85rem; color:#aaa;">Total Khatms</div>
                <div style="font-size:1.8rem; font-weight:bold; color:#bb86fc;">${deenData.quranStats?.totalKhatm || 0}</div>
                <div style="font-size:0.75rem; color:#888;">${deenData.quranStats?.totalJuz || 0} Juz / ${deenData.quranStats?.totalHizb || 0} Hizb</div>
            </div>
            <div style="flex:1; background:var(--card); padding:15px; border-radius:14px; border:1px solid var(--border); border-top: 3px solid #03dac6; text-align:center;">
                <div style="font-size:0.85rem; color:#aaa;">Total Swalath</div>
                <div style="font-size:1.8rem; font-weight:bold; color:#03dac6;">${(deenData.swalathStats?.total || 0).toLocaleString()}</div>
                <div style="font-size:0.75rem; color:#888;">Synced from Tasks & Deen</div>
            </div>
        `;
    }

    const dhikrContainer = document.getElementById('dhikr-list-container'); dhikrContainer.innerHTML = '';
    deenData.dhikr.forEach((d, index) => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--deen)'; if (d.completed) div.style.opacity = '0.6';
        let intentionHtml = d.intention ? `<div style="font-size:0.85rem; color:#aaa; margin-bottom:8px;"><em>" ${d.intention} "</em></div>` : ''; let deadlineHtml = d.deadline ? `<span class="badge" style="background:rgba(246, 229, 141, 0.15); color:var(--warning);">⏳ ${d.deadline}</span>` : ''; let progressHtml = d.completed ? `<span class="badge done-badge">✅ Completed</span>` : `<span class="badge target">Progress: ${d.current} / ${d.target}</span>`;
        div.innerHTML = `<div class="task-header"><div><div class="task-title">${d.name}</div>${intentionHtml}<div class="task-badges">${progressHtml}${deadlineHtml}</div></div><div class="task-controls"><button class="btn-icon" onclick="deleteDhikr(${index})">🗑️</button></div></div>${!d.completed ? `<div class="task-action-row"><div class="task-input-box"><input type="number" id="dhikr-input-${index}" value="1" min="1"></div><button class="btn-task-action" style="flex:1; background:var(--deen); color:#000;" onclick="logDhikr(${index})">Log Dhikr</button></div>` : ''}`;
        dhikrContainer.appendChild(div);
    });

    const select = document.getElementById('juz-select'); if(select && select.options.length <= 1) { for(let i=1; i<=30; i++) { let opt = document.createElement('option'); opt.value = i; opt.innerHTML = `Juz ${i}`; select.appendChild(opt); } } 
    
    const juzContainer = document.getElementById('juz-list-container'); 
    if (juzContainer) {
        juzContainer.innerHTML = ''; 
        let remainderJuz = (deenData.quranStats?.totalJuz || 0) % 30;
        let autoTracker = document.createElement('div');
        autoTracker.style = "background:rgba(3, 218, 198, 0.06); padding:12px; border-radius:10px; margin-bottom:12px; border-left:3px solid var(--deen);";
        autoTracker.innerHTML = `
            <div style="font-size:0.8rem; color:#aaa;">Automated Reading Progress</div>
            <div style="font-weight:bold; color:var(--deen); margin-top:2px;">Currently on Juz ${remainderJuz + 1} (${deenData.quranStats?.totalHizb || 0} Total Hizb read)</div>
        `;
        juzContainer.appendChild(autoTracker);

        deenData.quran.forEach((q, index) => { 
            const div = document.createElement('div'); 
            div.className = 'quran-item'; 
            div.style.opacity = q.completed ? '0.5' : '1'; 
            div.style.flexDirection = 'column'; 
            div.style.gap = '10px'; 
            let intentionText = q.intention ? `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;"><em>" ${q.intention} "</em></div>` : ''; 
            div.innerHTML = `<div><strong>${q.completed ? '✅' : '📖'} Juz ${q.juz}</strong>${intentionText}</div><div style="display: flex; gap: 6px; justify-content: flex-end;">${!q.completed ? `<button onclick="completeJuz(${index})" style="background:var(--success); color:#000; padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">Complete</button><button onclick="editJuz(${index})" style="background:var(--warning); color:#000; padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">✏️ Edit</button>` : ''}<button onclick="deleteJuz(${index})" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">🗑️</button></div>`; 
            juzContainer.appendChild(div); 
        }); 
    }

    const qadaContainer = document.getElementById('qada-container'); qadaContainer.innerHTML = ''; const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Witr']; let totalQada = prayers.reduce((acc, p) => acc + deenData.qada[p], 0);
    if (totalQada === 0 && !showAllQada) { qadaContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.9rem; margin-bottom:10px;">🎉 All missed prayers are caught up!</div>`; }
    prayers.forEach(p => { const count = deenData.qada[p]; if (!showAllQada && count === 0) return; const div = document.createElement('div'); div.className = 'qada-row'; div.innerHTML = `<div style="font-weight:bold;">${p}</div><div class="qada-controls"><span style="font-family:monospace; font-size:1.2rem; min-width:30px; text-align:center; color:${count > 0 ? 'var(--danger)' : 'var(--success)'}">${count}</span><button class="qada-btn minus" onclick="updateQada('${p}', -1)" title="Prayed Qada">✔️</button><button class="qada-btn" onclick="updateQada('${p}', 1)" title="Missed Prayer">➕</button></div>`; qadaContainer.appendChild(div); }); 
    const toggleBtn = document.createElement('button'); toggleBtn.style = "background:transparent; border:1px solid var(--deen); color:var(--deen); padding:8px; margin-top:10px; width:100%; border-radius:8px;"; toggleBtn.innerText = showAllQada ? "⬆️ Hide Caught Up Prayers" : "⬇️ Reveal All Prayers"; toggleBtn.onclick = function() { showAllQada = !showAllQada; renderDeen(); }; qadaContainer.appendChild(toggleBtn);

    document.getElementById('zakat-cash').value = deenData.zakatInputs.cash; document.getElementById('zakat-gold').value = deenData.zakatInputs.gold; document.getElementById('zakat-invest').value = deenData.zakatInputs.invest; calculateZakat(); 
}

function updateQada(prayer, amount) { deenData.qada[prayer] += amount; if(deenData.qada[prayer] < 0) deenData.qada[prayer] = 0; saveData(); renderDeen(); }
function addDhikr() { const name = document.getElementById('dhikr-name').value.trim(); const target = parseInt(document.getElementById('dhikr-target').value); const intention = document.getElementById('dhikr-intention').value.trim(); const deadline = document.getElementById('dhikr-deadline').value; if (!name || !target || target <= 0) return alert("Please provide a valid Dhikr name and target number."); deenData.dhikr.push({ name, target, current: 0, intention, deadline, completed: false }); document.getElementById('dhikr-name').value = ''; document.getElementById('dhikr-target').value = ''; document.getElementById('dhikr-intention').value = ''; document.getElementById('dhikr-deadline').value = ''; saveData(); renderDeen(); }
function logDhikr(index) { 
    const amount = parseInt(document.getElementById(`dhikr-input-${index}`).value) || 0; 
    if (amount <= 0) return; 
    deenData.dhikr[index].current += amount; 
    if (deenData.dhikr[index].current >= deenData.dhikr[index].target) { deenData.dhikr[index].current = deenData.dhikr[index].target; deenData.dhikr[index].completed = true; } 
    applyDeenAutomation(deenData.dhikr[index].name, amount);
    let newLog = { id: Date.now().toString(), taskId: 'dhikr-'+index, category: 'deen', timestamp: Date.now(), title: "Dhikr: " + deenData.dhikr[index].name, actionType: 'complete', amount: amount };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    saveData(); renderDeen(); 
}
function deleteDhikr(index) { if (confirm("Delete this committed Dhikr?")) { deenData.dhikr.splice(index, 1); saveData(); renderDeen(); } }
function addJuzIntention() { const val = document.getElementById('juz-select').value; const intention = document.getElementById('juz-intention').value.trim(); if(!val) return alert("Please select a Juz."); if(deenData.quran.find(q => q.juz == val && !q.completed)) return alert("An active intention for this Juz already exists!"); deenData.quran.push({ juz: parseInt(val), intention: intention, completed: false }); document.getElementById('juz-select').value = ''; document.getElementById('juz-intention').value = ''; saveData(); renderDeen(); }
function completeJuz(index) { 
    deenData.quran[index].completed = true; 
    let newLog = { id: Date.now().toString(), taskId: 'juz-'+index, category: 'deen', timestamp: Date.now(), title: "Completed Juz " + deenData.quran[index].juz, actionType: 'complete', amount: 1 };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    saveData(); renderDeen(); 
}
function editJuz(index) { const q = deenData.quran[index]; const newIntention = prompt(`Edit your intention for Juz ${q.juz}:`, q.intention); if (newIntention !== null) { deenData.quran[index].intention = newIntention.trim(); saveData(); renderDeen(); } }
function deleteJuz(index) { deenData.quran.splice(index, 1); saveData(); renderDeen(); }
function calculateZakat() { const cash = parseFloat(document.getElementById('zakat-cash').value) || 0; const gold = parseFloat(document.getElementById('zakat-gold').value) || 0; const invest = parseFloat(document.getElementById('zakat-invest').value) || 0; deenData.zakatInputs = { cash, gold, invest }; saveDataLocallyOnly(); const zakatDue = (cash + gold + invest) * 0.025; document.getElementById('zakat-due').innerText = zakatDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

// ==========================================
// BUDGET & EXPENSES LOGIC
// ==========================================
function setBudgetLimit() {
    const limitInput = document.getElementById('budget-set-limit').value;
    const newLimit = parseFloat(limitInput);
    if (!isNaN(newLimit) && newLimit >= 0) {
        budgetData.limit = newLimit;
        document.getElementById('budget-set-limit').value = '';
        saveData(); renderBudget();
    } else { alert("Please enter a valid amount."); }
}

function addExpense() {
    const desc = document.getElementById('expense-desc').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const dateInput = document.getElementById('expense-date').value;
    if (!desc || isNaN(amount) || amount <= 0) return alert("Please enter a valid description and amount.");
    
    const expenseDate = dateInput ? new Date(dateInput).getTime() : Date.now();
    budgetData.expenses.push({ id: Date.now().toString(), desc, amount, date: expenseDate });
    
    let newLog = { id: Date.now().toString(), taskId: 'exp-'+Date.now(), category: 'budget', timestamp: Date.now(), title: "Expense: " + desc, actionType: 'expense', amount: amount };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    
    document.getElementById('expense-desc').value = ''; document.getElementById('expense-amount').value = ''; document.getElementById('expense-date').value = '';
    closeModal('expense-modal');
    saveData(); renderBudget();
}

function deleteExpense(id) {
    if (confirm("Delete this expense log?")) {
        budgetData.expenses = budgetData.expenses.filter(e => e.id !== id);
        saveData(); renderBudget();
    }
}

async function pickContact() {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
        alert("Contact picker is only supported on mobile browsers. Please type the name manually.");
        return;
    }
    try {
        const props = ['name'];
        const contacts = await navigator.contacts.select(props, { multiple: false });
        if (contacts.length > 0 && contacts[0].name.length > 0) {
            document.getElementById('debt-desc').value = contacts[0].name[0];
        }
    } catch (ex) { console.error("Contact selection failed:", ex); }
}

function addDebt() {
    const desc = document.getElementById('debt-desc').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const type = document.getElementById('debt-type').value;
    const dateInput = document.getElementById('debt-date').value;
    if (!desc || isNaN(amount) || amount <= 0) return alert("Please enter a valid description and amount.");
    
    const debtDate = dateInput ? new Date(dateInput).getTime() : Date.now();
    budgetData.debts.push({ id: Date.now().toString(), desc, amount, type, date: debtDate, repaid: 0 });
    
    let newLog = { id: Date.now().toString(), taskId: 'debt-'+Date.now(), category: 'budget', taskType: type, timestamp: Date.now(), title: desc, actionType: 'debt', amount: amount };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    
    document.getElementById('debt-desc').value = ''; document.getElementById('debt-amount').value = ''; document.getElementById('debt-date').value = '';
    closeModal('debt-modal');
    saveData(); renderBudget();
}

function repayDebt(id) {
    const debt = budgetData.debts.find(d => d.id === id); if (!debt) return;
    let pending = debt.amount - (debt.repaid || 0);
    if (pending <= 0) return alert("This is already fully settled!");

    let input = prompt(`How much was returned? (Pending: ₹${pending}):`);
    if (input === null || input.trim() === '') return; 
    let repayAmount = parseFloat(input);
    if (isNaN(repayAmount) || repayAmount <= 0) return alert("Invalid amount entered.");
    if (repayAmount > pending) repayAmount = pending; 
    
    debt.repaid = (debt.repaid || 0) + repayAmount;
    
    let newLog = { id: Date.now().toString(), taskId: debt.id, category: 'budget', timestamp: Date.now(), title: `Repaid Debt (${debt.desc})`, actionType: 'repayment', amount: repayAmount };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    
    if (debt.amount - debt.repaid <= 0) {
        if (confirm(`₹${repayAmount} logged. This debt is now fully settled! Do you want to remove it from the list entirely?`)) {
            budgetData.debts = budgetData.debts.filter(d => d.id !== id);
        }
    } else {
        alert(`₹${repayAmount} logged successfully. ₹${debt.amount - debt.repaid} still pending.`);
    }
    saveData(); renderBudget();
}

function deleteDebt(id) {
    if (confirm("Delete this debt record?")) { budgetData.debts = budgetData.debts.filter(d => d.id !== id); saveData(); renderBudget(); }
}

function renderBudget() {
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    document.getElementById('budget-month-title').innerText = monthNames[currentMonth] + " " + currentYear;
    document.getElementById('budget-limit-display').innerText = budgetData.limit.toLocaleString();
    
    let monthlyTotal = 0;
    const listContainer = document.getElementById('expense-list-container');
    if (listContainer) {
        listContainer.innerHTML = '';
        const sortedExpenses = [...budgetData.expenses].sort((a, b) => b.date - a.date);
        let hasExpensesThisMonth = false;

        sortedExpenses.forEach(exp => {
            const expDate = new Date(exp.date);
            if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
                monthlyTotal += exp.amount; hasExpensesThisMonth = true;
                const div = document.createElement('div');
                div.style = "background:#252530; padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--danger);";
                div.innerHTML = `
                    <div>
                        <div style="font-weight:bold;">${exp.desc}</div>
                        <div style="font-size:0.8rem; color:#888;">${expDate.toLocaleDateString()}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="color:var(--danger); font-weight:bold;">₹${exp.amount.toLocaleString()}</span>
                        <button class="btn-icon" onclick="deleteExpense('${exp.id}')" style="min-width:36px; min-height:36px;">🗑️</button>
                    </div>
                `;
                listContainer.appendChild(div);
            }
        });
        if (!hasExpensesThisMonth) listContainer.innerHTML = '<p style="color:#aaa; text-align:center;">No expenses logged for this month yet.</p>';
    }

    document.getElementById('budget-spent').innerText = monthlyTotal.toLocaleString();
    const fillEl = document.getElementById('budget-progress-fill');
    const remainingText = document.getElementById('budget-remaining-text');
    
    if (budgetData.limit > 0) {
        let percentage = (monthlyTotal / budgetData.limit) * 100;
        let fillWidth = Math.min(percentage, 100);
        fillEl.style.width = fillWidth + '%';
        if (percentage >= 100) {
            fillEl.style.background = 'var(--danger)';
            remainingText.innerText = `Over budget by ₹${(monthlyTotal - budgetData.limit).toLocaleString()}`;
            remainingText.style.color = 'var(--danger)';
        } else if (percentage >= 80) {
            fillEl.style.background = 'var(--warning)';
            remainingText.innerText = `₹${(budgetData.limit - monthlyTotal).toLocaleString()} Remaining`;
            remainingText.style.color = 'var(--warning)';
        } else {
            fillEl.style.background = 'var(--budget)';
            remainingText.innerText = `₹${(budgetData.limit - monthlyTotal).toLocaleString()} Remaining`;
            remainingText.style.color = '#888';
        }
    } else {
        fillEl.style.width = '0%'; remainingText.innerText = 'Limit not set';
    }

    let totalBorrowed = 0; let totalLent = 0;
    const borrowedContainer = document.getElementById('borrowed-list-container');
    const lentContainer = document.getElementById('lent-list-container');
    
    if(borrowedContainer && lentContainer) {
        borrowedContainer.innerHTML = ''; lentContainer.innerHTML = '';
        const sortedDebts = [...(budgetData.debts || [])].sort((a, b) => b.date - a.date);
        
        sortedDebts.forEach(debt => {
            const dDate = new Date(debt.date); const repaid = debt.repaid || 0; const pending = debt.amount - repaid;
            if (pending <= 0 && repaid > 0 && debt.amount > 0) return; 
            
            const div = document.createElement('div');
            div.style = "background:#252530; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
            let progressHtml = repaid > 0 ? `<div style="font-size:0.75rem; color:#aaa; margin-top:2px;">Original: ₹${debt.amount} | Paid: ₹${repaid}</div>` : '';

            div.innerHTML = `
                <div>
                    <div style="font-weight:bold; font-size:0.85rem;">${debt.desc}</div>
                    <div style="font-size:0.75rem; color:#888;">${dDate.toLocaleDateString()}</div>
                    ${progressHtml}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="text-align:right;">
                        <span style="font-weight:bold; font-size:0.9rem; color:${debt.type === 'borrowed' ? 'var(--bad)' : 'var(--success)'};">₹${pending.toLocaleString()}</span>
                    </div>
                    <button class="btn-icon" onclick="repayDebt('${debt.id}')" style="background:rgba(3, 218, 198, 0.15); color:var(--success);" title="Log Repayment">💰</button>
                    <button class="btn-icon" onclick="deleteDebt('${debt.id}')" title="Delete Record">🗑️</button>
                </div>
            `;
            if (debt.type === 'borrowed') { totalBorrowed += pending; borrowedContainer.appendChild(div); } 
            else { totalLent += pending; lentContainer.appendChild(div); }
        });
        
        if (borrowedContainer.innerHTML === '') borrowedContainer.innerHTML = '<div style="color:#aaa; font-size:0.8rem; text-align:center;">None</div>';
        if (lentContainer.innerHTML === '') lentContainer.innerHTML = '<div style="color:#aaa; font-size:0.8rem; text-align:center;">None</div>';
        document.getElementById('total-borrowed').innerText = totalBorrowed.toLocaleString(); document.getElementById('total-lent').innerText = totalLent.toLocaleString();
    }
}

// ==========================================
// BACKLOG (WATCH/READ LATER) & SCRAPER LOGIC
// ==========================================
async function autoFetchThumbnail() {
    const link = document.getElementById('backlog-link').value.trim();
    const title = document.getElementById('backlog-title').value.trim();
    const type = document.getElementById('backlog-type').value;
    const imgInput = document.getElementById('backlog-image-url');

    if (!link && !title) return alert("Please enter a title or link first!");
    imgInput.placeholder = "⏳ Fetching high-res cover image...";

    if (link && (link.includes('youtube.com') || link.includes('youtu.be'))) {
        const vidIdMatch = link.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (vidIdMatch && vidIdMatch[1]) {
            const vidId = vidIdMatch[1];
            const maxResUrl = `https://img.youtube.com/vi/${vidId}/maxresdefault.jpg`;
            const testImg = new Image();
            testImg.src = maxResUrl;
            testImg.onload = function() {
                if (this.width > 120) { imgInput.value = maxResUrl; } 
                else { imgInput.value = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`; }
            };
            testImg.onerror = function() { imgInput.value = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`; };
            return;
        }
    }

    if (link) {
        try {
            const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(link)}`);
            const data = await res.json();
            if (data.status === 'success' && data.data && data.data.image && data.data.image.url) {
                imgInput.value = data.data.image.url;
                return;
            }
        } catch(e) { console.error("Link metadata fetch error", e); }
    }

    if (type === 'book' || title) {
        try {
            const query = encodeURIComponent(title || link);
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
            const data = await res.json();
            if (data.items && data.items[0].volumeInfo && data.items[0].volumeInfo.imageLinks) {
                let imageLinks = data.items[0].volumeInfo.imageLinks;
                let thumb = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail;
                if (thumb) {
                    thumb = thumb.replace('http://', 'https://').replace('&zoom=1', '&zoom=2').replace('&edge=curl', '');
                    imgInput.value = thumb;
                    return;
                }
            }
        } catch(e) { console.error("Book fetch error", e); }
    }

    if (link) {
        try {
            let domain = new URL(link).hostname;
            imgInput.value = `https://logo.clearbit.com/${domain}`;
        } catch(e) {
            alert("Could not fetch a high-res thumbnail automatically. Please paste an image link directly!");
        }
    } else {
        alert("Could not find a cover photo automatically. Please paste an image URL directly.");
    }
    imgInput.placeholder = "Cover Image URL (Auto-filled or paste here)";
}

function addBacklogItem() {
    const id = document.getElementById('backlog-id').value;
    const title = document.getElementById('backlog-title').value.trim();
    const link = document.getElementById('backlog-link').value.trim();
    const imageUrl = document.getElementById('backlog-image-url').value.trim();
    const type = document.getElementById('backlog-type').value;
    const notes = document.getElementById('backlog-notes').value.trim();

    if (!title) return alert("Please provide a title or name for the item.");

    if (id) {
        const item = backlogData.find(b => b.id === id);
        if (item) {
            item.title = title;
            item.link = link;
            item.imageUrl = imageUrl;
            item.type = type;
            item.notes = notes;
        }
    } else {
        backlogData.push({
            id: Date.now().toString(),
            title, link, imageUrl, type, notes,
            addedAt: Date.now(),
            completed: false
        });
        
        let newLog = { id: Date.now().toString(), taskId: 'backlog-'+Date.now(), category: 'backlog', taskType: type, timestamp: Date.now(), title: title, actionType: 'add_backlog', amount: 1 };
        activityHistory.push(newLog); syncToGoogleSheets(newLog);
    }

    cancelEditBacklogItem();
    closeModal('backlog-modal');
    saveData(); renderBacklog();
}

function editBacklogItem(id) {
    const item = backlogData.find(b => b.id === id);
    if (!item) return;
    document.getElementById('backlog-form-title').innerText = '✏️ Edit Backlog Item';
    document.getElementById('backlog-id').value = item.id;
    document.getElementById('backlog-title').value = item.title || '';
    document.getElementById('backlog-link').value = item.link || '';
    document.getElementById('backlog-image-url').value = item.imageUrl || '';
    document.getElementById('backlog-type').value = item.type || 'video';
    document.getElementById('backlog-notes').value = item.notes || '';

    document.getElementById('btn-save-backlog').innerText = 'Save Changes';
    document.getElementById('btn-cancel-edit-backlog').style.display = 'block';
    openModal('backlog-modal');
}

function cancelEditBacklogItem() {
    document.getElementById('backlog-form-title').innerText = '📌 Add to Library';
    document.getElementById('backlog-id').value = '';
    document.getElementById('backlog-title').value = '';
    document.getElementById('backlog-link').value = '';
    document.getElementById('backlog-image-url').value = '';
    document.getElementById('backlog-type').value = 'video';
    document.getElementById('backlog-notes').value = '';
    document.getElementById('btn-save-backlog').innerHTML = 'Save to Library';
    document.getElementById('btn-cancel-edit-backlog').style.display = 'none';
}

function toggleBacklogStatus(id) {
    const item = backlogData.find(b => b.id === id);
    if (item) {
        item.completed = !item.completed;
        
        let newLog = { id: Date.now().toString(), taskId: item.id, category: 'backlog', timestamp: Date.now(), title: `${item.completed ? 'Completed' : 'Reopened'} Library Item: ` + item.title, actionType: item.completed ? 'complete' : 'reopen', amount: 1 };
        activityHistory.push(newLog); syncToGoogleSheets(newLog);
        
        saveData(); renderBacklog();
        if (item.completed && typeof confetti === 'function') confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    }
}

function deleteBacklogItem(id) {
    if (confirm("Remove this item from your library?")) {
        backlogData = backlogData.filter(b => b.id !== id);
        saveData(); renderBacklog();
    }
}

function renderBacklog() {
    const container = document.getElementById('backlog-list-container'); if (!container) return; container.innerHTML = '';
    const filterView = document.getElementById('backlog-filter') ? document.getElementById('backlog-filter').value : 'all';
    
    let filteredData = backlogData;
    if (filterView === 'pending') filteredData = backlogData.filter(b => !b.completed);
    if (filterView === 'completed') filteredData = backlogData.filter(b => b.completed);

    if (filteredData.length === 0) { container.innerHTML = '<p style="color:#aaa; text-align:center;">Library is empty for this view.</p>'; return; }

    filteredData.sort((a, b) => {
        if (a.completed === b.completed) return b.addedAt - a.addedAt;
        return a.completed ? 1 : -1;
    });

    const typeIcons = { 'video': '📺', 'article': '📰', 'book': '📚', 'other': '🔖' };

    filteredData.forEach(item => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--backlog)'; if (item.completed) div.style.opacity = '0.5';

        let imageHtml = item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%; max-height:220px; object-fit:cover; border-radius:8px; margin-bottom:10px; background:#111;" onerror="this.style.display='none'">` : '';
        let linkHtml = item.link ? `<a href="${item.link}" target="_blank" style="color:var(--backlog); font-size:0.85rem; text-decoration:none; display:block; margin-bottom:5px;">🔗 Open Link</a>` : '';
        let notesHtml = item.notes ? `<div style="font-size:0.85rem; color:#aaa; margin-bottom:8px; background:#111; padding:8px; border-radius:5px;">${item.notes}</div>` : '';
        let statusBadge = item.completed ? `<span class="badge done-badge">✅ Finished</span>` : '';

        div.innerHTML = `
            ${imageHtml}
            <div class="task-header" style="margin-bottom:10px;">
                <div style="flex:1;">
                    <div style="font-size:0.8rem; color:#888; margin-bottom:3px;">${typeIcons[item.type] || '🔖'} ${item.type.toUpperCase()}</div>
                    <div class="task-title" style="${item.completed ? 'text-decoration:line-through;' : ''}">${item.title}</div>
                    ${statusBadge}
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="editBacklogItem('${item.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteBacklogItem('${item.id}')">🗑️</button>
                </div>
            </div>
            ${linkHtml}
            ${notesHtml}
            <button onclick="toggleBacklogStatus('${item.id}')" style="background:${item.completed ? '#333' : 'var(--backlog)'}; color:${item.completed ? '#fff' : '#000'}; width:100%; margin:0; padding:8px;">
                ${item.completed ? 'Undo (Mark as Pending)' : 'Mark as Done'}
            </button>
        `;
        container.appendChild(div);
    });
}

// ==========================================
// BACKGROUND REMINDER ENGINE
// ==========================================
setInterval(() => {
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if ("Notification" in window && Notification.permission === "granted") {
        tasks.forEach(t => {
            const doneToday = activityHistory.some(h => h.taskId === t.id && h.actionType === 'complete' && h.timestamp >= startOfDay);
            if (t.reminderTime === timeString && !t.isCompleted && !doneToday && t.currentTarget > 0) {
                if (t.lastNotified !== timeString) {
                    new Notification("Hisab Reminder: " + t.title, { body: `Target today: ${t.baseTarget} (${t.currentTarget} left in year)`, icon: "icon.png" });
                    t.lastNotified = timeString;
                    saveDataLocallyOnly();
                }
            }
        });
    }
    if (processAutomaticPenalties()) { saveData(); render(); }
}, 60000); 

// ==========================================
// CORE APP ROUTING & UI
// ==========================================
function switchTab(tabName, element) {
    localStorage.setItem('hisab_active_tab', tabName); document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(nav => { nav.classList.remove('active'); nav.classList.remove('active-bad'); nav.classList.remove('active-deen'); nav.classList.remove('active-budget'); nav.classList.remove('active-backlog'); });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if(tabName === 'deen') { element.classList.add('active-deen'); renderDeen(); } 
    else if(tabName === 'bad-habits') { element.classList.add('active-bad'); renderHabits(); }
    else if(tabName === 'budget') { element.classList.add('active-budget'); renderBudget(); }
    else if(tabName === 'backlog') { element.classList.add('active-backlog'); renderBacklog(); }
    else { element.classList.add('active'); }
    
    if (tabName === 'dashboard') updateDashboard();
}

function initNotifications() { const btn = document.getElementById('btn-notifications'); if (!("Notification" in window)) { btn.style.display = 'none'; return; } if (Notification.permission === "granted") { btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); } }
function toggleNotifications() { if (!("Notification" in window)) return alert("Browser does not support notifications."); if (Notification.permission === "granted") { alert("Notifications already enabled!"); } else if (Notification.permission !== "denied") { Notification.requestPermission().then(p => { if (p === "granted") { const btn = document.getElementById('btn-notifications'); btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); } }); } else { alert("Notifications blocked in device settings."); } }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function render() { renderTasks(); renderHabits(); renderDeen(); renderBudget(); renderBacklog(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard(); }

// Exports
window.openModal = openModal; window.closeModal = closeModal;
window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.switchTab = switchTab; 
window.saveTask = saveTask; window.editTask = editTask; window.cancelEdit = cancelEdit; window.deleteTask = deleteTask; window.logProgress = logProgress; window.markMissed = markMissed;
window.openTask30DayModal = openTask30DayModal; window.fulfillMissedTaskDay = fulfillMissedTaskDay; window.undoTaskDayLogs = undoTaskDayLogs; window.markTaskMissedOnDate = markTaskMissedOnDate;
window.undoAction = undoAction; window.openHistory = openHistory; window.closeHistory = closeHistory; window.filterHistory = filterHistory;
window.payDonation = payDonation; 
window.addGoodHabit = addGoodHabit; window.editGoodHabit = editGoodHabit; window.cancelEditGoodHabit = cancelEditGoodHabit; window.logGoodHabit = logGoodHabit; window.deleteGoodHabit = deleteGoodHabit; 
window.addBadHabit = addBadHabit; window.editBadHabit = editBadHabit; window.cancelEditBadHabit = cancelEditBadHabit; window.logBadHabit = logBadHabit; window.deleteBadHabit = deleteBadHabit;
window.logSwalathDirect = logSwalathDirect; window.logHizbDirect = logHizbDirect;
window.addDhikr = addDhikr; window.logDhikr = logDhikr; window.deleteDhikr = deleteDhikr; window.addJuzIntention = addJuzIntention; window.completeJuz = completeJuz; window.editJuz = editJuz; window.deleteJuz = deleteJuz; window.updateQada = updateQada; window.calculateZakat = calculateZakat;
window.setBudgetLimit = setBudgetLimit; window.addExpense = addExpense; window.deleteExpense = deleteExpense; window.addDebt = addDebt; window.deleteDebt = deleteDebt; window.repayDebt = repayDebt; window.pickContact = pickContact;
window.addBacklogItem = addBacklogItem; window.editBacklogItem = editBacklogItem; window.cancelEditBacklogItem = cancelEditBacklogItem; window.toggleBacklogStatus = toggleBacklogStatus; window.deleteBacklogItem = deleteBacklogItem; window.renderBacklog = renderBacklog; window.renderTasks = renderTasks; window.toggleNotifications = toggleNotifications; window.autoFetchThumbnail = autoFetchThumbnail;
window.openTask30DayModal = openTask30DayModal; window.fulfillMissedTaskDay = fulfillMissedTaskDay; window.undoTaskDayLogs = undoTaskDayLogs; window.markTaskMissedOnDate = markTaskMissedOnDate;
window.openHabit30DayModal = openHabit30DayModal; window.logHabitOnDate = logHabitOnDate; window.undoHabitDayLog = undoHabitDayLog;

initNotifications();
const savedTab = localStorage.getItem('hisab_active_tab') || 'dashboard'; const savedNavElement = document.getElementById('nav-' + savedTab); if (savedNavElement) switchTab(savedTab, savedNavElement);