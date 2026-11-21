
let currentTaskFilter = 'all';
function setTaskFilter(filterType, element) {
    currentTaskFilter = filterType;
    document.querySelectorAll('#task-filter-slider .filter-pill').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    renderTasks();
}
window.setTaskFilter = setTaskFilter;

function toggleTaskSlider(taskId, event) {
    if (event) event.stopPropagation();
    const card = document.getElementById('task-card-' + taskId);
    if (!card) return;
    const wasOpen = card.classList.contains('slider-open');
    card.classList.toggle('slider-open');
    const chevron = document.getElementById('chevron-' + taskId);
    if (chevron) chevron.innerText = wasOpen ? '▼' : '▲';
    if (typeof triggerHaptic === 'function') triggerHaptic(8);
}
window.toggleTaskSlider = toggleTaskSlider;


// ==========================================
// ==========================================
// QUICK ACTION SHEET & NAVIGATION DOCK
// ==========================================
function openQuickActionSheet() {
    closeNavDrawer();
    const sheet = document.getElementById('quick-action-sheet');
    const overlay = document.getElementById('quick-action-overlay');
    if (sheet) sheet.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('modal-open');
    if (typeof triggerHaptic === 'function') triggerHaptic(12);
    if (window.history && window.history.pushState) {
        history.pushState({ quickAction: true }, '', '#quick-action');
    }
}
function closeQuickActionSheet() {
    const sheet = document.getElementById('quick-action-sheet');
    const overlay = document.getElementById('quick-action-overlay');
    if (sheet) sheet.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('modal-open');
    if (window.location.hash === '#quick-action') {
        const currentTab = localStorage.getItem('hisab_active_tab') || 'dashboard';
        if (window.history && window.history.replaceState) {
            history.replaceState({ tab: currentTab }, '', '#' + currentTab);
        }
    }
}
window.openQuickActionSheet = openQuickActionSheet;
window.closeQuickActionSheet = closeQuickActionSheet;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeQuickActionSheet();
        closeNavDrawer();
    }
});

// NAVIGATION DRAWER & MINIMAL UI HELPERS
// ==========================================
function openNavDrawer() {
    closeQuickActionSheet();
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (typeof triggerHaptic === 'function') triggerHaptic(12);
    // Push drawer state to history so Android back button closes the drawer!
    if (window.history && window.history.pushState) {
        history.pushState({ drawer: true }, '', '#menu');
    }
}


function scrollToCharity() {
    const card = document.getElementById('charity-dashboard-card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        card.style.borderColor = 'var(--amber)';
        card.style.boxShadow = '0 0 0 4px var(--amber-soft)';
        setTimeout(() => { card.style.borderColor = ''; card.style.boxShadow = ''; }, 1600);
    }
}
window.scrollToCharity = scrollToCharity;

// Automatic Background & Tab-Return Cloud Sync
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser && navigator.onLine) {
        manualCloudSync(true);
    }
});
window.addEventListener('focus', () => {
    if (currentUser && navigator.onLine) {
        manualCloudSync(true);
    }
});
window.addEventListener('online', () => {
    if (currentUser) {
        manualCloudSync(true);
    }
});
setInterval(() => {
    if (currentUser && navigator.onLine && !document.hidden) {
        manualCloudSync(true);
    }
}, 60000);

window.openNavDrawer = openNavDrawer;
window.closeNavDrawer = closeNavDrawer;

function closeNavDrawer() {
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    // If current hash is #menu, safely restore the hash to the active tab
    if (window.location.hash === '#menu') {
        const currentTab = localStorage.getItem('hisab_active_tab') || 'dashboard';
        if (window.history && window.history.replaceState) {
            history.replaceState({ tab: currentTab }, '', '#' + currentTab);
        }
    }
}

function toggleAnalyticsView() {
    const content = document.getElementById('analytics-content');
    const arrow = document.getElementById('analytics-toggle-arrow');
    if (!content) return;
    const isHidden = content.style.display === 'none' || !content.style.display;
    content.style.display = isHidden ? 'block' : 'none';
    document.getElementById('analytics-card')?.classList.toggle('open', isHidden);
    if (isHidden) updateDashboard();
}

// Android Back Gesture & Popstate Interceptor (Never closes app on subpages!)
let lastBackPressTime = 0;

window.addEventListener('popstate', (event) => {
    // 0. If quick action sheet is open, close it!
    const quickSheet = document.getElementById('quick-action-sheet');
    if (quickSheet && quickSheet.classList.contains('active')) {
        closeQuickActionSheet();
        return;
    }
    // 1. If drawer is open, close it!
    const drawer = document.getElementById('nav-drawer');
    if (drawer && drawer.classList.contains('open')) {
        closeNavDrawer();
        return;
    }

    // 2. If history modal or any other modal is open, close it!
    const histModal = document.getElementById('history-modal');
    if (histModal && histModal.style.display === 'block') {
        closeHistory();
        return;
    }
    const openModals = document.querySelectorAll('.modal-overlay');
    let modalClosed = false;
    for (const m of openModals) {
        if (m.style.display === 'flex' || m.style.display === 'block') {
            m.style.display = 'none';
            modalClosed = true;
        }
    }
    if (modalClosed) return;

    // 3. Tab navigation on back
    const currentTab = localStorage.getItem('hisab_active_tab') || 'dashboard';
    const stateTab = event.state && event.state.tab;

    if (stateTab && stateTab !== currentTab) {
        switchTab(stateTab, null, true);
        return;
    }

    // If on a sub-tab (Tasks, Habits, Deen, etc.), always return to Dashboard!
    if (currentTab !== 'dashboard') {
        switchTab('dashboard', null, true);
        return;
    }

    // 4. Double-back exit prevention on Dashboard
    const now = Date.now();
    if (now - lastBackPressTime < 2000) {
        // User confirmed exit
        history.back();
    } else {
        lastBackPressTime = now;
        if (typeof showToast === 'function') {
            showToast("Press back again to exit Hisab", "👋");
        }
        if (window.history && window.history.pushState) {
            history.pushState({ tab: 'dashboard', root: true }, '', '#dashboard');
        }
    }
});

// Edge Swipe Gesture: Swiping right from screen left edge returns to Home or opens menu!
let edgeTouchStartX = 0;
let edgeTouchStartY = 0;

window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
        edgeTouchStartX = e.touches[0].clientX;
        edgeTouchStartY = e.touches[0].clientY;
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (edgeTouchStartX > 0 && e.changedTouches && e.changedTouches.length === 1) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - edgeTouchStartX;
        const diffY = Math.abs(endY - edgeTouchStartY);

        // Edge swipe started within 45px of screen left, swiped right > 65px
        if (edgeTouchStartX < 45 && diffX > 65 && diffY < 55) {
            const currentTab = localStorage.getItem('hisab_active_tab') || 'dashboard';
            if (currentTab !== 'dashboard') {
                if (typeof triggerHaptic === 'function') triggerHaptic(15);
                switchTab('dashboard');
            } else {
                openNavDrawer();
            }
        }
        edgeTouchStartX = 0;
    }
}, { passive: true });


// ==========================================
// FIREBASE CLOUD SERVER INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import * as Core from "./lib/core.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPw0XqzplPvH6KxbcJxwYNdyjfdPDntNo",
    authDomain: "hisab-1127d.firebaseapp.com",
    projectId: "hisab-1127d",
    // ↓ Needed for background push reminders. Copy from Firebase Console → Project settings → General → Your apps (Web app).
    messagingSenderId: "155630179687",
    appId: "1:155630179687:web:16e1542dbded16f337cbc2"
};
// ↓ Firebase Console → Project settings → Cloud Messaging → Web Push certificates → "Key pair". Leave empty to disable background push.
const FCM_VAPID_KEY = "BBHd24F7mknr9qK4TB64pp2cTcQi9l-HQSG7_Zlo9Fv9LjG68IW6O52SmcOrR__eXWL7ifu0sodOyLsS4k4mbAw";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
let unsubscribeSnapshot = null;

let lastCloudError = null;

function setSyncIndicator(state, text, err = null) {
    const el = document.getElementById('cloud-sync-indicator');
    if (!el) return;
    el.className = 'sync-status-dot ' + (state === 'synced' ? 'synced' : (state === 'error' ? 'error' : (state === 'pending' ? 'pending' : '')));
    el.innerText = text;
    el.title = state === 'pending' ? 'Saved on this device only — it will upload when you are back online' : 'Tap to sync';
    if (err) lastCloudError = err;
    if (state === 'synced') lastCloudError = null;
}

// Handle Redirect Sign-In Result if popup fell back to redirect
getRedirectResult(auth).then((result) => {
    if (result && result.user) {
        currentUser = result.user;
        showProfile({ name: currentUser.displayName, email: currentUser.email, picture: currentUser.photoURL });
        listenToFirebase();
    }
}).catch((err) => {
    console.warn("Redirect auth check:", err.message);
});

// onAuthStateChanged relocated to end of script after state initialization

async function loginWithGoogle() {
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) errEl.style.display = 'none';
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        showProfile({ name: currentUser.displayName, email: currentUser.email, picture: currentUser.photoURL });
        listenToFirebase();
    } catch (error) {
        console.error("Popup sign-in error:", error);
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider);
            return;
        }
        if (errEl) {
            errEl.style.display = 'block';
            if (error.code === 'auth/unauthorized-domain') {
                errEl.innerText = `⚠️ Domain "${window.location.hostname}" is not yet authorized in Firebase Console > Authentication > Settings > Authorized domains.`;
            } else {
                errEl.innerText = `⚠️ Sign-In Error (${error.code || 'Auth'}): ${error.message}`;
            }
        } else {
            alert("Login Failed: " + error.message);
        }
    }
}

function logout() { signOut(auth).then(() => { location.reload(); }); }

function showProfile(user) {
    const loginPrompt = document.getElementById('login-prompt');
    if (loginPrompt) loginPrompt.style.display = 'none';
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;
    // Only show the profile bar on the dashboard to keep other pages clean
    authContainer.style.cssText = 'display:none;';
    authContainer.dataset.ready = '1';
    authContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
            <img src="${escapeHTML(user.picture || 'icons/icon-96.png')}" onerror="this.src='icons/icon-96.png'" referrerpolicy="no-referrer" style="width:38px; height:38px; border-radius:50%; object-fit:cover;">
            <div style="line-height:1.3; min-width:0;">
                <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(user.name)}</div>
                <div style="font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(user.email)}</div>
            </div>
        </div>
        <div style="display:flex; gap:6px;">
            <button class="btn-sm btn-secondary" onclick="manualCloudSync()">${svgIcon('refresh', 'icon icon-sm')}Sync</button>
            <button class="btn-sm btn-ghost" onclick="logout()">Sign out</button>
        </div>`;
    const tab = localStorage.getItem('hisab_active_tab') || 'dashboard';
    if (tab === 'dashboard') authContainer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;';
    const so = document.getElementById('drawer-signout'); if (so) so.style.display = '';
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

let extraData = JSON.parse(localStorage.getItem('hisab_extra') || 'null') || {};
if (!extraData.prayerLog) extraData.prayerLog = {};
if (!extraData.focusLog) extraData.focusLog = {};
if (!extraData.goals) extraData.goals = {};

let budgetData = JSON.parse(localStorage.getItem('hisab_budget')) || { limit: 0, expenses: [], debts: [] };
if (!budgetData.debts) budgetData.debts = [];
let backlogData = JSON.parse(localStorage.getItem('hisab_backlog')) || [];
let archivedTasks = JSON.parse(localStorage.getItem('hisab_archived_tasks')) || [];
let journalData = JSON.parse(localStorage.getItem('hisab_journal')) || {};
let weeklyGoalData = JSON.parse(localStorage.getItem('hisab_weekly_goal')) || {};
let expenseCategoryChart = null;

let tasksProgressChart = null;
let badHabitsChart = null;
let showAllQada = false;
let currentHistoryFilter = 'all';
let active30DayTaskId = null;
let selected30DayDateKey = null;
let active30DayHabitId = null;
let active30DayHabitKind = 'good';
let selectedHabit30DayDateKey = null;

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
    if (log.missedDateKey === dateKey || log.fulfilledDateKey === dateKey || log.habitDateKey === dateKey) return true;
    const { start, end } = getDayBounds(dateKey);
    return log.timestamp >= start && log.timestamp <= end;
}

// ==========================================
// SHARED HELPERS (v2)
// ==========================================
function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cssVar(name, fallback = '#888') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}
function svgIcon(name, cls = 'icon') {
    return `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
}
function fmtNum(n) { return (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(); }

// Deletion tombstones: stop deleted/undone items coming back from another device during cloud merge.
let deletedIds = JSON.parse(localStorage.getItem('hisab_deleted_ids') || '{}');
function markDeleted(id) {
    if (id === undefined || id === null) return;
    deletedIds[String(id)] = Date.now();
    // keep it bounded: drop tombstones older than 180 days
    const cutoff = Date.now() - 180 * 86400000;
    for (const k of Object.keys(deletedIds)) if (deletedIds[k] < cutoff) delete deletedIds[k];
    localStorage.setItem('hisab_deleted_ids', JSON.stringify(deletedIds));
}
function isDeleted(id) { return id !== undefined && id !== null && !!deletedIds[String(id)]; }

// Is a task scheduled for the given day? (custom-days tasks rest on other days)
function isTaskActiveOn(task, dateObj = new Date()) {
    const d = new Date(dateObj);
    return Core.isActiveOnDate(task, toDateKey(d), d.getDay());
}

// Single source of truth for "how far along is this task in its current period?"
function getTaskStatus(task, now = new Date()) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const todayKey = toDateKey(now);
    const target = task.baseTarget || 1;
    const yearDone = (task.currentTarget ?? 1) <= 0;

    let since = startOfDay;
    if (task.type === 'weekly') since = startOfWeek;
    if (task.type === 'monthly') since = startOfMonth;

    const logs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'complete');
    let doneAmt;
    if (task.type === 'once') {
        doneAmt = logs.reduce((s, h) => s + (h.amount || 1), 0);
    } else if (task.type === 'daily') {
        doneAmt = logs.filter(h => h.fulfilledDateKey ? h.fulfilledDateKey === todayKey : h.timestamp >= startOfDay)
            .reduce((s, h) => s + (h.amount || 1), 0);
    } else {
        doneAmt = logs.filter(h => h.timestamp >= since).reduce((s, h) => s + (h.amount || 1), 0);
    }

    const isActiveToday = task.type !== 'daily' || isTaskActiveOn(task, now);
    const isDone = task.type === 'once' ? yearDone : (yearDone || doneAmt >= target);
    let isOverdue = false, dueLabel = '';
    if (task.type === 'once' && task.dueDate && !isDone) {
        const diff = Math.round((getDayBounds(task.dueDate).start - startOfDay) / 86400000);
        isOverdue = diff < 0;
        dueLabel = diff < 0 ? `Overdue ${-diff}d` : diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : `Due ${new Date(getDayBounds(task.dueDate).noon).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    const isDueToday = !isDone && (
        (task.type === 'daily' && isActiveToday) ||
        task.type === 'weekly' || task.type === 'monthly' ||
        (task.type === 'once' && (!task.dueDate || task.dueDate <= todayKey))
    );
    const periodLabel = { daily: 'today', weekly: 'this week', monthly: 'this month', once: 'total' }[task.type] || 'today';
    return { doneAmt, target, isDone, isActiveToday, isOverdue, dueLabel, isDueToday, periodLabel, pct: Math.min(100, Math.round((doneAmt / target) * 100)) };
}
window.getTaskStatus = getTaskStatus;

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

// Automatically pulls any entries logged via Email Replies or 1-Click Email Links
async function syncFromGoogleSheets() {
    if (!GOOGLE_SHEETS_URL) return;
    try {
        const lastSync = parseInt(localStorage.getItem('hisab_last_sheet_sync')) || (Date.now() - 3 * 86400000);
        const res = await fetch(`${GOOGLE_SHEETS_URL}?action=pull_email_logs&since=${lastSync}`);
        if (!res.ok) return;
        const newLogs = await res.json();
        if (!Array.isArray(newLogs) || newLogs.length === 0) return;

        let hasNew = false;
        newLogs.forEach(log => {
            if (!log || !log.id) return;
            if (activityHistory.some(h => String(h.id) === String(log.id))) return;
            hasNew = true;

            const logEntry = {
                id: String(log.id),
                timestamp: Number(log.timestamp) || Date.now(),
                category: log.category || 'general',
                actionType: log.actionType || '',
                title: log.title || '',
                amount: Number(log.amount) || 1,
                taskType: log.taskType || ''
            };
            activityHistory.push(logEntry);

            // 1. Process Expenses
            if (log.actionType === 'expense' || log.category === 'budget') {
                const cleanDesc = (log.title || 'Expense').replace(/^Expense:\s*/i, '').trim();
                budgetData.expenses.push({
                    id: String(log.id),
                    desc: cleanDesc,
                    amount: Number(log.amount) || 0,
                    date: logEntry.timestamp
                });
            }

            // 2. Process Swalath
            if (log.actionType === 'deen_swalath') {
                if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };
                deenData.swalathStats.total = (deenData.swalathStats.total || 0) + (Number(log.amount) || 0);
            }

            // 3. Process Quran Hizb
            if (log.actionType === 'deen_hizb') {
                if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
                deenData.quranStats.totalHizb = (deenData.quranStats.totalHizb || 0) + (Number(log.amount) || 0);
                deenData.quranStats.totalJuz = Math.floor(deenData.quranStats.totalHizb / 2);
                deenData.quranStats.totalKhatm = Math.floor(deenData.quranStats.totalHizb / 60);
            }

            // 4. Process Qada
            if (log.actionType === 'deen_qada') {
                const prayer = (log.title || '').replace(/^Qada:\s*/i, '').trim();
                if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
                if (deenData.qada[prayer] !== undefined) {
                    deenData.qada[prayer] = Math.max(0, deenData.qada[prayer] + (Number(log.amount) || 1));
                }
            }

            // 5. Process Bad Habits / Sins
            if (log.actionType === 'bad' || log.category === 'habits') {
                const sinName = (log.title || '').replace(/^Logged Bad:\s*/i, '').trim().toLowerCase();
                const matchedHabit = badHabits.find(h => (h.title || '').trim().toLowerCase() === sinName);
                if (matchedHabit) {
                    matchedHabit.annualCount = (matchedHabit.annualCount || 0) + (Number(log.amount) || 1);
                }
            }

            // 6. Process Tasks
            if (log.actionType === 'complete') {
                const taskTitle = (log.title || '').replace(/^Completed:\s*/i, '').trim().toLowerCase();
                const matchedTask = tasks.find(t => (t.title || '').trim().toLowerCase() === taskTitle);
                if (matchedTask) {
                    matchedTask.lastCompletedDay = new Date(logEntry.timestamp).toDateString();
                    matchedTask.currentTarget = Math.max(0, (matchedTask.currentTarget || 0) - (Number(log.amount) || 1));
                    if (matchedTask.currentTarget <= 0) matchedTask.isCompleted = true;
                }
            }
        });

        if (hasNew) {
            localStorage.setItem('hisab_last_sheet_sync', Date.now().toString());
            saveData();
            render();
            if (typeof showToast === 'function') {
                showToast(`📥 Synced ${newLogs.length} updates from email replies!`, '✉️');
            }
        }
    } catch(err) {
        console.warn("Could not sync email replies from Google Sheets:", err);
    }
}
window.syncFromGoogleSheets = syncFromGoogleSheets;

// ==========================================
// STALE-TAB LOCK & CLOUD SYNC LOGIC
// ==========================================
let hasInitialCloudSync = false;

function applyCloudPayload(parsed) {
    if (!parsed) return;
    const todayStr = new Date().toDateString();

    // 1. Smart Bidirectional History Merge (Never drop any finished log from either phone or desktop)
    const cloudHistory = parsed.history || [];
    const localHistory = activityHistory || [];
    const historyMap = new Map();
    cloudHistory.forEach(h => { if (h && h.id) historyMap.set(h.id, h); });
    localHistory.forEach(h => { if (h && h.id) historyMap.set(h.id, h); });
    activityHistory = Array.from(historyMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    localStorage.setItem('hisab_history', JSON.stringify(activityHistory));

    // 2. Smart Task Merge: Retain today's completions and lowest remaining targets
    const cloudTasks = parsed.tasks || [];
    const localTasks = tasks || [];
    const taskMap = new Map();

    // Merge deletion tombstones first so deleted items are never resurrected.
    if (parsed.deletedIds && typeof parsed.deletedIds === 'object') {
        deletedIds = { ...parsed.deletedIds, ...deletedIds };
        localStorage.setItem('hisab_deleted_ids', JSON.stringify(deletedIds));
    }
    activityHistory = activityHistory.filter(h => !isDeleted(h.id));
    localStorage.setItem('hisab_history', JSON.stringify(activityHistory));

    cloudTasks.forEach(ct => { if (ct && ct.id && !isDeleted(ct.id)) taskMap.set(ct.id, ct); });
    localTasks.forEach(lt => {
        if (!lt || !lt.id || isDeleted(lt.id)) return;
        if (!taskMap.has(lt.id)) {
            taskMap.set(lt.id, lt);
        } else {
            const ct = taskMap.get(lt.id);
            const isLocalDoneToday = lt.lastCompletedDay === todayStr;
            const isCloudDoneToday = ct.lastCompletedDay === todayStr;
            const effectiveCompletedDay = isLocalDoneToday ? lt.lastCompletedDay : (isCloudDoneToday ? ct.lastCompletedDay : lt.lastCompletedDay || ct.lastCompletedDay);

            let mergedTarget = ct.currentTarget;
            if (isLocalDoneToday && !isCloudDoneToday) {
                mergedTarget = lt.currentTarget;
            } else if (typeof lt.currentTarget === 'number' && typeof ct.currentTarget === 'number') {
                mergedTarget = Math.min(lt.currentTarget, ct.currentTarget);
            }

            taskMap.set(lt.id, {
                ...ct,
                ...lt,
                lastCompletedDay: effectiveCompletedDay,
                currentTarget: mergedTarget,
                isCompleted: (mergedTarget <= 0) || lt.isCompleted || ct.isCompleted
            });
        }
    });
    tasks = Array.from(taskMap.values());
    // A task archived on another device must not stay in the active list here.
    const parsedArchivedIds = new Set((parsed.archivedTasks || []).map(t => t && t.id));
    tasks = tasks.filter(t => !parsedArchivedIds.has(t.id));
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks));

    // 3. Habits, Charity & Storage Merge
    badHabits = parsed.badHabits || badHabits;
    goodHabits = parsed.goodHabits || goodHabits;
    bonusPoints = Math.max(bonusPoints || 0, parsed.bonusPoints || 0);

    if (parsed.charity) {
        charityData = {
            pending: typeof parsed.charity.pending === 'number' ? parsed.charity.pending : (charityData.pending || 0),
            paid: Math.max(charityData.paid || 0, parsed.charity.paid || 0),
            surplus: typeof parsed.charity.surplus === 'number' ? parsed.charity.surplus : (charityData.surplus || 0)
        };
    }
    budgetData = parsed.budget || budgetData;
    if (!budgetData.debts) budgetData.debts = [];

    // Backlog safe merge
    if (parsed.backlog && Array.isArray(parsed.backlog)) {
        const localUnsynced = (backlogData || []).filter(local => 
            !parsed.backlog.some(cloud => cloud.id === local.id || (local.link && cloud.link && local.link === cloud.link))
        );
        backlogData = [...localUnsynced, ...parsed.backlog].filter(b => b && !isDeleted(b.id));
        localStorage.setItem('hisab_backlog', JSON.stringify(backlogData));
    }

    archivedTasks = parsed.archivedTasks || archivedTasks;
    
    // Journal safe union
    if (parsed.journal) {
        journalData = { ...(journalData || {}), ...parsed.journal };
        localStorage.setItem('hisab_journal', JSON.stringify(journalData));
    }
    weeklyGoalData = parsed.weeklyGoal || weeklyGoalData;
    mergeExtra(parsed.extra);
    applyCloudSettings(parsed.settings);

    // Deen safe merge
    if (parsed.deen) {
        deenData = {
            ...deenData,
            ...parsed.deen,
            quranStats: {
                totalHizb: Math.max(deenData.quranStats?.totalHizb || 0, parsed.deen.quranStats?.totalHizb || 0),
                totalJuz: Math.max(deenData.quranStats?.totalJuz || 0, parsed.deen.quranStats?.totalJuz || 0),
                totalKhatm: Math.max(deenData.quranStats?.totalKhatm || 0, parsed.deen.quranStats?.totalKhatm || 0)
            },
            swalathStats: {
                total: Math.max(deenData.swalathStats?.total || 0, parsed.deen.swalathStats?.total || 0)
            }
        };
    }
    localStorage.setItem('hisab_deen', JSON.stringify(deenData));
}

function listenToFirebase() {
    if (!currentUser) return;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const parsed = docSnap.data();
            const cloudModified = parsed.lastModified || 0;

            if (!hasInitialCloudSync || cloudModified > lastModifiedLocal) {
                applyCloudPayload(parsed);
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
                setSyncIndicator('synced', 'Synced');
                render();
                return; 
            }

            hasInitialCloudSync = true;
            let legacyChanged = migrateLegacyTasks();
            let autoChanged = processAutomaticPenalties(); 
            
            if (legacyChanged || autoChanged) { saveData(); }
            else { saveDataLocallyOnly(); }
            setSyncIndicator('synced', 'Synced');
            render();
        } else { 
            hasInitialCloudSync = true;
            migrateLegacyTasks();
            processAutomaticPenalties();
            saveData(); 
            setSyncIndicator('synced', 'Synced');
        }
    }, (error) => {
        console.error("Firestore listener error:", error);
        setSyncIndicator('error', 'Sync Error', error);
    });
}

async function triggerCloudSyncNow(silent = false) {
    setSyncIndicator('synced', 'Syncing…');
    try {
        lastCloudError = null;
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const cloudData = snap.data();
            if ((cloudData.lastModified || 0) > lastModifiedLocal) {
                applyCloudPayload(cloudData);
                lastModifiedLocal = cloudData.lastModified;
                saveDataLocallyOnly();
                render();
                setSyncIndicator('synced', 'Synced');
                if (typeof showToast === 'function') { if (!silent) showToast('Pulled latest cloud data!', '☁️'); }
                return;
            }
        }
        hasInitialCloudSync = true;
        await syncDataToFirebase();
        await syncFromGoogleSheets();
        setSyncIndicator('synced', 'Synced');
        if (!silent && typeof showToast === 'function') showToast('Cloud data synced successfully!', '☁️');
    } catch (e) {
        console.error("Manual sync failed:", e);
        setSyncIndicator('error', 'Sync Failed', e);
        if (!silent && typeof showToast === 'function') showToast('Sync failed: ' + (e.message || 'Check connection'), '⚠️');
    }
}

function showSyncDiagnostics(err) {
    if (!err) return;
    const errCode = err.code || '';
    const errMsg = err.message || String(err);

    let fixDetails = '';
    if (errCode.includes('permission-denied') || errMsg.includes('insufficient permissions')) {
        fixDetails = '<b>Reason:</b> Cloud Firestore rules are blocking access.<br><br>' +
                     '<b>Quick 30-Second Fix:</b><br>' +
                     '1. Open <a href="https://console.firebase.google.com" target="_blank" style="color:var(--primary); text-decoration:underline;">console.firebase.google.com</a><br>' +
                     '2. Click <b>hisab-1127d</b> ➡️ <b>Firestore Database</b> ➡️ <b>Rules</b><br>' +
                     '3. Paste this rule:<br>' +
                     '<div style="background:#14171d; padding:8px 10px; border-radius:8px; font-family:monospace; font-size:0.72rem; margin:8px 0; text-align:left; border:1px solid var(--border); color:#a8ff78; line-height:1.4;">' +
                     "rules_version = '2';<br>service cloud.firestore {<br>&nbsp;&nbsp;match /databases/{database}/documents {<br>&nbsp;&nbsp;&nbsp;&nbsp;match /users/{userId} {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if request.auth != null && request.auth.uid == userId;<br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>&nbsp;&nbsp;}<br>}" +
                     '</div>' +
                     '4. Click <b>Publish</b> and tap Retry.';
    } else if (errCode.includes('unauthorized-domain') || errMsg.includes('unauthorized domain')) {
        fixDetails = '<b>Reason:</b> Domain <code>' + window.location.hostname + '</code> is not in Firebase authorized domains.<br><br>' +
                     '<b>Quick Fix:</b><br>' +
                     '1. Open <a href="https://console.firebase.google.com" target="_blank" style="color:var(--primary); text-decoration:underline;">Firebase Console</a><br>' +
                     '2. Go to <b>Authentication ➡️ Settings ➡️ Authorized Domains</b><br>' +
                     '3. Click <b>Add domain</b> and paste <code>' + window.location.hostname + '</code>.';
    } else {
        fixDetails = '<b>Details:</b> ' + (errCode ? '(' + errCode + ') ' : '') + errMsg + '<br><br>Check your internet connection or try syncing again.';
    }

    showConfirmSheet(
        fixDetails,
        { title: 'Cloud Sync Diagnostics', icon: '⚠️', okText: 'Retry Sync Now', cancelText: 'Close', danger: false }
    ).then(ok => {
        if (ok) triggerCloudSyncNow();
    });
}

async function manualCloudSync(silent = false) {
    if (!currentUser) {
        if (silent) return;
        showConfirmSheet(
            "<b>You are in Local (Offline) Mode.</b><br><br>All tasks and progress are safely saved on this device, but won't sync to your other devices until you sign in with Google.<br><br>Would you like to connect with Google now?",
            { title: 'Cloud Sync (Local Mode)', icon: '📴', okText: 'Sign In with Google', danger: false }
        ).then(ok => {
            if (ok) loginWithGoogle();
        });
        return;
    }

    lastCloudError = null;
    await triggerCloudSyncNow(silent);
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

                const checkDayOfWeek = new Date(cursor).getDay();
                const isActiveDay = Core.isActiveOnDate(t, checkKey, checkDayOfWeek);
                if (start >= createdStart.getTime() && isActiveDay) {
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
        return `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-top:1px solid var(--border);">
            <div style="min-width:0;"><b>${escapeHTML(taskName)}</b>${pen > 0 ? ` <span style="color:var(--amber); font-size:12.5px;">₹${pen} penalty</span>` : ''}</div>
            ${task ? `<button class="btn-sm" onclick="openTask30DayModal('${task.id}', '${yesterdayKey}')">Complete late</button>` : ''}
        </div>`;
    }).join('');

    if (sessionStorage.getItem('hisab_hide_recap_' + yesterdayKey)) { banner.style.display = 'none'; return; }
    banner.style.display = 'block';
    banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px;">
            <div style="font-weight:750; color:var(--red); font-size:14px;">Missed yesterday</div>
            <button class="btn-icon" onclick="sessionStorage.setItem('hisab_hide_recap_${yesterdayKey}', '1'); this.closest('.yesterday-recap-banner').style.display='none'" aria-label="Dismiss">${svgIcon('x', 'icon icon-sm')}</button>
        </div>
        <div style="font-size:14px;">${itemsHtml}</div>
        <div class="muted" style="font-size:12px; margin-top:6px;">Did it but forgot to log? Tap "Complete late" — any penalty is refunded.</div>
    `;

    if (newMissedList.length > 0 && "Notification" in window && Notification.permission === "granted") {
        const notifKey = `hisab_morning_notif_${yesterdayKey}`;
        if (!localStorage.getItem(notifKey)) {
            new Notification(`Hisab: Yesterday's Missed Tasks (${yesterdayKey})`, {
                body: `Missed yesterday: ${newMissedList.join(', ')}. Tap to review or fulfill retroactively.`,
                icon: "icons/icon-192.png"
            });
            localStorage.setItem(notifKey, '1');
        }
    }
}

