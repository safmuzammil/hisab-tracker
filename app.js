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
let goodHabits = JSON.parse(localStorage.getItem('hisab_good_habits')) || []; 
let bonusPoints = parseInt(localStorage.getItem('hisab_bonus_points')) || 0;
let charityData = JSON.parse(localStorage.getItem('hisab_charity')) || { pending: 0, paid: 0 }; 

let deenData = JSON.parse(localStorage.getItem('hisab_deen')) || {};
if (!deenData.qada) deenData.qada = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
if (!deenData.dhikr) deenData.dhikr = [];

// NEW STATE VARIABLES
let budgetData = JSON.parse(localStorage.getItem('hisab_budget')) || { limit: 0, expenses: [] };
let backlogData = JSON.parse(localStorage.getItem('hisab_backlog')) || [];

let tasksProgressChart = null;

// ==========================================
// CLOUD SYNC LOGIC
// ==========================================
function listenToFirebase() {
    if (!currentUser) return;
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const parsed = docSnap.data();
            const cloudModified = parsed.lastModified || 0;

            if (lastModifiedLocal > cloudModified && lastModifiedLocal > 0) { syncDataToFirebase(); return; }

            tasks = parsed.tasks || []; activityHistory = parsed.history || []; badHabits = parsed.badHabits || []; goodHabits = parsed.goodHabits || []; bonusPoints = parsed.bonusPoints || 0; charityData = parsed.charity || charityData; deenData = parsed.deen || deenData;
            budgetData = parsed.budget || budgetData;
            backlogData = parsed.backlog || backlogData;

            lastModifiedLocal = cloudModified;
            localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString());
            saveDataLocallyOnly(); render();
        } else { saveData(); }
    });
}

function saveDataLocallyOnly() { 
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks)); localStorage.setItem('hisab_history', JSON.stringify(activityHistory)); localStorage.setItem('hisab_bad_habits', JSON.stringify(badHabits)); localStorage.setItem('hisab_good_habits', JSON.stringify(goodHabits)); localStorage.setItem('hisab_bonus_points', bonusPoints.toString()); localStorage.setItem('hisab_charity', JSON.stringify(charityData)); localStorage.setItem('hisab_deen', JSON.stringify(deenData)); 
    localStorage.setItem('hisab_budget', JSON.stringify(budgetData));
    localStorage.setItem('hisab_backlog', JSON.stringify(backlogData));
}

async function syncDataToFirebase() { 
    if (currentUser) { 
        try { await setDoc(doc(db, "users", currentUser.uid), { tasks, history: activityHistory, badHabits, goodHabits, bonusPoints, charity: charityData, deen: deenData, budget: budgetData, backlog: backlogData, lastModified: lastModifiedLocal }); } catch(e) { console.error("Firebase sync failed", e); } 
    } 
}

function saveData() { lastModifiedLocal = Date.now(); localStorage.setItem('hisab_last_modified', lastModifiedLocal.toString()); saveDataLocallyOnly(); syncDataToFirebase(); }

