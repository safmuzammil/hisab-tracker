// ==========================================
// FIREBASE CLOUD SERVER INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPw0XqzplPvH6KxbcJxwYNdyjfdPDntNo",
    authDomain: "hisab-1127d.firebaseapp.com",
    projectId: "hisab-1127d",
    storageBucket: "hisab-1127d.firebasestorage.app",
    messagingSenderId: "155630179687",
    appId: "1:155630179687:web:16e1542dbded16f337cbc2"
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
        migrateLegacyTasks(); 
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
    authContainer.style.display = 'flex';
    authContainer.innerHTML = `<img src="${user.picture}" class="profile-pic" alt="Profile"><div class="profile-info"><h3>${user.name}</h3><p>${user.email}</p></div><button onclick="logout()" style="background:transparent; border:1px solid #aaa; color:#aaa; width:auto; padding:5px 10px; margin-left:auto; font-size:0.8rem;">Logout</button>`;
}

// ==========================================
// APP STATE & STORAGE
// ==========================================
let lastModifiedLocal = parseInt(localStorage.getItem('hisab_last_modified')) || 0; 

let tasks = JSON.parse(localStorage.getItem('hisab_tasks')) || [];
let activityHistory = JSON.parse(localStorage.getItem('hisab_history')) || [];
let badHabits = JSON.parse(localStorage.getItem('hisab_bad_habits')) || []; 
let charityData = JSON.parse(localStorage.getItem('hisab_charity')) || { pending: 0, paid: 0 }; 

if (isNaN(charityData.pending) || charityData.pending == null) charityData.pending = 0;
if (isNaN(charityData.paid) || charityData.paid == null) charityData.paid = 0;

let deenData = JSON.parse(localStorage.getItem('hisab_deen')) || {};
if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
if (!deenData.zakatInputs) deenData.zakatInputs = { cash: 0, gold: 0, invest: 0 };
if (!deenData.quran) deenData.quran = [];
if (!deenData.dhikr) deenData.dhikr = [];

let ledgerData = JSON.parse(localStorage.getItem('hisab_ledger')) || [];
let investData = JSON.parse(localStorage.getItem('hisab_invest')) || []; 

let tasksProgressChart = null;
let badHabitsChart = null;

// ==========================================
// CLOUD SYNC LOGIC
// ==========================================
function listenToFirebase() {
    if (!currentUser) return;
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const parsed = docSnap.data();
            const cloudModified = parsed.lastModified || 0;

            if (lastModifiedLocal > cloudModified && lastModifiedLocal > 0) {
                syncDataToFirebase();
                return;
            }

            tasks = parsed.tasks || []; 
            activityHistory = parsed.history || []; 
            badHabits = parsed.badHabits || []; 
            charityData = parsed.charity || charityData;
            
            if (isNaN(charityData.pending) || charityData.pending == null) charityData.pending = 0;
            if (isNaN(charityData.paid) || charityData.paid == null) charityData.paid = 0;

            if (parsed.deen) { 
                deenData = parsed.deen; 
                if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
                if (!deenData.zakatInputs) deenData.zakatInputs = { cash: 0, gold: 0, invest: 0 };
                if (!deenData.quran) deenData.quran = [];
                if (!deenData.dhikr) deenData.dhikr = [];
            } 
            
            if (parsed.ledger) ledgerData = parsed.ledger; 
            if (parsed.invest) investData = parsed.invest;

            lastModifiedLocal = cloudModified;
            localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString());
            
            migrateLegacyTasks();
            saveDataLocallyOnly(); 
            render();
        } else { 
            migrateLegacyTasks();
            saveData(); 
        }
    });
}

function migrateLegacyTasks() {
    let needsSave = false;
    tasks.forEach(t => {
        if (!t.createdAt || isNaN(new Date(t.createdAt).getTime())) {
            t.createdAt = parseInt(t.id) || Date.now();
            needsSave = true;
        }
        if (!t.legacyMigrated) {
            const periodsLeftToday = getPeriodsLeft(t.type || 'daily', Date.now());
            t.totalYearlyTarget = getPeriodsLeft(t.type || 'daily', t.createdAt) * (t.baseTarget || 1);
            t.currentTarget = periodsLeftToday * (t.baseTarget || 1);
            t.legacyMigrated = true;
            t.isCompleted = false;
            needsSave = true;
        }
    });
    if (needsSave) saveData();
}

function saveDataLocallyOnly() { 
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks)); 
    localStorage.setItem('hisab_history', JSON.stringify(activityHistory)); 
    localStorage.setItem('hisab_bad_habits', JSON.stringify(badHabits)); 
    localStorage.setItem('hisab_charity', JSON.stringify(charityData)); 
    localStorage.setItem('hisab_deen', JSON.stringify(deenData)); 
    localStorage.setItem('hisab_ledger', JSON.stringify(ledgerData)); 
    localStorage.setItem('hisab_invest', JSON.stringify(investData)); 
}

async function syncDataToFirebase() { 
    if (currentUser) { 
        try { 
            await setDoc(doc(db, "users", currentUser.uid), { 
                tasks, history: activityHistory, badHabits, charity: charityData, deen: deenData, ledger: ledgerData, invest: investData,
                lastModified: lastModifiedLocal 
            }); 
        } catch(e) { console.error("Firebase sync failed", e); } 
    } 
}

