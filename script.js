const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// MA'LUMOTLAR
let appData = {
    items: [],
    settings: { dark: false, vib: true },
    lifetime: { count: 0, time: 0 },
    lastUpdated: 0 
};

let canSaveToCloud = false;
let saveTimer = null;
const STORAGE_KEY = 'zikr_final_v5_full';

let currentItemId = null;
let currentDayIndex = null;
let sessionStart = 0;
let chartInstance = null;

window.onload = function() {
    initUser();
    initApp();
    
    setTimeout(() => {
        if(document.getElementById('loader').style.display !== 'none') {
            document.getElementById('loader').style.display = 'none';
            canSaveToCloud = true; 
        }
    }, 10000);

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

function initApp() {
    try {
        const localRaw = localStorage.getItem(STORAGE_KEY);
        if (localRaw) {
            const localParsed = JSON.parse(localRaw);
            if (localParsed.items) {
                appData = localParsed;
                renderAll();
            }
        }
    } catch(e) { console.log("Lokal xato"); }

    if (!tg.CloudStorage) {
        canSaveToCloud = true;
        document.getElementById('loader').style.display = 'none';
        return;
    }

    tg.CloudStorage.getItem(STORAGE_KEY, (err, val) => {
        if (!err && val) {
            try {
                const cloudData = JSON.parse(val);
                const localTime = appData.lastUpdated || 0;
                const cloudTime = cloudData.lastUpdated || 0;

                if (cloudTime > localTime || (appData.items.length === 0 && cloudData.items.length > 0)) {
                    appData = cloudData;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                }
            } catch (e) { console.error("Bulut JSON xato", e); }
        }
        
        canSaveToCloud = true;
        renderAll();
        document.getElementById('loader').style.display = 'none';
    });
}

function saveLocalOnly() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function saveAllData(force = false) {
    appData.lastUpdated = Date.now();
    saveLocalOnly();

    if (!canSaveToCloud || !tg.CloudStorage) return;

    if (saveTimer) clearTimeout(saveTimer);
    const doCloud = () => {
        tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    };

    if (force) doCloud(); else saveTimer = setTimeout(doCloud, 2000);
}

function forceCloudSync() {
    if(!confirm("Hozirgi ma'lumotlarni o'chirib, Bulutdagini yuklaymi?")) return;
    tg.CloudStorage.getItem(STORAGE_KEY, (err, val) => {
        if(!err && val) {
            appData = JSON.parse(val);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
            renderAll();
            alert("Tiklandi!");
        } else {
            alert("Bulut bo'sh.");
        }
    });
}

function renderAll() {
    applySettings();
    renderList();
    updateProfileUI();
}

function createItem() {
    const name = document.getElementById('inp-name').value;
    const total = parseInt(document.getElementById('inp-total').value);
    const days = parseInt(document.getElementById('inp-days').value);
    if(!name || !total || !days) return tg.showAlert("To'ldiring!");

    appData.items.push({
        id: Date.now(), name: name, total: total, durationDays: days,
        dailyGoal: Math.ceil(total / days), startDate: new Date().setHours(0,0,0,0),
        progress: new Array(days).fill(0), totalTimeMs: 0, history: {}, status: 'active', deleted: false
    });
    saveAllData();
    navTo('page-home');
    document.getElementById('inp-name').value = ''; document.getElementById('inp-total').value = ''; document.getElementById('inp-days').value = '';
}

function renderList() {
    const today = new Date().setHours(0,0,0,0);
    appData.items.forEach(item => {
        if (item.status === 'completed' || item.deleted) return;
        const daysPassed = Math.floor((today - item.startDate) / (1000 * 60 * 60 * 24));
        if (daysPassed > 0 && daysPassed < item.durationDays) {
            let doneInPast = 0; for(let i=0; i<daysPassed; i++) doneInPast += item.progress[i] || 0;
            const rem = item.total - doneInPast; const dLeft = item.durationDays - daysPassed;
            if (rem>0 && dLeft>0) item.dailyGoal = Math.ceil(rem/dLeft);
        }
    });

    const div = document.getElementById('list-container'); div.innerHTML = '';
    const active = appData.items.filter(i => i.status !== 'completed' && !i.deleted);
    
    if(active.length === 0) div.innerHTML = '<p style="text-align:center;opacity:0.5;margin-top:20px">Maqsadlar yo\'q.</p>';
    
    active.forEach(item => {
        const totalP = item.progress.reduce((a,b)=>a+b, 0); const percent = Math.floor((totalP / item.total) * 100);
        const el = document.createElement('div'); el.className = 'card'; el.onclick = () => openDaysList(item.id);
        el.innerHTML = `<h3>${item.name}</h3><div style="font-size:12px;opacity:0.7;margin-bottom:5px">Jami: ${totalP} / ${item.total}</div><div style="background:#e9e9ea;height:8px;border-radius:4px;overflow:hidden"><div style="width:${percent}%;background:var(--grad);height:100%"></div></div>`;
        div.appendChild(el);
    });
}

function openDaysList(id) {
    currentItemId = id; const item = appData.items.find(i => i.id === id); if(!item) return;
    document.getElementById('days-title').innerText = item.name;
    const container = document.getElementById('days-container'); container.innerHTML = '';
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
        div.onclick = isLocked ? () => tg.showAlert("Vaqti kelmadi") : () => openCounter(i);
        container.appendChild(div);
    }
    navTo('page-days');
}

