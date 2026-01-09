const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// MA'LUMOTLAR
let items = [];
let settings = { dark: false, vib: true };
let lifetime = { count: 0, time: 0 }; 

// QULF (HIMOYA)
let canSaveToCloud = false; 
let saveTimer = null;

const KEY_ITEMS = 'zikr_gold_v1_items';
const KEY_SETTINGS = 'zikr_gold_v1_settings';
const KEY_LIFE = 'zikr_gold_v1_life';

let currentItemId = null;
let currentDayIndex = null;
let sessionStart = 0;
let chartInstance = null;

window.onload = function() {
    initUser();
    initApp();
    
    // Xavfsizlik: 7 sekundda internet bo'lmasa, offline ochamiz
    setTimeout(() => {
        if(document.getElementById('loader').style.display !== 'none') {
            document.getElementById('loader').style.display = 'none';
        }
    }, 7000);

    window.addEventListener("beforeunload", () => { closeView(true); saveAllData(true); });
};

function initUser() {
    if(tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        document.getElementById('welcome-text').innerText = "Salom, " + u.first_name;
        document.getElementById('u-name').innerText = u.first_name;
        if(u.photo_url) {
            document.getElementById('u-ava-img').src = u.photo_url;
            document.getElementById('u-ava-img').style.display = 'block';
            document.getElementById('u-ava-ph').style.display = 'none';
        }
    }
}

// --- YUKLASH TIZIMI ---
function initApp() {
    try {
        const li = localStorage.getItem(KEY_ITEMS);
        const ls = localStorage.getItem(KEY_SETTINGS);
        const ll = localStorage.getItem(KEY_LIFE);
        if(li) items = JSON.parse(li);
        if(ls) settings = JSON.parse(ls);
        if(ll) lifetime = JSON.parse(ll);
        applySettings(); renderList(); updateProfileUI();
    } catch(e){}

    if(!tg.CloudStorage) {
        canSaveToCloud = true; 
        document.getElementById('loader').style.display = 'none';
        return;
    }

    tg.CloudStorage.getItem([KEY_ITEMS, KEY_SETTINGS, KEY_LIFE], (err, res) => {
        if(!err && res) {
            let cloudItems = [];
            try { if(res[KEY_ITEMS]) cloudItems = JSON.parse(res[KEY_ITEMS]); } catch(e){}
            
            if(cloudItems.length > 0) {
                items = cloudItems;
                if(res[KEY_SETTINGS]) settings = JSON.parse(res[KEY_SETTINGS]);
                if(res[KEY_LIFE]) lifetime = JSON.parse(res[KEY_LIFE]);
                saveLocalOnly();
            } else if(items.length > 0) {
                console.log("Bulut bo'sh, lokal ma'lumot saqlanadi.");
            }
            
            applySettings(); renderList(); updateProfileUI();
            canSaveToCloud = true;
        }
        document.getElementById('loader').style.display = 'none';
    });
}

function saveLocalOnly() {
    localStorage.setItem(KEY_ITEMS, JSON.stringify(items));
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
    localStorage.setItem(KEY_LIFE, JSON.stringify(lifetime));
}

function saveAllData(force = false) {
    saveLocalOnly();
    if(!canSaveToCloud) return;
    if(!tg.CloudStorage) return;

    if(saveTimer) clearTimeout(saveTimer);
    const doSave = () => {
        tg.CloudStorage.setItem(KEY_ITEMS, JSON.stringify(items));
        tg.CloudStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
        tg.CloudStorage.setItem(KEY_LIFE, JSON.stringify(lifetime));
    };
    if(force) doSave(); else saveTimer = setTimeout(doSave, 3000);
}

// --- ASOSIY LOGIKA ---
function cleanOldItems() { items.forEach(item => { if(item.deleted) return; const totalDone = item.progress.reduce((a, b) => a + b, 0); if (totalDone >= item.total) item.status = 'completed'; }); }

function recalculateGoals() {
    const today = new Date().setHours(0,0,0,0);
    let changed = false;
    items.forEach(item => {
        if (item.status === 'completed' || item.deleted) return;
        const daysPassed = Math.floor((today - item.startDate) / (1000 * 60 * 60 * 24));
        if (daysPassed > 0 && daysPassed < item.durationDays) {
            let doneInPast = 0; 
            for(let i=0; i < daysPassed; i++) doneInPast += item.progress[i] || 0;
            const rem = item.total - doneInPast; 
            const dLeft = item.durationDays - daysPassed;
            if (rem > 0 && dLeft > 0) {
                const n = Math.ceil(rem / dLeft);
                if (item.dailyGoal !== n) { item.dailyGoal = n; changed = true; }
            }
        }
    });
    if(changed) saveLocalOnly();
}

function calcDaily() { const t = parseInt(document.getElementById('inp-total').value) || 0; const d = parseInt(document.getElementById('inp-days').value) || 0; document.getElementById('lbl-daily').innerText = (t && d) ? Math.ceil(t/d) : 0; }