function saveDataLocallyOnly() { 
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks)); localStorage.setItem('hisab_history', JSON.stringify(activityHistory)); localStorage.setItem('hisab_bad_habits', JSON.stringify(badHabits)); localStorage.setItem('hisab_good_habits', JSON.stringify(goodHabits)); localStorage.setItem('hisab_bonus_points', bonusPoints.toString()); localStorage.setItem('hisab_charity', JSON.stringify(charityData)); localStorage.setItem('hisab_deen', JSON.stringify(deenData)); localStorage.setItem('hisab_budget', JSON.stringify(budgetData)); localStorage.setItem('hisab_backlog', JSON.stringify(backlogData));
    localStorage.setItem('hisab_archived_tasks', JSON.stringify(archivedTasks));
    localStorage.setItem('hisab_journal', JSON.stringify(journalData));
    localStorage.setItem('hisab_weekly_goal', JSON.stringify(weeklyGoalData));
    localStorage.setItem('hisab_deleted_ids', JSON.stringify(deletedIds));
    localStorage.setItem('hisab_extra', JSON.stringify(extraData));
}

function sanitizeForFirestore(val) {
    if (val === undefined) return null;
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
        return val.filter(item => item !== undefined).map(item => sanitizeForFirestore(item));
    }
    const clean = {};
    for (const key of Object.keys(val)) {
        const item = val[key];
        if (item !== undefined) {
            clean[key] = sanitizeForFirestore(item);
        }
    }
    return clean;
}

async function syncDataToFirebase() {
    if (currentUser) {
        try {
            setSyncIndicator('synced', 'Saving…');
            const rawPayload = {
                tasks,
                history: activityHistory,
                badHabits,
                goodHabits,
                bonusPoints,
                charity: charityData,
                deen: deenData,
                budget: budgetData,
                backlog: backlogData,
                archivedTasks,
                journal: journalData,
                weeklyGoal: weeklyGoalData,
                deletedIds,
                extra: extraData,
                settings: collectSettings(),
                lastModified: lastModifiedLocal
            };
            const cleanPayload = sanitizeForFirestore(rawPayload);
            await setDoc(doc(db, 'users', currentUser.uid), cleanPayload);
            lastCloudError = null;
            localStorage.removeItem('hisab_unsynced');
            setSyncIndicator('synced', 'Synced');
        } catch(e) {
            console.error('Firebase sync failed', e);
            setSyncIndicator('error', 'Sync Error', e);
        }
    }
}

function saveData() { if (currentUser) localStorage.setItem('hisab_unsynced', '1'); lastModifiedLocal = Date.now(); localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString()); saveDataLocallyOnly(); syncDataToFirebase(); }

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
    if (amount <= 0) { showToast('Enter the amount you paid', '💸'); input.focus(); return; }
    charityData.pending -= amount;
    if (charityData.pending < 0) charityData.pending = 0;
    charityData.paid += amount;
 input.value = '';
    showToast(`Recorded ₹${amount.toLocaleString()} paid — may Allah accept it`, '🤲');
    saveData(); 
    if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f6e58d', 'var(--green)', '#ffffff'] });
}

function deductFromSurplus() {
    if ((charityData.surplus || 0) <= 0 || (charityData.pending || 0) <= 0) return;
    const toCover = Math.min(charityData.surplus, charityData.pending);
    charityData.surplus -= toCover;
    charityData.pending -= toCover;
    charityData.paid = (charityData.paid || 0) + toCover;
    saveData();
    if (document.getElementById('tab-dashboard')?.classList.contains('active')) updateDashboard();
    if (typeof confetti === 'function') confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 }, colors: ['var(--green)', '#ffffff'] });
    showToast('Deducted ₹' + toCover.toLocaleString() + ' penalty using Surplus Wallet!', '✨');
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


// ==========================================
// TASK TAG & RECURRENCE ENGINE
// ==========================================
let currentEditingTags = [];
const TAG_ICONS = { health: '💪', study: '📚', deen: '🕌', finance: '💰', personal: '🌟' };

function toggleTaskTag(tag, btnEl) {
    const idx = currentEditingTags.indexOf(tag);
    if (idx === -1) {
        currentEditingTags.push(tag);
        if (btnEl) btnEl.classList.add('selected');
    } else {
        currentEditingTags.splice(idx, 1);
        if (btnEl) btnEl.classList.remove('selected');
    }
}

function resetTagSelector(tags = []) {
    currentEditingTags = [...tags];
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('selected', currentEditingTags.includes(btn.dataset.tag));
    });
}

function renderTaskTags(tags = []) {
    if (!tags || tags.length === 0) return '';
    return tags.map(tag => `<span class="tag-chip tag-${tag}">${TAG_ICONS[tag] || ''} ${tag}</span>`).join('');
}

function toggleActiveDaysSelector() {
    const typeEl = document.getElementById('task-type');
    const selectorEl = document.getElementById('active-days-selector');
    if (selectorEl) {
        selectorEl.style.display = typeEl?.value === 'daily-custom' ? 'block' : 'none';
    }
    const flexEl = document.getElementById('flex-recur-selector');
    if (flexEl) {
        flexEl.style.display = typeEl?.value === 'daily-flex' ? 'block' : 'none';
        if (typeEl?.value === 'daily-flex') { toggleRecurFields(); const a = document.getElementById('recur-anchor'); if (a && !a.value) a.value = toDateKey(Date.now()); }
    }
    const dueRow = document.getElementById('due-date-row');
    if (dueRow) dueRow.style.display = typeEl?.value === 'once' ? 'block' : 'none';
}

function getActiveDays() {
    return [...document.querySelectorAll('.day-toggle:checked')].map(cb => parseInt(cb.value));
}

function setActiveDays(days = []) {
    document.querySelectorAll('.day-toggle').forEach(cb => {
        cb.checked = days.includes(parseInt(cb.value));
    });
}

function saveTask() { 
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const rawType = document.getElementById('task-type').value;
    const type = (rawType === 'daily-custom' || rawType === 'daily-flex') ? 'daily' : rawType;
    const activeDays = rawType === 'daily-custom' ? getActiveDays() : null;
    const recur = rawType === 'daily-flex' ? readRecurFromForm() : null;
    const baseTarget = parseFloat(document.getElementById('task-base-target').value) || 1;
    const donationPenalty = parseFloat(document.getElementById('task-donation').value) || 0;
    const reminderTime = document.getElementById('task-reminder-time').value;
    const isMaxOnceDaily = document.getElementById('task-is-max-once').checked;
 const tags = [...currentEditingTags];
    const dueDate = rawType === 'once' ? (document.getElementById('task-due-date')?.value || '') : '';
    const prayerAnchor = readPrayerAnchorFromForm();
    
    if (!title) { showToast('Please enter a task name', '✏️'); document.getElementById('task-title')?.focus(); return; }
    if (rawType === 'daily-custom' && activeDays.length === 0) { showToast('Pick at least one day', '📅'); return; }
    if (id) { 
        const task = tasks.find(t => t.id === id);
        task.title = title;
        task.reminderTime = reminderTime;
        task.donationPenalty = donationPenalty;
        task.isMaxOnceDaily = isMaxOnceDaily;
        task.tags = tags;
        task.activeDays = activeDays;
        task.recur = recur;
        task.dueDate = dueDate;
        task.prayerAnchor = prayerAnchor;
        if (prayerAnchor) task.reminderTime = '';
        task.lastNotified = null;
        const creationTime = task.createdAt || Date.now();
        const newPeriodsLeft = getPeriodsLeft(type, creationTime);
        const newTotalYearly = newPeriodsLeft * baseTarget;
        const targetDiff = newTotalYearly - (task.totalYearlyTarget || 0);
        task.type = type;
        task.baseTarget = baseTarget;
        task.totalYearlyTarget = newTotalYearly;
        task.currentTarget = Math.max(0, (task.currentTarget || 0) + targetDiff);
        task.isCompleted = task.currentTarget <= 0;
    } else { 
        const creationTime = Date.now();
        const periodsLeft = getPeriodsLeft(type, creationTime);
        const totalYearlyTarget = periodsLeft * baseTarget;
        const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
        tasks.push({
            id: creationTime.toString(),
            createdAt: creationTime,
            title,
            type,
            activeDays,
            recur,
            dueDate,
            prayerAnchor,
            subtasks: [],
            tags,
            baseTarget,
            totalYearlyTarget,
            currentTarget: totalYearlyTarget,
            reminderTime: prayerAnchor ? '' : reminderTime,
            donationPenalty,
            isMaxOnceDaily,
            missedCount: 0,
            sortOrder: tasks.length,
            penaltyCheckDate: new Date().toDateString(),
            lastEvaluatedDateKey: yesterdayKey,
            isCompleted: false,
            legacyMigrated: true
        }); 
    } 
    const wasEdit = !!id;
    if (prayerAnchor) ensurePrayerTimes();
    cancelEdit();
    closeModal('task-modal');
    saveData();
    render(); 
    showToast(wasEdit ? 'Task updated' : 'Task added', '✅');
}

function editTask(id) { 
    const task = tasks.find(t => t.id === id); if (!task) return; 
    document.getElementById('form-title').innerText = 'Edit task';
    const dueEl = document.getElementById('task-due-date'); if (dueEl) dueEl.value = task.dueDate || '';
    writePrayerAnchorToForm(task.prayerAnchor || null);
    document.getElementById('btn-save-task').innerText = 'Save changes';
    document.getElementById('btn-cancel-edit').style.display = 'inline-block'; 
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    const typeSelect = document.getElementById('task-type');
    if (task.recur && task.recur.kind) {
        if (typeSelect) typeSelect.value = 'daily-flex';
        writeRecurToForm(task.recur);
        toggleActiveDaysSelector();
        setActiveDays([]);
    } else if (task.activeDays && task.activeDays.length > 0) {
        if (typeSelect) typeSelect.value = 'daily-custom';
        toggleActiveDaysSelector();
        setActiveDays(task.activeDays);
    } else {
        if (typeSelect) typeSelect.value = task.type || 'daily';
        toggleActiveDaysSelector();
        setActiveDays([]);
    }
    document.getElementById('task-base-target').value = task.baseTarget; 
    document.getElementById('task-donation').value = task.donationPenalty || '';
    document.getElementById('task-reminder-time').value = task.reminderTime || '';
    document.getElementById('task-is-max-once').checked = task.isMaxOnceDaily || false; 
    resetTagSelector(task.tags || []);
    openModal('task-modal');
}

function cancelEdit() { 
    document.getElementById('form-title').innerText = 'New task';
    document.getElementById('btn-save-task').innerText = 'Save task';
    const dueEl = document.getElementById('task-due-date'); if (dueEl) dueEl.value = '';
    writePrayerAnchorToForm(null);
    document.getElementById('btn-cancel-edit').style.display = 'none'; 
    document.getElementById('task-id').value = '';
    document.getElementById('task-title').value = '';
    const typeSelect = document.getElementById('task-type');
    if (typeSelect) typeSelect.value = 'daily';
    toggleActiveDaysSelector();
    setActiveDays([]);
    document.getElementById('task-base-target').value = '';
    document.getElementById('task-donation').value = '';
    document.getElementById('task-reminder-time').value = '';
    document.getElementById('task-is-max-once').checked = false;
    resetTagSelector([]);
}


// ==========================================
// CUSTOM CONFIRM SHEET (replaces native confirm)
// ==========================================
let _confirmResolve = null;
function showConfirmSheet(message, options = {}) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        const sheet = document.getElementById('confirm-sheet');
        if (!sheet) { resolve(window.confirm(message)); return; }
        const msgEl = document.getElementById('confirm-sheet-msg');
        const titleEl = document.getElementById('confirm-sheet-title');
        const iconEl = document.getElementById('confirm-sheet-icon');
        const okBtn = document.getElementById('confirm-sheet-ok');
        if (msgEl) msgEl.innerHTML = message;
        if (titleEl) titleEl.innerText = options.title || 'Are you sure?';
        if (iconEl) iconEl.innerText = options.icon || '❓';
        if (okBtn) {
            okBtn.innerText = options.okText || 'Confirm';
            okBtn.className = options.danger ? 'btn-danger' : '';
            const cancelBtn = document.getElementById('confirm-sheet-cancel');
            if (cancelBtn) cancelBtn.innerText = options.cancelText || 'Cancel';
        }
        sheet.style.display = 'flex';
    });
}
function closeConfirmSheet(result) {
    const sheet = document.getElementById('confirm-sheet');
    if (sheet) sheet.style.display = 'none';
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

function deleteTask(id) { showConfirmSheet("Delete this task? All logs will remain in history.", { title: 'Delete Task', icon: '🗑️', okText: 'Delete', danger: true }).then(ok => { if (ok) { markDeleted(id); tasks = tasks.filter(t => t.id !== id); saveData(); render(); showToast('Task deleted', '🗑️'); } }); }

function logProgress(id, explicitAmount = null) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    const inputEl = document.getElementById(`input-${id}`);
    const amountDone = explicitAmount != null ? Number(explicitAmount) : (parseFloat(inputEl ? inputEl.value : task.baseTarget) || task.baseTarget || 1);
    if (amountDone <= 0) return;

    const todayStr = new Date().toDateString();
    const todayKey = toDateKey(Date.now());

    // If this task was already marked missed today, automatically reverse today's missed log & refund penalty
    const missedTodayLogs = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, todayKey));
    missedTodayLogs.forEach(mLog => {
        refundPenaltyFromLog(mLog);
        task.currentTarget += (mLog.amount || 1);
        syncToGoogleSheets({ actionType: 'undo', id: mLog.id });
        markDeleted(mLog.id);
        activityHistory = activityHistory.filter(h => h.id !== mLog.id);
    });

    triggerHaptic([20, 40, 20]);
    if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 }, colors: ['var(--brand)', 'var(--green)', '#f6e58d'] });
    task.lastCompletedDay = todayStr;
    if (task.isMaxOnceDaily) task.missedCount = 0;
    
    const noteInput = document.getElementById(`note-${task.id}`);
    const noteText = noteInput ? noteInput.value.trim() : '';
    if (noteInput) noteInput.value = '';
    let newLog = { id: Date.now().toString(), taskId: task.id, category: 'tasks', taskType: task.type, timestamp: Date.now(), fulfilledDateKey: todayKey, title: "Completed: " + task.title, actionType: 'complete', amount: amountDone, note: noteText || "" };
    activityHistory.push(newLog);
    syncToGoogleSheets(newLog);

    task.currentTarget = Math.max(0, (task.currentTarget || 0) - amountDone);
    if (task.currentTarget <= 0) task.isCompleted = true; 
    
    applyDeenAutomation(task.title, amountDone);

    saveData(); render();
}

function markMissed(id, event) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    showConfirmSheet(`Mark <b>${escapeHTML(task.title)}</b> as missed for today?${task.donationPenalty > 0 ? ` A ₹${task.donationPenalty} penalty will be added.` : ''}`, { title: 'Mark as missed', icon: '⚠️', okText: 'Mark missed', danger: true }).then(ok => {
    if (ok) {
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
    });
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
        cell.className = `cal-day-card ${statusClass} ${isSelected ? 'selected-day' : ''}`;
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
                <span class="badge done-badge" style="margin:0;">Logged: ${amountDone} / ${task.baseTarget || 1}</span>
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
                <button onclick="fulfillMissedTaskDay('${task.id}', '${dateKey}', true)" style="background:var(--success); color:var(--on-accent); flex:1; margin:0;">
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
                    <div style="font-size:1.05rem; font-weight:800; color:var(--text);">⚪ ${readableDate}</div>
                </div>
                ${effectiveRefund > 0 ? `<span class="badge donation" style="margin:0;">💸 Deducts ₹${effectiveRefund} Penalty</span>` : `<span class="badge target" style="margin:0;">Target: ${task.baseTarget || 1}</span>`}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <div style="width:95px; flex-shrink:0;">
                    <input type="number" id="inspector-amount-input" value="${task.baseTarget || 1}" step="any" min="0.1" style="margin:0; text-align:center; font-weight:bold;">
                </div>
                <button onclick="fulfillMissedTaskDay('${task.id}', '${dateKey}', true)" style="background:var(--primary); color:var(--on-accent); flex:1; margin:0;">
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
        title: `Completed (${dateKey}): ${task.title}`,
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
        title: `Missed (${dateKey}): ${task.title}`,
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


// ==========================================
// SWIPE GESTURE ENGINE (Mobile)
// ==========================================
function addSwipeGesture(el, task) {
    if (!task || task.currentTarget <= 0) return;
    let startX = 0, startY = 0, isDragging = false;
    const SWIPE_THRESHOLD = 60;

    const rightLabel = document.createElement('div');
    rightLabel.className = 'swipe-hint-label right-label';
    rightLabel.innerText = '✔️';
    const leftLabel = document.createElement('div');
    leftLabel.className = 'swipe-hint-label left-label';
    leftLabel.innerText = '❌';
    el.appendChild(rightLabel);
    el.appendChild(leftLabel);

    el.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) { isDragging = false; return; }
        if (dx > 20) {
            el.classList.add('swipe-right-hint');
            el.classList.remove('swipe-left-hint');
        } else if (dx < -20) {
            el.classList.add('swipe-left-hint');
            el.classList.remove('swipe-right-hint');
        } else {
            el.classList.remove('swipe-right-hint', 'swipe-left-hint');
        }
    }, { passive: true });

    el.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        const dx = e.changedTouches[0].clientX - startX;
        el.classList.remove('swipe-right-hint', 'swipe-left-hint');
        if (dx > SWIPE_THRESHOLD) {
            logProgress(task.id);
        } else if (dx < -SWIPE_THRESHOLD) {
            if (task.donationPenalty > 0 || task.isMaxOnceDaily) {
                markMissed(task.id, { target: el, clientX: startX, clientY: startY });
            }
        }
    }, { passive: true });
}

// ==========================================
// DRAG-TO-REORDER TASKS
// ==========================================
let dragSrcTaskId = null;
function addDragAndDrop(el, taskId) {
    el.setAttribute('draggable', 'true');
    el.style.cursor = 'grab';

    el.addEventListener('dragstart', e => {
        dragSrcTaskId = taskId;
        el.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
        el.style.opacity = '1';
        document.querySelectorAll('.task-card-minimal').forEach(item => item.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
    });

    el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (dragSrcTaskId === taskId) return;
        const srcTask = tasks.find(t => t.id === dragSrcTaskId);
        const destTask = tasks.find(t => t.id === taskId);
        if (!srcTask || !destTask || srcTask.type !== destTask.type) return;

        const same = tasks.filter(t => t.type === srcTask.type).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const from = same.indexOf(srcTask), to = same.indexOf(destTask);
        same.splice(from, 1); same.splice(to, 0, srcTask);
        same.forEach((t, i) => { t.sortOrder = i; });
        saveData();
        renderTasks();
    });
}

// ==========================================
// ARCHIVE ENGINE
// ==========================================
function archiveTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.archivedAt = Date.now();
    archivedTasks.push(task);
    tasks = tasks.filter(t => t.id !== id);
    saveData();
    render();
}

function unarchiveTask(id) {
    const task = archivedTasks.find(t => t.id === id);
    if (!task) return;
    delete task.archivedAt;
    tasks.push(task);
    archivedTasks = archivedTasks.filter(t => t.id !== id);
    saveData();
    render();
    openArchive();
}

function openArchive() {
    const modal = document.getElementById('archive-modal');
    if (!modal) return;
    const list = document.getElementById('archive-list');
    if (!list) return;
    list.innerHTML = '';
    if (archivedTasks.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No archived tasks yet.</p>';
    } else {
        archivedTasks.forEach(task => {
            const div = document.createElement('div');
            div.style = 'background:var(--card-elevated); padding:14px; border-radius:12px; margin-bottom:10px; border-left:4px solid var(--success); display:flex; justify-content:space-between; align-items:center; gap:10px;';
            div.innerHTML = `
                <div>
                    <div style="font-weight:700; color:var(--text-main);">✅ ${escapeHTML(task.title)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Archived ${new Date(task.archivedAt).toLocaleDateString()} · ${task.type}</div>
                </div>
                <button onclick="unarchiveTask('${task.id}')" style="background:rgba(3,218,198,0.15); color:var(--success); border:1px solid rgba(3,218,198,0.3); padding:6px 12px; margin:0; width:auto; font-size:0.8rem; border-radius:8px;">↩️ Restore</button>
            `;
            list.appendChild(div);
        });
    }
    modal.style.display = 'flex';
}

function renderTasks() {
    const container = document.getElementById('task-list-container'); if (!container) return; container.innerHTML = '';
    const filterView = currentTaskFilter || 'all';
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setText('filter-all-count', tasks.length);
    setText('filter-daily-count', tasks.filter(t => t.type === 'daily').length);
    setText('filter-weekly-count', tasks.filter(t => t.type === 'weekly').length);
    setText('filter-monthly-count', tasks.filter(t => t.type === 'monthly').length);
    setText('filter-once-count', tasks.filter(t => t.type === 'once').length);
    setText('archive-count', archivedTasks.length);
    updateWeeklyGoalBanner();

    const searchQuery = (document.getElementById('task-search-input')?.value || '').trim().toLowerCase();
    const categories = [
        { id: 'daily', title: 'Daily' }, { id: 'weekly', title: 'Weekly' },
        { id: 'monthly', title: 'Monthly' }, { id: 'once', title: 'One-time' }
    ];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Today's daily focus: only tasks scheduled today count
    const todaysDaily = tasks.filter(t => t.type === 'daily' && isTaskActiveOn(t, now));
    const dailyDoneCount = todaysDaily.filter(t => getTaskStatus(t, now).isDone).length;
    const focusLabel = document.getElementById('daily-focus-label');
    const focusFill = document.getElementById('daily-focus-fill');
    if (focusLabel && focusFill) {
        const pct = todaysDaily.length > 0 ? Math.round((dailyDoneCount / todaysDaily.length) * 100) : 0;
        focusLabel.innerText = `${dailyDoneCount} / ${todaysDaily.length} · ${pct}%`;
        focusFill.style.width = `${pct}%`;
    }
    setText('drawer-count-tasks', todaysDaily.length ? `${todaysDaily.length - dailyDoneCount}` : '');

    if (tasks.length === 0) {
        container.innerHTML = `<div class="empty-state">${svgIcon('check-square')}<div style="font-weight:650; color:var(--text);">No tasks yet</div><div>Add your first task or reminder to get started.</div><button class="btn-sm" style="margin-top:12px;" onclick="cancelEdit(); openModal('task-modal');">${svgIcon('plus', 'icon icon-sm')}New task</button></div>`;
        return;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let anyShown = false;

    categories.forEach(cat => {
        if (filterView !== 'all' && cat.id !== filterView) return;
        const list = tasks.filter(t => t.type === cat.id && (!searchQuery || (t.title || '').toLowerCase().includes(searchQuery)));
        if (list.length === 0) return;
        anyShown = true;

        const withStatus = list.map(t => ({ t, st: getTaskStatus(t, now) }));
        withStatus.sort((a, b) => {
            // pending & scheduled first, then rest days, then done; respect manual order inside groups
            const rank = x => x.st.isDone ? 2 : (x.st.isActiveToday ? 0 : 1);
            const r = rank(a) - rank(b);
            if (r !== 0) return r;
            if (cat.id === 'once') {
                const ad = a.t.dueDate || '9999', bd = b.t.dueDate || '9999';
                if (ad !== bd) return ad < bd ? -1 : 1;
            }
            return (a.t.sortOrder ?? 0) - (b.t.sortOrder ?? 0);
        });

        const section = document.createElement('div');
        section.innerHTML = `<div class="task-group-head"><h3>${cat.title}</h3><span>${withStatus.filter(x => x.st.isDone).length}/${list.length} done</span></div>`;

        withStatus.forEach(({ t: task, st }) => {
            const primaryTag = task.tags && task.tags[0];
            const div = document.createElement('div');
            div.className = `task-card-minimal ${st.isDone ? 'is-completed' : ''}`;
            div.id = `task-card-${task.id}`;

            const thirtyDaysAgo = startOfDay - 29 * 86400000;
            const missed30Count = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'missed' && h.timestamp >= thirtyDaysAgo).length;
            const streak = computeItemStreak(task.id, 'tasks').currentStreak;

            // Meta line
            const meta = [];
            meta.push(`<span class="task-chip chip-${task.type}">${task.recur && task.recur.kind ? escapeHTML(Core.describeRecur(task.recur)) : task.activeDays && task.activeDays.length ? task.activeDays.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(d => dayNames[d]).join(' ') : task.type}</span>`);
            if (task.type !== 'once' || (task.baseTarget || 1) > 1) meta.push(`<span class="num">${fmtNum(st.doneAmt)}/${fmtNum(st.target)} ${st.periodLabel}</span>`);
            if (!st.isActiveToday) meta.push(`<span>Rest day</span>`);
            if (st.dueLabel) meta.push(`<span class="${st.isOverdue ? 'warn' : ''}">${st.dueLabel}</span>`);
            const remLabel = effectiveReminderLabel(task);
            if (task.snoozedUntil && task.snoozedUntil > Date.now()) meta.push(`<span>😴 until ${new Date(task.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`);
            else if (remLabel) meta.push(`<span>${svgIcon('bell', 'icon icon-sm')} ${escapeHTML(remLabel)}</span>`);
            const sts = subtaskState(task);
            if (sts.total) meta.push(`<span>${svgIcon('check-square', 'icon icon-sm')} ${sts.done}/${sts.total}</span>`);
            if (streak > 0) meta.push(`<span class="streak">${svgIcon('flame', 'icon icon-sm')} ${streak}d</span>`);
            if (missed30Count > 0) meta.push(`<span class="warn" style="cursor:pointer" onclick="event.stopPropagation(); openTask30DayModal('${task.id}')">${missed30Count} missed</span>`);
            if (primaryTag) meta.push(`<span style="text-transform:capitalize">${escapeHTML(primaryTag)}</span>`);

            // 7-day strip for daily tasks
            let miniWeekHtml = '';
            if (task.type === 'daily') {
                let pills = '';
                for (let d = 6; d >= 0; d--) {
                    const pDate = new Date(startOfDay - d * 86400000);
                    const dKey = toDateKey(pDate);
                    const amt = activityHistory.filter(h => h.taskId === task.id && h.actionType === 'complete' && isLogOnDateKey(h, dKey)).reduce((a, h) => a + (h.amount || 1), 0);
                    const isDone = amt >= (task.baseTarget || 1);
                    const isPartial = !isDone && amt > 0;
                    const isMiss = !isDone && activityHistory.some(h => h.taskId === task.id && h.actionType === 'missed' && isLogOnDateKey(h, dKey));
                    const rest = !isTaskActiveOn(task, pDate);
                    const pClass = isDone ? 'done' : (isMiss ? 'missed' : (isPartial ? 'partial' : (rest ? 'rest' : '')));
                    const mark = isDone ? '✓' : (isMiss ? '✕' : (isPartial ? '½' : '·'));
                    pills += `<span class="day-pill ${pClass}" onclick="openTask30DayModal('${task.id}', '${dKey}')" title="${dKey}"><span>${d === 0 ? 'Today' : pDate.toLocaleDateString(undefined, { weekday: 'short' })}</span><b>${mark}</b></span>`;
                }
                miniWeekHtml = `<div class="tray-label">Last 7 days</div><div class="mini-week-strip">${pills}</div>`;
            }

            const canLog = (task.currentTarget ?? 1) > 0;
            const badges = [
                renderTaskTags(task.tags),
                `<span class="badge target">${fmtNum(task.currentTarget)} left this year</span>`,
                task.donationPenalty ? `<span class="badge donation">₹${task.donationPenalty} penalty if missed</span>` : '',
                task.isMaxOnceDaily ? `<span class="badge">Strict · ${task.missedCount || 0}/5 misses</span>` : ''
            ].join('');

            div.innerHTML = `
                <div class="task-row">
                    <button class="task-check" onclick="event.stopPropagation(); quickCompleteTask('${task.id}', event)" title="${st.isDone ? 'Done — tap to log more' : 'Mark done'}" aria-label="Complete ${escapeHTML(task.title)}">
                        ${svgIcon('check')}
                    </button>
                    <div class="task-main" onclick="toggleTaskSlider('${task.id}', event)">
                        <div class="task-minimal-title">${escapeHTML(task.title)}</div>
                        <div class="task-minimal-meta">${meta.join('')}</div>
                    </div>
                    <button class="btn-slider-chevron" onclick="toggleTaskSlider('${task.id}', event)" aria-label="Details">${svgIcon('chevron-down')}<span id="chevron-${task.id}" class="sr-only"></span></button>
                </div>
                ${(task.baseTarget || 1) > 1 && task.type !== 'once' ? `<div class="task-period-bar"><span style="width:${st.pct}%"></span></div>` : ''}
                <div class="task-slider-tray" id="task-slider-${task.id}">
                    ${canLog ? `
                        <div class="tray-label">Log progress</div>
                        <div class="log-row">
                            <input type="number" class="qty" step="any" id="input-${task.id}" value="${task.baseTarget || 1}" min="0.1" inputmode="decimal" aria-label="Amount">
                            <input type="text" id="note-${task.id}" placeholder="Note (optional)">
                            <button onclick="logProgress('${task.id}')">Log</button>
                        </div>` : ''}
                    ${renderSubtasksHtml(task)}
                    ${miniWeekHtml}
                    <div class="task-badges" style="margin-top:12px;">${badges}</div>
                    <div class="tool-row">
                        <button class="tool-btn" onclick="openTask30DayModal('${task.id}')">${svgIcon('calendar')}30 days</button>
                        <button class="tool-btn" onclick="openPomodoroTimer('${task.id}')">${svgIcon('timer')}Focus</button>
                        <button class="tool-btn" onclick="addToGoogleCalendar('${task.id}')">${svgIcon('alarm')}Calendar</button>
                        ${canLog && !st.isDone ? `<button class="tool-btn" onclick="snoozeTask('${task.id}', 60)" title="Remind me in 1 hour">😴 1h</button><button class="tool-btn" onclick="snoozeTask('${task.id}', 'tomorrow')" title="Remind me tomorrow">😴 Tomorrow</button>` : ''}
                        ${canLog && (task.donationPenalty > 0 || task.isMaxOnceDaily) ? `<button class="tool-btn danger" onclick="markMissed('${task.id}', event)">${svgIcon('x')}Missed</button>` : ''}
                        <span class="spacer"></span>
                        <button class="tool-btn" onclick="editTask('${task.id}')">${svgIcon('pen')}Edit</button>
                        ${!canLog || task.type === 'once' ? `<button class="tool-btn success" onclick="archiveTask('${task.id}')">${svgIcon('archive')}Archive</button>` : ''}
                        <button class="tool-btn danger" onclick="deleteTask('${task.id}')" aria-label="Delete">${svgIcon('trash')}</button>
                    </div>
                </div>
            `;

            addSwipeGesture(div, task);
            addDragAndDrop(div, task.id);
            section.appendChild(div);
        });
        container.appendChild(section);
    });

    if (!anyShown) {
        container.innerHTML = `<div class="empty-state">${svgIcon('search')}<div>No tasks match.</div></div>`;
    }
}