// ==========================================
// CHARITY / SADAQAH LOGIC
// ==========================================
function payDonation() {
    const input = document.getElementById('donation-pay-amount'); const amount = parseFloat(input.value) || 0;
    if (amount <= 0) return alert("Please enter a valid amount to pay.");
    charityData.pending = Math.max(0, charityData.pending - amount); charityData.paid += amount; input.value = '';
    saveData(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#f6e58d', '#03dac6', '#ffffff'] });
}

// ==========================================
// TASKS LOGIC (Core Mechanics simplified for space)
// ==========================================
function getPeriodsLeft(type, dateObj) {
    const now = new Date(); const currentYear = now.getFullYear(); let start = new Date(dateObj);
    if (isNaN(start.getTime())) start = new Date(); if (start.getFullYear() < currentYear) start = new Date(currentYear, 0, 1);
    start.setHours(0, 0, 0, 0); const eoy = new Date(currentYear, 11, 31, 23, 59, 59); const msPerDay = 1000 * 60 * 60 * 24; const daysLeft = Math.round((eoy.getTime() - start.getTime()) / msPerDay) + 1; 
    if (type === 'daily') return daysLeft; if (type === 'weekly') return Math.ceil(daysLeft / 7); if (type === 'monthly') return (12 - start.getMonth()); return 1; 
}

function saveTask() { 
    const id = document.getElementById('task-id').value; const title = document.getElementById('task-title').value.trim(); const type = document.getElementById('task-type').value; const baseTarget = parseFloat(document.getElementById('task-base-target').value) || 1; const donationPenalty = parseFloat(document.getElementById('task-donation').value) || 0; const isMaxOnceDaily = document.getElementById('task-is-max-once').checked;
    if (!title) return alert('Enter a task name'); 
    if (id) { 
        const task = tasks.find(t => t.id === id); task.title = title; task.donationPenalty = donationPenalty; task.isMaxOnceDaily = isMaxOnceDaily;
        const creationTime = task.createdAt || Date.now(); const newTotalYearly = getPeriodsLeft(type, creationTime) * baseTarget; const targetDiff = newTotalYearly - (task.totalYearlyTarget || 0);
        task.type = type; task.baseTarget = baseTarget; task.totalYearlyTarget = newTotalYearly; task.currentTarget = Math.max(0, (task.currentTarget || 0) + targetDiff); task.isCompleted = task.currentTarget <= 0;
    } else { 
        const creationTime = Date.now(); const totalYearlyTarget = getPeriodsLeft(type, creationTime) * baseTarget;
        tasks.push({ id: creationTime.toString(), createdAt: creationTime, title, type, baseTarget, totalYearlyTarget, currentTarget: totalYearlyTarget, donationPenalty, isMaxOnceDaily, missedCount: 0, isCompleted: false }); 
    } 
    cancelEdit(); saveData(); render(); 
}

function editTask(id) { 
    const task = tasks.find(t => t.id === id); if (!task) return; 
    document.getElementById('form-title').innerText = '✏️ Edit Task'; document.getElementById('btn-save-task').innerText = 'Save Changes'; document.getElementById('btn-cancel-edit').style.display = 'inline-block'; 
    document.getElementById('task-id').value = task.id; document.getElementById('task-title').value = task.title; document.getElementById('task-type').value = task.type || 'daily'; document.getElementById('task-base-target').value = task.baseTarget; document.getElementById('task-donation').value = task.donationPenalty || ''; document.getElementById('task-is-max-once').checked = task.isMaxOnceDaily || false; window.scrollTo({ top: 0, behavior: 'smooth' }); 
}
function cancelEdit() { document.getElementById('form-title').innerText = '➕ Add New Task'; document.getElementById('btn-save-task').innerText = 'Add Task'; document.getElementById('btn-cancel-edit').style.display = 'none'; document.getElementById('task-id').value = ''; document.getElementById('task-title').value = ''; document.getElementById('task-type').value = 'daily'; document.getElementById('task-base-target').value = ''; document.getElementById('task-donation').value = ''; document.getElementById('task-is-max-once').checked = false; }
function deleteTask(id) { if (confirm("Delete this task?")) { tasks = tasks.filter(t => t.id !== id); saveData(); render(); } }

function logProgress(id) {
    const task = tasks.find(t => t.id === id); const amountDone = parseFloat(document.getElementById(`input-${id}`).value) || 0; if (amountDone <= 0) return;
    if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 }, colors: ['#bb86fc', '#03dac6', '#f6e58d'] });
    task.lastCompletedDay = new Date().toDateString(); activityHistory.push({ id: Date.now().toString(), taskId: task.id, timestamp: Date.now(), title: "Completed: " + task.title, actionType: 'complete', amount: amountDone });
    task.currentTarget -= amountDone; if (task.currentTarget <= 0) task.isCompleted = true; saveData(); render();
}