function createItem() {
    const name = document.getElementById('inp-name').value;
    const total = parseInt(document.getElementById('inp-total').value);
    const days = parseInt(document.getElementById('inp-days').value);
    if(!name || !total || !days) return tg.showAlert("To'ldiring!");
    items.push({ id: Date.now(), name: name, total: total, durationDays: days, dailyGoal: Math.ceil(total / days), startDate: new Date().setHours(0,0,0,0), progress: new Array(days).fill(0), totalTimeMs: 0, history: {}, status: 'active', deleted: false });
    saveAllData();
    document.getElementById('inp-name').value = ''; document.getElementById('inp-total').value = ''; document.getElementById('inp-days').value = '';
    navTo('page-home');
}

function openDaysList(id) {
    currentItemId = id; const item = items.find(i => i.id === id); if(!item) return;
    document.getElementById('days-title').innerText = item.name;
    const container = document.getElementById('days-container'); container.innerHTML = '';
    recalculateGoals();
    const today = new Date().setHours(0,0,0,0);
    const daysPassed = Math.floor((today - item.startDate) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < item.durationDays; i++) {
        const dayNum = i + 1; const isLocked = i > daysPassed;
        const currentCount = item.progress[i];
        let icon = isLocked ? '🔒' : (currentCount >= item.dailyGoal ? '✅' : '👉');
        let st = isLocked ? 'Qulflangan' : `${currentCount} / ${item.dailyGoal}`;
        if(i === daysPassed) st = `Bugun: ${st}`;
        const div = document.createElement('div');
        div.className = `card ${isLocked?'locked':''}`;
        div.innerHTML = `<div style="font-weight:bold">${dayNum}-kun</div><div style="font-size:14px;opacity:0.7">${st}</div><div>${icon}</div>`;
        div.onclick = isLocked ? () => tg.showAlert("Hali vaqti kelmadi") : () => openCounter(i);
        container.appendChild(div);
    }
    navTo('page-days');
}

function openCounter(dayIdx) {
    currentDayIndex = dayIdx; sessionStart = Date.now();
    const item = items.find(i => i.id === currentItemId);
    document.getElementById('view-word-name').innerText = item.name;
    document.getElementById('view-goal').innerText = item.dailyGoal;
    updateCircleUI(item);
    navTo('page-view');
}

function doCount() {
    if (!currentItemId) return;
    const item = items.find(i => i.id === currentItemId);
    if (item.progress[currentDayIndex] >= item.dailyGoal) return;
    item.progress[currentDayIndex]++; lifetime.count++;
    if(settings.vib) try { tg.HapticFeedback.impactOccurred('light'); } catch(e){}
    triggerDropEffect(item);
    saveAllData(); 
    if (item.progress[currentDayIndex] >= item.dailyGoal) {
        setTimeout(() => updateCircleUI(item), 600);
        const allDone = item.progress.every(p => p >= item.dailyGoal);
        setTimeout(() => {
            closeView(); 
            if (allDone) { item.status = 'completed'; saveAllData(true); tg.showPopup({title:"Tabriklaymiz!", message:"Tugadi!"}, () => navTo('page-home')); }
            else { saveAllData(true); openDaysList(currentItemId); }
        }, 1500);
    } else { setTimeout(() => updateCircleUI(item), 500); }
}

