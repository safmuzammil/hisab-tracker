// ==========================================
// GOOGLE DRIVE API CONFIGURATION
// ==========================================
const CLIENT_ID = '692381665206-5blu4q3717h5p8ndij58s1m5nevrug0r.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDJplHrfuYfqyVLc08ce1Kt4wZWqXW8IvA';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient; let gapiInited = false; let gisInited = false;

function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() {
    await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
    gapiInited = true;
}

window.onload = function () {
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
    const savedUser = JSON.parse(localStorage.getItem('hisab_user'));
    if (savedUser) { showProfile(savedUser); } 
    else { google.accounts.id.renderButton(document.getElementById("google-signin-button"), { theme: "outline", size: "large", type: "standard" }); }
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '' });
    gisInited = true;
};

function handleCredentialResponse(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const userData = { name: payload.name, email: payload.email, picture: payload.picture };
    localStorage.setItem('hisab_user', JSON.stringify(userData));
    showProfile(userData);
}

function showProfile(user) {
    document.getElementById('login-prompt').style.display = 'none';
    const authContainer = document.getElementById('auth-container');
    authContainer.style.display = 'flex';
    authContainer.innerHTML = `<img src="${user.picture}" class="profile-pic" alt="Profile"><div class="profile-info"><h3>${user.name}</h3><p>${user.email}</p></div><button onclick="logout()" style="background:transparent; border:1px solid #aaa; color:#aaa; width:auto; padding:5px 10px; margin-left:auto; font-size:0.8rem;">Logout</button>`;
}
function logout() { localStorage.removeItem('hisab_user'); location.reload(); }

// ==========================================
// APP STATE & STORAGE
// ==========================================
let tasks = JSON.parse(localStorage.getItem('hisab_tasks')) || [];
let score = parseInt(localStorage.getItem('hisab_score')) || 0;
let pointHistory = JSON.parse(localStorage.getItem('hisab_history')) || [];
let lastEvals = JSON.parse(localStorage.getItem('hisab_evals')) || { week: getWeekNumber(new Date()) };
let penaltyPool = JSON.parse(localStorage.getItem('hisab_penalties')) || [{ title: "30 Min Intense Focus", points: 50 }];

let deenData = JSON.parse(localStorage.getItem('hisab_deen')) || {
    quran: [], qada: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 }, zakatInputs: { cash: 0, gold: 0, invest: 0 }
};

let ledgerData = JSON.parse(localStorage.getItem('hisab_ledger')) || [];

// Auto-migration
let needsSave = false;
tasks.forEach(t => {
    if (t.freq && !t.type) { t.type = t.freq; needsSave = true; }
    if (t.target !== undefined && t.baseTarget === undefined) { t.baseTarget = t.target; needsSave = true; }
    if (t.points !== undefined && t.pointsPerUnit === undefined) { t.pointsPerUnit = t.points; needsSave = true; }
    if (t.currentTarget === undefined) { t.currentTarget = t.baseTarget; needsSave = true; }
    if (t.isCompleted === undefined) { t.isCompleted = false; needsSave = true; }
});
if (needsSave) localStorage.setItem('hisab_tasks', JSON.stringify(tasks));

let progressChart = null;

function getDynamicTargets() {
    let dailyBase = 0, weeklyBase = 0, monthlyBase = 0;
    tasks.forEach(t => {
        if (t.isPenalty || t.type === 'bad') return;
        const totalPoints = (t.baseTarget || 0) * (t.pointsPerUnit || 0);
        if (t.type === 'daily') dailyBase += totalPoints;
        if (t.type === 'weekly') weeklyBase += totalPoints;
        if (t.type === 'monthly') monthlyBase += totalPoints;
    });

    const dailyGoal = dailyBase;
    const weeklyGoal = weeklyBase + (dailyBase * 7);
    const monthlyGoal = monthlyBase + (weeklyBase * 4) + (dailyBase * 30); 
    const yearlyGoal = (monthlyBase * 12) + (weeklyBase * 52) + (dailyBase * 365); 

    return {
        daily: { goal: dailyGoal, min: dailyGoal * 0.5 },
        weekly: { goal: weeklyGoal, min: weeklyGoal * 0.5 },
        monthly: { goal: monthlyGoal, min: monthlyGoal * 0.5 },
        yearly: { goal: yearlyGoal, min: yearlyGoal * 0.5 }
    };
}