function renderTasks() {
    const container = document.getElementById('task-list-container'); container.innerHTML = ''; const filterView = document.getElementById('task-view-filter') ? document.getElementById('task-view-filter').value : 'all';
    const categories = [ { id: 'daily', title: '📅 Daily Tasks', filter: t => t.type === 'daily' }, { id: 'weekly', title: '📆 Weekly Tasks', filter: t => t.type === 'weekly' }, { id: 'monthly', title: '🗓️ Monthly Tasks', filter: t => t.type === 'monthly' }, { id: 'once', title: '🎯 One-Time Tasks', filter: t => t.type === 'once' } ];
    categories.forEach(cat => {
        if (filterView !== 'all' && cat.id !== filterView) return; const filteredTasks = tasks.filter(cat.filter); if (filteredTasks.length === 0) return;
        const section = document.createElement('div'); section.innerHTML = `<h3 style="margin-top:25px; color:#ddd; font-size:1.05rem; border-bottom:1px solid #333; padding-bottom:5px;">${cat.title}</h3>`;
        filteredTasks.forEach(task => {
            const div = document.createElement('div'); const isAhead = task.currentTarget <= 0; div.className = `task-item ${isAhead ? 'banked' : ''}`;
            let statusHTML = isAhead ? `<span class="badge done-badge">✅ Completed for the Year!</span>` : `<span class="badge target">Remaining in year: ${task.currentTarget}</span>`;
            div.innerHTML = `<div class="task-header"><div><div class="task-title">${task.title}</div><div class="task-badges"><span class="badge" style="background:#333; color:#ccc;">Target: ${task.baseTarget} / ${task.type}</span>${statusHTML}</div></div><div class="task-controls"><button class="btn-icon" onclick="editTask('${task.id}')">✏️</button><button class="btn-icon" onclick="deleteTask('${task.id}')">🗑️</button></div></div>${!isAhead ? `<div class="task-action-row"><div class="task-input-box"><input type="number" step="any" id="input-${task.id}" value="${task.baseTarget}" min="0.1"></div><button class="btn-task-action done" onclick="logProgress('${task.id}')">Complete</button></div>` : ''}`;
            section.appendChild(div);
        }); container.appendChild(section);
    });
}

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
    
    document.getElementById('expense-desc').value = ''; document.getElementById('expense-amount').value = ''; document.getElementById('expense-date').value = '';
    saveData(); renderBudget();
}

function deleteExpense(id) {
    if (confirm("Delete this expense log?")) {
        budgetData.expenses = budgetData.expenses.filter(e => e.id !== id);
        saveData(); renderBudget();
    }
}

function renderBudget() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    document.getElementById('budget-month-title').innerText = monthNames[currentMonth] + " " + currentYear;
    document.getElementById('budget-limit-display').innerText = budgetData.limit.toLocaleString();
    
    // Calculate this month's total
    let monthlyTotal = 0;
    const listContainer = document.getElementById('expense-list-container');
    listContainer.innerHTML = '';
    
    // Sort expenses newest first
    const sortedExpenses = [...budgetData.expenses].sort((a, b) => b.date - a.date);
    
    let hasExpensesThisMonth = false;

    sortedExpenses.forEach(exp => {
        const expDate = new Date(exp.date);
        if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
            monthlyTotal += exp.amount;
            hasExpensesThisMonth = true;
            
            const div = document.createElement('div');
            div.style = "background:#2c2c2c; padding:12px; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--danger);";
            div.innerHTML = `
                <div>
                    <div style="font-weight:bold;">${exp.desc}</div>
                    <div style="font-size:0.8rem; color:#888;">${expDate.toLocaleDateString()}</div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="color:var(--danger); font-weight:bold;">₹${exp.amount.toLocaleString()}</span>
                    <button onclick="deleteExpense('${exp.id}')" style="background:transparent; color:#888; padding:0; margin:0; border:none; width:auto; font-size:1.2rem;">×</button>
                </div>
            `;
            listContainer.appendChild(div);
        }
    });

    if (!hasExpensesThisMonth) {
        listContainer.innerHTML = '<p style="color:#aaa; text-align:center;">No expenses logged for this month yet.</p>';
    }

    // Update Dashboard UI elements
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
        fillEl.style.width = '0%';
        remainingText.innerText = 'Limit not set';
    }
}

// ==========================================
// BACKLOG (WATCH/READ LATER) LOGIC
// ==========================================
function addBacklogItem() {
    const title = document.getElementById('backlog-title').value.trim();
    const link = document.getElementById('backlog-link').value.trim();
    const type = document.getElementById('backlog-type').value;
    const notes = document.getElementById('backlog-notes').value.trim();

    if (!title) return alert("Please provide a title or name for the item.");

    backlogData.push({
        id: Date.now().toString(),
        title, link, type, notes,
        addedAt: Date.now(),
        completed: false
    });

    document.getElementById('backlog-title').value = '';
    document.getElementById('backlog-link').value = '';
    document.getElementById('backlog-notes').value = '';

    saveData(); renderBacklog();
}