function saveData() { 
    lastModifiedLocal = Date.now();
    localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString());
    saveDataLocallyOnly(); 
    syncDataToFirebase(); 
}

// ==========================================
// VISUAL EFFECTS ENGINE (SAD/ANGRY PENALTY)
// ==========================================
function triggerSadEffect(event) {
    if (!event) return;
    
    // 1. Shake the button deeply
    const btn = event.target.closest('button');
    if (btn) {
        btn.classList.add('shake-angry');
        setTimeout(() => btn.classList.remove('shake-angry'), 400);
    }

    // 2. Spawn a floating sad/angry emoji at the exact tap coordinates
    const emojis = ['😡', '😞', '📉', '💸'];
    const icon = emojis[Math.floor(Math.random() * emojis.length)];
    
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-emoji';
    floatEl.innerText = icon;
    floatEl.style.left = (event.clientX - 20) + 'px';
    floatEl.style.top = (event.clientY - 20) + 'px';
    document.body.appendChild(floatEl);
    
    // 3. Heavy Haptic feedback
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

    setTimeout(() => floatEl.remove(), 1200);
}


// ==========================================
// CHARITY / SADAQAH LOGIC
// ==========================================
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
// TASKS LOGIC (ANNUAL ALLOCATION)
// ==========================================
function getPeriodsLeft(type, dateObj) {
    const now = new Date();
    const currentYear = now.getFullYear();
    let start = new Date(dateObj);
    
    if (isNaN(start.getTime())) start = new Date(); 
    if (start.getFullYear() < currentYear) { start = new Date(currentYear, 0, 1); }
    
    start.setHours(0, 0, 0, 0); 
    const eoy = new Date(currentYear, 11, 31, 23, 59, 59); 
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.round((eoy.getTime() - start.getTime()) / msPerDay) + 1; 

    if (type === 'daily') return daysLeft;
    if (type === 'weekly') return Math.ceil(daysLeft / 7);
    if (type === 'monthly') return (12 - start.getMonth());
    return 1; 
}

function saveTask() { 
    const id = document.getElementById('task-id').value; 
    const title = document.getElementById('task-title').value.trim(); 
    const type = document.getElementById('task-type').value; 
    const baseTarget = parseFloat(document.getElementById('task-base-target').value) || 1; 
    const donationPenalty = parseFloat(document.getElementById('task-donation').value) || 0; 
    const reminderTime = document.getElementById('task-reminder-time').value;

    if (!title) return alert('Enter a task name'); 

    if (id) { 
        const task = tasks.find(t => t.id === id); 
        task.title = title; task.reminderTime = reminderTime;
        task.donationPenalty = donationPenalty;
        
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
        
        tasks.push({ 
            id: creationTime.toString(), 
            createdAt: creationTime,
            title, 
            type, 
            baseTarget, 
            totalYearlyTarget,
            currentTarget: totalYearlyTarget, 
            reminderTime,
            donationPenalty,
            isCompleted: false,
            legacyMigrated: true 
        }); 
    } 
    cancelEdit(); saveData(); render(); 
}

function editTask(id) { 
    const task = tasks.find(t => t.id === id); if (!task) return; 
    document.getElementById('form-title').innerText = '✏️ Edit Task'; document.getElementById('btn-save-task').innerText = 'Save Changes'; document.getElementById('btn-cancel-edit').style.display = 'inline-block'; 
    document.getElementById('task-id').value = task.id; document.getElementById('task-title').value = task.title; document.getElementById('task-type').value = task.type || 'daily'; document.getElementById('task-base-target').value = task.baseTarget; 
    document.getElementById('task-donation').value = task.donationPenalty || '';
    document.getElementById('task-reminder-time').value = task.reminderTime || '';
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function cancelEdit() { 
    document.getElementById('form-title').innerText = '➕ Add New Task'; document.getElementById('btn-save-task').innerText = 'Add Task'; document.getElementById('btn-cancel-edit').style.display = 'none'; 
    document.getElementById('task-id').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-type').value = 'daily'; document.getElementById('task-base-target').value = '';
    document.getElementById('task-donation').value = '';
    document.getElementById('task-reminder-time').value = '';
}

function deleteTask(id) { if (confirm("Delete this task?")) { tasks = tasks.filter(t => t.id !== id); saveData(); render(); } }

function logProgress(id) {
    const task = tasks.find(t => t.id === id); 
    const amountDone = parseFloat(document.getElementById(`input-${id}`).value) || 0; 
    if (amountDone <= 0) return;
    
    if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 }, colors: ['#bb86fc', '#03dac6', '#f6e58d'] });
    
    activityHistory.push({ id: Date.now().toString(), taskId: task.id, timestamp: Date.now(), title: "Completed: " + task.title, actionType: 'complete', amount: amountDone });
    
    task.currentTarget -= amountDone; 
    if (task.currentTarget <= 0) task.isCompleted = true; 
    
    saveData(); render();
}