// ==========================================
// UI TABS LOGIC
// ==========================================
function switchTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active'); nav.classList.remove('active-deen'); nav.classList.remove('active-ledger');
    });
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if(tabName === 'deen') { element.classList.add('active-deen'); renderDeen(); } 
    else if(tabName === 'ledger') { element.classList.add('active-ledger'); renderLedger(); }
    else { element.classList.add('active'); }
    
    if (tabName === 'dashboard') updateDashboard();
}

function toggleDateInputs() {
    const type = document.getElementById('task-type').value;
    document.getElementById('date-range-inputs').style.display = (type === 'fixed-period') ? 'block' : 'none';
}

function render() {
    renderTasks(); renderHistory(); renderPool(); renderDeen(); renderLedger();
    if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
}

// ==========================================
// LEDGER (FINANCE) TAB LOGIC
// ==========================================
function renderLedger() {
    const oweContainer = document.getElementById('ledger-owe-container');
    const lentContainer = document.getElementById('ledger-lent-container');
    oweContainer.innerHTML = ''; lentContainer.innerHTML = '';

    const oweData = ledgerData.filter(l => l.type === 'owe' && l.remaining > 0);
    const lentData = ledgerData.filter(l => l.type === 'lent' && l.remaining > 0);

    if (oweData.length === 0) oweContainer.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">You are debt-free! 🎉</p>';
    if (lentData.length === 0) lentContainer.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">Nobody owes you money currently.</p>';

    ledgerData.forEach((entry, index) => {
        if(entry.remaining <= 0) return; // Hide fully paid debts

        const div = document.createElement('div');
        div.className = `ledger-item ${entry.type}`;
        
        let titleText = entry.type === 'owe' ? `Owed to: ${entry.person}` : `Owed by: ${entry.person}`;
        let colorClass = entry.type === 'owe' ? 'var(--danger)' : 'var(--success)';

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span style="color:#aaa; font-size:0.8rem;">${titleText}</span>
                <button onclick="deleteLedgerEntry(${index})" style="background:transparent; color:#888; border:none; padding:0; margin:0; width:auto; font-size:1.2rem;">×</button>
            </div>
            <div class="ledger-amount" style="color:${colorClass}">${entry.remaining.toLocaleString()}</div>
            <div style="font-size:0.85rem; color:#aaa;">Original Amount: ${entry.amount.toLocaleString()} <br> ${entry.desc}</div>
            
            <div class="ledger-action">
                <input type="number" id="pay-input-${index}" placeholder="Amount paid">
                <button style="background:${colorClass}; color:#000;" onclick="logLedgerPayment(${index})">Log Payment</button>
            </div>
        `;
        
        if (entry.type === 'owe') oweContainer.appendChild(div);
        else lentContainer.appendChild(div);
    });
}

function addLedgerEntry() {
    const type = document.getElementById('ledger-type').value;
    const person = document.getElementById('ledger-person').value.trim();
    const amount = parseFloat(document.getElementById('ledger-amount').value);
    const desc = document.getElementById('ledger-desc').value.trim();

    if (!person || !amount || amount <= 0) return alert("Please enter a valid person and amount.");

    ledgerData.push({ type, person, amount, remaining: amount, desc, date: new Date().toISOString() });
    
    document.getElementById('ledger-person').value = '';
    document.getElementById('ledger-amount').value = '';
    document.getElementById('ledger-desc').value = '';
    
    saveData(); renderLedger();
}

function logLedgerPayment(index) {
    const payInput = document.getElementById(`pay-input-${index}`);
    const amountPaid = parseFloat(payInput.value);
    
    if (!amountPaid || amountPaid <= 0) return;
    
    let entry = ledgerData[index];
    entry.remaining -= amountPaid;
    
    if(entry.remaining <= 0) {
        entry.remaining = 0;
        alert(`🎉 The debt with ${entry.person} is fully settled!`);
    }
    
    saveData(); renderLedger();
}

function deleteLedgerEntry(index) {
    if (confirm("Are you sure you want to delete this record?")) {
        ledgerData.splice(index, 1);
        saveData(); renderLedger();
    }
}

// ==========================================
// DEEN (WORSHIP) TAB LOGIC
// ==========================================
function renderDeen() {
    const select = document.getElementById('juz-select');
    if(select.options.length <= 1) {
        for(let i=1; i<=30; i++) { let opt = document.createElement('option'); opt.value = i; opt.innerHTML = `Juz ${i}`; select.appendChild(opt); }
    }

    const juzContainer = document.getElementById('juz-list-container');
    juzContainer.innerHTML = '';
    deenData.quran.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'quran-item'; div.style.opacity = q.completed ? '0.5' : '1';
        div.innerHTML = `<strong>${q.completed ? '✅' : '📖'} Juz ${q.juz} Intention</strong><div>${!q.completed ? `<button onclick="completeJuz(${index})" style="background:var(--success); color:#000; padding:5px 10px; margin:0; width:auto; font-size:0.8rem;">Complete</button>` : ''}<button onclick="deleteJuz(${index})" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:5px 10px; margin:0 0 0 5px; width:auto; font-size:0.8rem;">🗑️</button></div>`;
        juzContainer.appendChild(div);
    });

    const qadaContainer = document.getElementById('qada-container');
    qadaContainer.innerHTML = '';
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Witr'];
    prayers.forEach(p => {
        const count = deenData.qada[p];
        const div = document.createElement('div');
        div.className = 'qada-row';
        div.innerHTML = `<div style="font-weight:bold;">${p}</div><div class="qada-controls"><span style="font-family:monospace; font-size:1.2rem; min-width:30px; text-align:center; color:${count > 0 ? 'var(--danger)' : 'var(--success)'}">${count}</span><button class="qada-btn minus" onclick="updateQada('${p}', -1)" title="Prayed Qada">✔️</button><button class="qada-btn" onclick="updateQada('${p}', 1)" title="Missed Prayer">➕</button></div>`;
        qadaContainer.appendChild(div);
    });

    document.getElementById('zakat-cash').value = deenData.zakatInputs.cash;
    document.getElementById('zakat-gold').value = deenData.zakatInputs.gold;
    document.getElementById('zakat-invest').value = deenData.zakatInputs.invest;
    calculateZakat();
}