// One-tap completion from the checkbox: logs one period's target (or the remainder of it).
function quickCompleteTask(id, event) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    if ((task.currentTarget ?? 1) <= 0) { showToast('Yearly target already reached 🎉', '🏆'); return; }
    const st = getTaskStatus(task);
    const remaining = Math.max(0, st.target - st.doneAmt);
    const amount = remaining > 0 ? remaining : (task.baseTarget || 1);
    const inputEl = document.getElementById(`input-${id}`);
    if (inputEl) inputEl.value = amount;
    logProgress(id, amount);
    if (remaining > 0) showToast(`Done: ${task.title}`, '✅');
    else showToast(`Extra logged: ${task.title}`, '➕');
}
window.quickCompleteTask = quickCompleteTask;

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

function deleteGoodHabit(id) { showConfirmSheet("Delete this good habit tracker?", { title: 'Delete Habit', icon: '🗑️', okText: 'Delete', danger: true }).then(ok => { if (ok) { goodHabits = goodHabits.filter(h => h.id !== id); saveData(); renderHabits(); } }); }


// ==========================================
// HABIT STREAK ENGINE
// ==========================================
function computeItemStreak(itemId, category = 'tasks') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const loggedDates = new Set(
        activityHistory
            .filter(h => {
                if (category === 'tasks') {
                    return h.taskId === itemId && h.actionType === 'complete';
                } else if (category === 'good-habits') {
                    return h.taskId === itemId && h.actionType === 'good';
                } else if (category === 'bad-habits') {
                    return h.taskId === itemId && h.actionType === 'bad';
                }
                return false;
            })
            .map(h => h.fulfilledDateKey || h.habitDateKey || toDateKey(h.timestamp))
    );
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let streakBroken = false;
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(todayStart - i * 86400000);
        const checkKey = toDateKey(checkDate);
        const isLogged = loggedDates.has(checkKey);
        const isPositive = category === 'bad-habits' ? !isLogged : isLogged;
        if (isPositive) {
            tempStreak++;
            if (!streakBroken) currentStreak = tempStreak;
        } else {
            if (!streakBroken && i > 0) streakBroken = true;
            if (streakBroken) {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            } else {
                currentStreak = 0;
                streakBroken = true;
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            }
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    return { currentStreak, longestStreak };
}
window.computeItemStreak = computeItemStreak;

function computeHabitStreak(habitId, actionType) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const loggedDates = new Set(
        activityHistory
            .filter(h => h.taskId === habitId && h.actionType === actionType)
            .map(h => h.habitDateKey || toDateKey(h.timestamp))
    );
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let streakBroken = false;
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(todayStart - i * 86400000);
        const checkKey = toDateKey(checkDate);
        const isLogged = loggedDates.has(checkKey);
        const isPositive = actionType === 'good' ? isLogged : !isLogged;
        if (isPositive) {
            tempStreak++;
            if (!streakBroken) currentStreak = tempStreak;
        } else {
            if (!streakBroken && i > 0) streakBroken = true;
            if (streakBroken) {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            } else {
                currentStreak = 0;
                streakBroken = true;
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            }
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    return { currentStreak, longestStreak };
}

function renderGoodHabits() {
    const container = document.getElementById('good-habit-list-container'); 
    const displayPoints = document.getElementById('display-bonus-points');
    const displaySurplus = document.getElementById('display-surplus-wallet-habits');
    if(displayPoints) displayPoints.innerText = bonusPoints.toLocaleString();
    if(displaySurplus) displaySurplus.innerText = (charityData.surplus || 0).toLocaleString();
    if (!container) return;
    
    container.innerHTML = '';
    if (goodHabits.length === 0) { container.innerHTML = '<p style="color:var(--muted); text-align:center;">No good habits tracked yet.</p>'; return; }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    goodHabits.forEach(habit => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--success)';
        let rewardText = habit.rewardType === 'points' ? `🏆 +${habit.rewardValue} Points` : `🌟 Bank ₹${habit.rewardValue} Surplus / Reduce Penalty`;
        
        const todayLogs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'good' && h.timestamp >= startOfDay);
        const timesDoneToday = todayLogs.reduce((sum, log) => sum + (log.amount || 1), 0);
        let doneTodayHtml = timesDoneToday > 0 ? `<span class="badge done-badge">⭐ Done Today: ${timesDoneToday}</span>` : '';
        const { currentStreak: gCurr, longestStreak: gLong } = computeHabitStreak(habit.id, 'good');
        const streakHtml = gCurr > 0 ? `<span class="badge" style="background:rgba(255,180,0,0.15); color:var(--amber); border:1px solid rgba(255,180,0,0.3);">🔥 ${gCurr}d streak${gLong > gCurr ? ` (best: ${gLong}d)` : ''}</span>` : (gLong > 0 ? `<span class="badge" style="background:var(--surface-2); color:var(--muted);">Best: 🔥${gLong}d</span>` : '');

        let pills = '';
        for (let d = 6; d >= 0; d--) {
            const pDate = new Date(startOfDay - d * 86400000);
            const dKey = toDateKey(pDate);
            const dayShort = d === 0 ? 'Today' : pDate.toLocaleDateString(undefined, { weekday: 'short' });
            const countDay = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'good' && isLogOnDateKey(h, dKey)).reduce((s, l) => s + (l.amount || 1), 0);
            const pClass = countDay > 0 ? 'done' : '';
            const pIcon = countDay > 0 ? `🌟${countDay > 1 ? countDay : ''}` : '⚪';
            pills += `<span class="day-pill ${pClass}" onclick="openHabit30DayModal('${habit.id}', 'good', '${dKey}')" title="Inspect ${dKey}">${pIcon} ${dayShort}</span>`;
        }

        div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title" style="color:var(--success);">${escapeHTML(habit.title)}</div>
                    <div class="task-badges"><span class="badge" style="background:var(--surface-2); color:var(--text);">Annual Total: ${habit.annualCount}</span><span class="badge" style="background:rgba(3, 218, 198, 0.1); color:var(--success);">${rewardText}</span>${doneTodayHtml}${streakHtml}</div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="openHabit30DayModal('${habit.id}', 'good')" title="30-Day Habit Streak">📅</button>
                    <button class="btn-icon" onclick="editGoodHabit('${habit.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteGoodHabit('${habit.id}')">🗑️</button>
                </div>
            </div>
            <div class="mini-week-strip">${pills}</div>
            <div class="task-action-row"><button class="btn-task-action" style="background:var(--success); color:var(--on-accent);" onclick="logGoodHabit('${habit.id}', event)">+1 Log Good Habit</button></div>
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

function deleteBadHabit(id) { showConfirmSheet("Delete this bad habit tracker?", { title: 'Delete Vice', icon: '🗑️', okText: 'Delete', danger: true }).then(ok => { if (ok) { badHabits = badHabits.filter(h => h.id !== id); saveData(); renderHabits(); } }); }

function renderBadHabits() {
    const container = document.getElementById('bad-habit-list-container'); if (!container) return; container.innerHTML = '';
    if (badHabits.length === 0) { container.innerHTML = '<p style="color:var(--muted); text-align:center;">No bad habits tracked yet.</p>'; return; }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    badHabits.forEach(habit => {
        const div = document.createElement('div'); div.className = 'task-item bad-log';
        let donationHtml = habit.donationPenalty ? `<span class="badge donation">💸 Penalty: ₹${habit.donationPenalty}</span>` : ``;
        
        const todayLogs = activityHistory.filter(h => h.taskId === habit.id && h.actionType === 'bad' && h.timestamp >= startOfDay);
        const timesDoneToday = todayLogs.reduce((sum, log) => sum + (log.amount || 1), 0);
        let doneTodayHtml = timesDoneToday > 0 ? `<span class="badge" style="background:rgba(255, 82, 82, 0.2); color:var(--danger);">⚠️ Logged Today: ${timesDoneToday}</span>` : '';
        const { currentStreak: bCurr, longestStreak: bLong } = computeHabitStreak(habit.id, 'bad');
        const badStreakHtml = bCurr > 0 ? `<span class="badge" style="background:rgba(3,218,198,0.12); color:var(--success); border:1px solid rgba(3,218,198,0.3);">🛡️ ${bCurr}d clean${bLong > bCurr ? ` (best: ${bLong}d)` : ''}</span>` : (bLong > 0 ? `<span class="badge" style="background:var(--surface-2); color:var(--muted);">Best clean: 🛡️${bLong}d</span>` : '');

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
                    <div class="task-title" style="color:var(--bad);">${escapeHTML(habit.title)}</div>
                    <div class="task-badges"><span class="badge" style="background:var(--surface-2); color:var(--text);">Annual Total: ${habit.annualCount}</span>${donationHtml}${doneTodayHtml}${badStreakHtml}</div>
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
            <button onclick="logHabitOnDate('${habit.id}', '${kind}', '${dateKey}')" style="background:${kind === 'good' ? 'var(--success)' : 'var(--bad)'}; color:#fff; flex:1; margin:0;">
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
    if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['var(--green)', 'var(--brand)'] });
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
    if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['var(--brand)', '#f6e58d'] });
    saveData();
    render();
}

// ==========================================
// UNDO, BACKUP & FILTERED HISTORY MODAL
// ==========================================
function exportDataBackup() {
    const backup = {
        exportedAt: new Date().toISOString(),
        lastModified: lastModifiedLocal,
        tasks,
        history: activityHistory,
        badHabits,
        goodHabits,
        bonusPoints,
        charity: charityData,
        deen: deenData,
        budget: budgetData,
        backlog: backlogData,
        archivedTasks,
        journal: journalData,
        weeklyGoal: weeklyGoalData,
        deletedIds,
        extra: extraData,
        settings: collectSettings()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisab_backup_${toDateKey(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('hisab_last_backup', String(Date.now()));
    if (typeof renderBackupNudge === 'function') { renderBackupNudge(); updateBackupStatusLine(); }
    showToast('Backup saved to your downloads', '💾');
}

function importDataBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            showConfirmSheet('Restore this backup? It will be merged with your current data and synced.', { title: 'Restore backup', icon: '📂', okText: 'Restore' }).then(ok => {
                if (!ok) return;
                applyCloudPayload(parsed);
                saveData(); render(); openHistory(currentHistoryFilter);
                showToast('Backup restored', '✅');
            });
        } catch (err) {
            showToast('Invalid backup file: ' + err.message, '⚠️');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function undoAction(historyId) {
    const entry = activityHistory.find(h => h.id === historyId); if (!entry) return;
    
    showConfirmSheet(`Undo <b>${escapeHTML(entry.title)}</b>? Balances and targets will be reversed.`, { title: 'Undo entry', icon: '↩️', okText: 'Undo', danger: true }).then(ok => {
    if (ok) {
        if (entry.actionType === 'expense') {
            const expId = entry.expenseId || entry.id;
            budgetData.expenses = budgetData.expenses.filter(e => e.id !== expId);
            (budgetData.bills || []).forEach(b => { for (const k of Object.keys(b.paid || {})) if (b.paid[k] === expId) delete b.paid[k]; });
        }
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
        
        markDeleted(historyId);
        activityHistory = activityHistory.filter(h => h.id !== historyId);
        saveData(); render(); openHistory(currentHistoryFilter); 
    }
    });
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

    if (filteredHistory.length === 0) { list.innerHTML = '<div class="empty-state">Nothing logged here yet.</div>'; return; }
    
    const sorted = [...filteredHistory].sort((a, b) => b.timestamp - a.timestamp);
    const MAX = 300;
    const html = sorted.slice(0, MAX).map(item => {
        const date = new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        const neg = item.actionType === 'bad' || item.actionType === 'missed' || item.actionType === 'expense';
        const details = [];
        if (item.donationAdded) details.push(`<span style="color:var(--amber)">+₹${item.donationAdded} penalty</span>`);
        if (item.coveredBySurplus) details.push(`<span style="color:var(--green)">₹${item.coveredBySurplus} covered by surplus</span>`);
        if (item.penaltyRefunded) details.push(`<span style="color:var(--green)">₹${item.penaltyRefunded} refunded</span>`);
        if (item.pointsAdded) details.push(`<span style="color:var(--green)">+${item.pointsAdded} points</span>`);
        if (item.penaltyReduced) details.push(`<span style="color:var(--green)">−₹${item.penaltyReduced} penalty</span>`);
        if (item.surplusAdded) details.push(`<span style="color:var(--green)">+₹${item.surplusAdded} surplus</span>`);
        if (item.note) details.push(`<span class="muted">“${escapeHTML(item.note)}”</span>`);
        const fulfill = (item.actionType === 'missed' && item.taskId)
            ? `<button class="btn-sm" onclick="closeHistory(); openTask30DayModal('${item.taskId}', '${item.missedDateKey || toDateKey(item.timestamp)}')">Complete late & refund</button>` : '';
        return `<div class="history-item ${neg ? 'neg' : ''}">
            <div class="t">${escapeHTML(item.title)}</div>
            <div class="d">${date}${item.amount && item.amount !== 1 ? ` · ${fmtNum(item.amount)}` : ''}</div>
            ${details.length ? `<div class="x" style="display:flex; gap:10px; flex-wrap:wrap;">${details.join('')}</div>` : ''}
            <div class="a">${fulfill}<button class="btn-sm btn-secondary" onclick="undoAction('${item.id}')">${svgIcon('history', 'icon icon-sm')}Undo</button></div>
        </div>`;
    }).join('');
    list.innerHTML = html + (sorted.length > MAX ? `<div class="muted" style="text-align:center; font-size:12.5px; padding:10px;">Showing latest ${MAX} of ${sorted.length}. Export a backup for the full log.</div>` : '');
}
function closeHistory() { document.getElementById('history-modal').style.display = 'none'; }

// ==========================================
// DASHBOARD & DUAL CHARTS
// ==========================================

// ==========================================
// PROGRESS RINGS & HEATMAP ENGINES
// ==========================================
function createProgressRing(pct, color, label) {
    const r = 32;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return `
        <div class="progress-ring-container">
            <svg class="progress-ring-svg" width="80" height="80" viewBox="0 0 80 80">
                <circle class="progress-ring-track" cx="40" cy="40" r="${r}"/>
                <circle class="progress-ring-fill" cx="40" cy="40" r="${r}"
                    stroke="${color}"
                    stroke-dasharray="${circ}"
                    stroke-dashoffset="${offset}"/>
            </svg>
            <div class="progress-ring-label" style="color:${color};">${Math.round(pct)}%<br><span style="font-size:0.6rem;color:var(--text-muted);">${label}</span></div>
        </div>
    `;
}

function renderHeatmap() {
    let heatmapCard = document.getElementById('heatmap-card');
    if (!heatmapCard) {
        heatmapCard = document.createElement('div');
        heatmapCard.id = 'heatmap-card';
        heatmapCard.className = 'bento-stat-card';
        heatmapCard.style = 'margin-bottom:20px;';
        const dashTab = document.getElementById('tab-dashboard');
        if (dashTab) {
            const grid = dashTab.querySelector('.dashboard-grid');
            if (grid) dashTab.insertBefore(heatmapCard, grid);
        }
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const totalDays = 84;
    const totalTasks = tasks.filter(t => t.type === 'daily').length || 1;

    const intensityMap = {};
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(todayStart - (totalDays - 1 - i) * 86400000);
        const dk = toDateKey(d);
        const count = activityHistory.filter(h => h.actionType === 'complete' && h.category === 'tasks' && (h.fulfilledDateKey === dk || toDateKey(h.timestamp) === dk)).length;
        const pct = Math.min(count / Math.max(totalTasks, 1), 1);
        intensityMap[dk] = pct === 0 ? 0 : pct <= 0.25 ? 1 : pct <= 0.5 ? 2 : pct <= 0.75 ? 3 : 4;
    }

    let weeksHtml = '';
    let labelsHtml = '';
    for (let w = 0; w < 12; w++) {
        let weekHtml = '<div class="heatmap-week">';
        const weekStart = new Date(todayStart - (11 - w) * 7 * 86400000);
        const monthLabel = weekStart.toLocaleDateString(undefined, { month: 'short' });
        labelsHtml += `<div class="heatmap-week-label">${w % 3 === 0 ? monthLabel : ''}</div>`;
        for (let d = 0; d < 7; d++) {
            const dayDate = new Date(weekStart.getTime() + d * 86400000);
            const dk = toDateKey(dayDate);
            const intensity = intensityMap[dk] || 0;
            const dayName = dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            weekHtml += `<div class="heatmap-day" data-intensity="${intensity}" title="${dayName}: ${intensity === 0 ? 'No activity' : intensity === 4 ? 'All daily targets met' : 'Partial'}" onclick="filterHistory('tasks')"></div>`;
        }
        weekHtml += '</div>';
        weeksHtml += weekHtml;
    }

    heatmapCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0; font-size:0.95rem; color:var(--text-muted);">📅 12-Week Activity Heatmap</h3>
            <div style="display:flex; align-items:center; gap:5px; font-size:0.72rem; color:var(--text-muted);">
                Less <div style="width:10px;height:10px;border-radius:2px;background:var(--card-elevated);display:inline-block;margin:0 2px;"></div>
                <div style="width:10px;height:10px;border-radius:2px;background:rgba(3,218,198,0.2);display:inline-block;margin:0 2px;"></div>
                <div style="width:10px;height:10px;border-radius:2px;background:rgba(3,218,198,0.65);display:inline-block;margin:0 2px;"></div>
                <div style="width:10px;height:10px;border-radius:2px;background:rgba(3,218,198,0.9);display:inline-block;margin:0 2px;"></div> More
            </div>
        </div>
        <div class="heatmap-wrap">
            <div class="heatmap-labels">${labelsHtml}</div>
            <div class="heatmap-grid">${weeksHtml}</div>
        </div>
    `;
}

function renderTodayAgenda() {
    const box = document.getElementById('dash-today-list');
    if (!box) return;
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const list = tasks.map(t => ({ t, st: getTaskStatus(t, now) })).filter(({ t, st }) => {
        if (st.isDueToday) return true;
        if (st.isDone && t.type === 'daily' && st.isActiveToday) return true;
        return activityHistory.some(h => h.taskId === t.id && h.actionType === 'complete' && h.timestamp >= sod);
    });
    list.sort((a, b) => {
        if (a.st.isDone !== b.st.isDone) return a.st.isDone ? 1 : -1;
        if (a.st.isOverdue !== b.st.isOverdue) return a.st.isOverdue ? -1 : 1;
        const ar = a.t.reminderTime || '99:99', br = b.t.reminderTime || '99:99';
        if (ar !== br) return ar < br ? -1 : 1;
        return (a.t.sortOrder ?? 0) - (b.t.sortOrder ?? 0);
    });
    const billsDue = dueBillsForAgenda();
    const billsHtml = billsDue.map(({ b, s }) => `
            <div class="agenda-item">
                <button class="agenda-check" onclick="markBillPaid('${b.id}')" aria-label="Mark paid">${svgIcon('check')}</button>
                <div class="agenda-body" onclick="switchTab('budget')">
                    <div class="agenda-title">${escapeHTML(b.name)} <span class="num muted" style="font-weight:600;">₹${Number(b.amount).toLocaleString()}</span></div>
                    <div class="agenda-meta"><span>Bill</span><span class="${s.daysLeft <= 0 ? 'late' : ''}">${Core.dueLabel(s.daysLeft)}</span></div>
                </div>
            </div>`).join('');
    if (list.length === 0 && billsDue.length) { box.innerHTML = billsHtml; return; }
    if (list.length === 0) {
        box.innerHTML = tasks.length === 0
            ? `<div class="muted" style="font-size:14px; padding:6px 2px;">No tasks yet. Add something you want to be reminded about.</div>`
            : `<div class="muted" style="font-size:14px; padding:6px 2px;">Nothing due today. Enjoy the calm ✨</div>`;
        return;
    }
    const nowHM = now.toTimeString().slice(0, 5);
    box.innerHTML = list.slice(0, 8).map(({ t, st }) => {
        const meta = [];
        if (t.type !== 'daily') meta.push(`<span style="text-transform:capitalize">${t.type === 'once' ? 'One-time' : t.type}</span>`);
        if ((t.baseTarget || 1) > 1 || t.type === 'weekly' || t.type === 'monthly') meta.push(`<span class="num">${fmtNum(st.doneAmt)}/${fmtNum(st.target)}</span>`);
        if (st.dueLabel) meta.push(`<span class="${st.isOverdue ? 'late' : ''}">${st.dueLabel}</span>`);
        const rm = Core.reminderMinute(t, getTodayPrayerTimings());
        if (t.snoozedUntil && t.snoozedUntil > Date.now()) meta.push(`<span>😴 ${new Date(t.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`);
        else if (rm != null) meta.push(`<span class="${!st.isDone && Core.minToHm(rm) < nowHM ? 'late' : ''}">${t.prayerAnchor ? escapeHTML(Core.describeAnchor(t.prayerAnchor)) + ' · ' : ''}${Core.minToHm(rm)}</span>`);
        else if (t.prayerAnchor) meta.push(`<span>${escapeHTML(Core.describeAnchor(t.prayerAnchor))}</span>`);
        const sts = subtaskState(t); if (sts.total) meta.push(`<span>☑ ${sts.done}/${sts.total}</span>`);
        return `
            <div class="agenda-item ${st.isDone ? 'done' : ''}">
                <button class="agenda-check" onclick="quickCompleteTask('${t.id}', event)" aria-label="Complete">${svgIcon('check')}</button>
                <div class="agenda-body" onclick="switchTab('tasks'); setTimeout(() => toggleTaskSlider('${t.id}'), 150);">
                    <div class="agenda-title">${escapeHTML(t.title)}</div>
                    ${meta.length ? `<div class="agenda-meta">${meta.join('')}</div>` : ''}
                </div>
            </div>`;
    }).join('') + billsHtml + (list.length > 8 ? `<div style="padding-top:10px;"><button class="btn-sm btn-ghost" onclick="switchTab('tasks')">+${list.length - 8} more</button></div>` : '');
}
window.renderTodayAgenda = renderTodayAgenda;

function updateDashboard() {
    renderHeatmap();
    renderTodayAgenda();

    const spiritContainer = document.getElementById('spiritual-milestones');
    if (spiritContainer) {
        spiritContainer.innerHTML = `
            <div class="milestone" onclick="switchTab('deen')" style="cursor:pointer">
                <div class="l">Quran khatms</div>
                <div class="v" style="color:var(--brand)">${deenData.quranStats?.totalKhatm || 0}</div>
                <div class="s">${deenData.quranStats?.totalJuz || 0} juz · ${fmtNum(deenData.quranStats?.totalHizb || 0)} hizb</div>
            </div>
            <div class="milestone" onclick="switchTab('deen')" style="cursor:pointer">
                <div class="l">Swalath</div>
                <div class="v" style="color:var(--sky)">${(deenData.swalathStats?.total || 0).toLocaleString()}</div>
                <div class="s">Lifetime count</div>
            </div>`;
    }

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setText('donation-pending', (charityData.pending || 0).toLocaleString());
    setText('donation-paid', (charityData.paid || 0).toLocaleString());
    setText('display-surplus-wallet', (charityData.surplus || 0).toLocaleString());

    let dTotal = 0, dComp = 0, wTotal = 0, wComp = 0, mTotal = 0, mComp = 0, oTotal = 0, oComp = 0;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    let dayPts = 0, weekPts = 0, monthPts = 0, yearPts = 0;
    activityHistory.forEach(r => {
        if (r.actionType === 'complete' && r.category === 'tasks') {
            const a = Number(r.amount) || 0;
            if (r.timestamp >= startOfDay) dayPts += a; if (r.timestamp >= startOfWeek) weekPts += a; if (r.timestamp >= startOfMonth) monthPts += a; if (r.timestamp >= startOfYear) yearPts += a;
        }
    });
    tasks.forEach(t => {
        const total = t.totalYearlyTarget || 1; const pending = Math.max(0, t.currentTarget || 0); const completed = Math.max(0, Math.min(total, total - pending));
        if (t.type === 'daily') { dTotal += total; dComp += completed; } if (t.type === 'weekly') { wTotal += total; wComp += completed; } if (t.type === 'monthly') { mTotal += total; mComp += completed; } if (t.type === 'once') { oTotal += total; oComp += completed; }
    });
    const pctOf = (c, t) => t > 0 ? parseFloat(((c / t) * 100).toFixed(1)) : 0;
    const dPct = pctOf(dComp, dTotal), wPct = pctOf(wComp, wTotal), mPct = pctOf(mComp, mTotal), oPct = pctOf(oComp, oTotal);

    let ringsRow = document.getElementById('dashboard-rings-row');
    if (!ringsRow) {
        ringsRow = document.createElement('div');
        ringsRow.id = 'dashboard-rings-row';
        const heat = document.getElementById('heatmap-card');
        if (heat && heat.parentNode) heat.parentNode.insertBefore(ringsRow, heat.nextSibling);
    }
    ringsRow.innerHTML = createProgressRing(dPct, 'var(--brand)', 'Daily') + createProgressRing(wPct, 'var(--indigo)', 'Weekly') + createProgressRing(mPct, 'var(--sky)', 'Monthly') + createProgressRing(oPct, 'var(--orange)', 'One-time');

    setText('day-completed', fmtNum(dayPts)); setText('week-completed', fmtNum(weekPts));
    setText('month-completed', fmtNum(monthPts)); setText('year-completed', fmtNum(yearPts));

    // ---- Today's numbers ----
    const todayKey = toDateKey(now);
    const todaysDaily = tasks.filter(t => t.type === 'daily' && isTaskActiveOn(t, now));
    const completedDailyCount = todaysDaily.filter(t => getTaskStatus(t, now).isDone).length;
    const otherDue = tasks.filter(t => t.type !== 'daily' && getTaskStatus(t, now).isDueToday);
    const pendingDailyCount = todaysDaily.length - completedDailyCount;

    setText('tile-tasks-sub', tasks.length === 0 ? 'No tasks yet'
        : (pendingDailyCount + otherDue.length === 0 ? 'All done for today 🎉' : `${pendingDailyCount + otherDue.length} to do today`));

    // Penalty banner
    const bannerWrap = document.getElementById('dash-penalty-banner-wrap');
    if (bannerWrap) {
        if ((charityData.pending || 0) > 0) {
            bannerWrap.innerHTML = `
                <div class="banner warn">
                    <div class="b-left">
                        <div class="b-icon">${svgIcon('scale')}</div>
                        <div><div class="b-title">Pending charity penalty</div><div class="b-amount">₹${charityData.pending.toLocaleString()}</div></div>
                    </div>
                    <div class="b-actions">
                        ${(charityData.surplus || 0) > 0 ? `<button class="btn-sm btn-secondary" onclick="deductFromSurplus()">Use ₹${Math.min(charityData.surplus, charityData.pending).toLocaleString()} surplus</button>` : ''}
                        <button class="btn-sm" onclick="scrollToCharity(); setTimeout(() => document.getElementById('donation-pay-amount')?.focus(), 400)">Record payment</button>
                    </div>
                </div>`;
        } else {
            bannerWrap.innerHTML = '';
        }
    }

    // Unified daily score
    const completedHabitsCount = (goodHabits || []).filter(h => activityHistory.some(log => log.taskId === h.id && log.actionType === 'good' && (log.habitDateKey === todayKey || toDateKey(log.timestamp) === todayKey))).length;
    const totalHabitsGoal = (goodHabits || []).length;
    const hasDeenActivityToday = activityHistory.some(log => (log.category === 'deen' || (log.actionType && log.actionType.startsWith('deen_'))) && log.timestamp >= startOfDay);
    const hasTodayJournal = !!(journalData && journalData[todayKey] && journalData[todayKey].trim().length > 0);
    const otherDoneToday = tasks.filter(t => t.type !== 'daily' && activityHistory.some(h => h.taskId === t.id && h.actionType === 'complete' && h.timestamp >= startOfDay)).length;

    const taskTotal = todaysDaily.length + otherDue.length + otherDoneToday;
    const taskDone = completedDailyCount + otherDoneToday;
    const totalGoals = taskTotal + totalHabitsGoal + 1 + 1;
    const doneGoals = taskDone + completedHabitsCount + (hasDeenActivityToday ? 1 : 0) + (hasTodayJournal ? 1 : 0);
    const pct = totalGoals > 0 ? Math.min(100, Math.round((doneGoals / totalGoals) * 100)) : 0;

    setText('dash-hero-stats', `${doneGoals} of ${totalGoals} goals done`);
    setText('dash-hero-pct', `${pct}%`);
    const ring = document.getElementById('dash-hero-ring');
    if (ring) ring.style.strokeDashoffset = String(276.5 * (1 - pct / 100));
    const heroBar = document.getElementById('dash-hero-bar'); if (heroBar) heroBar.style.width = `${pct}%`;
    setText('dash-greeting-date', now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
    const hr = now.getHours();
    const firstName = (currentUser && currentUser.displayName ? currentUser.displayName.split(' ')[0] : '');
    setText('dash-greeting', `${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}${firstName ? ', ' + firstName : ''}`);

    const pill = (ok, icon, label, val, tab) => `<span class="goal-pill ${ok ? 'ok' : ''}" onclick="switchTab('${tab}')">${svgIcon(ok ? 'check' : icon)}${label} <b>${val}</b></span>`;
    const goalsBreakdown = document.getElementById('dash-goals-breakdown');
    if (goalsBreakdown) {
        goalsBreakdown.innerHTML =
            pill(taskTotal > 0 && taskDone >= taskTotal, 'check-square', 'Tasks', `${taskDone}/${taskTotal}`, 'tasks') +
            pill(totalHabitsGoal > 0 && completedHabitsCount >= totalHabitsGoal, 'shield', 'Habits', `${completedHabitsCount}/${totalHabitsGoal}`, 'bad-habits') +
            pill(hasDeenActivityToday, 'moon-star', 'Deen', hasDeenActivityToday ? '✓' : '—', 'deen') +
            pill(hasTodayJournal, 'book', 'Journal', hasTodayJournal ? '✓' : '—', 'journal');
    }

    // Habit streaks
    let maxGoodStreak = 0, maxCleanStreak = 0;
    (goodHabits || []).forEach(h => { const { currentStreak } = computeHabitStreak(h.id, 'good'); if (currentStreak > maxGoodStreak) maxGoodStreak = currentStreak; });
    (badHabits || []).forEach(h => { const { currentStreak } = computeHabitStreak(h.id, 'bad'); if (currentStreak > maxCleanStreak) maxCleanStreak = currentStreak; });
    let bestTaskStreak = 0;
    tasks.filter(t => t.type === 'daily').forEach(t => { const s = computeItemStreak(t.id, 'tasks').currentStreak; if (s > bestTaskStreak) bestTaskStreak = s; });
    const bestStreak = Math.max(maxGoodStreak, bestTaskStreak);
    setText('tile-habits-sub', (maxGoodStreak > 0 || maxCleanStreak > 0) ? `${maxGoodStreak}d streak · ${maxCleanStreak}d clean` : `${(goodHabits || []).length + (badHabits || []).length} habits tracked`);
    setText('dash-streak-pill', bestStreak > 0 ? `🔥 ${bestStreak}-day streak` : 'Start a streak today');

    const khatmCount = deenData.quranStats?.totalKhatm || 0;
    setText('tile-deen-sub', khatmCount > 0 ? `${khatmCount} khatm · prayers` : 'Prayers & Quran');

    const monthSpent = (budgetData.expenses || []).filter(e => e.date >= startOfMonth).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    setText('tile-budget-sub', monthSpent > 0 ? `₹${monthSpent.toLocaleString()} spent${budgetData.limit ? ` of ₹${Number(budgetData.limit).toLocaleString()}` : ''}` : 'Expenses & debts');
    const pendingSaved = (backlogData || []).filter(b => !b.completed).length;
    setText('tile-saved-sub', pendingSaved > 0 ? `${pendingSaved} to watch/read` : 'Library is clear');
    setText('tile-journal-sub', hasTodayJournal ? 'Written today ✓' : 'Write today\'s entry');

    renderDashboardCharts(dPct, wPct, mPct, oPct);
}

function renderDashboardCharts(dPct, wPct, mPct, oPct) {
    if (typeof Chart === 'undefined') return;
    const content = document.getElementById('analytics-content');
    if (!content || content.style.display === 'none') return; // render lazily when visible
    const grid = cssVar('--border'), tick = cssVar('--muted');
    const tCanvas = document.getElementById('tasksProgressChart');
    if (tCanvas) {
        if (tasksProgressChart) tasksProgressChart.destroy();
        tasksProgressChart = new Chart(tCanvas.getContext('2d'), {
            type: 'bar',
            data: { labels: ['Daily', 'Weekly', 'Monthly', 'One-time'], datasets: [{ label: 'Yearly completion (%)', data: [dPct, wPct, mPct, oPct], backgroundColor: cssVar('--brand'), borderRadius: 6, maxBarThickness: 42 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: grid }, ticks: { color: tick, callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { color: tick } } }, plugins: { legend: { display: false } } }
        });
    }
    const bCanvas = document.getElementById('badHabitsChart');
    if (bCanvas && badHabits.length > 0) {
        if (badHabitsChart) badHabitsChart.destroy();
        badHabitsChart = new Chart(bCanvas.getContext('2d'), {
            type: 'bar',
            data: { labels: badHabits.map(h => h.title), datasets: [{ label: 'Occurrences', data: badHabits.map(h => h.annualCount || 0), backgroundColor: cssVar('--rose'), borderRadius: 6, maxBarThickness: 42 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: grid }, ticks: { color: tick, stepSize: 1 } }, x: { grid: { display: false }, ticks: { color: tick } } }, plugins: { legend: { display: false } } }
        });
    }
}
window.onThemeChanged = () => { try { updateDashboard(); renderBudget(); } catch (e) {} };

// ==========================================
// DEEN TAB
// ==========================================

// ==========================================
// PRAYER TIMES ENGINE (Aladhan API)
// ==========================================
let prayerTimesData = null;
let prayerCountdownInterval = null;

async function loadPrayerTimes() {
    const content = document.getElementById('prayer-times-content');
    if (content) content.innerHTML = '<div style="text-align:center; color:var(--text-muted);">📍 Requesting location...</div>';
    if (!navigator.geolocation) {
        if (content) content.innerHTML = 'Geolocation is not supported by your browser.';
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        deenData.location = { lat: Math.round(latitude * 1000) / 1000, lng: Math.round(longitude * 1000) / 1000, method: 2, savedAt: Date.now() };
        saveData();
        try {
            if (content) content.innerHTML = '<div style="text-align:center; color:var(--text-muted);">⏳ Fetching prayer times...</div>';
            const d0 = new Date(); const dd = `${String(d0.getDate()).padStart(2, '0')}-${String(d0.getMonth() + 1).padStart(2, '0')}-${d0.getFullYear()}`;
            const resp = await fetch(`https://api.aladhan.com/v1/timings/${dd}?latitude=${latitude}&longitude=${longitude}&method=2`);
            const data = await resp.json();
            if (data.code === 200) {
                prayerTimesData = data.data.timings;
                localStorage.setItem('hisab_prayer_times', JSON.stringify({ timings: prayerTimesData, date: toDateKey(Date.now()) }));
                renderPrayerTimes();
            } else {
                if (content) content.innerHTML = 'Could not fetch prayer times. Please try again.';
            }
        } catch (e) {
            if (content) content.innerHTML = 'Network error fetching prayer times.';
        }
    }, () => {
        if (content) content.innerHTML = 'Location permission denied. Please allow location access.';
    });
}

function renderPrayerTimes() {
    const content = document.getElementById('prayer-times-content');
    if (!content || !prayerTimesData) return;
    const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const prayerIcons = { Fajr: '🌅', Sunrise: '☀️', Dhuhr: '🌞', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' };
    let html = '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">';
    prayers.forEach(p => {
        if (!prayerTimesData[p]) return;
        html += `
            <div style="background:var(--card-elevated); padding:10px 8px; border-radius:10px; border:1px solid var(--border); text-align:center;">
                <div style="font-size:1.1rem;">${prayerIcons[p] || '🕌'}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin:2px 0;">${p}</div>
                <div style="font-size:0.85rem; font-weight:700; font-family:var(--font-mono); color:var(--deen);">${prayerTimesData[p]}</div>
            </div>
        `;
    });
    html += '</div>';
    content.innerHTML = html;
    startPrayerCountdown();
}

function startPrayerCountdown() {
    if (prayerCountdownInterval) clearInterval(prayerCountdownInterval);
    updatePrayerCountdown();
    prayerCountdownInterval = setInterval(updatePrayerCountdown, 1000);
}

function updatePrayerCountdown() {
    if (!prayerTimesData) return;
    const countdownEl = document.getElementById('next-prayer-countdown');
    const nameEl = document.getElementById('next-prayer-name');
    const textEl = document.getElementById('next-prayer-countdown-text');
    if (!countdownEl || !nameEl || !textEl) return;
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let nextPrayer = null;
    let minDiff = Infinity;
    prayers.forEach(p => {
        if (!prayerTimesData[p]) return;
        const [h, m] = prayerTimesData[p].split(':').map(Number);
        const pMin = h * 60 + m;
        const diff = pMin > nowMinutes ? pMin - nowMinutes : (24 * 60 - nowMinutes + pMin);
        if (diff < minDiff) { minDiff = diff; nextPrayer = { name: p, diff }; }
    });
    if (nextPrayer) {
        countdownEl.style.display = 'block';
        nameEl.innerText = nextPrayer.name;
        const hrs = Math.floor(nextPrayer.diff / 60);
        const mins = nextPrayer.diff % 60;
        textEl.innerText = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m remaining`;
    }
}

// Auto-load cached prayer times if from today
const cachedPrayer = JSON.parse(localStorage.getItem('hisab_prayer_times') || 'null');
if (cachedPrayer && cachedPrayer.date === toDateKey(Date.now())) {
    prayerTimesData = cachedPrayer.timings;
}

function renderDeen() {
    if (prayerTimesData) renderPrayerTimes(); 
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

    const dhikrContainer = document.getElementById('dhikr-list-container');
    if (dhikrContainer) {
        dhikrContainer.innerHTML = '';
        deenData.dhikr.forEach((d, index) => {
            const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--deen)'; if (d.completed) div.style.opacity = '0.6';
            let intentionHtml = d.intention ? `<div style="font-size:0.85rem; color:var(--muted); margin-bottom:8px;"><em>" ${escapeHTML(d.intention)} "</em></div>` : ''; let deadlineHtml = d.deadline ? `<span class="badge" style="background:rgba(246, 229, 141, 0.15); color:var(--warning);">⏳ ${d.deadline}</span>` : ''; let progressHtml = d.completed ? `<span class="badge done-badge">✅ Completed</span>` : `<span class="badge target">Progress: ${d.current} / ${d.target}</span>`;
            div.innerHTML = `<div class="task-header"><div><div class="task-title">${escapeHTML(d.name)}</div>${intentionHtml}<div class="task-badges">${progressHtml}${deadlineHtml}</div></div><div class="task-controls"><button class="btn-icon" onclick="openDhikrEdit(${index})" title="Edit" aria-label="Edit dhikr">✏️</button><button class="btn-icon" onclick="deleteDhikr(${index})" title="Delete" aria-label="Delete dhikr">🗑️</button></div></div>${!d.completed ? `<div class="task-action-row"><div class="task-input-box"><input type="number" id="dhikr-input-${index}" value="1" min="1"></div><button class="btn-task-action" style="flex:1; background:var(--deen); color:var(--on-accent);" onclick="logDhikr(${index})">Log Dhikr</button></div>` : ''}`;
            dhikrContainer.appendChild(div);
        });
    }

    const select = document.getElementById('juz-select'); if(select && select.options && select.options.length <= 1) { for(let i=1; i<=30; i++) { let opt = document.createElement('option'); opt.value = i; opt.innerHTML = `Juz ${i}`; select.appendChild(opt); } } 
    
    const juzContainer = document.getElementById('juz-list-container'); 
    if (juzContainer) {
        juzContainer.innerHTML = ''; 
        let remainderJuz = (deenData.quranStats?.totalJuz || 0) % 30;
        let autoTracker = document.createElement('div');
        autoTracker.style = "background:rgba(3, 218, 198, 0.06); padding:12px; border-radius:10px; margin-bottom:12px; border-left:3px solid var(--deen);";
        autoTracker.innerHTML = `
            <div style="font-size:0.8rem; color:var(--muted);">Automated Reading Progress</div>
            <div style="font-weight:bold; color:var(--deen); margin-top:2px;">Currently on Juz ${remainderJuz + 1} (${deenData.quranStats?.totalHizb || 0} Total Hizb read)</div>
        `;
        juzContainer.appendChild(autoTracker);

        deenData.quran.forEach((q, index) => { 
            const div = document.createElement('div'); 
            div.className = 'quran-item'; 
            div.style.opacity = q.completed ? '0.5' : '1'; 
            div.style.flexDirection = 'column'; 
            div.style.gap = '10px'; 
            let intentionText = q.intention ? `<div style="font-size:0.85rem; color:var(--muted); margin-top:4px;"><em>" ${escapeHTML(q.intention)} "</em></div>` : ''; 
            div.innerHTML = `<div><strong>${q.completed ? '✅' : '📖'} Juz ${q.juz}</strong>${intentionText}</div><div style="display: flex; gap: 6px; justify-content: flex-end;">${!q.completed ? `<button onclick="completeJuz(${index})" style="background:var(--success); color:var(--on-accent); padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">Complete</button><button onclick="editJuz(${index})" style="background:var(--warning); color:var(--on-accent); padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">✏️ Edit</button>` : ''}<button onclick="deleteJuz(${index})" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:6px 12px; margin:0; width:auto; font-size:0.8rem;">🗑️</button></div>`; 
            juzContainer.appendChild(div); 
        }); 
    }

    const qadaContainer = document.getElementById('qada-container');
    if (qadaContainer) {
        qadaContainer.innerHTML = '';
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Witr'];
        let totalQada = prayers.reduce((acc, p) => acc + deenData.qada[p], 0);
        if (totalQada === 0 && !showAllQada) { qadaContainer.innerHTML = `<div style="text-align:center; color:var(--muted); font-size:0.9rem; margin-bottom:10px;">🎉 All missed prayers are caught up!</div>`; }
        prayers.forEach(p => { const count = deenData.qada[p]; if (!showAllQada && count === 0) return; const div = document.createElement('div'); div.className = 'qada-row'; div.innerHTML = `<div style="font-weight:bold;">${p}</div><div class="qada-controls"><span style="font-family:monospace; font-size:1.2rem; min-width:30px; text-align:center; color:${count > 0 ? 'var(--danger)' : 'var(--success)'}">${count}</span><button class="qada-btn minus" onclick="updateQada('${p}', -1)" title="Prayed Qada">✔️</button><button class="qada-btn" onclick="updateQada('${p}', 1)" title="Missed Prayer">➕</button></div>`; qadaContainer.appendChild(div); }); 
        const toggleBtn = document.createElement('button'); toggleBtn.style = "background:transparent; border:1px solid var(--deen); color:var(--deen); padding:8px; margin-top:10px; width:100%; border-radius:8px;"; toggleBtn.innerText = showAllQada ? "⬆️ Hide Caught Up Prayers" : "⬇️ Reveal All Prayers"; toggleBtn.onclick = function() { showAllQada = !showAllQada; renderDeen(); }; qadaContainer.appendChild(toggleBtn);
    }

    const zCash = document.getElementById('zakat-cash');
    const zGold = document.getElementById('zakat-gold');
    const zInvest = document.getElementById('zakat-invest');
    if (zCash && zGold && zInvest) {
        zCash.value = deenData.zakatInputs.cash;
        zGold.value = deenData.zakatInputs.gold;
        zInvest.value = deenData.zakatInputs.invest;
        calculateZakat();
    }
}

function updateQada(prayer, amount) { deenData.qada[prayer] += amount; if(deenData.qada[prayer] < 0) deenData.qada[prayer] = 0; saveData(); renderDeen(); }
function addDhikr() { const name = document.getElementById('dhikr-name').value.trim(); const target = parseInt(document.getElementById('dhikr-target').value); const intention = document.getElementById('dhikr-intention').value.trim(); const deadline = document.getElementById('dhikr-deadline').value; const startEl = document.getElementById('dhikr-start'); const start = Math.max(0, parseInt(startEl && startEl.value) || 0); if (!name || !target || target <= 0) return alert("Please provide a valid Dhikr name and target number."); deenData.dhikr.push({ name, target, current: Math.min(start, target), intention, deadline, completed: start >= target }); if (startEl) startEl.value = ''; document.getElementById('dhikr-name').value = ''; document.getElementById('dhikr-target').value = ''; document.getElementById('dhikr-intention').value = ''; document.getElementById('dhikr-deadline').value = ''; saveData(); renderDeen(); }
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
    const category = document.getElementById('expense-category')?.value || 'other';
    const expenseId = Date.now().toString();
    budgetData.expenses.push({ id: expenseId, desc, amount, category, date: expenseDate });
    
    let newLog = { id: (Date.now() + 1).toString(), expenseId, taskId: 'exp-' + expenseId, category: 'budget', timestamp: Date.now(), title: "Expense: " + desc, actionType: 'expense', amount: amount };
    activityHistory.push(newLog); syncToGoogleSheets(newLog);
    
    document.getElementById('expense-desc').value = ''; document.getElementById('expense-amount').value = ''; document.getElementById('expense-date').value = '';
    closeModal('expense-modal');
    saveData(); renderBudget();
    showToast(`₹${amount.toLocaleString()} logged`, '🧾');
    setTimeout(() => checkCategoryWarning(category), 1200);
}