function markMissed(id, event) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    if (confirm(`Mark "${task.title}" as missed?`)) {
        
        triggerSadEffect(event);
        
        let addedPenalty = 0;
        if (task.donationPenalty > 0) {
            charityData.pending += task.donationPenalty;
            addedPenalty = task.donationPenalty;
        }
        
        activityHistory.push({ id: Date.now().toString(), taskId: task.id, timestamp: Date.now(), title: "Missed: " + task.title, actionType: 'missed', amount: 1, donationAdded: addedPenalty });
        
        task.currentTarget -= 1; 
        if (task.currentTarget <= 0) task.isCompleted = true;
        saveData(); render();
    }
}

function renderTasks() {
    const container = document.getElementById('task-list-container'); container.innerHTML = '';
    const filterView = document.getElementById('task-view-filter') ? document.getElementById('task-view-filter').value : 'all';

    const categories = [ 
        { id: 'daily', title: '📅 Daily Tasks (Yearly Target)', filter: t => t.type === 'daily' }, 
        { id: 'weekly', title: '📆 Weekly Tasks (Yearly Target)', filter: t => t.type === 'weekly' }, 
        { id: 'monthly', title: '🗓️ Monthly Tasks (Yearly Target)', filter: t => t.type === 'monthly' }, 
        { id: 'once', title: '🎯 One-Time Tasks', filter: t => t.type === 'once' } 
    ];

    categories.forEach(cat => {
        if (filterView !== 'all' && cat.id !== filterView) return;
        const filteredTasks = tasks.filter(cat.filter); if (filteredTasks.length === 0) return;
        
        const section = document.createElement('div'); section.innerHTML = `<h3 style="margin-top:25px; color:#ddd; font-size:1.05rem; border-bottom:1px solid #333; padding-bottom:5px;">${cat.title}</h3>`;
        
        filteredTasks.forEach(task => {
            const div = document.createElement('div');
            const isAhead = task.currentTarget <= 0; 
            div.className = `task-item ${isAhead ? 'banked' : ''}`;
            
            let statusHTML = isAhead ? `<span class="badge done-badge">✅ Completed for the Year!</span>` : `<span class="badge target">Remaining in year: ${task.currentTarget}</span>`;
            let reminderHtml = task.reminderTime ? `<span class="badge reminder">🔔 ${task.reminderTime}</span>` : ``;
            let donationHtml = task.donationPenalty ? `<span class="badge donation">💸 Penalty: ${task.donationPenalty}</span>` : ``;

            div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title">${task.title}</div>
                    <div class="task-badges">
                        <span class="badge" style="background:#333; color:#ccc;">Target: ${task.baseTarget} / ${task.type}</span>
                        ${statusHTML}
                        ${reminderHtml}
                        ${donationHtml}
                    </div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="editTask('${task.id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteTask('${task.id}')">🗑️</button>
                </div>
            </div>
            ${!isAhead ? `
            <div class="task-action-row">
                ${task.donationPenalty ? `<button class="btn-task-action missed" onclick="markMissed('${task.id}', event)">❌ Missed</button>` : ''}
                <div class="task-input-box"><input type="number" step="any" id="input-${task.id}" value="${task.baseTarget}" min="0.1"></div>
                <button class="btn-task-action done" onclick="logProgress('${task.id}')">Complete</button>
            </div>` : ''}`;
            section.appendChild(div);
        });
        container.appendChild(section);
    });
}

// ==========================================
// BAD HABITS / VICES LOGIC
// ==========================================
function addBadHabit() {
    const title = document.getElementById('bad-habit-title').value.trim();
    const donationPenalty = parseFloat(document.getElementById('bad-habit-donation').value) || 0;
    if (!title) return alert("Enter a habit name.");
    badHabits.push({ id: Date.now().toString(), title, donationPenalty, annualCount: 0 });
    document.getElementById('bad-habit-title').value = '';
    document.getElementById('bad-habit-donation').value = '';
    saveData(); renderBadHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function logBadHabit(id, event) {
    const habit = badHabits.find(h => h.id === id);
    if (!habit) return;
    
    triggerSadEffect(event);
    
    let addedPenalty = 0;
    if (habit.donationPenalty > 0) {
        charityData.pending += habit.donationPenalty;
        addedPenalty = habit.donationPenalty;
    }
    
    habit.annualCount++;
    activityHistory.push({ id: Date.now().toString(), taskId: habit.id, timestamp: Date.now(), title: "Logged Habit: " + habit.title, actionType: 'bad', amount: 1, donationAdded: addedPenalty });
    
    saveData(); renderBadHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

function deleteBadHabit(id) {
    if(confirm("Delete this habit tracker?")) {
        badHabits = badHabits.filter(h => h.id !== id);
        saveData(); renderBadHabits(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
    }
}

function renderBadHabits() {
    const container = document.getElementById('bad-habit-list-container'); container.innerHTML = '';
    
    if (badHabits.length === 0) {
        container.innerHTML = '<p style="color:#aaa; text-align:center;">No habits tracked yet.</p>'; return;
    }

    badHabits.forEach(habit => {
        const div = document.createElement('div');
        div.className = 'task-item bad-log';
        
        let donationHtml = habit.donationPenalty ? `<span class="badge donation">💸 Penalty: ${habit.donationPenalty}</span>` : ``;

        div.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-title" style="color:var(--bad);">${habit.title}</div>
                    <div class="task-badges">
                        <span class="badge" style="background:#2c2c2c; color:#fff;">Annual Total: ${habit.annualCount}</span>
                        ${donationHtml}
                    </div>
                </div>
                <div class="task-controls">
                    <button class="btn-icon" onclick="deleteBadHabit('${habit.id}')">🗑️</button>
                </div>
            </div>
            <div class="task-action-row">
                <button class="btn-task-action bad" onclick="logBadHabit('${habit.id}', event)">+1 Log Occurrence</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// ==========================================
// UNDO & HISTORY MODAL
// ==========================================
function undoAction(historyId) {
    const entry = activityHistory.find(h => h.id === historyId);
    if (!entry) return;
    
    if (confirm(`Undo "${entry.title}"?`)) {
        
        if (entry.actionType === 'complete' || entry.actionType === 'missed') {
            const task = tasks.find(t => t.id === entry.taskId);
            if (task) { task.currentTarget += entry.amount; task.isCompleted = false; }
        } 
        else if (entry.actionType === 'bad') {
            const habit = badHabits.find(h => h.id === entry.taskId);
            if (habit) { habit.annualCount -= entry.amount; }
        }
        
        if (entry.donationAdded) {
            charityData.pending -= entry.donationAdded;
            if (charityData.pending < 0) charityData.pending = 0;
        }
        
        activityHistory = activityHistory.filter(h => h.id !== historyId);
        saveData(); render(); openHistory(); 
    }
}

function openHistory() {
    document.getElementById('history-modal').style.display = 'block';
    const list = document.getElementById('history-list'); list.innerHTML = '';
    
    if (activityHistory.length === 0) { list.innerHTML = '<p style="color:#aaa;">No history recorded yet.</p>'; return; }
    
    const sorted = [...activityHistory].sort((a, b) => b.timestamp - a.timestamp);
    sorted.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString();
        const div = document.createElement('div');
        div.style = `background:var(--card); padding:15px; border-radius:10px; margin-bottom:10px; border-left: 5px solid ${item.actionType === 'bad' || item.actionType === 'missed' ? 'var(--bad)' : 'var(--success)'}`;
        
        let undoBtn = `<button onclick="undoAction('${item.id}')" style="background:transparent; border:1px solid #aaa; padding:6px 12px; font-size:0.85rem; color:#ccc; margin:0; width:auto; border-radius:6px;">↩️ Undo</button>`;
        let donationText = item.donationAdded ? `<div style="color:var(--charity); font-size:0.85rem; margin-top:4px;">💸 Added penalty: ${item.donationAdded}</div>` : '';

        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><strong style="font-size:1.1rem; color:#fff;">${item.title}</strong></div><div style="font-size:0.8rem; color:#aaa; margin-top:5px;">${date}</div>${donationText}<div style="margin-top:10px;">${undoBtn}</div>`;
        list.appendChild(div);
    });
}
function closeHistory() { document.getElementById('history-modal').style.display = 'none'; }

// ==========================================
// BACKGROUND REMINDER ENGINE
// ==========================================
setInterval(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    tasks.forEach(t => {
        if (t.reminderTime === timeString && !t.isCompleted && t.currentTarget > 0) {
            if (t.lastNotified !== timeString) {
                new Notification("Hisab Reminder: " + t.title, { body: `You have ${t.currentTarget} pending units!`, icon: "icon.png" });
                t.lastNotified = timeString;
                saveDataLocallyOnly();
            }
        }
    });
}, 60000); 

// ==========================================
// DASHBOARD & DUAL CHARTS
// ==========================================
function updateDashboard() { 
    
    document.getElementById('donation-pending').innerText = charityData.pending.toLocaleString();
    document.getElementById('donation-paid').innerText = charityData.paid.toLocaleString();

    let dTotal = 0, dComp = 0, wTotal = 0, wComp = 0, mTotal = 0, mComp = 0, oTotal = 0, oComp = 0;
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000).setHours(0,0,0,0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime(); 

    let dayPts = 0, weekPts = 0, monthPts = 0, yearPts = 0; 
    activityHistory.forEach(r => { 
        if (r.actionType === 'complete') {
            if (r.timestamp >= startOfDay) dayPts += r.amount; 
            if (r.timestamp >= startOfWeek) weekPts += r.amount; 
            if (r.timestamp >= startOfMonth) monthPts += r.amount; 
            if (r.timestamp >= startOfYear) yearPts += r.amount; 
        }
    }); 
    
    const elDay = document.getElementById('day-completed');
    if (elDay) elDay.innerText = Math.round(dayPts*100)/100; 
    const elWeek = document.getElementById('week-completed');
    if (elWeek) elWeek.innerText = Math.round(weekPts*100)/100; 
    const elMonth = document.getElementById('month-completed');
    if (elMonth) elMonth.innerText = Math.round(monthPts*100)/100; 
    const elYear = document.getElementById('year-completed');
    if (elYear) elYear.innerText = Math.round(yearPts*100)/100; 

    tasks.forEach(t => {
        let total = t.totalYearlyTarget || 1;
        let pending = Math.max(0, t.currentTarget || 0);
        let completed = Math.max(0, Math.min(total, total - pending)); 

        if(t.type === 'daily') { dTotal += total; dComp += completed; }
        if(t.type === 'weekly') { wTotal += total; wComp += completed; }
        if(t.type === 'monthly') { mTotal += total; mComp += completed; }
        if(t.type === 'once') { oTotal += total; oComp += completed; }
    });
    
    const dPct = dTotal > 0 ? parseFloat(((dComp / dTotal) * 100).toFixed(1)) : 0;
    const wPct = wTotal > 0 ? parseFloat(((wComp / wTotal) * 100).toFixed(1)) : 0;
    const mPct = mTotal > 0 ? parseFloat(((mComp / mTotal) * 100).toFixed(1)) : 0;
    const oPct = oTotal > 0 ? parseFloat(((oComp / oTotal) * 100).toFixed(1)) : 0;

    const tCanvas = document.getElementById('tasksProgressChart'); 
    if (tCanvas) {
        const ctx = tCanvas.getContext('2d'); 
        if (tasksProgressChart) tasksProgressChart.destroy(); 
        tasksProgressChart = new Chart(ctx, { 
            type: 'bar',
            data: { 
                labels: ['Daily', 'Weekly', 'Monthly', 'Once'], 
                datasets: [{ label: 'Annual Completion (%)', data: [dPct, wPct, mPct, oPct], backgroundColor: '#03dac6', borderRadius: 4 }] 
            }, 
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: '#333' }, ticks: { callback: v => v + "%" } } }, plugins: { legend: { labels: { color: '#fff' } } } } 
        }); 
    }

    const bCanvas = document.getElementById('badHabitsChart');
    if (bCanvas && badHabits.length > 0) {
        const labels = badHabits.map(h => h.title);
        const data = badHabits.map(h => h.annualCount);
        const ctx = bCanvas.getContext('2d');
        if (badHabitsChart) badHabitsChart.destroy();
        badHabitsChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Occurrences This Year', data: data, backgroundColor: '#e53935', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { stepSize: 1 } } }, plugins: { legend: { labels: { color: '#fff' } } } }
        });
    }
}