function addJuzIntention() {
    const val = document.getElementById('juz-select').value;
    if(!val) return; if(deenData.quran.find(q => q.juz == val && !q.completed)) return alert("Intention already exists!");
    deenData.quran.push({ juz: parseInt(val), completed: false }); saveData(); renderDeen();
}
function completeJuz(index) { deenData.quran[index].completed = true; saveData(); renderDeen(); }
function deleteJuz(index) { deenData.quran.splice(index, 1); saveData(); renderDeen(); }
function updateQada(prayer, amount) { deenData.qada[prayer] += amount; if(deenData.qada[prayer] < 0) deenData.qada[prayer] = 0; saveData(); renderDeen(); }

function calculateZakat() {
    const cash = parseFloat(document.getElementById('zakat-cash').value) || 0;
    const gold = parseFloat(document.getElementById('zakat-gold').value) || 0;
    const invest = parseFloat(document.getElementById('zakat-invest').value) || 0;
    deenData.zakatInputs = { cash, gold, invest }; saveData();
    const zakatDue = (cash + gold + invest) * 0.025;
    document.getElementById('zakat-due').innerText = zakatDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// ==========================================
// RENDER TASKS 
// ==========================================
function renderTasks() {
    const container = document.getElementById('task-list-container');
    container.innerHTML = '';
    const categories = [
        { id: 'daily', title: '📅 Daily Tasks', filter: t => t.type === 'daily' && !t.isPenalty },
        { id: 'weekly', title: '📆 Weekly Tasks', filter: t => t.type === 'weekly' && !t.isPenalty },
        { id: 'monthly', title: '🗓️ Monthly Tasks', filter: t => t.type === 'monthly' && !t.isPenalty },
        { id: 'special', title: '🎯 Goals & One-Time Tasks', filter: t => (t.type === 'one-time' || t.type === 'fixed-period') && !t.isPenalty && !t.isCompleted },
        { id: 'bad', title: '🚫 Bad Habits & Penalties', filter: t => t.type === 'bad' || t.isPenalty }
    ];
    categories.forEach(cat => {
        const filteredTasks = tasks.filter(cat.filter);
        if (filteredTasks.length === 0) return;
        const section = document.createElement('div');
        section.innerHTML = `<h3 class="section-title">${cat.title}</h3>`;
        filteredTasks.forEach(task => {
            const div = document.createElement('div');
            if (task.type === 'bad') {
                div.className = 'task-item penalty';
                div.innerHTML = `<div class="task-header"><div class="task-title-area"><strong>${task.title}</strong></div><div class="task-controls"><button class="btn-delete" onclick="deleteTask('${task.id}')">🗑️</button></div></div><div class="task-status">Penalty: -${task.pointsPerUnit} pts if triggered</div><button class="btn-fail" onclick="punish('${task.id}', '${task.title}')">I Messed Up</button>`;
            } else {
                const isAhead = task.currentTarget <= 0;
                div.className = `task-item ${task.isPenalty ? 'penalty' : ''} ${isAhead ? 'banked' : ''}`;
                let timeInfo = task.type === 'fixed-period' ? `<div style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">Window: ${task.startDate} to ${task.endDate}</div>` : '';
                let statusHTML = isAhead ? `<span class="highlight-banked">✅ Done! Credit banked: ${Math.abs(task.currentTarget)} units.</span>` : `⏳ Pending: <strong>${task.currentTarget}</strong> (Base: ${task.baseTarget})`;
                div.innerHTML = `<div class="task-header"><div class="task-title-area"><strong>${task.isPenalty ? '⚠️ ' : ''}${task.title}</strong><span style="font-size:0.8rem; color:var(--primary);">+${task.pointsPerUnit} pts/unit</span></div><div class="task-controls"><button class="btn-edit" onclick="editTask('${task.id}')">✏️</button><button class="btn-delete" onclick="deleteTask('${task.id}')">🗑️</button></div></div>${timeInfo}<div class="task-status">${statusHTML}</div><div class="task-action"><input type="number" id="input-${task.id}" value="1" min="1"><button class="btn-done" onclick="logProgress('${task.id}')">Log Units</button></div>`;
            }
            section.appendChild(div);
        });
        container.appendChild(section);
    });
}

function renderHistory() {
    const log = document.getElementById('history-log');
    log.innerHTML = '';
    const recentHistory = [...pointHistory].reverse().slice(0, 20);
    if (recentHistory.length === 0) { log.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">No history yet.</div>'; return; }
    recentHistory.forEach(record => {
        const d = new Date(record.timestamp);
        const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        const pointsFmt = record.points > 0 ? `<span style="color:var(--success)">+${record.points}</span>` : `<span style="color:var(--danger)">${record.points}</span>`;
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<div><div>${record.title || 'Unknown Task'}</div><div class="history-time">${timeStr}</div></div><div style="font-weight:bold;">${pointsFmt}</div>`;
        log.appendChild(div);
    });
}

// ==========================================
// TASKS & CORE LOGIC
// ==========================================
function saveTask() {
    const id = document.getElementById('task-id').value; const title = document.getElementById('task-title').value;
    const type = document.getElementById('task-type').value; const baseTarget = parseInt(document.getElementById('task-base-target').value) || 1;
    const pointsPerUnit = parseInt(document.getElementById('task-points-unit').value) || 10;
    const startDate = document.getElementById('task-start-date').value; const endDate = document.getElementById('task-end-date').value;
    if (!title) return alert('Enter a title');
    if (type === 'fixed-period' && (!startDate || !endDate)) return alert("Please select start and end dates.");
    if (id) {
        const task = tasks.find(t => t.id === id);
        task.title = title; task.type = type; task.currentTarget += (baseTarget - task.baseTarget); 
        task.baseTarget = baseTarget; task.pointsPerUnit = pointsPerUnit; task.startDate = startDate; task.endDate = endDate;
    } else { tasks.push({ id: Date.now().toString(), title, type, baseTarget, currentTarget: baseTarget, pointsPerUnit, startDate, endDate, lastChecked: new Date().toISOString(), isPenalty: false, isCompleted: false }); }
    cancelEdit(); saveData(); render();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id); if (!task) return;
    document.getElementById('form-title').innerText = '✏️ Edit Task'; document.getElementById('btn-save-task').innerText = 'Save Changes';
    document.getElementById('btn-cancel-edit').style.display = 'inline-block';
    document.getElementById('task-id').value = task.id; document.getElementById('task-title').value = task.title;
    document.getElementById('task-type').value = task.type || 'daily'; document.getElementById('task-base-target').value = task.baseTarget; 
    document.getElementById('task-points-unit').value = task.pointsPerUnit; document.getElementById('task-start-date').value = task.startDate || '';
    document.getElementById('task-end-date').value = task.endDate || '';
    toggleDateInputs(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('form-title').innerText = '➕ Add New Task'; document.getElementById('btn-save-task').innerText = 'Add Task';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    document.getElementById('task-id').value = ''; document.getElementById('task-title').value = '';
    document.getElementById('task-type').value = 'daily'; document.getElementById('task-base-target').value = ''; 
    document.getElementById('task-points-unit').value = ''; document.getElementById('task-start-date').value = '';
    document.getElementById('task-end-date').value = ''; toggleDateInputs();
}

function deleteTask(id) { if (confirm("Delete this task?")) { tasks = tasks.filter(t => t.id !== id); saveData(); render(); } }

function logProgress(id) {
    const task = tasks.find(t => t.id === id); const amountDone = parseInt(document.getElementById(`input-${id}`).value) || 0;
    if (amountDone <= 0) return;
    const pointsEarned = amountDone * task.pointsPerUnit; score += pointsEarned;
    pointHistory.push({ timestamp: Date.now(), points: pointsEarned, title: task.title });
    if (task.isPenalty) { tasks = tasks.filter(t => t.id !== id); } 
    else { task.currentTarget -= amountDone; if (task.type === 'one-time' && task.currentTarget <= 0) { task.isCompleted = true; } task.lastChecked = new Date().toISOString(); }
    saveData(); render();
}

function punish(id, title) {
    const task = tasks.find(t => t.id === id); score -= task.pointsPerUnit;
    pointHistory.push({ timestamp: Date.now(), points: -task.pointsPerUnit, title: "Failed: " + title }); saveData(); render();
}

function processRollovers() {
    const now = new Date(); const todayMidnight = new Date(now.setHours(0,0,0,0)).getTime();
    tasks.forEach(task => {
        if (task.type === 'bad' || task.isPenalty || task.type === 'one-time' || task.isCompleted) return;
        const lastCheckedMidnight = new Date(new Date(task.lastChecked).setHours(0,0,0,0)).getTime();
        const diffDays = Math.floor((todayMidnight - lastCheckedMidnight) / 86400000);
        if (diffDays <= 0) return; 
        if (task.type === 'daily') { task.currentTarget += (task.baseTarget * diffDays); }
        else if (task.type === 'weekly') { const weeksPassed = Math.floor(diffDays / 7); if (weeksPassed >= 1) task.currentTarget += (task.baseTarget * weeksPassed); }
        else if (task.type === 'monthly') { const last = new Date(task.lastChecked); const monthsPassed = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth()); if (monthsPassed >= 1) task.currentTarget += (task.baseTarget * monthsPassed); }
        else if (task.type === 'fixed-period') {
            const start = new Date(task.startDate).setHours(0,0,0,0); const end = new Date(task.endDate).setHours(23,59,59,999);
            let validDays = 0;
            for (let i = 1; i <= diffDays; i++) { let checkDate = lastCheckedMidnight + (i * 86400000); if (checkDate >= start && checkDate <= end) validDays++; }
            task.currentTarget += (task.baseTarget * validDays);
        }
        task.lastChecked = new Date().toISOString();
    });
    saveData();
}

// ==========================================
// DASHBOARD & CHART
// ==========================================
function updateDashboard() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = getStartOfWeek(now).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    let dayPts = 0, weekPts = 0, monthPts = 0, yearPts = 0;
    pointHistory.forEach(r => {
        if (r.timestamp >= startOfDay) dayPts += r.points;
        if (r.timestamp >= startOfWeek) weekPts += r.points;
        if (r.timestamp >= startOfMonth) monthPts += r.points;
        if (r.timestamp >= startOfYear) yearPts += r.points;
    });

    const dynTargets = getDynamicTargets();

    document.getElementById('today-points').innerText = dayPts;
    document.getElementById('day-earned').innerText = dayPts; document.getElementById('day-max').innerText = dynTargets.daily.goal;
    document.getElementById('week-earned').innerText = weekPts; document.getElementById('week-max').innerText = dynTargets.weekly.goal;
    document.getElementById('month-earned').innerText = monthPts; document.getElementById('month-max').innerText = dynTargets.monthly.goal;
    document.getElementById('year-earned').innerText = yearPts; document.getElementById('year-max').innerText = dynTargets.yearly.goal;

    const dayPct = dynTargets.daily.goal > 0 ? (dayPts / dynTargets.daily.goal) * 100 : 0;
    const weekPct = dynTargets.weekly.goal > 0 ? (weekPts / dynTargets.weekly.goal) * 100 : 0;
    const monthPct = dynTargets.monthly.goal > 0 ? (monthPts / dynTargets.monthly.goal) * 100 : 0;
    const yearPct = dynTargets.yearly.goal > 0 ? (yearPts / dynTargets.yearly.goal) * 100 : 0;

    const canvas = document.getElementById('progressChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (progressChart) progressChart.destroy();
    
    progressChart = new Chart(ctx, {
        data: {
            labels: ['Today', 'This Week', 'This Month', 'This Year'],
            datasets: [
                { type: 'line', label: 'Min to Avoid Penalty (50%)', data: [50, 50, 50, 50], borderColor: '#f6e58d', borderWidth: 3, borderDash: [5, 5], fill: false, pointBackgroundColor: '#f6e58d' },
                { type: 'bar', label: 'Progress (%)', data: [dayPct, weekPct, monthPct, yearPct], backgroundColor: '#03dac6', borderRadius: 4 },
                { type: 'bar', label: 'Goal (100%)', data: [100, 100, 100, 100], backgroundColor: 'rgba(207, 102, 121, 0.4)', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 120, grid: { color: '#333' }, ticks: { callback: function(value) { return value + "%" } } } }, plugins: { legend: { labels: { color: '#fff' } }, tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + context.raw.toFixed(1) + '%'; } } } } }
    });
}

function evaluatePerformance() {
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const dynTargets = getDynamicTargets();

    if (currentWeek !== lastEvals.week) {
        const startOfThisWeek = getStartOfWeek(now).getTime();
        const startOfLastWeek = startOfThisWeek - 604800000;
        let lastWeekScore = 0;
        pointHistory.forEach(r => { if (r.timestamp >= startOfLastWeek && r.timestamp < startOfThisWeek) lastWeekScore += r.points; });

        if (lastWeekScore < dynTargets.weekly.min) {
            let selectedPenalty = penaltyPool.length > 0 ? penaltyPool[Math.floor(Math.random() * penaltyPool.length)] : { title: "Generic Penalty", points: 50 };
            tasks.push({ id: Date.now().toString() + "-pen", title: selectedPenalty.title, type: 'daily', baseTarget: 1, currentTarget: 1, pointsPerUnit: selectedPenalty.points, lastChecked: new Date().toISOString(), isPenalty: true });
            alert(`⚠️ Roulette has chosen your punishment:\n"${selectedPenalty.title}"`);
        }
        lastEvals.week = currentWeek;
        saveData();
    }
}

// ==========================================
// DATA STORAGE & GOOGLE DRIVE SYNC
// ==========================================
function renderPool() {
    const list = document.getElementById('pool-list'); list.innerHTML = '';
    penaltyPool.forEach((p, index) => {
        const div = document.createElement('div'); div.style = "display:flex; justify-content:space-between; align-items:center; background:#3a1c1e; padding:8px; border-radius:5px; margin-top:5px;";
        div.innerHTML = `<span>${p.title} (-${p.points})</span><button onclick="removePoolItem(${index})" style="background:transparent; color:var(--danger); margin:0; width:auto; padding:0 10px;">❌</button>`; list.appendChild(div);
    });
}
function addToPool() {
    const title = document.getElementById('pool-title').value; const points = parseInt(document.getElementById('pool-points').value) || 50;
    if (!title) return alert("Please enter a punishment description.");
    penaltyPool.push({ title, points }); document.getElementById('pool-title').value = ''; document.getElementById('pool-points').value = ''; saveData(); renderPool();
}
function removePoolItem(index) { penaltyPool.splice(index, 1); saveData(); renderPool(); }

function saveData() {
    localStorage.setItem('hisab_tasks', JSON.stringify(tasks));
    localStorage.setItem('hisab_score', score.toString());
    localStorage.setItem('hisab_history', JSON.stringify(pointHistory));
    localStorage.setItem('hisab_evals', JSON.stringify(lastEvals));
    localStorage.setItem('hisab_penalties', JSON.stringify(penaltyPool));
    localStorage.setItem('hisab_deen', JSON.stringify(deenData));
    localStorage.setItem('hisab_ledger', JSON.stringify(ledgerData)); // Save Ledger
}

function handleDriveAction(action) {
    if (!CLIENT_ID.includes("apps.googleusercontent.com")) { return alert("Error: You must insert your Google Client ID into app.js first!"); }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) { throw (resp); }
        try {
            document.body.style.cursor = 'wait';
            let fileId = null;
            let searchResp = await gapi.client.drive.files.list({ q: "name='hisab_backup.json' and trashed=false", fields: 'files(id, name)' });
            if (searchResp.result.files && searchResp.result.files.length > 0) { fileId = searchResp.result.files[0].id; }

            if (action === 'backup') {
                // Include ALL data in backup
                const fileContent = JSON.stringify({ tasks, score, history: pointHistory, evals: lastEvals, penalties: penaltyPool, deen: deenData, ledger: ledgerData });
                const metadata = { 'name': 'hisab_backup.json', 'mimeType': 'application/json' };
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";
                const multipartRequestBody = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' + fileContent + close_delim;

                let request = fileId 
                    ? gapi.client.request({ 'path': '/upload/drive/v3/files/' + fileId, 'method': 'PATCH', 'params': {'uploadType': 'multipart'}, 'headers': {'Content-Type': 'multipart/related; boundary="' + boundary + '"'}, 'body': multipartRequestBody })
                    : gapi.client.request({ 'path': '/upload/drive/v3/files', 'method': 'POST', 'params': {'uploadType': 'multipart'}, 'headers': {'Content-Type': 'multipart/related; boundary="' + boundary + '"'}, 'body': multipartRequestBody });

                await request;
                alert("✅ Successfully backed up to your Google Drive!");
            } else if (action === 'restore') {
                if (!fileId) return alert("❌ No 'hisab_backup.json' file found in your Google Drive.");
                let fileResp = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
                const parsed = typeof fileResp.body === 'string' ? JSON.parse(fileResp.body) : fileResp.result;
                
                if (parsed.tasks && confirm("Restore data from Drive? This will overwrite your current progress.")) {
                    tasks = parsed.tasks; score = parsed.score || 0; pointHistory = parsed.history || []; lastEvals = parsed.evals || { week: getWeekNumber(new Date()) }; penaltyPool = parsed.penalties || [];
                    if (parsed.deen) deenData = parsed.deen;
                    if (parsed.ledger) ledgerData = parsed.ledger; // Restore Ledger
                    saveData(); render(); alert("✅ Data successfully restored from Google Drive!");
                }
            }
        } catch(err) { console.error(err); alert("An error occurred. Check the console."); } 
        finally { document.body.style.cursor = 'default'; }
    };
    gapi.client.getToken() === null ? tokenClient.requestAccessToken({prompt: 'consent'}) : tokenClient.requestAccessToken({prompt: ''});
}

// ==========================================
// UTILS & INIT
// ==========================================
function getStartOfWeek(date) { const d = new Date(date); return new Date(d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(),0,1))) / 86400000) + 1)/7); }

// Notifications
function initNotifications() {
    const btn = document.getElementById('btn-notifications');
    if (!("Notification" in window)) { btn.style.display = 'none'; return; }
    if (Notification.permission === "granted") { btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); }
}
function toggleNotifications() {
    if (!("Notification" in window)) return alert("Browser does not support notifications.");
    if (Notification.permission === "granted") { alert("Notifications already enabled!"); checkAndNotify(); } 
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(p => { if (p === "granted") { const btn = document.getElementById('btn-notifications'); btn.innerText = "🔔 Alerts On"; btn.classList.add('enabled'); checkAndNotify(); } });
    } else { alert("Notifications blocked in device settings."); }
}
function checkAndNotify() {
    if (Notification.permission !== "granted") return;
    let pendingCount = 0; let hasPenalty = false;
    tasks.forEach(t => { if (t.isPenalty) hasPenalty = true; else if (t.type !== 'bad' && !t.isCompleted && t.currentTarget > 0) pendingCount++; });
    if (hasPenalty) new Notification("Hisab Warning! ⚠️", { body: "You have an active Penalty Task.", icon: "https://via.placeholder.com/192/cf6679/ffffff?text=!" });
    else if (pendingCount > 0) new Notification("Hisab Reminder 📝", { body: `You have ${pendingCount} tasks pending.`, icon: "https://via.placeholder.com/192/03dac6/000000?text=+" });
}
setInterval(checkAndNotify, 1000 * 60 * 60 * 3);

// INIT
initNotifications();
processRollovers();
evaluatePerformance();
render();