function deleteExpense(id) {
    showConfirmSheet("Delete this expense?", { title: 'Delete expense', icon: '🗑️', okText: 'Delete', danger: true }).then(ok => {
        if (!ok) return;
        budgetData.expenses = budgetData.expenses.filter(e => e.id !== id);
        saveData(); renderBudget();
    });
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
    const dueInput = document.getElementById('debt-due');
    budgetData.debts.push({ id: Date.now().toString(), desc, amount, type, date: debtDate, repaid: 0, due: (dueInput && dueInput.value) || '' });
    if (dueInput) dueInput.value = '';
    
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
    
    const monthTitleEl = document.getElementById('budget-month-title');
    if (monthTitleEl) monthTitleEl.innerText = monthNames[currentMonth] + " " + currentYear;
    const limitDisplayEl = document.getElementById('budget-limit-display');
    if (limitDisplayEl) limitDisplayEl.innerText = budgetData.limit.toLocaleString();
    
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
                div.style = "background:var(--surface-2); padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--danger);";
                div.innerHTML = `
                    <div>
                        <div style="font-weight:bold;">${escapeHTML(exp.desc)}</div>
                        <div style="font-size:0.8rem; color:var(--muted);">${expDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${BILL_CATS[exp.category || 'other'] || 'Other'}${exp.billId ? ' · recurring bill' : ''}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="color:var(--danger); font-weight:bold;">₹${exp.amount.toLocaleString()}</span>
                        <button class="btn-icon" onclick="deleteExpense('${exp.id}')" style="min-width:36px; min-height:36px;">🗑️</button>
                    </div>
                `;
                listContainer.appendChild(div);
            }
        });
        if (!hasExpensesThisMonth) listContainer.innerHTML = '<p style="color:var(--muted); text-align:center;">No expenses logged for this month yet.</p>';
    }

    // Category Chart & Breakdown
    const catCanvas = document.getElementById('expenseCategoryChart');
    if (catCanvas) {
        const catConfig = {
            food: { label: '🍔 Food', color: '#ef5350' },
            transport: { label: '🚗 Transport', color: '#42a5f5' },
            shopping: { label: '🛍️ Shopping', color: '#ab47bc' },
            bills: { label: '💡 Bills', color: '#ffa726' },
            health: { label: '💊 Health', color: '#66bb6a' },
            education: { label: '📚 Education', color: '#26c6da' },
            entertainment: { label: '🎮 Entertainment', color: '#8d6e63' },
            other: { label: '📦 Other', color: '#78909c' }
        };
        const catTotals = {};
        budgetData.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).forEach(e => {
            const cat = e.category || 'other';
            catTotals[cat] = (catTotals[cat] || 0) + e.amount;
        });
        const labels = [], data = [], colors = [];
        Object.entries(catTotals).forEach(([cat, amt]) => {
            labels.push(catConfig[cat]?.label || cat);
            data.push(amt);
            colors.push(catConfig[cat]?.color || '#888');
        });
        const ctx2 = catCanvas.getContext('2d');
        if (expenseCategoryChart) expenseCategoryChart.destroy();
        if (typeof Chart !== 'undefined' && data.length > 0) {
            expenseCategoryChart = new Chart(ctx2, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: cssVar('--muted'), font: { size: 10 } }, position: 'right' } } } });
        }
        renderCategoryBreakdown(catConfig);
    }
    renderBills();

    const spentEl = document.getElementById('budget-spent');
    if (spentEl) spentEl.innerText = monthlyTotal.toLocaleString();
    const fillEl = document.getElementById('budget-progress-fill');
    const remainingText = document.getElementById('budget-remaining-text');
    
    if (fillEl && remainingText) {
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
            div.style = "background:var(--surface-2); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
            let progressHtml = repaid > 0 ? `<div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">Original: ₹${debt.amount} | Paid: ₹${repaid}</div>` : '';

            div.innerHTML = `
                <div>
                    <div style="font-weight:bold; font-size:0.85rem;">${escapeHTML(debt.desc)}</div>
                    <div style="font-size:0.75rem; color:var(--muted);">${dDate.toLocaleDateString()}</div>
                    ${debtDueBadge(debt)}
                    ${progressHtml}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="text-align:right;">
                        <span style="font-weight:bold; font-size:0.9rem; color:${debt.type === 'borrowed' ? 'var(--bad)' : 'var(--success)'};">₹${pending.toLocaleString()}</span>
                    </div>
                    <button class="btn-icon" onclick="openDebtDue('${debt.id}')" title="Set due date" aria-label="Set due date">📅</button>
                    <button class="btn-icon" onclick="repayDebt('${debt.id}')" style="background:rgba(3, 218, 198, 0.15); color:var(--success);" title="Log Repayment">💰</button>
                    <button class="btn-icon" onclick="deleteDebt('${debt.id}')" title="Delete Record">🗑️</button>
                </div>
            `;
            if (debt.type === 'borrowed') { totalBorrowed += pending; borrowedContainer.appendChild(div); } 
            else { totalLent += pending; lentContainer.appendChild(div); }
        });
        
        if (borrowedContainer.innerHTML === '') borrowedContainer.innerHTML = '<div style="color:var(--muted); font-size:0.8rem; text-align:center;">None</div>';
        if (lentContainer.innerHTML === '') lentContainer.innerHTML = '<div style="color:var(--muted); font-size:0.8rem; text-align:center;">None</div>';
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
        if (document.getElementById('tab-dashboard')?.classList.contains('active')) updateDashboard();
        if (item.completed && typeof confetti === 'function') confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    }
}

function deleteBacklogItem(id) {
    showConfirmSheet("Remove this item from your library?", { title: 'Remove item', icon: '🗑️', okText: 'Remove', danger: true }).then(ok => {
        if (!ok) return;
        markDeleted(id);
        backlogData = backlogData.filter(b => b.id !== id);
        saveData(); renderBacklog();
    });
}

function renderBacklog() {
    const safeUrl = u => /^https?:\/\//i.test(u || '') ? escapeHTML(u) : '';
    const container = document.getElementById('backlog-list-container'); if (!container) return; container.innerHTML = '';
    const filterView = document.getElementById('backlog-filter') ? document.getElementById('backlog-filter').value : 'all';
    
    let filteredData = backlogData;
    if (filterView === 'pending') filteredData = backlogData.filter(b => !b.completed);
    if (filterView === 'completed') filteredData = backlogData.filter(b => b.completed);

    if (filteredData.length === 0) { container.innerHTML = '<p style="color:var(--muted); text-align:center;">Library is empty for this view.</p>'; return; }

    filteredData.sort((a, b) => {
        if (a.completed === b.completed) return b.addedAt - a.addedAt;
        return a.completed ? 1 : -1;
    });

    const typeIcons = { 'video': '📺', 'article': '📰', 'book': '📚', 'other': '🔖' };

    filteredData.forEach(item => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--backlog)'; if (item.completed) div.style.opacity = '0.5';

        let imageHtml = item.imageUrl ? `<img src="${safeUrl(item.imageUrl)}" style="width:100%; max-height:220px; object-fit:cover; border-radius:8px; margin-bottom:10px; background:var(--surface-2);" onerror="this.style.display='none'">` : '';
        let linkHtml = item.link ? `<a href="${safeUrl(item.link)}" rel="noopener" target="_blank" style="color:var(--backlog); font-size:0.85rem; text-decoration:none; display:block; margin-bottom:5px;">🔗 Open Link</a>` : '';
        let notesHtml = item.notes ? `<div style="font-size:0.85rem; color:var(--muted); margin-bottom:8px; background:var(--surface-2); padding:8px; border-radius:5px;">${escapeHTML(item.notes)}</div>` : '';
        let statusBadge = item.completed ? `<span class="badge done-badge">✅ Finished</span>` : '';

        div.innerHTML = `
            ${imageHtml}
            <div class="task-header" style="margin-bottom:10px;">
                <div style="flex:1;">
                    <div style="font-size:0.8rem; color:var(--muted); margin-bottom:3px;">${typeIcons[item.type] || '🔖'} ${escapeHTML((item.type || 'other').toUpperCase())}</div>
                    <div class="task-title" style="${item.completed ? 'text-decoration:line-through;' : ''}">${escapeHTML(item.title)}</div>
                    ${statusBadge}
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="editBacklogItem('${item.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteBacklogItem('${item.id}')">🗑️</button>
                </div>
            </div>
            ${linkHtml}
            ${notesHtml}
            <button onclick="toggleBacklogStatus('${item.id}')" style="background:${item.completed ? 'var(--surface-3)' : 'var(--backlog)'}; color:${item.completed ? 'var(--text)' : '#fff'}; width:100%; margin:0; padding:8px;">
                ${item.completed ? 'Undo (Mark as Pending)' : 'Mark as Done'}
            </button>
        `;
        container.appendChild(div);
    });
}

// ==========================================
// BACKGROUND REMINDER ENGINE
// ==========================================
setInterval(runReminderEngine, 30000);
setTimeout(runReminderEngine, 4000);

function runReminderEngine() {
    const now = new Date();
    const ctx = Core.ctxFromLocalDate(now);
    const todayKey = ctx.todayKey;
    const nowMin = ctx.minuteOfDay;
    const canNotify = ("Notification" in window && Notification.permission === "granted");
    // When background push is active, the server sends reminders — avoid duplicates.
    const serverHandles = localStorage.getItem('hisab_push_active') === '1';

    if (canNotify && !serverHandles) {
        const timings = getTodayPrayerTimings();
        let changed = false;
        tasks.forEach(t => {
            if ((t.currentTarget ?? 1) <= 0) return;
            const st = getTaskStatus(t, now);
            if (st.isDone || !st.isDueToday) return;

            // Snoozed reminders
            if (t.snoozedUntil) {
                if (Date.now() < t.snoozedUntil) return;
                if (t.snoozeFired !== t.snoozedUntil) {
                    notifyTask(t, st, '(snoozed)');
                    t.snoozeFired = t.snoozedUntil; changed = true;
                    return;
                }
            }
            const rMin = Core.reminderMinute(t, timings);
            if (rMin == null) return;
            // 5-minute window so a throttled background tab doesn't skip reminders
            if (nowMin < rMin || nowMin >= rMin + 5) return;
            const notifiedKey = `${todayKey} ${Core.minToHm(rMin)}`;
            if (t.lastNotified === notifiedKey) return;
            notifyTask(t, st);
            t.lastNotified = notifiedKey; changed = true;
        });

        // Recurring bills: remind at 09:00 inside each bill's reminder window
        if (nowMin >= 9 * 60) {
            (budgetData.bills || []).forEach(b => {
                const bs = Core.billStatus(b, ctx);
                if (!bs.inWindow) return;
                const k = `hisab_bill_notif_${b.id}_${todayKey}`;
                if (localStorage.getItem(k)) return;
                sendAppNotification(`💳 ${b.name} — ₹${Number(b.amount).toLocaleString()}`, { body: Core.dueLabel(bs.daysLeft), tag: 'bill-' + b.id, data: { kind: 'bill', billId: b.id }, actions: [{ action: 'billpaid', title: 'Mark paid' }] });
                localStorage.setItem(k, '1');
            });
        }

        runExtraReminders(ctx, nowMin, todayKey);

        // Evening summary
        const eveningMin = Core.hmToMin(getSetting('eveningTime', '21:00'));
        if (eveningMin != null && nowMin >= eveningMin && nowMin < eveningMin + 5) {
            const eodKey = `hisab_eod_notif_${todayKey}`;
            if (!localStorage.getItem(eodKey)) {
                const incomplete = tasks.filter(t => (t.currentTarget ?? 1) > 0 && getTaskStatus(t, now).isDueToday && (t.type === 'daily' || t.type === 'once'));
                if (incomplete.length > 0) {
                    sendAppNotification(`🌙 ${incomplete.length} task${incomplete.length > 1 ? 's' : ''} left today`, {
                        body: incomplete.slice(0, 3).map(t => `• ${t.title}`).join('\n') + (incomplete.length > 3 ? `\n+${incomplete.length - 3} more` : ''),
                        tag: 'eod-summary'
                    });
                }
                localStorage.setItem(eodKey, '1');
            }
        }

        // Sunday weekly report at 20:00
        if (ctx.dow === 0 && nowMin >= 20 * 60 && nowMin < 20 * 60 + 5 && !localStorage.getItem('hisab_wr_notif_' + todayKey)) {
            const r = getWeeklyReport(0);
            sendAppNotification('📊 Your week in Hisab', { body: `${r.rate != null ? r.rate + '% of daily tasks done' : r.completed + ' tasks done'} · ₹${r.spent.toLocaleString()} spent${r.best ? ` · Best: ${r.best.title}` : ''}`, tag: 'weekly-report', data: { kind: 'report' } });
            localStorage.setItem('hisab_wr_notif_' + todayKey, '1');
        }
        if (changed) saveDataLocallyOnly();
    }
    if (processAutomaticPenalties()) { saveData(); render(); }
}

function notifyTask(t, st, suffix = '') {
    const left = Math.max(0, st.target - st.doneAmt);
    const anchor = t.prayerAnchor ? Core.describeAnchor(t.prayerAnchor) : '';
    const body = [st.dueLabel, st.target > 1 ? `${fmtNum(left)} left ${st.periodLabel}` : '', anchor, suffix].filter(Boolean).join(' · ') || 'Time to do this';
    sendAppNotification('⏰ ' + t.title, {
        body, tag: 'task-' + t.id, requireInteraction: true,
        data: { kind: 'task', taskId: t.id },
        actions: [{ action: 'done', title: '✓ Done' }, { action: 'snooze10', title: 'Snooze 10m' }, { action: 'snooze60', title: '1 hour' }]
    });
}


// ==========================================
// CORE APP ROUTING & UI
// ==========================================

// ==========================================
// POMODORO TIMER ENGINE
// ==========================================
let pomodoroTaskId = null;
let pomodoroInterval = null;
let pomodoroSecondsLeft = 25 * 60;
let pomodoroRunning = false;
let pomodoroPhase = 'work';
const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;
let pomodoroSessionsToday = parseInt(localStorage.getItem(`hisab_pomo_${toDateKey(Date.now())}`) || '0');