function openCounter(dayIdx) {
    currentDayIndex = dayIdx; sessionStart = Date.now();
    const item = appData.items.find(i => i.id === currentItemId);
    document.getElementById('view-word-name').innerText = item.name;
    document.getElementById('view-goal').innerText = item.dailyGoal;
    updateCircleUI(item);
    navTo('page-view');
}

function doCount() {
    if (!currentItemId) return;
    const item = appData.items.find(i => i.id === currentItemId);
    if (item.progress[currentDayIndex] >= item.dailyGoal) return;

    item.progress[currentDayIndex]++; appData.lifetime.count++;
    if(appData.settings.vib) try { tg.HapticFeedback.impactOccurred('light'); } catch(e){}
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
        const item = appData.items.find(i => i.id === currentItemId);
        if(item) {
            item.totalTimeMs += diff; appData.lifetime.time += diff;
            const dKey = new Date().toISOString().split('T')[0];
            item.history[dKey] = (item.history[dKey] || 0) + diff;
            saveAllData();
        }
    }
    sessionStart = 0; if(!isForce) { currentDayIndex = null; openDaysList(currentItemId); }
}

function deleteStatsItem() {
    if (!currentItemId) return;
    tg.showPopup({ title: "O'chirish", message: "Aniqmi?", buttons: [{id: 'd', type: 'destructive', text: "Ha"}, {id: 'c', type: 'cancel', text: "Yo'q"}] }, (id) => {
        if (id === 'd') { 
            const item = appData.items.find(i => i.id === currentItemId); if(item) item.deleted = true;
            saveAllData(true); currentItemId = null; navTo('page-stats'); 
        }
    });
}

function showDetail(id) {
    currentItemId = id; const item = appData.items.find(i => i.id === id);
    document.getElementById('detail-title').innerText = item.name;
    document.getElementById('detail-time').innerText = Math.floor(item.totalTimeMs / 60000) + " daqiqa";
    navTo('page-detail');
    if(chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('timeChart').getContext('2d');
    const clr = appData.settings.dark ? '#fff' : '#000';
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(item.history), datasets: [{ label: 'Vaqt (daqiqa)', data: Object.values(item.history).map(ms => (ms/60000).toFixed(1)), backgroundColor: '#22c55e', borderRadius: 6 }] },
        options: { responsive:true, maintainAspectRatio:false, scales: { y: { ticks: { color: clr } }, x: { ticks: { color: clr } } }, plugins: { legend: { display: false } } }
    });
}

function renderStats() {
    const div = document.getElementById('completed-container'); div.innerHTML = '';
    const list = appData.items.filter(i => i.status === 'completed' && !i.deleted);
    if(list.length === 0) div.innerHTML = '<p style="text-align:center;opacity:0.5;margin-top:20px">Tarix bo\'sh</p>';
    list.forEach(item => {
        const el = document.createElement('div'); el.className = 'card'; el.style.background = 'rgba(34, 197, 94, 0.2)';
        el.onclick = () => showDetail(item.id);
        el.innerHTML = `<b>${item.name} ✅</b><br><span style="font-size:12px">Statistika</span>`;
        div.appendChild(el);
    });
}

function updateProfileUI() {
    document.getElementById('p-life-count').innerText = appData.lifetime.count;
    let tm = Math.floor(appData.lifetime.time / 60000);
    document.getElementById('p-life-time').innerText = (tm > 60 ? Math.floor(tm/60)+"s " : "") + (tm%60) + "m";
    document.getElementById('tg-dark').checked = appData.settings.dark; 
    document.getElementById('tg-vib').checked = appData.settings.vib;
}

function calcDaily() { const t = parseInt(document.getElementById('inp-total').value) || 0; const d = parseInt(document.getElementById('inp-days').value) || 0; document.getElementById('lbl-daily').innerText = (t && d) ? Math.ceil(t/d) : 0; }

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
    if(appData.settings.dark) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
    try { const c = getComputedStyle(document.body).getPropertyValue('--bg').trim(); tg.setHeaderColor(c); tg.setBackgroundColor(c); } catch(e){}
}
function toggleDark() { appData.settings.dark = !appData.settings.dark; applySettings(); saveAllData(); }
function toggleVib() { appData.settings.vib = !appData.settings.vib; saveAllData(); }