// ==========================================
// FINANCE & LIVE SYNC
// ==========================================
function renderInvestments() {
    const container = document.getElementById('invest-container'); container.innerHTML = '';
    const currency = document.getElementById('currency-toggle') ? document.getElementById('currency-toggle').value : 'INR';
    const symbol = currency === 'INR' ? '₹' : '$';
    let totalInvested = 0; let totalCurrent = 0;

    investData.forEach((inv, index) => {
        const invested = inv.qty * inv.buyPrice; const current = inv.qty * inv.currentPrice;
        const pl = current - invested; const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
        totalInvested += invested; totalCurrent += current;
        const color = pl >= 0 ? 'var(--success)' : 'var(--danger)'; const sign = pl >= 0 ? '+' : '';

        const div = document.createElement('div');
        div.style = `background: #2c2c2c; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 5px solid ${color};`;
        div.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;"><strong style="font-size: 1.2rem;">${inv.asset}</strong><button onclick="deleteInvestment(${index})" style="background:transparent; color:#888; border:none; padding:0; font-size:1.2rem;">×</button></div><div style="color: #aaa; font-size: 0.85rem; margin-bottom: 10px;">${inv.qty} units @ avg ${symbol}${inv.buyPrice.toLocaleString()}</div><div style="display: flex; justify-content: space-between; align-items: center;"><div><div style="font-size: 0.8rem; color: #aaa;">Current Price (${symbol})</div><div style="display: flex; gap: 5px; align-items: center;"><input type="number" step="any" id="inv-update-${index}" value="${inv.currentPrice}" style="width: 80px; padding: 5px; margin: 0;"><button onclick="updateInvestmentPrice(${index})" style="background: #444; color: #fff; padding: 5px 10px; margin: 0;">Update</button></div></div><div style="text-align: right;"><div style="font-size: 1.2rem; color: ${color}; font-weight: bold;">${sign}${symbol}${pl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div><div style="font-size: 0.85rem; color: ${color};">${sign}${plPercent.toFixed(2)}%</div></div></div>`;
        container.appendChild(div);
    });

    const netPL = totalCurrent - totalInvested; const netPLPercent = totalInvested > 0 ? (netPL / totalInvested) * 100 : 0;
    document.getElementById('inv-total-invested').innerText = symbol + totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('inv-current-value').innerText = symbol + totalCurrent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('inv-total-pl').innerText = `Net P/L: ${netPL >= 0 ? '+' : ''}${symbol}${netPL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${netPL >= 0 ? '+' : ''}${netPLPercent.toFixed(2)}%)`;
    document.getElementById('inv-total-pl').style.color = netPL >= 0 ? 'var(--success)' : 'var(--danger)';
}