// ==========================================
// 1-TAP GOOGLE CALENDAR ALARM SYNC ENGINE
// ==========================================
function addToGoogleCalendar(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    triggerHaptic(15);

    const now = new Date();
    let hours = 9, minutes = 0;
    if (task.reminderTime && task.reminderTime.includes(':')) {
        const parts = task.reminderTime.split(':').map(Number);
        if (!isNaN(parts[0])) hours = parts[0];
        if (!isNaN(parts[1])) minutes = parts[1];
    }

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const end = new Date(start.getTime() + 30 * 60000); // 30 min duration

    const pad = (n) => String(n).padStart(2, '0');
    const formatCalDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

    let rrule = 'RRULE:FREQ=DAILY';
    if (task.activeDays && task.activeDays.length > 0) {
        const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const days = task.activeDays.map(d => dayMap[d]).join(',');
        rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
    } else if (task.type === 'weekly') {
        rrule = 'RRULE:FREQ=WEEKLY';
    } else if (task.type === 'monthly') {
        rrule = 'RRULE:FREQ=MONTHLY';
    } else if (task.type === 'once') {
        rrule = '';
    }

    const title = encodeURIComponent(`Hisab: ${task.title}`);
    const details = encodeURIComponent(`Daily Target: ${task.baseTarget} / ${task.type}\n\nAuto-synced from Hisab Life Tracker.\nOpen App: ${window.location.href}`);
    const dates = `${formatCalDate(start)}/${formatCalDate(end)}`;

    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    if (rrule) url += `&recur=${encodeURIComponent(rrule)}`;

    window.open(url, '_blank');
}

function openPomodoroTimer(taskId) {
    const task = taskId ? tasks.find(t => t.id === taskId) : (tasks.find(t => t.type === 'daily' && t.currentTarget > 0) || tasks[0]);
    pomodoroTaskId = task ? task.id : null;
    const widget = document.getElementById('pomodoro-widget');
    const nameEl = document.getElementById('pomodoro-task-name');
    if (widget) widget.classList.add('visible');
    if (nameEl) nameEl.innerText = task ? task.title : 'Deep Focus Session';
    updatePomodoroDisplay();
    const countEl = document.getElementById('pomodoro-count');
    if (countEl) countEl.innerText = pomodoroSessionsToday;
}

function closePomodoroTimer() {
    clearInterval(pomodoroInterval);
    pomodoroRunning = false;
    pomodoroTaskId = null;
    pomodoroSecondsLeft = POMODORO_WORK;
    pomodoroPhase = 'work';
    const widget = document.getElementById('pomodoro-widget');
    if (widget) widget.classList.remove('visible');
    updatePomodoroDisplay();
}

function togglePomodoroTimer() {
    if (pomodoroRunning) {
        clearInterval(pomodoroInterval);
        pomodoroRunning = false;
        const btn = document.getElementById('pomodoro-start-btn');
        if (btn) btn.innerText = '▶ Resume';
    } else {
        pomodoroRunning = true;
        const btn = document.getElementById('pomodoro-start-btn');
        if (btn) btn.innerText = '⏸ Pause';
        pomodoroInterval = setInterval(() => {
            pomodoroSecondsLeft--;
            updatePomodoroDisplay();
            if (pomodoroSecondsLeft <= 0) {
                clearInterval(pomodoroInterval);
                pomodoroRunning = false;
                if (pomodoroPhase === 'work') {
                    pomodoroSessionsToday++;
                    localStorage.setItem(`hisab_pomo_${toDateKey(Date.now())}`, pomodoroSessionsToday.toString());
                    const countEl = document.getElementById('pomodoro-count');
                    if (countEl) countEl.innerText = pomodoroSessionsToday;
                    addFocusMinutes(pomodoroTaskId, POMODORO_WORK / 60);
                    if (pomodoroTaskId) logProgress(pomodoroTaskId);
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("🍅 Pomodoro Complete!", { body: "Great work! Time for a 5-minute break.", icon: "icons/icon-192.png" });
                    }
                    if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                    pomodoroPhase = 'break';
                    pomodoroSecondsLeft = POMODORO_BREAK;
                    const phaseEl = document.getElementById('pomodoro-phase-label');
                    if (phaseEl) phaseEl.innerText = 'Break Time ☕';
                    const startBtn = document.getElementById('pomodoro-start-btn');
                    if (startBtn) startBtn.innerText = '▶ Start Break';
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                } else {
                    pomodoroPhase = 'work';
                    pomodoroSecondsLeft = POMODORO_WORK;
                    const phaseEl = document.getElementById('pomodoro-phase-label');
                    if (phaseEl) phaseEl.innerText = 'Work Session';
                    const startBtn = document.getElementById('pomodoro-start-btn');
                    if (startBtn) startBtn.innerText = '▶ Start';
                }
                updatePomodoroDisplay();
            }
        }, 1000);
    }
}

function resetPomodoroTimer() {
    clearInterval(pomodoroInterval);
    pomodoroRunning = false;
    pomodoroPhase = 'work';
    pomodoroSecondsLeft = POMODORO_WORK;
    const btn = document.getElementById('pomodoro-start-btn');
    if (btn) btn.innerText = '▶ Start';
    const phaseEl = document.getElementById('pomodoro-phase-label');
    if (phaseEl) phaseEl.innerText = 'Work Session';
    updatePomodoroDisplay();
}

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSecondsLeft / 60).toString().padStart(2, '0');
    const secs = (pomodoroSecondsLeft % 60).toString().padStart(2, '0');
    const timeEl = document.getElementById('pomodoro-time');
    if (timeEl) {
        timeEl.innerText = `${mins}:${secs}`;
        timeEl.style.color = pomodoroPhase === 'break' ? 'var(--success)' : 'var(--text-main)';
    }
}

// ==========================================
// DAILY JOURNAL ENGINE
// ==========================================
let currentJournalDateKey = toDateKey(Date.now());
let journalAutoSaveTimeout = null;

function renderJournal() {
    const textarea = document.getElementById('journal-textarea');
    const dateDisplay = document.getElementById('journal-current-date');
    const charCount = document.getElementById('journal-char-count');
    const nextBtn = document.getElementById('journal-next-btn');
    const todayKey = toDateKey(Date.now());

    if (dateDisplay) {
        const [y, m, d] = currentJournalDateKey.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateDisplay.innerText = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (nextBtn) {
        nextBtn.disabled = currentJournalDateKey >= todayKey;
        nextBtn.style.opacity = currentJournalDateKey >= todayKey ? '0.3' : '1';
    }
    const entry = journalData[currentJournalDateKey] || '';
    if (textarea) {
        textarea.value = entry;
        textarea.readOnly = currentJournalDateKey > todayKey;
    }
    if (charCount) charCount.innerText = `${entry.length} chars`;

    const recentList = document.getElementById('journal-recent-list');
    if (recentList) {
        const entries = Object.entries(journalData)
            .filter(([k, v]) => v && v.trim() && k !== currentJournalDateKey)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 5);
        if (entries.length === 0) {
            recentList.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding:16px;">No other journal entries yet. Start writing today!</p>';
        } else {
            recentList.innerHTML = entries.map(([dk, text]) => {
                const [y, m, d] = dk.split('-').map(Number);
                const dateLabel = new Date(y, m-1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                const preview = text.length > 120 ? text.slice(0, 120) + '...' : text;
                return `
                    <div class="journal-entry-card" onclick="openJournalDate('${dk}')" style="cursor:pointer;">
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px; font-weight:600;">${dateLabel}</div>
                        <div style="font-size:0.85rem; color:var(--text-main); line-height:1.5;">${preview}</div>
                    </div>
                `;
            }).join('');
        }
    }
}

function openJournalDate(dk) { currentJournalDateKey = dk; renderJournal(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
window.openJournalDate = openJournalDate;

function journalNavigateDay(direction) {
    const [y, m, d] = currentJournalDateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + direction);
    const newKey = toDateKey(dateObj);
    if (newKey > toDateKey(Date.now())) return;
    currentJournalDateKey = newKey;
    renderJournal();
}

function journalAutoSave() {
    const textarea = document.getElementById('journal-textarea');
    const statusEl = document.getElementById('journal-save-status');
    const charCount = document.getElementById('journal-char-count');
    if (!textarea) return;
    if (charCount) charCount.innerText = `${textarea.value.length} chars`;
    if (statusEl) statusEl.innerText = 'Saving…';
    clearTimeout(journalAutoSaveTimeout);
    journalAutoSaveTimeout = setTimeout(() => {
        journalData[currentJournalDateKey] = textarea.value;
        if (!textarea.value.trim()) delete journalData[currentJournalDateKey];
        saveData();
        if (document.getElementById('tab-dashboard')?.classList.contains('active')) updateDashboard();
        if (statusEl) statusEl.innerText = '✅ Saved';
        setTimeout(() => { if (statusEl) statusEl.innerText = 'Auto-saved'; }, 2000);
    }, 800);
}

// ==========================================
// SHARE PROGRESS CARD ENGINE
// ==========================================
function openShareModal() {
    openModal('share-modal');
    setTimeout(generateShareCard, 100);
}

function generateShareCard() {
    const canvas = document.getElementById('share-canvas-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const theme = document.body.getAttribute('data-theme') || 'obsidian';
    const bgColor = theme === 'ramadan' ? '#0e0a04' : '#0b0e11';
    const accentColor = theme === 'ramadan' ? '#f5c518' : '#bb86fc';
    const successColor = theme === 'ramadan' ? '#c8a951' : '#00e5a3';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 24px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('HISAB', W / 2, 46);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '12px Inter, system-ui';
    ctx.fillText('Life Tracker · Progress Card', W / 2, 66);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }), W / 2, 86);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 98);
    ctx.lineTo(W - 30, 98);
    ctx.stroke();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const dailyDone = activityHistory.filter(h => h.actionType === 'complete' && h.timestamp >= startOfDay).length;
    const weeklyDone = activityHistory.filter(h => h.actionType === 'complete' && h.timestamp >= startOfWeek).length;
    const totalDailyTasks = tasks.filter(t => t.type === 'daily').length;

    const statsData = [
        { label: '✅ Done Today', value: `${dailyDone}/${totalDailyTasks}`, color: accentColor },
        { label: '📅 This Week', value: weeklyDone.toString(), color: successColor },
        { label: '🏆 Bonus Points', value: bonusPoints.toLocaleString(), color: '#f5c518' },
        { label: '⚖️ Charity Paid', value: `₹${charityData.paid.toLocaleString()}`, color: successColor },
        { label: '📿 Swalath', value: (deenData.swalathStats?.total || 0).toLocaleString(), color: '#80cbc4' },
        { label: '📖 Hizb Read', value: (deenData.quranStats?.totalHizb || 0).toString(), color: accentColor }
    ];

    const cardW = (W - 60) / 2;
    const cardH = 72;
    const startY = 112;
    statsData.forEach((stat, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 25 + col * (cardW + 10);
        const y = startY + row * (cardH + 8);

        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 12);
        ctx.fill();

        ctx.fillStyle = stat.color;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(stat.value, x + cardW / 2, y + 36);

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '10px Inter, system-ui';
        ctx.fillText(stat.label, x + cardW / 2, y + 54);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('hisab.app · ' + new Date().toLocaleDateString(), W / 2, H - 18);
}

function downloadShareCard() {
    const canvas = document.getElementById('share-canvas-preview');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `hisab-progress-${toDateKey(Date.now())}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ==========================================
// WEEKLY GOAL REVIEW ENGINE
// ==========================================
function getWeekKey() {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return toDateKey(startOfWeek);
}

function saveWeeklyGoal() {
    const val = document.getElementById('weekly-goal-input')?.value.trim();
    if (val) weeklyGoalData[getWeekKey()] = val; else delete weeklyGoalData[getWeekKey()];
    saveData();
    closeModal('weekly-report-modal');
    updateWeeklyGoalBanner();
    if (val) showToast('Weekly focus set', '🎯');
}

function updateWeeklyGoalBanner() {
    const banner = document.getElementById('weekly-goal-banner');
    const bannerText = document.getElementById('weekly-goal-banner-text');
    const goal = weeklyGoalData[getWeekKey()];
    if (banner && bannerText) {
        if (goal) {
            bannerText.innerText = goal;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }
}

function checkWeeklyGoalPrompt() {
    const now = new Date();
    const isMonday = now.getDay() === 1;
    const weekKey = getWeekKey();
    const shownKey = `hisab_weekly_modal_${weekKey}`;
    if (isMonday && !weeklyGoalData[weekKey] && !localStorage.getItem(shownKey)) {
        localStorage.setItem(shownKey, '1');
        const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
        const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const missedLast = activityHistory.filter(h => h.actionType === 'missed' && h.timestamp >= lastWeekStart && h.timestamp < lastWeekEnd);
        const summaryEl = document.getElementById('weekly-goal-missed-summary');
        if (summaryEl) {
            summaryEl.innerHTML = missedLast.length > 0
                ? `⚠️ You missed <strong>${missedLast.length} task(s)</strong> last week. Set your focus for this week:`
                : `✅ Great job last week! Set your focus for this week:`;
        }
        setTimeout(() => openModal('weekly-goal-modal'), 1200);
    }
    updateWeeklyGoalBanner();
}

// ==========================================
// NOTIFICATIONS & NAV BADGES
// ==========================================
function openNotifSettings() {
    const timeInput = document.getElementById('evening-notif-time');
    if (timeInput) timeInput.value = getSetting('eveningTime', '21:00');
    refreshNotifButtons();
    renderAppLockSettings(); updateBackupStatusLine();
    const lbl = document.getElementById('theme-mode-label');
    if (lbl) lbl.textContent = { light: 'Light', dark: 'Dark', system: 'Auto (follows device)' }[localStorage.getItem('hisab_theme_mode') || 'system'];
    openModal('notif-settings-modal');
}

function saveEveningNotifTime() {
    const val = document.getElementById('evening-notif-time')?.value;
    if (val) {
        setSetting('eveningTime', val);
        closeModal('notif-settings-modal');
        showToast(`Evening summary set for ${val}`, '🌙');
    }
}

function updateNavBadges() {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const hasMissed = activityHistory.some(h => h.actionType === 'missed' && h.timestamp >= sevenDaysAgo && h.category === 'tasks');
    const tasksNavEl = document.getElementById('nav-tasks');
    if (tasksNavEl) {
        let dot = tasksNavEl.querySelector('.nav-badge-dot');
        if (dot) dot.style.display = hasMissed ? 'block' : 'none';
    }
    if (budgetData.limit > 0) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const monthlyTotal = budgetData.expenses.filter(e => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
        const budgetNavEl = document.getElementById('nav-budget');
        if (budgetNavEl) {
            let dot = budgetNavEl.querySelector('.nav-badge-dot');
            if (dot) {
                dot.style.background = 'var(--warning)';
                dot.style.display = monthlyTotal > budgetData.limit * 0.8 ? 'block' : 'none';
            }
        }
    }
    const dashNavEl = document.getElementById('nav-dashboard');
    if (dashNavEl) {
        let dot = dashNavEl.querySelector('.nav-badge-dot');
        if (dot) {
            dot.style.background = 'var(--charity)';
            dot.style.display = (charityData.pending > 0) ? 'block' : 'none';
        }
    }
}


// ==========================================
// MOBILE HAPTIC & PWA INSTALL ENGINE
// ==========================================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.style.display = 'none';
});


// ==========================================
// ALARM CHIME & RELIABLE NOTIFICATION ENGINE
// ==========================================
function playAlarmChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Play a gentle 3-tone melodic chime (C5 -> E5 -> G5)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.16);
            gain.gain.setValueAtTime(0.3, now + idx * 0.16);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.16);
            osc.stop(now + idx * 0.16 + 0.5);
        });
    } catch (e) {
        console.warn("Alarm audio chime:", e);
    }
}

async function sendAppNotification(title, options = {}) {
    playAlarmChime();
    if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
    }
    const defaultOptions = {
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-96.png',
        vibrate: [200, 100, 200, 100, 400],
        requireInteraction: true,
        ...options
    };
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                return reg.showNotification(title, defaultOptions);
            }
        } catch (e) {
            console.warn("SW showNotification error:", e);
        }
    }
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, defaultOptions);
    }
}

function promptPWAInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                const installBtn = document.getElementById('btn-install-pwa');
                if (installBtn) installBtn.style.display = 'none';
            }
            deferredPrompt = null;
        });
    } else {
        alert("To install this app on your phone:\n• On Chrome: Tap the 3 dots (⋮) > Add to Home screen / Install app.\n• On Safari: Tap Share (📤) > Add to Home Screen.");
    }
}

function triggerHaptic(ms = 12) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

function switchTab(tabName, element, fromPopState = false) {
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (!targetTab) return;

    // 1. ALWAYS close the drawer and quick action sheet immediately on tab navigation
    closeNavDrawer();
    closeQuickActionSheet();

    triggerHaptic(10);
    if (tabName !== 'compact') localStorage.setItem('hisab_active_tab', tabName);

    // 2. Manage history stack so mobile back gestures work reliably
    if (window.history && window.history.pushState && !fromPopState) {
        if (window.location.hash !== '#' + tabName) {
            history.pushState({ tab: tabName }, '', '#' + tabName);
        }
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); 
    document.querySelectorAll('.nav-hub-item').forEach(item => item.classList.remove('active'));
    const hubItem = document.getElementById(`nav-hub-${tabName}`);
    if (hubItem) hubItem.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active', 'active-bad', 'active-deen', 'active-budget', 'active-backlog');
    });

    targetTab.classList.add('active');
    const navEl = element || document.getElementById(`nav-${tabName}`);
    
    if (tabName === 'deen') { if (navEl) navEl.classList.add('active-deen'); renderDeen(); } 
    else if (tabName === 'bad-habits') { if (navEl) navEl.classList.add('active-bad'); renderHabits(); }
    else if (tabName === 'budget') { if (navEl) navEl.classList.add('active-budget'); renderBudget(); }
    else if (tabName === 'backlog') { if (navEl) navEl.classList.add('active-backlog'); renderBacklog(); }
    else { if (navEl) navEl.classList.add('active'); }
    
    // Update active highlight in the drawer
    document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));
    const drawerItem = document.getElementById(`drawer-nav-${tabName}`);
    if (drawerItem) drawerItem.classList.add('active');

    const ac = document.getElementById('auth-container');
    if (ac && ac.dataset.ready) ac.style.display = tabName === 'dashboard' ? 'flex' : 'none';
    const lp = document.getElementById('login-prompt');
    if (lp && !currentUser) lp.style.display = tabName === 'dashboard' ? 'flex' : 'none';
    if (tabName === 'tasks') renderTasks();
    if (tabName === 'compact') renderCompact();
    if (tabName === 'dashboard') { updateDashboard(); renderBackupNudge(); }
    if (tabName === 'journal') { currentJournalDateKey = toDateKey(Date.now()); renderJournal(); }

    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchTab = switchTab;
window.fullSwitchTab = switchTab;

function refreshNotifButtons() {
    const btn = document.getElementById('btn-notifications');
    const push = document.getElementById('btn-enable-push');
    const supported = 'Notification' in window;
    const granted = supported && Notification.permission === 'granted';
    if (btn) btn.classList.toggle('enabled', granted);
    if (push) {
        push.disabled = !supported || Notification.permission === 'denied' || (granted && (localStorage.getItem('hisab_push_active') === '1' || !pushConfigured() || !currentUser));
        push.innerHTML = !supported ? 'Not supported on this browser'
            : granted ? (localStorage.getItem('hisab_push_active') === '1' ? `${svgIcon('check', 'icon icon-sm')}On · works when app is closed` : (pushConfigured() && currentUser ? `${svgIcon('bell', 'icon icon-sm')}Turn on background reminders` : `${svgIcon('check', 'icon icon-sm')}On · while Hisab is open`))
            : Notification.permission === 'denied' ? 'Blocked — allow in browser settings'
            : `${svgIcon('bell', 'icon icon-sm')}Enable notifications`;
    }
}
function initNotifications() { refreshNotifButtons(); }
function toggleNotifications() {
    if (!('Notification' in window)) return showToast('Notifications are not supported here', '⚠️');
    if (Notification.permission === 'granted') { refreshNotifButtons(); registerPushToken(false); return; }
    Notification.requestPermission().then(p => {
        refreshNotifButtons();
        if (p === 'granted') {
            showToast('Reminders enabled', '🔔');
            sendAppNotification('Hisab reminders are on', { body: 'You will be notified at each task\'s reminder time.' });
            registerPushToken(true);
        }
    });
}
function openModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function closeModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function render() { renderTasks(); renderHabits(); renderDeen(); renderBudget(); renderBacklog(); if (document.getElementById('tab-dashboard')?.classList.contains('active')) updateDashboard(); else renderTodayAgenda(); updateNavBadges(); renderDeenExtras(); renderSavingsGoal(); renderBackupNudge(); if (document.getElementById('tab-compact')?.classList.contains('active')) renderCompact(); }

// Exports
window.deductFromSurplus = deductFromSurplus; window.openModal = openModal; window.closeModal = closeModal;

// ==========================================
// TOAST NOTIFICATION HELPER
// ==========================================
function showToast(msg, icon = '✨') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(msg)}</span>`;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-140px)';
    }, 3200);
}