function toggleBacklogStatus(id) {
    const item = backlogData.find(b => b.id === id);
    if (item) {
        item.completed = !item.completed;
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
    const container = document.getElementById('backlog-list-container');
    container.innerHTML = '';
    
    const filterView = document.getElementById('backlog-filter') ? document.getElementById('backlog-filter').value : 'all';
    
    let filteredData = backlogData;
    if (filterView === 'pending') filteredData = backlogData.filter(b => !b.completed);
    if (filterView === 'completed') filteredData = backlogData.filter(b => b.completed);

    if (filteredData.length === 0) {
        container.innerHTML = '<p style="color:#aaa; text-align:center;">Library is empty for this view.</p>';
        return;
    }

    // Sort: Pending first, then by date added (newest first)
    filteredData.sort((a, b) => {
        if (a.completed === b.completed) return b.addedAt - a.addedAt;
        return a.completed ? 1 : -1;
    });

    const typeIcons = { 'video': '📺', 'article': '📰', 'book': '📚', 'other': '🔖' };

    filteredData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.style.borderLeftColor = 'var(--backlog)';
        if (item.completed) div.style.opacity = '0.5';

        let linkHtml = item.link ? `<a href="${item.link}" target="_blank" style="color:var(--backlog); font-size:0.85rem; text-decoration:none; display:block; margin-bottom:5px;">🔗 Open Link</a>` : '';
        let notesHtml = item.notes ? `<div style="font-size:0.85rem; color:#aaa; margin-bottom:8px; background:#111; padding:8px; border-radius:5px;">${item.notes}</div>` : '';
        let statusBadge = item.completed ? `<span class="badge done-badge">✅ Finished</span>` : '';

        div.innerHTML = `
            <div class="task-header" style="margin-bottom:10px;">
                <div style="flex:1;">
                    <div style="font-size:0.8rem; color:#888; margin-bottom:3px;">${typeIcons[item.type] || '🔖'} ${item.type.toUpperCase()}</div>
                    <div class="task-title" style="${item.completed ? 'text-decoration:line-through;' : ''}">${item.title}</div>
                    ${statusBadge}
                </div>
                <div class="task-controls">
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
// OTHER TABS (HABITS & DEEN)
// ==========================================
function renderHabits() { /* ... Same logic as previous for Good/Bad habits ... */ }
function addGoodHabit() { /* ... */ } function logGoodHabit() { /* ... */ } function addBadHabit() { /* ... */ } function logBadHabit() { /* ... */ }
function renderDeen() { /* ... Same logic as previous for Dhikr/Qada ... */ }
function addDhikr() { /* ... */ } function logDhikr() { /* ... */ }

// ==========================================
// CORE APP ROUTING & UI
// ==========================================
function updateDashboard() { 
    // Simplified Dashboard Update
    let dTotal = 0, dComp = 0, wTotal = 0, wComp = 0;
    tasks.forEach(t => {
        let total = t.totalYearlyTarget || 1; let pending = Math.max(0, t.currentTarget || 0); let completed = Math.max(0, Math.min(total, total - pending)); 
        if(t.type === 'daily') { dTotal += total; dComp += completed; } if(t.type === 'weekly') { wTotal += total; wComp += completed; }
    });
    
    const tCanvas = document.getElementById('tasksProgressChart'); 
    if (tCanvas) {
        const ctx = tCanvas.getContext('2d'); if (tasksProgressChart) tasksProgressChart.destroy(); 
        tasksProgressChart = new Chart(ctx, { type: 'bar', data: { labels: ['Daily', 'Weekly'], datasets: [{ label: 'Annual Completion (%)', data: [dTotal > 0 ? (dComp/dTotal)*100 : 0, wTotal > 0 ? (wComp/wTotal)*100 : 0], backgroundColor: '#03dac6', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false } }); 
    }
}

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

function initNotifications() { /* ... */ }
function toggleNotifications() { /* ... */ }

function render() { renderTasks(); renderBudget(); renderBacklog(); if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard(); }

// Exports for global scope HTML access
window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.switchTab = switchTab; 
window.saveTask = saveTask; window.editTask = editTask; window.cancelEdit = cancelEdit; window.deleteTask = deleteTask; window.logProgress = logProgress;
window.payDonation = payDonation;
window.setBudgetLimit = setBudgetLimit; window.addExpense = addExpense; window.deleteExpense = deleteExpense;
window.addBacklogItem = addBacklogItem; window.toggleBacklogStatus = toggleBacklogStatus; window.deleteBacklogItem = deleteBacklogItem; window.renderBacklog = renderBacklog;

const savedTab = localStorage.getItem('hisab_active_tab') || 'dashboard'; const savedNavElement = document.getElementById('nav-' + savedTab); if (savedNavElement) switchTab(savedTab, savedNavElement);