async function fetchLivePrices() {
    const btn = document.getElementById('btn-refresh-prices'); if (!btn) return;
    btn.innerText = "⏳ Fetching from Custom Backend...";
    let updatedCount = 0;
    for (let i = 0; i < investData.length; i++) {
        let symbol = investData[i].asset.toUpperCase().trim();
        try {
            let response = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}`);
            if (response.ok) {
                let data = await response.json();
                if (data.chart && data.chart.result && data.chart.result.length > 0) {
                    let livePrice = data.chart.result[0].meta.regularMarketPrice;
                    if (livePrice) { investData[i].currentPrice = parseFloat(livePrice); updatedCount++; }
                }
            }
        } catch (error) { console.error(`Error pulling market values for: ${symbol}`, error); }
    }
    if (updatedCount > 0) { saveData(); renderInvestments(); alert(`✅ Successfully synced live prices!`); } 
    else { alert("⚠️ Live sync failed. The backend might still be deploying, give Vercel 1 minute."); }
    btn.innerText = "🔄 Auto-Update Live Market Prices";
}

let searchTimeout = null;
async function searchAsset(query) {
    const list = document.getElementById('asset-suggestions');
    if (!query || query.trim().length < 2) { list.style.display = 'none'; return; }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json(); list.innerHTML = '';
                if (data.quotes && data.quotes.length > 0) {
                    data.quotes.forEach(item => {
                        if(item.symbol && item.quoteType) {
                            const div = document.createElement('div'); div.className = 'autocomplete-item';
                            div.innerHTML = `<span class="auto-symbol">${item.symbol}</span> <span class="auto-name">${item.shortname || item.longname || item.exchDisp}</span>`;
                            div.onclick = function() { document.getElementById('inv-asset').value = item.symbol; list.style.display = 'none'; };
                            list.appendChild(div);
                        }
                    });
                    list.style.display = 'block';
                } else { list.style.display = 'none'; }
            }
        } catch (err) { console.error("Search fetch failed", err); }
    }, 400);
}
document.addEventListener('click', function (e) { if (e.target.id !== 'inv-asset') { const list = document.getElementById('asset-suggestions'); if(list) list.style.display = 'none'; } });

function addInvestment() { const asset = document.getElementById('inv-asset').value.trim(); const qty = parseFloat(document.getElementById('inv-qty').value); const buyPrice = parseFloat(document.getElementById('inv-buy').value); if (!asset || !qty || !buyPrice) return alert("Please fill in all details."); investData.push({ asset, qty, buyPrice, currentPrice: buyPrice }); document.getElementById('inv-asset').value = ''; document.getElementById('inv-qty').value = ''; document.getElementById('inv-buy').value = ''; saveData(); renderInvestments(); }
function updateInvestmentPrice(index) { const newPrice = parseFloat(document.getElementById(`inv-update-${index}`).value); if (isNaN(newPrice) || newPrice < 0) return alert("Invalid price."); investData[index].currentPrice = newPrice; saveData(); renderInvestments(); }
function deleteInvestment(index) { if (confirm(`Remove ${investData[index].asset}?`)) { investData.splice(index, 1); saveData(); renderInvestments(); } }

// ==========================================
// DEEN & LEDGER
// ==========================================
function renderDeen() { 
    const dhikrContainer = document.getElementById('dhikr-list-container'); dhikrContainer.innerHTML = '';
    deenData.dhikr.forEach((d, index) => {
        const div = document.createElement('div'); div.className = 'task-item'; div.style.borderLeftColor = 'var(--deen)';
        if (d.completed) div.style.opacity = '0.6';
        let intentionHtml = d.intention ? `<div style="font-size:0.85rem; color:#aaa; margin-bottom:8px;"><em>" ${d.intention} "</em></div>` : '';
        let deadlineHtml = d.deadline ? `<span class="badge" style="background:rgba(246, 229, 141, 0.15); color:var(--warning);">⏳ ${d.deadline}</span>` : '';
        let progressHtml = d.completed ? `<span class="badge done-badge">✅ Completed</span>` : `<span class="badge target">Progress: ${d.current} / ${d.target}</span>`;
        div.innerHTML = `<div class="task-header"><div><div class="task-title">${d.name}</div>${intentionHtml}<div class="task-badges">${progressHtml}${deadlineHtml}</div></div><div class="task-controls"><button class="btn-icon" onclick="deleteDhikr(${index})">🗑️</button></div></div>${!d.completed ? `<div class="task-action-row"><div class="task-input-box"><input type="number" id="dhikr-input-${index}" value="1" min="1"></div><button class="btn-task-action" style="flex:1; background:var(--deen); color:#000;" onclick="logDhikr(${index})">Log Dhikr</button></div>` : ''}`;
        dhikrContainer.appendChild(div);
    });

    const select = document.getElementById('juz-select'); if(select.options.length <= 1) { for(let i=1; i<=30; i++) { let opt = document.createElement('option'); opt.value = i; opt.innerHTML = `Juz ${i}`; select.appendChild(opt); } } const juzContainer = document.getElementById('juz-list-container'); juzContainer.innerHTML = ''; deenData.quran.forEach((q, index) => { const div = document.createElement('div'); div.className = 'quran-item'; div.style.opacity = q.completed ? '0.5' : '1'; div.style.flexDirection = 'column'; div.style.gap = '10px'; let intentionText = q.intention ? `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;"><em>" ${q.intention} "</em></div>` : ''; div.innerHTML = `<div><strong>${q.completed ? '✅' : '📖'} Juz ${q.juz}</strong>${intentionText}</div><div style="display: flex; gap: 5px; justify-content: flex-end;">${!q.completed ? `<button onclick="completeJuz(${index})" style="background:var(--success); color:#000; padding:5px 10px; margin:0; width:auto; font-size:0.8rem;">Complete</button><button onclick="editJuz(${index})" style="background:var(--warning); color:#000; padding:5px 10px; margin:0; width:auto; font-size:0.8rem;">✏️ Edit</button>` : ''}<button onclick="deleteJuz(${index})" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:5px 10px; margin:0; width:auto; font-size:0.8rem;">🗑️</button></div>`; juzContainer.appendChild(div); }); const qadaContainer = document.getElementById('qada-container'); qadaContainer.innerHTML = ''; ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Witr'].forEach(p => { const count = deenData.qada[p]; const div = document.createElement('div'); div.className = 'qada-row'; div.innerHTML = `<div style="font-weight:bold;">${p}</div><div class="qada-controls"><span style="font-family:monospace; font-size:1.2rem; min-width:30px; text-align:center; color:${count > 0 ? 'var(--danger)' : 'var(--success)'}">${count}</span><button class="qada-btn minus" onclick="updateQada('${p}', -1)" title="Prayed Qada">✔️</button><button class="qada-btn" onclick="updateQada('${p}', 1)" title="Missed Prayer">➕</button></div>`; qadaContainer.appendChild(div); }); document.getElementById('zakat-cash').value = deenData.zakatInputs.cash; document.getElementById('zakat-gold').value = deenData.zakatInputs.gold; document.getElementById('zakat-invest').value = deenData.zakatInputs.invest; calculateZakat(); 
}

function updateQada(prayer, amount) { 
    deenData.qada[prayer] += amount; 
    if(deenData.qada[prayer] < 0) deenData.qada[prayer] = 0; 
    saveData(); 
    renderDeen(); 
}

function addDhikr() { const name = document.getElementById('dhikr-name').value.trim(); const target = parseInt(document.getElementById('dhikr-target').value); const intention = document.getElementById('dhikr-intention').value.trim(); const deadline = document.getElementById('dhikr-deadline').value; if (!name || !target || target <= 0) return alert("Please provide a valid Dhikr name and target number."); deenData.dhikr.push({ name, target, current: 0, intention, deadline, completed: false }); document.getElementById('dhikr-name').value = ''; document.getElementById('dhikr-target').value = ''; document.getElementById('dhikr-intention').value = ''; document.getElementById('dhikr-deadline').value = ''; saveData(); renderDeen(); }
function logDhikr(index) { const amount = parseInt(document.getElementById(`dhikr-input-${index}`).value) || 0; if (amount <= 0) return; deenData.dhikr[index].current += amount; if (deenData.dhikr[index].current >= deenData.dhikr[index].target) { deenData.dhikr[index].current = deenData.dhikr[index].target; deenData.dhikr[index].completed = true; } saveData(); renderDeen(); }
function deleteDhikr(index) { if (confirm("Delete this committed Dhikr?")) { deenData.dhikr.splice(index, 1); saveData(); renderDeen(); } }
function addJuzIntention() { const val = document.getElementById('juz-select').value; const intention = document.getElementById('juz-intention').value.trim(); if(!val) return alert("Please select a Juz."); if(deenData.quran.find(q => q.juz == val && !q.completed)) return alert("An active intention for this Juz already exists!"); deenData.quran.push({ juz: parseInt(val), intention: intention, completed: false }); document.getElementById('juz-select').value = ''; document.getElementById('juz-intention').value = ''; saveData(); renderDeen(); }
function completeJuz(index) { deenData.quran[index].completed = true; saveData(); renderDeen(); }
function editJuz(index) { const q = deenData.quran[index]; const newIntention = prompt(`Edit your intention for Juz ${q.juz}:`, q.intention); if (newIntention !== null) { deenData.quran[index].intention = newIntention.trim(); saveData(); renderDeen(); } }
function deleteJuz(index) { deenData.quran.splice(index, 1); saveData(); renderDeen(); }
function calculateZakat() { const cash = parseFloat(document.getElementById('zakat-cash').value) || 0; const gold = parseFloat(document.getElementById('zakat-gold').value) || 0; const invest = parseFloat(document.getElementById('zakat-invest').value) || 0; deenData.zakatInputs = { cash, gold, invest }; saveDataLocallyOnly(); const zakatDue = (cash + gold + invest) * 0.025; document.getElementById('zakat-due').innerText = zakatDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

function renderLedger() { const oweContainer = document.getElementById('ledger-owe-container'); const lentContainer = document.getElementById('ledger-lent-container'); oweContainer.innerHTML = ''; lentContainer.innerHTML = ''; const oweData = ledgerData.filter(l => l.type === 'owe' && l.remaining > 0); const lentData = ledgerData.filter(l => l.type === 'lent' && l.remaining > 0); if (oweData.length === 0) oweContainer.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">You are debt-free! 🎉</p>'; if (lentData.length === 0) lentContainer.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">Nobody owes you money currently.</p>'; ledgerData.forEach((entry, index) => { if(entry.remaining <= 0) return; const div = document.createElement('div'); div.className = `ledger-item ${entry.type}`; let titleText = entry.type === 'owe' ? `Owed to: ${entry.person}` : `Owed by: ${entry.person}`; let colorClass = entry.type === 'owe' ? 'var(--danger)' : 'var(--success)'; div.innerHTML = `<div style="display:flex; justify-content:space-between;"><span style="color:#aaa; font-size:0.8rem;">${titleText}</span><button onclick="deleteLedgerEntry(${index})" style="background:transparent; color:#888; border:none; padding:0; margin:0; width:auto; font-size:1.2rem;">×</button></div><div class="ledger-amount" style="color:${colorClass}">${entry.remaining.toLocaleString()}</div><div style="font-size:0.85rem; color:#aaa;">Original Amount: ${entry.amount.toLocaleString()} <br> ${entry.desc}</div><div class="ledger-action"><input type="number" step="any" id="pay-input-${index}" placeholder="Amount paid"><button style="background:${colorClass}; color:#000;" onclick="logLedgerPayment(${index})">Log Payment</button></div>`; if (entry.type === 'owe') oweContainer.appendChild(div); else lentContainer.appendChild(div); }); }
function addLedgerEntry() { const type = document.getElementById('ledger-type').value; const person = document.getElementById('ledger-person').value.trim(); const amount = parseFloat(document.getElementById('ledger-amount').value); const desc = document.getElementById('ledger-desc').value.trim(); if (!person || !amount || amount <= 0) return alert("Please enter a valid person and amount."); ledgerData.push({ type, person, amount, remaining: amount, desc, date: new Date().toISOString() }); document.getElementById('ledger-person').value = ''; document.getElementById('ledger-amount').value = ''; document.getElementById('ledger-desc').value = ''; saveData(); renderLedger(); }
function logLedgerPayment(index) { const amountPaid = parseFloat(document.getElementById(`pay-input-${index}`).value); if (!amountPaid || amountPaid <= 0) return; let entry = ledgerData[index]; entry.remaining -= amountPaid; if(entry.remaining <= 0) { entry.remaining = 0; alert(`🎉 The debt with ${entry.person} is fully settled!`); } saveData(); renderLedger(); }
function deleteLedgerEntry(index) { if (confirm("Delete this record?")) { ledgerData.splice(index, 1); saveData(); renderLedger(); } }

function switchTab(tabName, element) {
    localStorage.setItem('hisab_active_tab', tabName); document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); document.querySelectorAll('.nav-item').forEach(nav => { nav.classList.remove('active'); nav.classList.remove('active-bad'); nav.classList.remove('active-deen'); nav.classList.remove('active-ledger'); });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if(tabName === 'deen') { element.classList.add('active-deen'); renderDeen(); } 
    else if(tabName === 'bad-habits') { element.classList.add('active-bad'); renderBadHabits(); }
    else if(tabName === 'ledger') { element.classList.add('active-ledger'); renderLedger(); renderInvestments(); } 
    else { element.classList.add('active'); }
    
    if (tabName === 'dashboard') updateDashboard();
}

function initNotifications() { const btn = document.getElementById('btn-notifications'); if (!("Notification" in window)) { btn.style.display = 'none'; return; } if (Notification.permission === "granted") { btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); } }
function toggleNotifications() { if (!("Notification" in window)) return alert("Browser does not support notifications."); if (Notification.permission === "granted") { alert("Notifications already enabled!"); } else if (Notification.permission !== "denied") { Notification.requestPermission().then(p => { if (p === "granted") { const btn = document.getElementById('btn-notifications'); btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); } }); } else { alert("Notifications blocked in device settings."); } }