// ==========================================
// OPTION 1: NATIVE WEB SHARE TARGET HANDLER
// ==========================================
function handleIncomingShare() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareTitle = urlParams.get('share_title') || urlParams.get('title') || '';
    const shareText = urlParams.get('share_text') || urlParams.get('text') || '';
    const shareUrl = urlParams.get('share_url') || urlParams.get('url') || '';

    if (!shareTitle && !shareText && !shareUrl) return;

    let targetUrl = shareUrl;
    if (!targetUrl) {
        const urlMatch = shareText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) targetUrl = urlMatch[1];
    }

    if (!targetUrl && !shareTitle && !shareText) return;

    // Check for YouTube video / shorts
    const ytMatch = targetUrl ? targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/) : null;
    let cleanTitle = shareTitle || shareText || 'Shared Item';
    if (targetUrl) {
        cleanTitle = cleanTitle.replace(targetUrl, '').trim();
    }
    // Clean YouTube app share text wrapper
    cleanTitle = cleanTitle.replace(/^Watch\s*["“]?/i, '').replace(/["”]?\s*on\s*YouTube$/i, '').trim();
    if (!cleanTitle && ytMatch) cleanTitle = 'YouTube Video';

    let finalLink = targetUrl || '';
    let coverUrl = '';
    const vidId = ytMatch ? ytMatch[1] : null;

    if (vidId) {
        finalLink = `https://www.youtube.com/watch?v=${vidId}`;
        coverUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
    }

    const newItem = {
        id: Date.now().toString(),
        title: cleanTitle || 'Shared Video',
        link: finalLink,
        imageUrl: coverUrl,
        type: ytMatch ? 'video' : 'article',
        notes: 'Saved via YouTube Share to Hisab',
        addedAt: Date.now(),
        completed: false
    };

    // Check duplicate by canonical link or video ID
    const exists = finalLink && backlogData.some(b => b.link === finalLink || (vidId && b.link && b.link.includes(vidId)));
    if (!exists) {
        backlogData.unshift(newItem);
        localStorage.setItem('hisab_backlog', JSON.stringify(backlogData));
        
        let newLog = { 
            id: Date.now().toString(), 
            taskId: 'backlog-' + Date.now(), 
            category: 'backlog', 
            taskType: newItem.type, 
            timestamp: Date.now(), 
            title: newItem.title, 
            actionType: 'add_backlog', 
            amount: 1 
        };
        activityHistory.push(newLog);
        syncToGoogleSheets(newLog);
        saveData();

        // If title is generic or missing, fetch real YouTube title in background
        if (vidId && (!cleanTitle || cleanTitle === 'YouTube Video')) {
            fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vidId}`)
                .then(r => r.json())
                .then(d => {
                    if (d && d.title) {
                        newItem.title = d.title;
                        const idx = backlogData.findIndex(b => b.id === newItem.id);
                        if (idx !== -1) {
                            backlogData[idx].title = d.title;
                            saveDataLocallyOnly();
                            renderBacklog();
                        }
                    }
                }).catch(() => {});
        }
    }

    // Switch to Saved tab immediately
    localStorage.setItem('hisab_active_tab', 'backlog');
    const backlogNav = document.getElementById('nav-backlog');
    switchTab('backlog', backlogNav);
    renderBacklog();
    triggerHaptic(50);

    // Re-assert Saved tab after initial cloud sync arrives to avoid being overwritten
    setTimeout(() => {
        const navEl = document.getElementById('nav-backlog');
        switchTab('backlog', navEl);
        renderBacklog();
    }, 600);

    setTimeout(() => {
        showToast(exists ? `Already in Library: "${cleanTitle}"` : `Saved to Library: "${cleanTitle}"`, exists ? 'ℹ️' : '🎬');
    }, 400);

    // Clean URL query params so browser reload doesn't re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ==========================================
// OPTION 2: YOUTUBE PLAYLIST SYNC ENGINE
// ==========================================
function openYouTubePlaylistModal() {
    const savedPlaylist = localStorage.getItem('hisab_yt_playlist') || '';
    const savedKey = localStorage.getItem('hisab_yt_api_key') || '';
    const input = document.getElementById('yt-playlist-input');
    const keyInput = document.getElementById('yt-api-key-input');
    if (input) input.value = savedPlaylist;
    if (keyInput) keyInput.value = savedKey;
    const status = document.getElementById('yt-sync-status');
    if (status) status.innerHTML = '';
    openModal('yt-playlist-modal');
}

function saveYouTubePlaylistConfig() {
    const input = document.getElementById('yt-playlist-input');
    const keyInput = document.getElementById('yt-api-key-input');
    if (!input) return;
    const val = input.value.trim();
    const keyVal = keyInput ? keyInput.value.trim() : '';
    setSetting('ytPlaylist', val);
    localStorage.setItem('hisab_yt_api_key', keyVal);
    const status = document.getElementById('yt-sync-status');
    if (status) status.innerHTML = `<span style="color:var(--success);">✅ Settings saved!</span>`;
    triggerHaptic(20);
}

async function syncYouTubePlaylist() {
    const input = document.getElementById('yt-playlist-input');
    const keyInput = document.getElementById('yt-api-key-input');
    let playlistVal = (input ? input.value.trim() : '') || localStorage.getItem('hisab_yt_playlist') || '';
    const apiKey = (keyInput ? keyInput.value.trim() : '') || localStorage.getItem('hisab_yt_api_key') || '';
    const status = document.getElementById('yt-sync-status');
    const syncBtn = document.getElementById('btn-sync-yt-now');

    if (!playlistVal) {
        openYouTubePlaylistModal();
        if (status) status.innerHTML = `<span style="color:var(--danger);">⚠️ Please enter your Playlist link or ID first!</span>`;
        return;
    }

    localStorage.setItem('hisab_yt_playlist', playlistVal);
    if (apiKey) localStorage.setItem('hisab_yt_api_key', apiKey);

    // Extract playlist ID if full URL passed
    let playlistId = playlistVal;
    const listMatch = playlistVal.match(/[?&]list=([^#&?]+)/);
    if (listMatch) playlistId = listMatch[1];

    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerText = '⏳ Syncing...';
    }
    if (status) status.innerHTML = `<span style="color:var(--text-muted);">Fetching videos from YouTube...</span>`;

    try {
        let videos = [];

        // Strategy 1: Google API Key provided
        if (apiKey) {
            const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(apiKey)}`;
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`YouTube API error (${res.status})`);
            const data = await res.json();
            if (data.items) {
                videos = data.items.map(item => {
                    const snippet = item.snippet || {};
                    const vidId = snippet.resourceId ? snippet.resourceId.videoId : null;
                    return {
                        id: vidId,
                        title: snippet.title || 'YouTube Video',
                        link: vidId ? `https://www.youtube.com/watch?v=${vidId}` : '',
                        imageUrl: vidId ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` : ''
                    };
                }).filter(v => v.id && v.link);
            }
        } else {
            // Strategy 2: Call Vercel serverless function /api/youtube-sync
            const apiEndpoint = `/api/youtube-sync?playlistId=${encodeURIComponent(playlistId)}`;
            const res = await fetch(apiEndpoint);
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || `Failed to fetch playlist (${res.status})`);
            }
            videos = data.videos || [];
        }

        if (!videos || videos.length === 0) {
            if (status) status.innerHTML = `<span style="color:var(--warning);">No videos found in this playlist. Ensure it's Public or Unlisted.</span>`;
            return;
        }

        // Merge new videos into backlogData without duplicates
        let addedCount = 0;
        videos.forEach(v => {
            const alreadyExists = backlogData.some(b => b.link === v.link || (b.title === v.title && b.type === 'video'));
            if (!alreadyExists) {
                backlogData.unshift({
                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
                    title: v.title,
                    link: v.link,
                    imageUrl: v.imageUrl,
                    type: 'video',
                    notes: 'Synced from YouTube Playlist',
                    addedAt: Date.now(),
                    completed: false
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            saveData();
            renderBacklog();
            triggerHaptic(40);
            showToast(`Added ${addedCount} new YouTube video(s)!`, '🎉');
            if (status) status.innerHTML = `<span style="color:var(--success); font-weight:700;">🎉 Added ${addedCount} new video(s)!</span>`;
            setTimeout(() => closeModal('yt-playlist-modal'), 1200);
        } else {
            showToast('Library is up to date! (No new videos)', '✅');
            if (status) status.innerHTML = `<span style="color:var(--success);">✅ Playlist is up to date! (No new videos)</span>`;
        }
    } catch (err) {
        console.error('Playlist sync failed:', err);
        if (status) status.innerHTML = `<span style="color:var(--danger);">❌ Error: ${err.message || 'Sync failed'}</span>`;
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerText = '🔄 Sync Now';
        }
    }
}

window.openNavDrawer = openNavDrawer;
window.closeNavDrawer = closeNavDrawer;
window.toggleAnalyticsView = toggleAnalyticsView;
window.showToast = showToast;
window.handleIncomingShare = handleIncomingShare;
window.openYouTubePlaylistModal = openYouTubePlaylistModal;
window.saveYouTubePlaylistConfig = saveYouTubePlaylistConfig;
window.syncYouTubePlaylist = syncYouTubePlaylist;
window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.manualCloudSync = manualCloudSync; window.switchTab = switchTab;
window.fullSwitchTab = switchTab; 
window.saveTask = saveTask; window.editTask = editTask; window.cancelEdit = cancelEdit; window.deleteTask = deleteTask; window.logProgress = logProgress; window.markMissed = markMissed;
window.openTask30DayModal = openTask30DayModal; window.fulfillMissedTaskDay = fulfillMissedTaskDay; window.undoTaskDayLogs = undoTaskDayLogs; window.markTaskMissedOnDate = markTaskMissedOnDate;
window.openHabit30DayModal = openHabit30DayModal; window.logHabitOnDate = logHabitOnDate; window.undoHabitDayLog = undoHabitDayLog;
window.undoAction = undoAction; window.openHistory = openHistory; window.closeHistory = closeHistory; window.filterHistory = filterHistory;
window.exportDataBackup = exportDataBackup; window.importDataBackup = importDataBackup;
window.payDonation = payDonation; 
window.addGoodHabit = addGoodHabit; window.editGoodHabit = editGoodHabit; window.cancelEditGoodHabit = cancelEditGoodHabit; window.logGoodHabit = logGoodHabit; window.deleteGoodHabit = deleteGoodHabit; 
window.addBadHabit = addBadHabit; window.editBadHabit = editBadHabit; window.cancelEditBadHabit = cancelEditBadHabit; window.logBadHabit = logBadHabit; window.deleteBadHabit = deleteBadHabit;
window.logSwalathDirect = logSwalathDirect; window.logHizbDirect = logHizbDirect;
window.addDhikr = addDhikr; window.logDhikr = logDhikr; window.deleteDhikr = deleteDhikr; window.addJuzIntention = addJuzIntention; window.completeJuz = completeJuz; window.editJuz = editJuz; window.deleteJuz = deleteJuz; window.updateQada = updateQada; window.calculateZakat = calculateZakat;
window.setBudgetLimit = setBudgetLimit; window.addExpense = addExpense; window.deleteExpense = deleteExpense; window.addDebt = addDebt; window.deleteDebt = deleteDebt; window.repayDebt = repayDebt; window.pickContact = pickContact;
window.addBacklogItem = addBacklogItem; window.editBacklogItem = editBacklogItem; window.cancelEditBacklogItem = cancelEditBacklogItem; window.toggleBacklogStatus = toggleBacklogStatus; window.deleteBacklogItem = deleteBacklogItem; window.renderBacklog = renderBacklog; window.renderTasks = renderTasks; window.toggleNotifications = toggleNotifications; window.autoFetchThumbnail = autoFetchThumbnail;
window.showConfirmSheet = showConfirmSheet; window.closeConfirmSheet = closeConfirmSheet;
window.toggleTaskTag = toggleTaskTag; window.resetTagSelector = resetTagSelector; window.renderTaskTags = renderTaskTags;
window.toggleActiveDaysSelector = toggleActiveDaysSelector; window.getActiveDays = getActiveDays; window.setActiveDays = setActiveDays;
window.archiveTask = archiveTask; window.unarchiveTask = unarchiveTask; window.openArchive = openArchive;
window.computeHabitStreak = computeHabitStreak;
window.renderHeatmap = renderHeatmap; window.createProgressRing = createProgressRing;
window.loadPrayerTimes = loadPrayerTimes; window.renderPrayerTimes = renderPrayerTimes;
window.addToGoogleCalendar = addToGoogleCalendar;
window.openPomodoroTimer = openPomodoroTimer; window.closePomodoroTimer = closePomodoroTimer; window.togglePomodoroTimer = togglePomodoroTimer; window.resetPomodoroTimer = resetPomodoroTimer;
window.renderJournal = renderJournal; window.journalNavigateDay = journalNavigateDay; window.journalAutoSave = journalAutoSave;
window.openShareModal = openShareModal; window.generateShareCard = generateShareCard; window.downloadShareCard = downloadShareCard;
window.saveWeeklyGoal = saveWeeklyGoal; window.updateWeeklyGoalBanner = updateWeeklyGoalBanner; window.checkWeeklyGoalPrompt = checkWeeklyGoalPrompt;
window.openNotifSettings = openNotifSettings; window.saveEveningNotifTime = saveEveningNotifTime; window.updateNavBadges = updateNavBadges;
window.promptPWAInstall = promptPWAInstall;
window.triggerHaptic = triggerHaptic;
window.sendAppNotification = sendAppNotification;
window.playAlarmChime = playAlarmChime;

// =====================================================================
// v2.1 FEATURES: settings sync · prayer anchors · background push ·
// snooze · quick add · checklists · bills · category limits · weekly report
// (state below uses `var` so it is ready before the first render)
// =====================================================================

// ---------- Settings that follow you across devices ----------
var SETTING_KEYS = { themeMode: 'hisab_theme_mode', eveningTime: 'hisab_evening_notif_time', ytPlaylist: 'hisab_yt_playlist' };
function getSetting(name, fallback = '') { return localStorage.getItem(SETTING_KEYS[name]) || fallback; }
function setSetting(name, value) {
    localStorage.setItem(SETTING_KEYS[name], value);
    localStorage.setItem('hisab_settings_updated', String(Date.now()));
    saveData();
}
function collectSettings() {
    const out = { updatedAt: Number(localStorage.getItem('hisab_settings_updated') || 0) };
    for (const [k, ls] of Object.entries(SETTING_KEYS)) { const v = localStorage.getItem(ls); if (v) out[k] = v; }
    return out;
}
function applyCloudSettings(st) {
    if (!st || !st.updatedAt) return;
    const local = Number(localStorage.getItem('hisab_settings_updated') || 0);
    if (st.updatedAt <= local) return;
    for (const [k, ls] of Object.entries(SETTING_KEYS)) if (st[k]) localStorage.setItem(ls, st[k]);
    localStorage.setItem('hisab_settings_updated', String(st.updatedAt));
    if (st.themeMode && typeof window.applyThemeMode === 'function') window.applyThemeMode(st.themeMode);
}
function setThemeMode(mode) { window.applyThemeMode(mode); setSetting('themeMode', mode); }
window.setThemeMode = setThemeMode;
window.getSetting = getSetting;

// ---------- Prayer times (cached daily, refreshed silently from saved location) ----------
function getTodayPrayerTimings() {
    const c = JSON.parse(localStorage.getItem('hisab_prayer_times') || 'null');
    return (c && c.date === toDateKey(Date.now())) ? c.timings : null;
}
async function ensurePrayerTimes(force = false) {
    if (!force && getTodayPrayerTimings()) return getTodayPrayerTimings();
    const loc = deenData.location;
    if (!loc || loc.lat == null) return null;
    try {
        const d = new Date();
        const dd = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        const resp = await fetch(`https://api.aladhan.com/v1/timings/${dd}?latitude=${loc.lat}&longitude=${loc.lng}&method=${loc.method || 2}`);
        const data = await resp.json();
        if (data.code === 200) {
            prayerTimesData = data.data.timings;
            localStorage.setItem('hisab_prayer_times', JSON.stringify({ timings: prayerTimesData, date: toDateKey(Date.now()) }));
            if (document.getElementById('tab-deen')?.classList.contains('active')) renderPrayerTimes();
            return prayerTimesData;
        }
    } catch (e) { /* offline */ }
    return null;
}
window.ensurePrayerTimes = ensurePrayerTimes;

function effectiveReminderLabel(task) {
    if (task.prayerAnchor && task.prayerAnchor.prayer) {
        const m = Core.reminderMinute(task, getTodayPrayerTimings());
        return `${Core.describeAnchor(task.prayerAnchor)}${m != null ? ' · ' + Core.minToHm(m) : ''}`;
    }
    return task.reminderTime || '';
}

function onReminderPrayerChange() {
    const sel = document.getElementById('task-reminder-prayer');
    const time = document.getElementById('task-reminder-time');
    const off = document.getElementById('task-prayer-offset-wrap');
    const anchored = sel && sel.value;
    if (time) { time.disabled = !!anchored; time.style.opacity = anchored ? .5 : 1; }
    if (off) off.style.display = anchored ? 'block' : 'none';
    if (anchored && !deenData.location) {
        const hint = document.getElementById('task-prayer-hint');
        if (hint) hint.innerHTML = 'Set your location once in <b>Deen → Prayer times</b> so Hisab knows the times.';
    } else {
        const hint = document.getElementById('task-prayer-hint'); if (hint) hint.innerHTML = '';
    }
}
window.onReminderPrayerChange = onReminderPrayerChange;
function readPrayerAnchorFromForm() {
    const v = document.getElementById('task-reminder-prayer')?.value || '';
    if (!v) return null;
    const [dir, prayer] = v.split(':');
    const mins = Math.abs(parseInt(document.getElementById('task-prayer-offset')?.value || '0', 10) || 0);
    return { prayer, offset: dir === 'before' ? -mins : mins };
}
function writePrayerAnchorToForm(anchor) {
    const sel = document.getElementById('task-reminder-prayer');
    const off = document.getElementById('task-prayer-offset');
    if (sel) sel.value = anchor ? `${anchor.offset < 0 ? 'before' : 'after'}:${anchor.prayer}` : '';
    if (off) off.value = anchor ? Math.abs(anchor.offset || 0) : 10;
    onReminderPrayerChange();
}

// ---------- Background push (Firebase Cloud Messaging) ----------
function pushConfigured() { return !!(FCM_VAPID_KEY && firebaseConfig.messagingSenderId && firebaseConfig.appId); }
async function registerPushToken(silent = true) {
    if (!pushConfigured()) { if (!silent) showToast('Background push is not configured yet (see setup guide)', 'ℹ️'); return false; }
    if (!currentUser) { if (!silent) showToast('Sign in first to get reminders when the app is closed', '🔐'); return false; }
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
        const { getMessaging, getToken, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js");
        if (!(await isSupported())) { if (!silent) showToast('This browser does not support background push', '⚠️'); return false; }
        const reg = await navigator.serviceWorker.ready;
        const token = await getToken(getMessaging(app), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
        if (!token) return false;
        await setDoc(doc(db, 'pushTokens', currentUser.uid), {
            tokens: { [token.slice(-40)]: { token, ua: navigator.userAgent.slice(0, 120), updatedAt: Date.now() } },
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
            updatedAt: Date.now()
        }, { merge: true });
        localStorage.setItem('hisab_push_active', '1');
        refreshNotifButtons();
        if (!silent) showToast('Reminders will arrive even when Hisab is closed', '🔔');
        return true;
    } catch (e) {
        console.warn('Push registration failed', e);
        localStorage.removeItem('hisab_push_active');
        if (!silent) showToast('Could not enable background push: ' + (e.message || e), '⚠️');
        return false;
    }
}
window.registerPushToken = registerPushToken;

// ---------- Snooze & notification actions ----------
function snoozeTask(id, minutes) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    let until;
    if (minutes === 'tomorrow') {
        const d = new Date(); d.setDate(d.getDate() + 1);
        const m = Core.reminderMinute(t, getTodayPrayerTimings()) ?? 9 * 60;
        d.setHours(Math.floor(m / 60), m % 60, 0, 0); until = d.getTime();
    } else until = Date.now() + Number(minutes) * 60000;
    t.snoozedUntil = until; t.snoozeFired = null;
    saveData(); render();
    showToast(`Snoozed until ${new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${minutes === 'tomorrow' ? ' tomorrow' : ''}`, '😴');
}
window.snoozeTask = snoozeTask;

function handleNotifAction(msg) {
    if (!msg) return;
    const { action, taskId, billId } = msg;
    if (taskId && action === 'done') { quickCompleteTask(taskId); switchTab('dashboard'); }
    else if (taskId && action === 'snooze10') snoozeTask(taskId, 10);
    else if (taskId && action === 'snooze60') snoozeTask(taskId, 60);
    else if (billId && action === 'billpaid') markBillPaid(billId);
    else if (msg.kind === 'report') openWeeklyReport(0);
    else if (taskId) { switchTab('tasks'); setTimeout(() => toggleTaskSlider(taskId), 200); }
}
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'hisab-notif') handleNotifAction(e.data); });
}
(function handleLaunchAction() {
    const q = new URLSearchParams(location.search);
    if (!q.get('na')) return;
    const msg = { action: q.get('na'), taskId: q.get('task') || null, billId: q.get('bill') || null, kind: q.get('kind') || null };
    history.replaceState({ tab: 'dashboard' }, '', location.pathname + '#dashboard');
    setTimeout(() => handleNotifAction(msg), 900);
})();

// ---------- Quick add ----------
function quickAddPreview(inputEl) {
    const prev = document.getElementById(inputEl.dataset.preview);
    if (!prev) return;
    const v = inputEl.value.trim();
    if (!v) { prev.innerHTML = ''; return; }
    const ctx = Core.ctxFromLocalDate();
    const p = Core.parseQuickAdd(v, ctx);
    prev.innerHTML = p.title
        ? `<span class="qa-title">${escapeHTML(p.title)}</span>` + Core.describeParsed(p, ctx).map(b => `<span class="qa-chip">${escapeHTML(b)}</span>`).join('')
        : '';
}
function quickAddKey(e, inputEl) {
    if (e.key === 'Enter') { e.preventDefault(); quickAddSubmit(inputEl.id); }
    if (e.key === 'Escape') { inputEl.value = ''; quickAddPreview(inputEl); }
}
function quickAddSubmit(inputId, openForm = false) {
    const el = document.getElementById(inputId); if (!el) return;
    const raw = el.value.trim();
    if (!raw) { el.focus(); return; }
    const p = Core.parseQuickAdd(raw, Core.ctxFromLocalDate());
    if (!p.title) { showToast('Add a task name', '✏️'); return; }
    if (openForm) {
        cancelEdit();
        document.getElementById('task-title').value = p.title;
        document.getElementById('task-type').value = p.activeDays ? 'daily-custom' : p.type;
        toggleActiveDaysSelector(); setActiveDays(p.activeDays || []);
        document.getElementById('task-base-target').value = p.baseTarget > 1 ? p.baseTarget : '';
        document.getElementById('task-due-date').value = p.dueDate || '';
        document.getElementById('task-reminder-time').value = p.reminderTime || '';
        document.getElementById('task-donation').value = p.donationPenalty || '';
        writePrayerAnchorToForm(p.prayerAnchor);
        resetTagSelector(p.tags);
        openModal('task-modal');
    } else {
        createTaskFromFields({ ...p, title: p.title });
        showToast(`Added: ${p.title}`, '✅');
    }
    el.value = ''; quickAddPreview(el);
}
function createTaskFromFields(f) {
    const creationTime = Date.now();
    const type = f.type || 'once';
    const baseTarget = f.baseTarget || 1;
    const totalYearlyTarget = getPeriodsLeft(type, creationTime) * baseTarget;
    tasks.push({
        id: creationTime.toString(), createdAt: creationTime, title: f.title, type,
        activeDays: f.activeDays && f.activeDays.length ? f.activeDays : null,
        dueDate: type === 'once' ? (f.dueDate || '') : '', tags: f.tags || [],
        baseTarget, totalYearlyTarget, currentTarget: totalYearlyTarget,
        reminderTime: f.prayerAnchor ? '' : (f.reminderTime || ''), prayerAnchor: f.prayerAnchor || null,
        donationPenalty: f.donationPenalty || 0, isMaxOnceDaily: false, missedCount: 0,
        sortOrder: tasks.filter(t => t.type === type).length, subtasks: [],
        penaltyCheckDate: new Date().toDateString(), lastEvaluatedDateKey: toDateKey(Date.now() - 86400000),
        isCompleted: false, legacyMigrated: true
    });
    if (f.prayerAnchor) ensurePrayerTimes();
    saveData(); render();
}
Object.assign(window, { quickAddPreview, quickAddKey, quickAddSubmit, handleNotifAction });

// ---------- Checklists (subtasks) ----------
function subtaskPeriodKey(task) { return Core.periodKey(task, Core.ctxFromLocalDate()); }
function subtaskState(task) {
    const list = task.subtasks || [];
    const pk = subtaskPeriodKey(task);
    const done = list.filter(s => s.doneKey === pk).length;
    return { list, pk, done, total: list.length };
}
function renderSubtasksHtml(task) {
    const { list, pk, done, total } = subtaskState(task);
    const items = list.map(s => `
        <div class="subtask ${s.doneKey === pk ? 'done' : ''}">
            <input type="checkbox" ${s.doneKey === pk ? 'checked' : ''} onchange="toggleSubtask('${task.id}', '${s.id}')" aria-label="Toggle">
            <span class="st-text">${escapeHTML(s.t)}</span>
            <button class="btn-icon st-del" onclick="deleteSubtask('${task.id}', '${s.id}')" aria-label="Remove">${svgIcon('x', 'icon icon-sm')}</button>
        </div>`).join('');
    return `<div class="tray-label">Checklist${total ? ` · ${done}/${total}${task.type !== 'once' ? ' ' + ({ daily: 'today', weekly: 'this week', monthly: 'this month' }[task.type] || '') : ''}` : ''}</div>
        <div class="subtasks">${items}
            <div class="subtask add"><input type="text" id="st-new-${task.id}" placeholder="Add a step and press Enter" onkeydown="if(event.key==='Enter'){event.preventDefault(); addSubtask('${task.id}')}"></div>
        </div>`;
}
function addSubtask(taskId) {
    const t = tasks.find(x => x.id === taskId); const el = document.getElementById(`st-new-${taskId}`);
    if (!t || !el || !el.value.trim()) return;
    t.subtasks = t.subtasks || [];
    t.subtasks.push({ id: Date.now().toString(36), t: el.value.trim(), doneKey: '' });
    saveData(); renderTasks(); reopenTray(taskId); setTimeout(() => document.getElementById(`st-new-${taskId}`)?.focus(), 30);
}
function toggleSubtask(taskId, sid) {
    const t = tasks.find(x => x.id === taskId); if (!t) return;
    const s = (t.subtasks || []).find(x => x.id === sid); if (!s) return;
    const pk = subtaskPeriodKey(t);
    s.doneKey = s.doneKey === pk ? '' : pk;
    const st = subtaskState(t);
    saveData();
    if (st.total > 0 && st.done === st.total && !getTaskStatus(t).isDone) {
        quickCompleteTask(taskId);  // finishing the checklist completes the task
    } else { renderTasks(); renderTodayAgenda(); reopenTray(taskId); }
}
function deleteSubtask(taskId, sid) {
    const t = tasks.find(x => x.id === taskId); if (!t) return;
    t.subtasks = (t.subtasks || []).filter(x => x.id !== sid);
    saveData(); renderTasks(); reopenTray(taskId);
}
function reopenTray(taskId) { document.getElementById('task-card-' + taskId)?.classList.add('slider-open'); }
Object.assign(window, { addSubtask, toggleSubtask, deleteSubtask });

// ---------- Recurring bills ----------
var BILL_CATS = { food: 'Food & dining', transport: 'Transport', shopping: 'Shopping', bills: 'Bills & utilities', health: 'Health', education: 'Education', entertainment: 'Entertainment', other: 'Other' };
function openBillModal(id = null) {
    const b = id ? (budgetData.bills || []).find(x => x.id === id) : null;
    document.getElementById('bill-id').value = b ? b.id : '';
    document.getElementById('bill-name').value = b ? b.name : '';
    document.getElementById('bill-amount').value = b ? b.amount : '';
    document.getElementById('bill-day').value = b ? b.dueDay : '';
    document.getElementById('bill-category').value = b ? (b.category || 'bills') : 'bills';
    document.getElementById('bill-remind').value = b ? (b.remindBefore ?? 2) : 2;
    document.getElementById('bill-modal-title').innerText = b ? 'Edit bill' : 'New recurring bill';
    openModal('bill-modal');
}
function saveBill() {
    const id = document.getElementById('bill-id').value;
    const name = document.getElementById('bill-name').value.trim();
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const dueDay = parseInt(document.getElementById('bill-day').value, 10);
    const category = document.getElementById('bill-category').value;
    const remindBefore = Math.max(0, parseInt(document.getElementById('bill-remind').value, 10) || 0);
    if (!name || !(amount > 0) || !(dueDay >= 1 && dueDay <= 31)) { showToast('Enter a name, amount and due day (1–31)', '✏️'); return; }
    budgetData.bills = budgetData.bills || [];
    if (id) Object.assign(budgetData.bills.find(b => b.id === id) || {}, { name, amount, dueDay, category, remindBefore });
    else budgetData.bills.push({ id: Date.now().toString(), name, amount, dueDay, category, remindBefore, paid: {}, startKey: toDateKey(Date.now()) });
    closeModal('bill-modal'); saveData(); renderBudget(); renderTodayAgenda();
    showToast(id ? 'Bill updated' : 'Bill added', '💳');
}
function deleteBill(id) {
    showConfirmSheet('Delete this recurring bill? Past payments stay in your expenses.', { title: 'Delete bill', icon: '🗑️', okText: 'Delete', danger: true }).then(ok => {
        if (!ok) return;
        budgetData.bills = (budgetData.bills || []).filter(b => b.id !== id);
        saveData(); renderBudget(); renderTodayAgenda();
    });
}
function markBillPaid(id) {
    const b = (budgetData.bills || []).find(x => x.id === id); if (!b) return;
    const bs = Core.billStatus(b, Core.ctxFromLocalDate());
    if (bs.paid) return;
    const expenseId = Date.now().toString();
    budgetData.expenses.push({ id: expenseId, desc: b.name, amount: Number(b.amount), category: b.category || 'bills', date: Date.now(), billId: b.id });
    b.paid = b.paid || {}; b.paid[bs.monthKey] = expenseId;
    const log = { id: (Date.now() + 1).toString(), expenseId, taskId: 'bill-' + b.id, category: 'budget', timestamp: Date.now(), title: 'Bill paid: ' + b.name, actionType: 'expense', amount: Number(b.amount) };
    activityHistory.push(log); syncToGoogleSheets(log);
    saveData(); renderBudget(); renderTodayAgenda(); updateDashboard();
    showToast(`${b.name} marked paid · ₹${Number(b.amount).toLocaleString()} logged`, '✅');
    checkCategoryWarning(b.category || 'bills');
}
function undoBillPaid(id, monthKey) {
    const b = (budgetData.bills || []).find(x => x.id === id); if (!b || !b.paid || !b.paid[monthKey]) return;
    const expId = b.paid[monthKey];
    budgetData.expenses = budgetData.expenses.filter(e => e.id !== expId);
    activityHistory.filter(h => h.expenseId === expId).forEach(h => markDeleted(h.id));
    activityHistory = activityHistory.filter(h => h.expenseId !== expId);
    delete b.paid[monthKey];
    saveData(); renderBudget(); renderTodayAgenda();
}
function renderBills() {
    const box = document.getElementById('bills-list'); if (!box) return;
    const bills = budgetData.bills || [];
    if (!bills.length) { box.innerHTML = `<div class="muted" style="font-size:13.5px; padding:4px 2px;">Rent, phone, internet, EMIs — add them once and Hisab reminds you before each due date.</div>`; return; }
    const ctx = Core.ctxFromLocalDate();
    box.innerHTML = bills.map(b => ({ b, s: Core.billStatus(b, ctx) })).sort((x, y) => x.s.daysLeft - y.s.daysLeft).map(({ b, s }) => {
        const label = s.paidThisMonth && !s.inWindow ? `Paid this month · next ${Core.dueLabel(s.daysLeft).toLowerCase()}` : s.startsNext && !s.inWindow ? `Starts next month · ${Core.dueLabel(s.daysLeft).toLowerCase()}` : Core.dueLabel(s.daysLeft);
        const cls = s.overdue ? 'danger' : (s.inWindow ? 'donation' : (s.paidThisMonth ? 'done-badge' : ''));
        const curMonth = ctx.monthKey;
        return `<div class="bill-row">
            <div class="bill-main">
                <div class="bill-name">${escapeHTML(b.name)}</div>
                <div class="bill-meta">Every month on the ${b.dueDay}${['th', 'st', 'nd', 'rd'][(b.dueDay % 10 > 3 || [11, 12, 13].includes(b.dueDay % 100)) ? 0 : b.dueDay % 10]} · ${BILL_CATS[b.category] || 'Bills'}</div>
            </div>
            <div class="bill-right">
                <div class="num" style="font-weight:700;">₹${Number(b.amount).toLocaleString()}</div>
                <span class="badge ${cls}">${label}</span>
            </div>
            <div class="bill-actions">
                ${!s.paid && (s.inWindow || (!s.paidThisMonth && !s.startsNext)) ? `<button class="btn-sm" onclick="markBillPaid('${b.id}')">Mark paid</button>` : ''}
                ${s.paidThisMonth ? `<button class="btn-sm btn-ghost" onclick="undoBillPaid('${b.id}', '${curMonth}')">Undo</button>` : ''}
                <button class="btn-icon" onclick="openBillModal('${b.id}')" aria-label="Edit">${svgIcon('pen', 'icon icon-sm')}</button>
                <button class="btn-icon" onclick="deleteBill('${b.id}')" aria-label="Delete">${svgIcon('trash', 'icon icon-sm')}</button>
            </div>
        </div>`;
    }).join('');
}
function dueBillsForAgenda() {
    const ctx = Core.ctxFromLocalDate();
    return (budgetData.bills || []).map(b => ({ b, s: Core.billStatus(b, ctx) })).filter(x => x.s.inWindow);
}
Object.assign(window, { openBillModal, saveBill, deleteBill, markBillPaid, undoBillPaid });

// ---------- Category limits ----------
function monthCategoryTotals() {
    const now = new Date(); const totals = {};
    (budgetData.expenses || []).forEach(e => { const d = new Date(e.date); if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) totals[e.category || 'other'] = (totals[e.category || 'other'] || 0) + (Number(e.amount) || 0); });
    return totals;
}
function openCategoryLimits() {
    const lim = budgetData.categoryLimits || {};
    document.getElementById('cat-limits-form').innerHTML = Object.entries(BILL_CATS).map(([k, label]) => `
        <div class="field-row" style="align-items:center; margin-bottom:8px;">
            <label for="cl-${k}" style="flex:1.2; font-size:14px; font-weight:600;">${label}</label>
            <input type="number" id="cl-${k}" value="${lim[k] || ''}" placeholder="No limit" inputmode="decimal" style="margin:0;">
        </div>`).join('');
    openModal('cat-limits-modal');
}
function saveCategoryLimits() {
    const lim = {};
    Object.keys(BILL_CATS).forEach(k => { const v = parseFloat(document.getElementById('cl-' + k)?.value); if (v > 0) lim[k] = v; });
    budgetData.categoryLimits = lim;
    closeModal('cat-limits-modal'); saveData(); renderBudget();
    showToast('Category limits saved', '🎯');
}
function checkCategoryWarning(cat) {
    const lim = (budgetData.categoryLimits || {})[cat]; if (!lim) return;
    const spent = monthCategoryTotals()[cat] || 0;
    const pct = spent / lim;
    const name = BILL_CATS[cat] || cat;
    if (pct >= 1) showToast(`${name}: over limit by ₹${(spent - lim).toLocaleString()}`, '🚨');
    else if (pct >= 0.8) showToast(`${name}: ${Math.round(pct * 100)}% of ₹${lim.toLocaleString()} used`, '⚠️');
}
function renderCategoryBreakdown(catConfig) {
    const el = document.getElementById('category-breakdown-list'); if (!el) return;
    const totals = monthCategoryTotals(); const lim = budgetData.categoryLimits || {};
    const keys = [...new Set([...Object.keys(totals), ...Object.keys(lim)])].sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
    const head = `<div class="card-head"><h3>By category</h3><button class="btn-sm btn-ghost" onclick="openCategoryLimits()">${svgIcon('target', 'icon icon-sm')}Limits</button></div>`;
    if (!keys.length) { el.innerHTML = head + '<div class="muted" style="font-size:13.5px;">No expenses this month. Set limits per category to get warnings at 80%.</div>'; return; }
    el.innerHTML = head + keys.map(k => {
        const spent = totals[k] || 0, l = lim[k];
        const pct = l ? Math.min(100, Math.round(spent / l * 100)) : null;
        const color = pct == null ? (catConfig[k]?.color || 'var(--indigo)') : pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)';
        return `<div class="cat-row">
            <div class="cat-top"><span><i style="background:${catConfig[k]?.color || '#888'}"></i>${BILL_CATS[k] || escapeHTML(k)}</span>
            <span class="num">₹${spent.toLocaleString()}${l ? `<span class="muted"> / ${l.toLocaleString()}</span>` : ''}</span></div>
            ${l ? `<div class="progress" style="margin:6px 0 0; height:6px;"><span style="width:${pct}%; background:${color}"></span></div>` : ''}
        </div>`;
    }).join('');
}
Object.assign(window, { openCategoryLimits, saveCategoryLimits });