function triggerDropEffect(item) {
    const wrapper = document.getElementById('circle-area');
    const cur = item.progress[currentDayIndex] - 1; 
    const max = item.dailyGoal;
    let percent = (cur / max) * 100; if(percent > 100) percent = 100; if(percent < 5) percent = 5; 
    const drop = document.createElement('div'); drop.className = 'droplet'; wrapper.appendChild(drop);
    const surfaceTop = 100 - percent; 
    const anim = drop.animate([{ top: '-20px', opacity: 1, transform: 'translateX(-50%) rotate(45deg) scale(1)' }, { top: `calc(${surfaceTop}% - 10px)`, opacity: 1, transform: 'translateX(-50%) rotate(45deg) scale(0.8)' }], { duration: 500, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' });
    anim.onfinish = () => { drop.remove(); createSplash(surfaceTop); };
}

function createSplash(topPercent) {
    const wrapper = document.getElementById('circle-area');
    const ripple = document.createElement('div'); ripple.className = 'ripple'; ripple.style.top = topPercent + '%'; wrapper.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    for(let i=0; i<6; i++) {
        const p = document.createElement('div'); p.className = 'splash-particle'; p.style.top = topPercent + '%'; p.style.left = '50%'; wrapper.appendChild(p);
        const rx = (Math.random() - 0.5) * 60; const ry = -20 - Math.random() * 30; p.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${rx}px, ${ry}px) scale(0)`, opacity: 0 }], { duration: 400 + Math.random()*200 }).onfinish = () => p.remove();
    }
}

function updateCircleUI(item) {
    const cur = item.progress[currentDayIndex]; const max = item.dailyGoal;
    let ratio = cur / max; if (ratio > 1) ratio = 1;
    document.getElementById('liq-container').style.height = (100 * ratio) + "%";
}

function closeView(isForce = false) {
    if (currentItemId && sessionStart > 0) {
        const diff = Date.now() - sessionStart; 
        const item = items.find(i => i.id === currentItemId);
        if(item) {
            item.totalTimeMs += diff; lifetime.time += diff;
            const dKey = new Date().toISOString().split('T')[0];
            item.history[dKey] = (item.history[dKey] || 0) + diff;
            saveLocalOnly();
        }
    }
    sessionStart = 0; if(!isForce) { currentDayIndex = null; openDaysList(currentItemId); }
}

function deleteStatsItem() {
    if (!currentItemId) return;
    tg.showPopup({ title: "O'chirish", message: "Aniqmi?", buttons: [{id: 'd', type: 'destructive', text: "Ha"}, {id: 'c', type: 'cancel', text: "Yo'q"}] }, (id) => {
        if (id === 'd') { 
            const item = items.find(i => i.id === currentItemId); if(item) item.deleted = true;
            saveAllData(true); currentItemId = null; navTo('page-stats'); 
        }
    });
}

function renderList() {
    recalculateGoals();
    const div = document.getElementById('list-container'); div.innerHTML = '';
    const active = items.filter(i => i.status !== 'completed' && !i.deleted);
    if(active.length === 0) div.innerHTML = '<p style="text-align:center;opacity:0.5;margin-top:20px">Hozircha maqsadlar yo\'q.</p>';
    active.forEach(item => {
        const totalP = item.progress.reduce((a,b)=>a+b, 0); const percent = Math.floor((totalP / item.total) * 100);
        const el = document.createElement('div'); el.className = 'card'; el.onclick = () => openDaysList(item.id);
        el.innerHTML = `<h3>${item.name}</h3><div style="font-size:12px;opacity:0.7;margin-bottom:5px">Jami: ${totalP} / ${item.total}</div><div style="background:#e9e9ea;height:8px;border-radius:4px;overflow:hidden"><div style="width:${percent}%;background:var(--grad);height:100%"></div></div>`;
        div.appendChild(el);
    });
}

function showDetail(id) {
    currentItemId = id; const item = items.find(i => i.id === id);
    document.getElementById('detail-title').innerText = item.name;
    document.getElementById('detail-time').innerText = Math.floor(item.totalTimeMs / 60000) + " daqiqa";
    navTo('page-detail');
    if(chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('timeChart').getContext('2d');
    const clr = settings.dark ? '#fff' : '#000';
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(item.history), datasets: [{ label: 'Vaqt (daqiqa)', data: Object.values(item.history).map(ms => (ms/60000).toFixed(1)), backgroundColor: '#22c55e', borderRadius: 6 }] },
        options: { responsive:true, maintainAspectRatio:false, scales: { y: { ticks: { color: clr } }, x: { ticks: { color: clr } } }, plugins: { legend: { display: false } } }
    });
}

function renderStats() {
    const div = document.getElementById('completed-container'); div.innerHTML = '';
    const list = items.filter(i => i.status === 'completed' && !i.deleted);
    if(list.length === 0) div.innerHTML = '<p style="text-align:center;opacity:0.5;margin-top:20px">Tarix bo\'sh</p>';
    list.forEach(item => {
        const el = document.createElement('div'); el.className = 'card'; el.style.background = 'rgba(34, 197, 94, 0.2)';
        el.onclick = () => showDetail(item.id);
        el.innerHTML = `<b>${item.name} ✅</b><br><span style="font-size:12px">Statistika</span>`;
        div.appendChild(el);
    });
}

function updateProfileUI() {
    document.getElementById('p-life-count').innerText = lifetime.count;
    let tm = Math.floor(lifetime.time / 60000);
    document.getElementById('p-life-time').innerText = (tm > 60 ? Math.floor(tm/60)+"s " : "") + (tm%60) + "m";
}

function navTo(pid) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pid).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(pid === 'page-home') { document.querySelectorAll('.nav-item')[0].classList.add('active'); renderList(); tg.BackButton.hide(); }
    else {
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
            if(pid === 'page-view') closeView();
            else if(pid === 'page-detail') navTo('page-stats');
            else if(pid === 'page-days') navTo('page-home');
            else if(pid === 'page-create') navTo('page-home');
            else navTo('page-home');
            tg.BackButton.offClick();
        });
    }
    if(pid==='page-stats') { document.querySelectorAll('.nav-item')[1].classList.add('active'); renderStats(); }
    if(pid==='page-profile') { document.querySelectorAll('.nav-item')[2].classList.add('active'); updateProfileUI(); }
}

function applySettings() {
    if(settings.dark) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
    document.getElementById('tg-dark').checked = settings.dark; document.getElementById('tg-vib').checked = settings.vib;
    try { const c = getComputedStyle(document.body).getPropertyValue('--bg').trim(); tg.setHeaderColor(c); tg.setBackgroundColor(c); } catch(e){}
}
function toggleDark() { settings.dark = !settings.dark; applySettings(); saveAllData(); }
function toggleVib() { settings.vib = !settings.vib; saveAllData(); }