function render() { renderTasks(); renderBadHabits(); renderDeen(); renderLedger(); renderInvestments(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard(); }

// ==========================================
// EXPORTS (CLEANED)
// ==========================================
window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.switchTab = switchTab; window.saveTask = saveTask; window.editTask = editTask; window.cancelEdit = cancelEdit; window.deleteTask = deleteTask; window.logProgress = logProgress; window.markMissed = markMissed; window.undoAction = undoAction; window.addDhikr = addDhikr; window.logDhikr = logDhikr; window.deleteDhikr = deleteDhikr; window.addJuzIntention = addJuzIntention; window.completeJuz = completeJuz; window.editJuz = editJuz; window.deleteJuz = deleteJuz; window.updateQada = updateQada; window.calculateZakat = calculateZakat; window.addLedgerEntry = addLedgerEntry; window.logLedgerPayment = logLedgerPayment; window.deleteLedgerEntry = deleteLedgerEntry; window.fetchLivePrices = fetchLivePrices; window.searchAsset = searchAsset; window.addInvestment = addInvestment; window.updateInvestmentPrice = updateInvestmentPrice; window.deleteInvestment = deleteInvestment; window.toggleNotifications = toggleNotifications; window.renderTasks = renderTasks; window.renderInvestments = renderInvestments; window.openHistory = openHistory; window.closeHistory = closeHistory; window.addBadHabit = addBadHabit; window.logBadHabit = logBadHabit; window.deleteBadHabit = deleteBadHabit; window.payDonation = payDonation;

initNotifications();
const savedTab = localStorage.getItem('hisab_active_tab') || 'dashboard'; const savedNavElement = document.getElementById('nav-' + savedTab); if (savedNavElement) switchTab(savedTab, savedNavElement);