// ---------- Weekly report ----------
function getWeeklyReport(weeksAgo = 0) {
    // Last 7 full days ending at the start of today (so on Sunday it covers Sun→Sat)
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - weeksAgo * 7 * 86400000;
    const start = end - 7 * 86400000;
    const r = Core.weeklyReport({ tasks, history: activityHistory, budget: budgetData, journal: journalData, goodHabits }, start, end);
    let bestStreak = 0, bestStreakName = '';
    tasks.filter(t => t.type === 'daily').forEach(t => { const s = computeItemStreak(t.id, 'tasks').currentStreak; if (s > bestStreak) { bestStreak = s; bestStreakName = t.title; } });
    (goodHabits || []).forEach(h => { const s = computeHabitStreak(h.id, 'good').currentStreak; if (s > bestStreak) { bestStreak = s; bestStreakName = h.title; } });
    return { ...r, start, end, bestStreak, bestStreakName };
}
var reportWeeksAgo = 0;
function openWeeklyReport(weeksAgo = 0) {
    reportWeeksAgo = Math.max(0, weeksAgo);
    const r = getWeeklyReport(reportWeeksAgo);
    const fmt = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const prev = getWeeklyReport(reportWeeksAgo + 1);
    const delta = (a, b) => (a == null || b == null) ? '' : (a === b ? '' : `<span class="${a > b ? 'up' : 'down'}">${a > b ? '▲' : '▼'} ${Math.abs(a - b)} pts vs the week before</span>`);
    document.getElementById('weekly-report-range').innerText = `${fmt(r.start)} – ${fmt(r.end - 1)}`;
    document.getElementById('weekly-report-body').innerHTML = `
        <div class="report-hero">
            <div class="report-rate">${r.rate != null ? r.rate + '%' : '—'}</div>
            <div><div style="font-weight:700;">Daily tasks completed</div><div class="muted" style="font-size:13px;">${r.hit} of ${r.slots} scheduled · ${delta(r.rate, prev.rate) || 'same as the week before'}</div></div>
        </div>
        <div class="grid-3" style="margin:14px 0;">
            <div class="stat-box"><div class="l">Tasks done</div><div class="v">${r.completed}</div></div>
            <div class="stat-box"><div class="l">Missed</div><div class="v" style="color:${r.missed ? 'var(--red)' : 'inherit'}">${r.missed}</div></div>
            <div class="stat-box"><div class="l">Best streak</div><div class="v">${r.bestStreak}d</div></div>
            <div class="stat-box"><div class="l">Spent</div><div class="v" style="font-size:17px;">₹${r.spent.toLocaleString()}</div></div>
            <div class="stat-box"><div class="l">Penalties</div><div class="v" style="font-size:17px; color:${r.penalties ? 'var(--amber)' : 'inherit'}">₹${r.penalties.toLocaleString()}</div></div>
            <div class="stat-box"><div class="l">Journal</div><div class="v">${r.journalDays}/7</div></div>
        </div>
        <div class="report-lines">
            ${r.best ? `<div>🏆 Most consistent: <b>${escapeHTML(r.best.title)}</b> (${r.best.hit}/${r.best.slots})</div>` : ''}
            ${r.worst && r.worst.rate < 1 ? `<div>🎯 Needs attention: <b>${escapeHTML(r.worst.title)}</b> (${r.worst.hit}/${r.worst.slots})</div>` : ''}
            ${r.bestStreak ? `<div>🔥 Longest live streak: <b>${escapeHTML(r.bestStreakName)}</b> — ${r.bestStreak} day${r.bestStreak === 1 ? '' : 's'}</div>` : ''}
            <div>🕌 ${fmtNum(r.hizb)} hizb · ${r.swalath.toLocaleString()} swalath · ${r.goodLogs} good-habit logs${r.badLogs ? ` · ${r.badLogs} slips` : ''}</div>
        </div>`;
    const goalEl = document.getElementById('weekly-goal-input');
    if (goalEl) goalEl.value = weeklyGoalData[getWeekKey()] || '';
    renderWeeklyFocus(r.start);
    document.getElementById('weekly-report-next').disabled = reportWeeksAgo === 0;
    document.getElementById('weekly-focus-row').style.display = reportWeeksAgo === 0 ? 'block' : 'none';
    openModal('weekly-report-modal');
}
function checkWeeklyReportPrompt() {
    const now = new Date();
    const shownKey = `hisab_weekly_report_${getWeekKey()}`;
    if (now.getDay() === 0 && !localStorage.getItem(shownKey) && tasks.length > 0) {
        localStorage.setItem(shownKey, '1');
        setTimeout(() => openWeeklyReport(0), 1200);
    }
    updateWeeklyGoalBanner();
}
Object.assign(window, { openWeeklyReport, getWeeklyReport, reportNav: d => openWeeklyReport(reportWeeksAgo + d) });

// ---------- Startup for v2.1 ----------
setTimeout(() => { ensurePrayerTimes().then(() => { try { renderTodayAgenda(); } catch (e) {} }); }, 1500);

initNotifications();
const savedTab = (window.location.hash === '#compact') ? 'compact' : (localStorage.getItem('hisab_active_tab') || 'dashboard');

// Establish #dashboard as the base root of the history stack
if (window.history && window.history.replaceState) {
    history.replaceState({ tab: 'dashboard', root: true }, '', '#dashboard');
}

if (savedTab !== 'dashboard') {
    switchTab(savedTab, null, true);
} else {
    switchTab('dashboard', null, false);
}

handleIncomingShare();
setTimeout(checkWeeklyReportPrompt, 1500);

// Initialize Firebase Auth Listener safely after all state & functions are defined
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        showProfile({ name: user.displayName || 'Hisab User', email: user.email || '', picture: user.photoURL || 'icons/icon-96.png' });
        setSyncIndicator('synced', 'Connecting…');
        listenToFirebase(); 
        if ('Notification' in window && Notification.permission === 'granted') setTimeout(() => registerPushToken(true), 2500);
    } else {
        currentUser = null;
        setSyncIndicator('local', 'Local only');
        const loginPrompt = document.getElementById('login-prompt');
        const authContainer = document.getElementById('auth-container');
        if (loginPrompt) loginPrompt.style.display = (localStorage.getItem('hisab_active_tab') || 'dashboard') === 'dashboard' ? 'flex' : 'none';
        const so = document.getElementById('drawer-signout'); if (so) so.style.display = 'none';
        if (authContainer) authContainer.style.display = 'none';
        hasInitialCloudSync = true;
        migrateLegacyTasks();
        processAutomaticPenalties(); 
        render();
        syncFromGoogleSheets();
    }
});

// ==========================================
// SELF-HEALING TASK RECOVERY ENGINE
// Automatically detects and restores missing tasks from history or presets
// ==========================================
function recoverMissingTasks(silent = false) {
    let recoveredCount = 0;
    const existingIds = new Set([...(tasks || []), ...(archivedTasks || [])].map(t => String(t.id)));
    const existingTitles = new Set((tasks || []).map(t => (t.title || '').trim().toLowerCase()));

    // 1. Recover from activityHistory
    const taskLogs = (activityHistory || []).filter(h => h && (h.category === 'tasks' || h.taskId));
    taskLogs.forEach(h => {
        const rawTitle = h.title || '';
        const cleanTitle = rawTitle.replace(/^(Completed:\s*|Missed:\s*|Task:\s*)/i, '').trim();
        const taskId = String(h.taskId || h.id);
        if (!cleanTitle || taskId === 'unknown' || isDeleted(taskId)) return;
        if (!h.taskId || (h.category && h.category !== 'tasks')) return; // only real task logs can be restored

        if (!existingIds.has(taskId) && !existingTitles.has(cleanTitle.toLowerCase())) {
            const taskType = h.taskType || 'daily';
            const baseTarget = h.amount || 1;
            const createdAt = h.timestamp || Date.now();
            if (cleanTitle.startsWith('Missed (')) return;
            const periodsLeft = getPeriodsLeft(taskType, createdAt);
            const totalYearlyTarget = periodsLeft * baseTarget;

            tasks.push({
                id: taskId,
                title: cleanTitle,
                type: taskType,
                baseTarget: baseTarget,
                totalYearlyTarget: totalYearlyTarget,
                currentTarget: totalYearlyTarget,
                donation: 50,
                createdAt: createdAt,
                legacyMigrated: true,
                isCompleted: false
            });
            existingIds.add(taskId);
            existingTitles.add(cleanTitle.toLowerCase());
            recoveredCount++;
        }
    });

    if (recoveredCount > 0) {
        saveData();
        render();
        if (!silent && typeof showToast === 'function') {
            showToast('Restored ' + recoveredCount + ' tasks!', '🎉');
        }
    } else if (!silent && typeof showToast === 'function') {
        showToast('All tasks are already active and visible!', '✅');
    }
    return recoveredCount;
}
window.recoverMissingTasks = recoverMissingTasks;


// ==========================================================================
// v2.2 FEATURES — goals & streaks, prayer tracker, Khatm planner, intentions,
// zakat date, savings goal, debt due dates, backup nudge, compact view,
// focus log, flexible repeats, app lock.
// (Declared as functions only, so nothing here is touched before it is defined.)
// ==========================================================================

function touchExtra() { extraData.updatedAt = Date.now(); }

function mergeExtra(cloud) {
    if (!cloud || typeof cloud !== 'object') return;
    if (!extraData.prayerLog) extraData.prayerLog = {};
    if (!extraData.focusLog) extraData.focusLog = {};
    // Per-day logs: union. For the same prayer, this device's value wins (cleared = '').
    for (const [day, rec] of Object.entries(cloud.prayerLog || {})) {
        extraData.prayerLog[day] = { ...rec, ...(extraData.prayerLog[day] || {}) };
    }
    for (const [day, rec] of Object.entries(cloud.focusLog || {})) {
        const local = extraData.focusLog[day] || (extraData.focusLog[day] = {});
        for (const [tid, mins] of Object.entries(rec || {})) local[tid] = Math.max(Number(local[tid]) || 0, Number(mins) || 0);
    }
    // Single settings: last writer wins.
    if ((cloud.updatedAt || 0) > (extraData.updatedAt || 0)) {
        for (const k of ['goals', 'khatm', 'savings', 'zakatDate']) {
            if (k in cloud) extraData[k] = cloud[k]; else delete extraData[k];
        }
        if (!extraData.goals) extraData.goals = {};
        extraData.updatedAt = cloud.updatedAt;
    }
    localStorage.setItem('hisab_extra', JSON.stringify(extraData));
}

// Re-render a container unless the user is typing inside it.
function setHTMLUnlessFocused(el, html) {
    if (!el) return;
    if (el.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    el.innerHTML = html;
}
function addDaysToKey(key, n) { return Core.addDaysKey(key, n); }
function fmtNum1(n) { return (Math.round(n * 10) / 10).toLocaleString(); }

// ---------- Daily Deen totals (derived from history, so undo stays consistent) ----------
function dailyDeenMap() {
    const map = {};
    const swalathRe = /swalath|salawat|salawaat|darood|durood/i;
    for (const h of activityHistory) {
        if (!h || h.category !== 'deen') continue;
        const key = h.fulfilledDateKey || toDateKey(h.timestamp);
        const rec = map[key] || (map[key] = { hizb: 0, swalath: 0, dhikr: 0 });
        const amt = Number(h.amount) || 0;
        if (h.actionType === 'deen_hizb') rec.hizb += amt;
        else if (h.actionType === 'deen_swalath') rec.swalath += amt;
        else if (h.actionType === 'complete' && String(h.taskId || '').startsWith('dhikr-')) {
            rec.dhikr += amt;
            if (swalathRe.test(h.title || '')) rec.swalath += amt;
            if (/hizb/i.test(h.title || '')) rec.hizb += amt;
        }
    }
    // Tasks the user ticks off that are Deen items (e.g. "Read 1 hizb") also count.
    for (const h of activityHistory) {
        if (!h || h.actionType !== 'complete' || h.category === 'deen') continue;
        const t = /hizb|swalath|salawat|salawaat|darood|durood/i.test(h.title || '');
        if (!t) continue;
        const key = h.fulfilledDateKey || toDateKey(h.timestamp);
        const rec = map[key] || (map[key] = { hizb: 0, swalath: 0, dhikr: 0 });
        const amt = Number(h.amount) || 0;
        if (/hizb/i.test(h.title)) rec.hizb += amt;
        if (swalathRe.test(h.title)) rec.swalath += amt;
    }
    return map;
}
function goalStreak(map, field, goal, todayKey) {
    if (!goal) return 0;
    let streak = 0, key = todayKey;
    if (((map[key] || {})[field] || 0) < goal) key = addDaysToKey(key, -1); // today still open
    for (let i = 0; i < 400; i++) {
        if (((map[key] || {})[field] || 0) >= goal) { streak++; key = addDaysToKey(key, -1); } else break;
    }
    return streak;
}

function goalRingHTML(label, color, done, goal, streak, unit) {
    const C = 2 * Math.PI * 30;
    const pct = goal ? Math.min(1, done / goal) : 0;
    return `<div class="goal-ring">
        <div class="ring-wrap"><svg viewBox="0 0 72 72"><circle class="track" cx="36" cy="36" r="30" fill="none" stroke-width="7"/><circle class="fill" cx="36" cy="36" r="30" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/></svg>
        <div class="pct">${goal ? Math.round(pct * 100) + '%' : '—'}</div></div>
        <div class="gl">${label}</div>
        <div class="gv">${goal ? `${fmtNum1(done)} / ${fmtNum1(goal)}${unit}` : 'No goal'}</div>
        ${streak ? `<div class="gs">🔥 ${streak} day${streak === 1 ? '' : 's'}</div>` : ''}
    </div>`;
}

function saveDeenGoals() {
    const g = id => Math.max(0, parseFloat(document.getElementById(id)?.value) || 0);
    extraData.goals = { hizb: g('goal-hizb'), swalath: g('goal-swalath'), dhikr: g('goal-dhikr') };
    touchExtra(); saveData(); showToast('Daily goals saved', '🎯'); renderDeenExtras();
}
function toggleGoalEdit() { document.getElementById('goal-edit')?.classList.toggle('open'); }

// ---------- Prayer tracker ----------
function prayerNames() { return ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']; }
function setPrayerState(day, prayer, state) {
    if (!extraData.prayerLog) extraData.prayerLog = {};
    const rec = extraData.prayerLog[day] || (extraData.prayerLog[day] = {});
    rec[prayer] = rec[prayer] === state ? '' : state;
    // keep the log bounded (≈ 13 months)
    const cutoff = addDaysToKey(toDateKey(Date.now()), -400);
    for (const k of Object.keys(extraData.prayerLog)) if (k < cutoff) delete extraData.prayerLog[k];
    saveData(); renderDeenExtras();
    if (document.getElementById('tab-compact')?.classList.contains('active')) renderCompact();
}
function prayerDayComplete(day) {
    const rec = (extraData.prayerLog || {})[day] || {};
    return prayerNames().every(p => rec[p] === 'on' || rec[p] === 'late');
}
function prayerStreak(todayKey) {
    let streak = 0, key = todayKey;
    if (!prayerDayComplete(key)) key = addDaysToKey(key, -1);
    for (let i = 0; i < 400; i++) { if (prayerDayComplete(key)) { streak++; key = addDaysToKey(key, -1); } else break; }
    return streak;
}
function prayerRowsHTML(todayKey, compact) {
    const rec = (extraData.prayerLog || {})[todayKey] || {};
    const timings = getTodayPrayerTimings && getTodayPrayerTimings();
    return prayerNames().map(p => {
        const st = rec[p] || '';
        const t = timings && timings[p] ? String(timings[p]).slice(0, 5) : '';
        const btn = (state, label, title) => `<button class="${st === state ? 'on-' + state : ''}" onclick="setPrayerState('${todayKey}','${p}','${state}')" title="${title}" aria-label="${p}: ${title}">${label}</button>`;
        return `<div class="prayer-row"><div><div class="pn">${p}</div>${t ? `<div class="pt">${t}</div>` : ''}</div>
            <div class="pstate">${btn('on', compact ? '✓' : '✓ On time', 'On time')}${btn('late', compact ? 'L' : 'Late', 'Late')}${btn('missed', compact ? '✕' : '✕ Missed', 'Missed')}</div></div>`;
    }).join('');
}
function prayerWeekGridHTML(todayKey) {
    const dayLbl = k => new Date(getDayBounds(k).noon).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
    const keys = []; for (let i = 6; i >= 0; i--) keys.push(addDaysToKey(todayKey, -i));
    let html = `<div class="pweek"><span></span>${keys.map(k => `<span class="h">${dayLbl(k)}</span>`).join('')}`;
    prayerNames().forEach(p => {
        html += `<span class="n">${p.slice(0, 3)}</span>` + keys.map(k => {
            const st = ((extraData.prayerLog || {})[k] || {})[p] || '';
            return `<span class="pdot ${st}" title="${p} ${k}${st ? ': ' + st : ''}"></span>`;
        }).join('');
    });
    return html + '</div>';
}
function prayerWeekStats(todayKey) {
    let on = 0, late = 0, missed = 0, logged = 0;
    for (let i = 0; i < 7; i++) {
        const rec = (extraData.prayerLog || {})[addDaysToKey(todayKey, -i)] || {};
        prayerNames().forEach(p => { if (rec[p]) { logged++; if (rec[p] === 'on') on++; else if (rec[p] === 'late') late++; else if (rec[p] === 'missed') missed++; } });
    }
    return { on, late, missed, logged };
}

// ---------- Khatm planner ----------
function setKhatmPlan() {
    const date = document.getElementById('khatm-target-date')?.value;
    const todayKey = toDateKey(Date.now());
    if (!date || date < todayKey) { showToast('Pick a finish date in the future', '📅'); return; }
    const T = (deenData.quranStats && deenData.quranStats.totalHizb) || 0;
    const goal = (Math.floor(T / 60) + 1) * 60;
    extraData.khatm = { startDate: todayKey, startHizb: T, goal, targetDate: date };
    touchExtra(); saveData(); showToast('Khatm plan started', '📖'); renderDeenExtras();
}
function clearKhatmPlan() { delete extraData.khatm; touchExtra(); saveData(); renderDeenExtras(); }
function khatmPlanHTML(todayKey, map) {
    const T = (deenData.quranStats && deenData.quranStats.totalHizb) || 0;
    const plan = extraData.khatm;
    const nextDate = addDaysToKey(todayKey, 30);
    if (!plan) {
        return `<div class="muted" style="font-size:13.5px; margin-bottom:10px;">Pick a date to finish your next Khatm (60 hizb) and Hisab works out how much to read each day.</div>
            <div class="inline-form"><input type="date" id="khatm-target-date" min="${todayKey}" value="${nextDate}"><button onclick="setKhatmPlan()">Start plan</button></div>`;
    }
    const remaining = Math.max(0, plan.goal - T);
    const doneToday = (map[todayKey] || {}).hizb || 0;
    if (remaining <= 0) {
        return `<div class="plan-status ahead">🎉 Khatm complete — ${fmtNum1(plan.goal / 60)} in total. Barakallahu feek!</div>
            <button class="btn-secondary" onclick="clearKhatmPlan()" style="margin:8px 0 0;">Plan the next Khatm</button>`;
    }
    const totalDays = Math.max(1, Core.daysBetweenKeys(plan.startDate, plan.targetDate) + 1);
    const elapsed = Math.max(0, Core.daysBetweenKeys(plan.startDate, todayKey));
    const daysLeft = Core.daysBetweenKeys(todayKey, plan.targetDate) + 1;
    const pastDue = daysLeft <= 0;
    const perDay = pastDue ? remaining : remaining / daysLeft;
    const expected = plan.startHizb + (plan.goal - plan.startHizb) * Math.min(1, (elapsed + 1) / totalDays);
    const diff = T - expected;
    let status, cls = '';
    if (pastDue) { status = `Target date passed — ${fmtNum1(remaining)} hizb to go`; cls = 'behind'; }
    else if (diff >= 0.05) { status = `Ahead of plan by ${fmtNum1(diff)} hizb`; cls = 'ahead'; }
    else if (diff <= -0.05) { status = `Behind plan by ${fmtNum1(-diff)} hizb — ${fmtNum1(perDay)}/day catches you up`; cls = 'behind'; }
    else status = 'Right on plan';
    let paceTotal = 0; for (let i = 0; i < 14; i++) paceTotal += (map[addDaysToKey(todayKey, -i)] || {}).hizb || 0;
    const pace = paceTotal / 14;
    let proj = '';
    if (pace > 0) { const d = Math.ceil(remaining / pace); proj = `At your 14-day pace (${fmtNum1(pace)}/day) you finish around <b>${new Date(getDayBounds(addDaysToKey(todayKey, d)).noon).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>.`; }
    const progress = Math.min(100, Math.round(((T - plan.startHizb) / Math.max(1, plan.goal - plan.startHizb)) * 100));
    return `<div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:6px;"><span><b>${fmtNum1(T)}</b> / ${plan.goal} hizb</span><span class="muted">${daysLeft > 0 ? daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left' : 'overdue'}</span></div>
        <div class="mini-bar"><span style="width:${progress}%"></span></div>
        <div class="plan-status ${cls}">${status}</div>
        <div style="font-size:13.5px; margin-top:8px;">Today: <b>${fmtNum1(doneToday)}</b> of <b>${fmtNum1(perDay)}</b> hizb</div>
        ${proj ? `<div class="muted" style="font-size:12.5px; margin-top:6px;">${proj}</div>` : ''}
        <button class="btn-sm btn-ghost" onclick="clearKhatmPlan()" style="margin-top:10px;">Change plan</button>`;
}

// ---------- Intentions ----------
function intentionsHTML() {
    const m = {};
    const ensure = label => { const k = label.toLowerCase(); return m[k] || (m[k] = { label, count: 0, target: 0, dhikr: 0, juz: 0, juzDone: 0 }); };
    (deenData.dhikr || []).forEach(d => { const l = (d.intention || '').trim(); if (!l) return; const e = ensure(l); e.count += Number(d.current) || 0; e.target += Number(d.target) || 0; e.dhikr++; });
    (deenData.quran || []).forEach(q => { const l = (q.intention || '').trim(); if (!l) return; const e = ensure(l); e.juz++; if (q.completed) e.juzDone++; });
    const rows = Object.values(m).sort((a, b) => b.count - a.count);
    if (!rows.length) return `<div class="muted" style="font-size:13.5px;">Add an intention to a dhikr or a Juz dedication and the total you've offered for each one shows up here.</div>`;
    return rows.map(e => {
        const parts = [];
        if (e.dhikr) parts.push(`${e.count.toLocaleString()} recited across ${e.dhikr} dhikr`);
        if (e.juz) parts.push(`${e.juzDone}/${e.juz} Juz completed`);
        const pct = e.target ? Math.min(100, Math.round((e.count / e.target) * 100)) : 0;
        return `<div class="intent-row"><div class="it">${escapeHTML(e.label)}</div><div class="im">${parts.join(' · ')}</div>${e.target ? `<div class="mini-bar"><span style="width:${pct}%"></span></div>` : ''}</div>`;
    }).join('');
}

// ---------- Zakat date ----------
function saveZakatDate() {
    const v = document.getElementById('zakat-date')?.value || '';
    if (v) extraData.zakatDate = v; else delete extraData.zakatDate;
    touchExtra(); saveData(); showToast(v ? 'Zakat date saved' : 'Zakat date cleared', '🕌'); renderDeenExtras();
}
function zakatExtraHTML() {
    const ctx = Core.ctxFromLocalDate(new Date());
    const z = Core.zakatStatus(extraData.zakatDate, ctx);
    const info = z.set
        ? `<div style="font-size:13.5px; margin-top:8px;">Next zakat due <b>${new Date(getDayBounds(z.next).noon).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</b> — ${z.daysLeft === 0 ? '<b>today</b>' : 'in ' + z.daysLeft + ' day' + (z.daysLeft === 1 ? '' : 's')}.</div><div class="muted" style="font-size:12.5px; margin-top:4px;">You'll be reminded 7 days before, 1 day before and on the day.</div>`
        : `<div class="muted" style="font-size:12.5px; margin-top:8px;">Set the date your zakat year ends (your nisab anniversary) to get a yearly reminder.</div>`;
    return `<label class="field-label" for="zakat-date">Zakat anniversary date</label>
        <div class="inline-form"><input type="date" id="zakat-date" value="${escapeHTML(extraData.zakatDate || '')}"><button onclick="saveZakatDate()">Save</button></div>${info}`;
}

// ---------- Render the Deen extras ----------
function renderDeenExtras() {
    const top = document.getElementById('deen-extras-top');
    const bottom = document.getElementById('deen-extras-bottom');
    if (!top && !bottom) return;
    const todayKey = toDateKey(Date.now());
    const map = dailyDeenMap();
    const goals = extraData.goals || {};
    const td = map[todayKey] || { hizb: 0, swalath: 0, dhikr: 0 };

    if (top) {
        const ps = prayerWeekStats(todayKey);
        const pStreak = prayerStreak(todayKey);
        setHTMLUnlessFocused(top, `
        <div class="card">
            <div class="card-head"><h3>Daily goals</h3><button class="btn-sm btn-ghost" onclick="toggleGoalEdit()">Edit goals</button></div>
            <div class="goal-rings">
                ${goalRingHTML('Hizb', 'var(--brand)', td.hizb, goals.hizb || 0, goalStreak(map, 'hizb', goals.hizb || 0, todayKey), '')}
                ${goalRingHTML('Swalath', 'var(--amber)', td.swalath, goals.swalath || 0, goalStreak(map, 'swalath', goals.swalath || 0, todayKey), '')}
                ${goalRingHTML('Dhikr', 'var(--indigo)', td.dhikr, goals.dhikr || 0, goalStreak(map, 'dhikr', goals.dhikr || 0, todayKey), '')}
            </div>
            <div class="goal-edit" id="goal-edit">
                <div class="grid-3">
                    <div><label class="field-label" for="goal-hizb">Hizb / day</label><input type="number" id="goal-hizb" min="0" step="any" value="${goals.hizb || ''}" inputmode="decimal"></div>
                    <div><label class="field-label" for="goal-swalath">Swalath / day</label><input type="number" id="goal-swalath" min="0" value="${goals.swalath || ''}" inputmode="numeric"></div>
                    <div><label class="field-label" for="goal-dhikr">Dhikr / day</label><input type="number" id="goal-dhikr" min="0" value="${goals.dhikr || ''}" inputmode="numeric"></div>
                </div>
                <button onclick="saveDeenGoals()" style="margin:6px 0 0;">Save goals</button>
            </div>
        </div>
        <div class="card" id="prayer-tracker-card">
            <div class="card-head"><h3>Prayer tracker</h3><span class="badge ${pStreak ? 'done-badge' : ''}">${pStreak ? '🔥 ' + pStreak + '-day streak' : 'Today'}</span></div>
            ${prayerRowsHTML(todayKey, false)}
            ${prayerWeekGridHTML(todayKey)}
            <div class="muted" style="font-size:12.5px; margin-top:10px;">This week: ${ps.on} on time · ${ps.late} late · ${ps.missed} missed${ps.logged ? ` (${Math.round(((ps.on + ps.late) / ps.logged) * 100)}% prayed)` : ''}</div>
        </div>`);
    }
    if (bottom) {
        setHTMLUnlessFocused(bottom, `
        <div class="card">
            <div class="card-head"><h3>Khatm planner</h3></div>
            ${khatmPlanHTML(todayKey, map)}
        </div>
        <div class="card">
            <div class="card-head"><h3>Intentions</h3></div>
            ${intentionsHTML()}
        </div>`);
    }
    const zx = document.getElementById('zakat-extra');
    if (zx) setHTMLUnlessFocused(zx, zakatExtraHTML());
}

// ---------- Savings goal with monthly carry-over ----------
function ymKey(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; }
function monthSpentFor(ym) { return (budgetData.expenses || []).reduce((s, e) => ymKey(e.date) === ym ? s + (Number(e.amount) || 0) : s, 0); }
function savingsProgress() {
    const sv = extraData.savings;
    if (!sv || !(Number(sv.goal) > 0)) return null;
    const limit = Number(budgetData.limit) || 0;
    const nowYm = ymKey(Date.now());
    let saved = 0, months = 0, ym = sv.since || nowYm;
    let guard = 0;
    while (ym < nowYm && guard++ < 600) {
        if (limit > 0) saved += Math.max(0, limit - monthSpentFor(ym));
        months++;
        const [y, m] = ym.split('-').map(Number);
        ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    const thisMonthLeft = limit > 0 ? Math.max(0, limit - monthSpentFor(nowYm)) : 0;
    const goal = Number(sv.goal);
    const avg = months ? saved / months : 0;
    const togo = Math.max(0, goal - saved);
    return { saved, thisMonthLeft, goal, limit, months, avg, togo, monthsToGo: avg > 0 ? Math.ceil(togo / avg) : null };
}
function saveSavingsGoal() {
    const name = (document.getElementById('sv-name')?.value || '').trim() || 'Savings goal';
    const goal = parseFloat(document.getElementById('sv-goal')?.value);
    if (!(goal > 0)) { showToast('Enter a goal amount', '💰'); return; }
    extraData.savings = { name, goal, since: ymKey(Date.now()) };
    touchExtra(); saveData(); showToast('Savings goal set', '🎯'); renderSavingsGoal();
}
function clearSavingsGoal() { delete extraData.savings; touchExtra(); saveData(); renderSavingsGoal(); }
function renderSavingsGoal() {
    const el = document.getElementById('savings-goal-card');
    if (!el) return;
    const p = savingsProgress();
    const fmt = n => '₹' + Math.round(n).toLocaleString();
    if (!p) {
        setHTMLUnlessFocused(el, `<div class="card"><div class="card-head"><h3>Savings goal</h3></div>
            <div class="muted" style="font-size:13.5px; margin-bottom:10px;">Whatever you don't spend of your monthly limit rolls into a savings goal automatically. Set a monthly limit first, then a goal.</div>
            <div class="field-row"><input type="text" id="sv-name" placeholder="Goal (e.g. Laptop, Hajj fund)" style="flex:2;"><input type="number" id="sv-goal" placeholder="Amount ₹" inputmode="decimal"></div>
            <button onclick="saveSavingsGoal()" style="margin:0;">Start saving</button></div>`);
        return;
    }
    const pct = Math.min(100, Math.round((p.saved / p.goal) * 100));
    const line = p.limit <= 0 ? 'Set a monthly limit above — unspent budget only counts once a limit exists.'
        : p.months === 0 ? `Your first month is in progress. Staying under budget would add ${fmt(p.thisMonthLeft)} so far.`
        : `Averaging ${fmt(p.avg)}/month${p.monthsToGo != null && p.togo > 0 ? ` — about ${p.monthsToGo} more month${p.monthsToGo === 1 ? '' : 's'} to go` : ''}. This month so far: ${fmt(p.thisMonthLeft)} unspent.`;
    setHTMLUnlessFocused(el, `<div class="card"><div class="card-head"><h3>${escapeHTML(extraData.savings.name || 'Savings goal')}</h3><button class="btn-sm btn-ghost" onclick="clearSavingsGoal()">Remove</button></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end;"><div class="big-figure" style="color:var(--green)">${fmt(p.saved)}</div><div class="muted" style="font-size:13px;">of ${fmt(p.goal)}</div></div>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%; background:var(--green)"></div></div>
        <div class="muted" style="font-size:12.5px;">${line}</div></div>`);
}

// ---------- Debt due dates ----------
function debtDueBadge(debt) {
    const st = Core.debtStatus(debt, Core.ctxFromLocalDate(new Date()));
    if (!st.active) return '';
    const label = st.daysLeft < 0 ? `Overdue ${-st.daysLeft}d` : st.daysLeft === 0 ? 'Due today' : st.daysLeft === 1 ? 'Due tomorrow' : `Due in ${st.daysLeft}d`;
    return `<div style="margin-top:3px;"><span class="badge ${st.daysLeft < 0 ? 'debt-over' : 'debt-due'}">${label}</span></div>`;
}
function openDebtDue(id) {
    const d = (budgetData.debts || []).find(x => x.id === id); if (!d) return;
    document.getElementById('debt-due-id').value = id;
    document.getElementById('debt-due-input').value = d.due || '';
    openModal('debt-due-modal');
}
function saveDebtDue(clear) {
    const id = document.getElementById('debt-due-id').value;
    const d = (budgetData.debts || []).find(x => x.id === id); if (!d) return;
    d.due = clear ? '' : (document.getElementById('debt-due-input').value || '');
    closeModal('debt-due-modal'); saveData(); renderBudget();
    showToast(d.due ? 'Reminder set' : 'Due date cleared', '📅');
}

// ---------- Backup nudge + status ----------
function backupDaysSince() { const t = Number(localStorage.getItem('hisab_last_backup')) || 0; return t ? Math.floor((Date.now() - t) / 86400000) : null; }
function updateBackupStatusLine() {
    const el = document.getElementById('backup-status-line'); if (!el) return;
    const d = backupDaysSince();
    el.innerText = (d == null ? 'No backup file saved yet.' : d === 0 ? 'Last backup: today.' : `Last backup: ${d} day${d === 1 ? '' : 's'} ago.`) + (currentUser ? ' Cloud sync is on.' : ' Data is stored on this device only.');
}
function snoozeBackupNudge() { localStorage.setItem('hisab_backup_snooze', String(Date.now() + 3 * 86400000)); renderBackupNudge(); }
function renderBackupNudge() {
    const el = document.getElementById('backup-nudge'); if (!el) return;
    const hasData = tasks.length > 0 || activityHistory.length > 20;
    const d = backupDaysSince();
    const snoozed = Date.now() < (Number(localStorage.getItem('hisab_backup_snooze')) || 0);
    let msg = '';
    if (hasData && !snoozed) {
        if (!currentUser && (d == null || d >= 7)) msg = d == null ? 'Your data lives only on this device and has never been backed up.' : `Your last backup was ${d} days ago and your data is only on this device.`;
        else if (currentUser && localStorage.getItem('hisab_unsynced') === '1' && lastCloudError) msg = 'Cloud sync is failing, so recent changes are only on this device.';
    }
    el.innerHTML = msg ? `<div class="nudge"><span class="grow"><b>Back up your data.</b> ${msg}${currentUser ? '' : ' Sign in with Google, or save a backup file.'}</span><button onclick="exportDataBackup()">Back up now</button><button class="btn-secondary" onclick="snoozeBackupNudge()">Later</button></div>` : '';
}

// ---------- Focus log ----------
function addFocusMinutes(taskId, minutes) {
    const day = toDateKey(Date.now());
    if (!extraData.focusLog) extraData.focusLog = {};
    const rec = extraData.focusLog[day] || (extraData.focusLog[day] = {});
    const k = taskId || '_none';
    rec[k] = (Number(rec[k]) || 0) + minutes;
    const cutoff = addDaysToKey(day, -400);
    for (const d of Object.keys(extraData.focusLog)) if (d < cutoff) delete extraData.focusLog[d];
    saveData();
}
function renderWeeklyFocus(startMs) {
    const el = document.getElementById('weekly-focus-card'); if (!el) return;
    const days = [], perTask = {};
    let total = 0;
    for (let i = 0; i < 7; i++) {
        const key = toDateKey(startMs + i * 86400000 + 3600000);
        const rec = (extraData.focusLog || {})[key] || {};
        const mins = Object.values(rec).reduce((s, v) => s + (Number(v) || 0), 0);
        Object.entries(rec).forEach(([tid, v]) => { perTask[tid] = (perTask[tid] || 0) + (Number(v) || 0); });
        total += mins;
        days.push({ key, mins, lbl: new Date(startMs + i * 86400000 + 3600000).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2) });
    }
    if (!total) { el.innerHTML = ''; return; }
    const max = Math.max(...days.map(d => d.mins), 1);
    const nameOf = tid => tid === '_none' ? 'No task selected' : ((tasks.find(t => t.id === tid) || (archivedTasks || []).find(t => t.id === tid) || {}).title || 'Deleted task');
    const top = Object.entries(perTask).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const fmtM = m => m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`;
    el.innerHTML = `<div class="card" style="margin-top:14px; box-shadow:none; background:var(--surface-2); border:0;">
        <div class="card-head" style="margin-bottom:4px;"><h3>Focus time</h3><span class="muted" style="font-size:13px;">${fmtM(total)} this week</span></div>
        <div class="focus-bars">${days.map(d => `<div class="fb"><b>${d.mins ? fmtM(d.mins) : ''}</b><span style="height:${Math.max(3, Math.round((d.mins / max) * 70))}px"></span>${d.lbl}</div>`).join('')}</div>
        <div class="report-lines" style="margin-top:10px;">${top.map(([tid, m]) => `<div>⏱ <b>${escapeHTML(nameOf(tid))}</b> — ${fmtM(m)}</div>`).join('')}</div></div>`;
}

// ---------- Flexible repeat form helpers ----------
function toggleRecurFields() {
    const k = document.getElementById('recur-kind')?.value || 'everyN';
    const show = (id, on) => { const e = document.getElementById(id); if (e) e.style.display = on ? 'flex' : 'none'; };
    show('recur-everyN', k === 'everyN'); show('recur-nth', k === 'nth'); show('recur-monthday', k === 'monthday');
}
function readRecurFromForm() {
    const k = document.getElementById('recur-kind').value;
    if (k === 'everyN') return { kind: 'everyN', n: Math.min(365, Math.max(2, parseInt(document.getElementById('recur-n').value, 10) || 2)), anchor: document.getElementById('recur-anchor').value || toDateKey(Date.now()) };
    if (k === 'nth') return { kind: 'nth', nth: parseInt(document.getElementById('recur-nth-n').value, 10), dow: parseInt(document.getElementById('recur-nth-dow').value, 10) };
    return { kind: 'monthday', day: Math.min(31, Math.max(1, parseInt(document.getElementById('recur-day').value, 10) || 1)) };
}
function writeRecurToForm(r) {
    document.getElementById('recur-kind').value = r.kind;
    if (r.kind === 'everyN') { document.getElementById('recur-n').value = r.n; document.getElementById('recur-anchor').value = r.anchor || ''; }
    if (r.kind === 'nth') { document.getElementById('recur-nth-n').value = String(r.nth); document.getElementById('recur-nth-dow').value = String(r.dow); }
    if (r.kind === 'monthday') document.getElementById('recur-day').value = r.day;
    toggleRecurFields();
}

// ---------- Compact "Today" view ----------
function compactDone(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    const st = getTaskStatus(t, new Date());
    const left = Math.max(0, st.target - st.doneAmt) || st.target || 1;
    logProgress(id, left);
    renderCompact();
}
function renderCompact() {
    const body = document.getElementById('compact-body'); if (!body) return;
    const now = new Date(), todayKey = toDateKey(now);
    const due = tasks.filter(t => (t.currentTarget ?? 1) > 0).map(t => ({ t, st: getTaskStatus(t, now) })).filter(x => x.st.isDueToday && !x.st.isDone);
    const doneCount = tasks.filter(t => { const st = getTaskStatus(t, now); return st.isActiveToday && st.isDone && t.type === 'daily'; }).length;
    const sub = document.getElementById('compact-sub');
    if (sub) sub.innerText = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ` · ${due.length} left`;
    const map = dailyDeenMap(), goals = extraData.goals || {}, td = map[todayKey] || {};
    const goalLines = [['Hizb', 'hizb'], ['Swalath', 'swalath'], ['Dhikr', 'dhikr']].filter(([, k]) => goals[k] > 0)
        .map(([l, k]) => `<span class="badge ${(td[k] || 0) >= goals[k] ? 'done-badge' : ''}">${l} ${fmtNum1(td[k] || 0)}/${fmtNum1(goals[k])}</span>`).join(' ');
    const items = due.length ? due.map(({ t, st }) => `<div class="compact-item"><div class="ct">${escapeHTML(t.title)}<div class="cm">${[st.dueLabel, st.target > 1 ? fmtNum1(st.target - st.doneAmt) + ' left ' + st.periodLabel : '', t.reminderTime ? '⏰ ' + t.reminderTime : ''].filter(Boolean).join(' · ') || st.periodLabel}</div></div><button onclick="compactDone('${t.id}')" aria-label="Mark ${escapeHTML(t.title)} done">✓</button></div>`).join('')
        : `<div class="empty-state">${doneCount ? '🎉 Everything for today is done.' : 'Nothing scheduled for today.'}</div>`;
    body.innerHTML = `${goalLines ? `<div style="margin-bottom:12px; display:flex; gap:6px; flex-wrap:wrap;">${goalLines}</div>` : ''}${items}
        <div class="section-title"><h3>Prayers</h3></div><div class="card" style="padding:4px 16px;">${prayerRowsHTML(todayKey, true)}</div>`;
}

// ---------- Debt & zakat reminders (client side, used when background push is off) ----------
function runExtraReminders(ctx, nowMin, todayKey) {
    if (nowMin < 9 * 60) return;
    (budgetData.debts || []).forEach(d => {
        const ds = Core.debtStatus(d, ctx);
        if (!ds.remind) return;
        const k = `hisab_debt_notif_${d.id}_${todayKey}`;
        if (localStorage.getItem(k)) return;
        const verb = d.type === 'borrowed' ? 'You owe' : 'Owed to you by';
        sendAppNotification(`🤝 ${d.type === 'borrowed' ? 'Repay' : 'Collect from'} ${d.desc} — ₹${Math.round(ds.pending).toLocaleString()}`, { body: `${verb} ${d.desc}: ${Core.dueLabel(ds.daysLeft)}`, tag: 'debt-' + d.id, data: { kind: 'debt' } });
        localStorage.setItem(k, '1');
    });
    const z = Core.zakatStatus(extraData.zakatDate, ctx);
    if (z.remind && !localStorage.getItem('hisab_zakat_notif_' + todayKey)) {
        sendAppNotification('🕌 Zakat reminder', { body: z.daysLeft === 0 ? 'Your zakat anniversary is today.' : `Your zakat anniversary is in ${z.daysLeft} day${z.daysLeft === 1 ? '' : 's'}.`, tag: 'zakat', data: { kind: 'zakat' } });
        localStorage.setItem('hisab_zakat_notif_' + todayKey, '1');
    }
}

// ---------- App lock (PIN) ----------
function lockCfg() { try { return JSON.parse(localStorage.getItem('hisab_lock') || 'null'); } catch (e) { return null; } }
async function hashPin(pin, salt) {
    const buf = new TextEncoder().encode(salt + ':' + pin);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const lockState = { mode: 'unlock', entry: '', first: '', fails: 0, until: 0, onDone: null, hiddenAt: 0 };
function lockDraw() {
    const dots = document.getElementById('app-lock-dots'); if (!dots) return;
    dots.innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < lockState.entry.length ? 'f' : ''}"></i>`).join('');
}
function lockBuildPad() {
    const pad = document.getElementById('app-lock-pad'); if (!pad || pad.dataset.ready) return;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', '0', 'b'];
    pad.innerHTML = keys.map(k => k === 'c' ? '<button type="button" data-k="c" aria-label="Cancel" id="app-lock-cancel">✕</button>' : k === 'b' ? '<button type="button" data-k="b" aria-label="Delete">⌫</button>' : `<button type="button" data-k="${k}">${k}</button>`).join('');
    pad.addEventListener('click', e => { const b = e.target.closest('button'); if (b) lockKey(b.dataset.k); });
    pad.dataset.ready = '1';
}
function lockShow(mode, onDone) {
    lockState.mode = mode; lockState.entry = ''; lockState.first = ''; lockState.onDone = onDone || null;
    const titles = { unlock: 'Enter your PIN', set1: 'Choose a 4-digit PIN', set2: 'Confirm your PIN', verify: 'Enter your current PIN' };
    lockBuildPad();
    document.getElementById('app-lock-title').innerText = titles[mode] || '';
    document.getElementById('app-lock-msg').innerText = '';
    document.getElementById('app-lock-forgot').style.display = (mode === 'unlock' || mode === 'verify') ? 'inline-block' : 'none';
    document.getElementById('app-lock-cancel').style.visibility = mode === 'unlock' ? 'hidden' : 'visible';
    lockDraw();
    document.getElementById('app-lock').style.display = 'flex';
}
function lockHide() { const el = document.getElementById('app-lock'); if (el) el.style.display = 'none'; }
async function lockKey(k) {
    const msg = document.getElementById('app-lock-msg');
    if (k === 'c') { if (lockState.mode !== 'unlock') lockHide(); return; }
    if (Date.now() < lockState.until) { msg.innerText = `Too many tries — wait ${Math.ceil((lockState.until - Date.now()) / 1000)}s`; return; }
    if (k === 'b') { lockState.entry = lockState.entry.slice(0, -1); lockDraw(); return; }
    if (lockState.entry.length >= 4) return;
    lockState.entry += k; lockDraw();
    if (lockState.entry.length < 4) return;
    const pin = lockState.entry; lockState.entry = '';
    const cfg = lockCfg();
    if (lockState.mode === 'unlock' || lockState.mode === 'verify') {
        const ok = cfg && (await hashPin(pin, cfg.salt)) === cfg.hash;
        if (ok) { lockState.fails = 0; const cb = lockState.onDone; lockHide(); if (cb) cb(); return; }
        lockState.fails++; msg.innerText = 'Wrong PIN';
        if (lockState.fails >= 5) { lockState.until = Date.now() + 30000; lockState.fails = 0; msg.innerText = 'Too many tries — wait 30s'; }
        setTimeout(lockDraw, 120); lockDraw(); return;
    }
    if (lockState.mode === 'set1') { lockState.first = pin; lockState.mode = 'set2'; document.getElementById('app-lock-title').innerText = 'Confirm your PIN'; lockDraw(); return; }
    if (lockState.mode === 'set2') {
        if (pin !== lockState.first) { lockState.mode = 'set1'; lockState.first = ''; document.getElementById('app-lock-title').innerText = 'Choose a 4-digit PIN'; msg.innerText = "PINs didn't match — try again"; lockDraw(); return; }
        const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('hisab_lock', JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
        lockHide(); renderAppLockSettings(); showToast('App lock is on', '🔒');
    }
}
function startSetPin() { lockShow('set1'); }
function changePin() { lockShow('verify', () => lockShow('set1')); }
function disableLock() { lockShow('verify', () => { localStorage.removeItem('hisab_lock'); renderAppLockSettings(); showToast('App lock turned off', '🔓'); }); }
function forgotPin() {
    if (confirm('Forgot your PIN?\n\nThe only way back in is to reset Hisab on this device. That erases the data stored here. If you are signed in with Google, your cloud data comes back after you sign in; otherwise it is lost.\n\nReset this device?')) {
        localStorage.clear(); location.reload();
    }
}
function renderAppLockSettings() {
    const el = document.getElementById('applock-settings'); if (!el) return;
    const on = !!lockCfg();
    el.innerHTML = `<div style="font-weight:650; font-size:14px;">App lock</div>
        <div class="muted" style="font-size:12.5px; margin-bottom:10px;">${on ? 'Hisab asks for your PIN when you open it and after it has been in the background for 30 seconds.' : 'Ask for a 4-digit PIN when Hisab opens. It keeps casual snoopers out of your journal and intentions; it is not encryption.'}</div>
        ${on ? `<div class="field-row"><button class="btn-secondary" onclick="changePin()" style="margin:0;">Change PIN</button><button class="btn-secondary" onclick="disableLock()" style="margin:0;">Turn off</button></div>`
             : `<button class="btn-secondary" onclick="startSetPin()" style="margin:0;"><svg class="icon icon-sm"><use href="#i-lock"/></svg>Set a PIN</button>`}`;
}
function initAppLock() {
    if (lockCfg()) lockShow('unlock');
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') lockState.hiddenAt = Date.now();
        else if (lockCfg() && lockState.hiddenAt && Date.now() - lockState.hiddenAt > 30000 && document.getElementById('app-lock').style.display !== 'flex') lockShow('unlock');
    });
}

// ---------- Wiring ----------
window.addEventListener('offline', () => { if (currentUser) setSyncIndicator('pending', 'Offline'); });
window.addEventListener('online', () => { if (currentUser && localStorage.getItem('hisab_unsynced') === '1') setSyncIndicator('pending', 'Syncing…'); });
Object.assign(window, {
    setPrayerState, saveDeenGoals, toggleGoalEdit, setKhatmPlan, clearKhatmPlan, saveZakatDate, saveSavingsGoal, clearSavingsGoal,
    openDebtDue, saveDebtDue, snoozeBackupNudge, toggleRecurFields, compactDone, renderCompact, startSetPin, changePin, disableLock, forgotPin,
    renderDeenExtras, renderSavingsGoal, renderBackupNudge, updateBackupStatusLine, renderAppLockSettings,
    addFocusMinutes, mergeExtra, getExtraData: () => extraData
});
initAppLock();

// ==========================================================================
// DHIKR EDIT + DEEN RECOVERY (rebuild from Google Sheet logs / CSV / backup)
// ==========================================================================
function openDhikrEdit(i) {
    const d = deenData.dhikr[i]; if (!d) return;
    document.getElementById('dhikr-edit-index').value = i;
    document.getElementById('dhikr-edit-name').value = d.name || '';
    document.getElementById('dhikr-edit-intention').value = d.intention || '';
    document.getElementById('dhikr-edit-current').value = d.current || 0;
    document.getElementById('dhikr-edit-target').value = d.target || 1;
    openModal('dhikr-edit-modal');
}
function saveDhikrEdit() {
    const i = parseInt(document.getElementById('dhikr-edit-index').value, 10);
    const d = deenData.dhikr[i]; if (!d) return;
    const name = document.getElementById('dhikr-edit-name').value.trim();
    const target = parseInt(document.getElementById('dhikr-edit-target').value, 10);
    const current = Math.max(0, parseInt(document.getElementById('dhikr-edit-current').value, 10) || 0);
    if (!name || !(target > 0)) { showToast('Enter a name and a target', '✏️'); return; }
    d.name = name; d.target = target; d.current = Math.min(current, target);
    d.intention = document.getElementById('dhikr-edit-intention').value.trim();
    d.completed = d.current >= d.target;
    closeModal('dhikr-edit-modal'); saveData(); renderDeen(); renderDeenExtras();
    showToast('Dhikr updated', '✅');
}

let recoverRows = [];

function openRecover() { document.getElementById('recover-result').innerHTML = ''; openModal('recover-modal'); }

function parseCSV(text) {
    const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
        else if (c === '"') q = true;
        else if (c === delim) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

function toTimestamp(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!isNaN(n) && n > 1e11) return n;          // ms epoch
    if (!isNaN(n) && n > 1e9) return n * 1000;     // s epoch
    if (!isNaN(n) && n > 20000 && n < 80000) return Math.round((n - 25569) * 86400000); // Sheets serial date
    const t = Date.parse(v); return isNaN(t) ? null : t;
}

// Turn sheet rows / API objects / a backup file into normalized log entries.
function normalizeRecoveredLogs(input) {
    let objs = [];
    if (Array.isArray(input) && input.length && Array.isArray(input[0])) {
        const head = input[0].map(h => String(h).trim().toLowerCase().replace(/[\s_-]/g, ''));
        const col = (...names) => head.findIndex(h => names.includes(h));
        const ci = { id: col('id', 'logid'), ts: col('timestamp', 'time', 'ms', 'epoch'), date: col('date', 'datetime', 'loggedat', 'created'), cat: col('category', 'cat'), act: col('actiontype', 'action', 'type'), title: col('title', 'name', 'description', 'desc', 'item'), amt: col('amount', 'count', 'qty', 'value'), task: col('taskid') };
        if (ci.title < 0) throw new Error("Couldn't find a Title column in that file");
        objs = input.slice(1).map(r => ({
            id: ci.id >= 0 ? r[ci.id] : '', timestamp: (ci.ts >= 0 ? toTimestamp(r[ci.ts]) : null) ?? (ci.date >= 0 ? toTimestamp(r[ci.date]) : null),
            category: ci.cat >= 0 ? r[ci.cat] : '', actionType: ci.act >= 0 ? r[ci.act] : '', title: r[ci.title], amount: ci.amt >= 0 ? r[ci.amt] : 1, taskId: ci.task >= 0 ? r[ci.task] : ''
        }));
    } else if (Array.isArray(input)) objs = input;
    else if (input && Array.isArray(input.history)) objs = input.history;   // a Hisab backup file
    else if (input && Array.isArray(input.logs)) objs = input.logs;
    else if (input && Array.isArray(input.data)) objs = input.data;

    const out = [];
    for (const o of objs) {
        if (!o) continue;
        const title = String(o.title || '').trim(); if (!title) continue;
        const ts = toTimestamp(o.timestamp) ?? toTimestamp(o.date) ?? null;
        const amount = Number(o.amount); const amt = isNaN(amount) || amount <= 0 ? 1 : amount;
        let kind = null, name = '', juz = null;
        const act = String(o.actionType || '').trim();
        if (/^dhikr:/i.test(title)) { kind = 'dhikr'; name = title.replace(/^dhikr:\s*/i, '').trim(); }
        else if (act === 'deen_swalath' || /^logged swalath/i.test(title)) kind = 'swalath';
        else if (act === 'deen_hizb' || /^logged hizb/i.test(title)) kind = 'hizb';
        else if (/^completed juz\s*(\d+)/i.test(title)) { kind = 'juz'; juz = parseInt(title.match(/(\d+)/)[1], 10); }
        else if (act === 'deen_qada' || /^qada:/i.test(title)) kind = 'qada';
        if (!kind) continue;
        const id = String(o.id || '').trim() || `rec-${ts || 0}-${title.length}-${amt}`;
        out.push({ id, timestamp: ts || Date.now(), title, amount: amt, kind, name, juz, actionType: act, taskId: String(o.taskId || '') });
    }
    return out;
}

function guessIntention(name) {
    const m = name.match(/\b(?:for|on behalf of|to)\s+(.+)$/i);
    return m ? m[1].trim() : '';
}

function renderRecoverPreview(logs, sourceLabel) {
    const el = document.getElementById('recover-result');
    const have = new Set(activityHistory.map(h => String(h.id)));
    const sig = h => `${h.timestamp}|${h.title}|${h.amount}`;
    const haveSig = new Set(activityHistory.map(sig));
    recoverRows = logs.map(l => ({ ...l, isNew: !have.has(l.id) && !haveSig.has(sig(l)) }));
    if (!recoverRows.length) {
        el.innerHTML = `<div class="empty-state" style="margin-top:12px;">No dhikr, swalath, hizb or Juz entries found in ${escapeHTML(sourceLabel)}.<br>If your Sheet has them, download it as CSV and use Import.</div>`;
        return;
    }
    const groups = {};
    let swalath = 0, hizb = 0, juz = new Set(), newCount = 0;
    recoverRows.forEach(r => {
        if (r.isNew) newCount++;
        if (r.kind === 'dhikr') { const k = r.name.toLowerCase(); const g = groups[k] || (groups[k] = { name: r.name, total: 0, n: 0, first: r.timestamp, last: r.timestamp }); g.total += r.amount; g.n++; g.first = Math.min(g.first, r.timestamp); g.last = Math.max(g.last, r.timestamp); }
        if (r.kind === 'swalath') swalath += r.amount;
        if (r.kind === 'hizb') hizb += r.amount;
        if (r.kind === 'juz') juz.add(r.juz);
    });
    const fmtD = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
    const existing = name => (deenData.dhikr || []).find(d => (d.name || '').toLowerCase() === name.toLowerCase());
    const gl = Object.values(groups).sort((a, b) => b.last - a.last);
    el.innerHTML = `
        <div class="plan-status" style="margin-top:12px;">Found ${recoverRows.length} entries in ${escapeHTML(sourceLabel)} — ${newCount} not on this device yet.</div>
        <div class="grid-3" style="margin:10px 0;">
            <div class="stat-box"><div class="l">Swalath logs</div><div class="v" style="font-size:17px;">${swalath.toLocaleString()}</div></div>
            <div class="stat-box"><div class="l">Hizb logs</div><div class="v" style="font-size:17px;">${fmtNum1(hizb)}</div></div>
            <div class="stat-box"><div class="l">Juz done</div><div class="v" style="font-size:17px;">${juz.size}</div></div>
        </div>
        ${gl.length ? `<div class="field-label" style="margin-top:6px;">Committed dhikr found (${gl.length}) — fill in the target and intention; these weren't stored in the Sheet</div>` : ''}
        ${gl.map((g, i) => { const ex = existing(g.name); return `
        <div class="card" style="box-shadow:none; background:var(--surface-2); border:0; padding:12px; margin-bottom:8px;">
            <label class="check-row" style="margin:0 0 6px;"><input type="checkbox" class="rec-pick" data-i="${i}" checked><span><b>${escapeHTML(g.name)}</b> — ${g.total.toLocaleString()} recited in ${g.n} log${g.n === 1 ? '' : 's'} (${fmtD(g.first)} – ${fmtD(g.last)})${ex ? ` · <span style="color:var(--amber)">already in your list (${(ex.current || 0).toLocaleString()} / ${(ex.target || 0).toLocaleString()})</span>` : ''}</span></label>
            <div class="field-row" style="margin:0;">
                <input type="text" id="rec-int-${i}" placeholder="Intention / for whom" value="${escapeHTML(ex ? (ex.intention || '') : guessIntention(g.name))}" style="flex:2;">
                <input type="number" id="rec-tgt-${i}" placeholder="Target" min="1" value="${ex ? ex.target : ''}" inputmode="numeric">
            </div>
            <input type="hidden" id="rec-name-${i}" value="${escapeHTML(g.name)}"><input type="hidden" id="rec-total-${i}" value="${g.total}">
        </div>`; }).join('')}
        <button onclick="applyRecovery()" style="margin-top:8px;">Restore ${newCount ? newCount + ' entries' : ''}${gl.length ? (newCount ? ' and ' : '') + 'dhikr commitments' : ''}</button>
        <div class="field-hint" style="margin-top:8px;">Totals only go up, entries already on this device are skipped, and nothing is sent back to the Sheet, so it's safe to run again.</div>`;
}

async function recoverFromSheet() {
    const el = document.getElementById('recover-result');
    el.innerHTML = '<div class="muted" style="padding:14px 0;">Fetching from your Google Sheet…</div>';
    try {
        const res = await fetch(`${GOOGLE_SHEETS_URL}?action=pull_email_logs&since=0`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        renderRecoverPreview(normalizeRecoveredLogs(data), 'your Google Sheet');
    } catch (e) {
        el.innerHTML = `<div class="empty-state" style="margin-top:12px;">Couldn't read the Sheet (${escapeHTML(e.message || String(e))}).<br>Open the Sheet → File → Download → CSV, then tap Import.</div>`;
    }
}

function recoverFromFile(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const text = String(e.target.result || '');
            const data = /^\s*[\[{]/.test(text) ? JSON.parse(text) : parseCSV(text);
            renderRecoverPreview(normalizeRecoveredLogs(data), file.name);
        } catch (err) {
            document.getElementById('recover-result').innerHTML = `<div class="empty-state" style="margin-top:12px;">${escapeHTML(err.message || String(err))}</div>`;
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function applyRecovery() {
    if (!recoverRows.length) return;
    if (!deenData.dhikr) deenData.dhikr = [];
    if (!deenData.quran) deenData.quran = [];
    // 1) Dhikr commitments
    const indexByName = {};
    document.querySelectorAll('.rec-pick').forEach(cb => {
        const i = cb.dataset.i;
        const name = document.getElementById('rec-name-' + i).value;
        const total = Number(document.getElementById('rec-total-' + i).value) || 0;
        let idx = deenData.dhikr.findIndex(d => (d.name || '').toLowerCase() === name.toLowerCase());
        if (idx >= 0) indexByName[name.toLowerCase()] = idx;
        if (!cb.checked) return;
        const tgtIn = parseInt(document.getElementById('rec-tgt-' + i).value, 10);
        const intention = document.getElementById('rec-int-' + i).value.trim();
        if (idx >= 0) {
            const d = deenData.dhikr[idx];
            d.target = tgtIn > 0 ? tgtIn : Math.max(d.target || 0, total);
            d.current = Math.min(d.target, Math.max(d.current || 0, total));
            if (intention) d.intention = intention;
            d.completed = d.current >= d.target;
        } else {
            const target = tgtIn > 0 ? tgtIn : total;
            deenData.dhikr.push({ name, target, current: Math.min(total, target), intention, deadline: '', completed: total >= target });
            idx = deenData.dhikr.length - 1;
        }
        indexByName[name.toLowerCase()] = idx;
    });
    // 2) History entries (skipped if already present; never re-sent to the Sheet)
    let added = 0;
    recoverRows.filter(r => r.isNew).forEach(r => {
        const e = { id: r.id, timestamp: r.timestamp, category: 'deen', title: r.title, amount: r.amount, recovered: true };
        if (r.kind === 'dhikr') { e.actionType = 'complete'; const ix = indexByName[r.name.toLowerCase()]; e.taskId = ix != null ? 'dhikr-' + ix : 'dhikr-recovered'; }
        else if (r.kind === 'swalath') { e.actionType = 'deen_swalath'; e.taskId = 'swalath-direct'; }
        else if (r.kind === 'hizb') { e.actionType = 'deen_hizb'; e.taskId = 'hizb-direct'; }
        else if (r.kind === 'juz') { e.actionType = 'complete'; e.taskId = 'juz-recovered'; }
        else if (r.kind === 'qada') { e.actionType = 'deen_qada'; e.taskId = 'qada'; }
        activityHistory.push(e); added++;
        r.isNew = false;
    });
    // 3) Juz completions
    recoverRows.filter(r => r.kind === 'juz').forEach(r => {
        if (!deenData.quran.some(q => q.juz === r.juz && q.completed)) deenData.quran.push({ juz: r.juz, intention: '', completed: true });
    });
    // 4) Totals: recompute from the full history; only ever raise them
    const swRe = /swalath|salawat|salawaat|darood|durood/i;
    let sw = 0, hz = 0;
    activityHistory.forEach(h => {
        if (!h) return; const a = Number(h.amount) || 0;
        if (h.actionType === 'deen_swalath') sw += a;
        else if (h.actionType === 'deen_hizb') hz += a;
        else if (h.actionType === 'complete') { if (swRe.test(h.title || '')) sw += a; if (/hizb/i.test(h.title || '')) hz += a; }
    });
    if (!deenData.swalathStats) deenData.swalathStats = { total: 0 };
    if (!deenData.quranStats) deenData.quranStats = { totalHizb: 0, totalJuz: 0, totalKhatm: 0 };
    deenData.swalathStats.total = Math.max(deenData.swalathStats.total || 0, sw);
    deenData.quranStats.totalHizb = Math.max(deenData.quranStats.totalHizb || 0, hz);
    deenData.quranStats.totalJuz = Math.floor(deenData.quranStats.totalHizb / 2);
    deenData.quranStats.totalKhatm = Math.floor(deenData.quranStats.totalHizb / 60);
    saveData(); render();
    closeModal('recover-modal');
    showToast(`Restored ${added} entries`, '✅');
}

Object.assign(window, { openDhikrEdit, saveDhikrEdit, openRecover, recoverFromSheet, recoverFromFile, applyRecovery, normalizeRecoveredLogs, parseCSV });
