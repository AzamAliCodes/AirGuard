// AirGuard Logic Controller - Professional Edition
let values = { aqi: 0, pm25: 0, pm10: 0, no2: 0, so2: 0, co: 0, o3: 0 };
let trendChart = null;
let activeLocationId = 'loc-001'; // Default to Chennai
let allLocations = [];
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let userSubscriptions = [];
let alerts = [];

// --- Alerts Management ---
function toggleAlerts() {
    document.getElementById('alertsSidebar').classList.toggle('open');
    if (document.getElementById('alertsSidebar').classList.contains('open')) {
        fetchAlerts();
    }
}

async function fetchAlerts() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/alerts/${currentUser.id}`);
        alerts = await res.json();
        renderAlerts();
        updateNotiBadge();
    } catch (err) { console.error(err); }
}

function updateNotiBadge() {
    const badge = document.getElementById('notiBadge');
    if (alerts.length > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderAlerts() {
    const container = document.getElementById('alertsContainer');
    if (alerts.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No active alerts for your followed locations.</p></div>`;
        return;
    }

    container.innerHTML = alerts.map(a => `
        <div class="alert-item critical">
            <span class="time">${new Date(a.CreatedAt).toLocaleString()}</span>
            <div class="title">Critical ${a.Pollutant} Level</div>
            <div class="desc">${a.RecName}: ${a.RecDesc}</div>
            <div style="font-size: 11px; margin-top: 8px; font-weight: 800; color: var(--color-primary);">Station: ${a.LocationName}</div>
        </div>
    `).join('');
}

// --- Auth UI Management ---
function showAuthModal(type) {
    document.getElementById('authModal').classList.remove('hidden');
    toggleAuth(type);
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

function toggleAuth(type) {
    if (type === 'login') {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('signupForm').classList.add('hidden');
    } else {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
    }
}

function updateAuthUI() {
    const authNav = document.getElementById('authNav');
    const userNav = document.getElementById('userNav');
    const navUsername = document.getElementById('navUsername');
    
    if (currentUser) {
        if (authNav) authNav.classList.add('hidden');
        if (userNav) userNav.classList.remove('hidden');
        if (navUsername) navUsername.innerText = currentUser.username;
        fetchSubscriptions();
    } else {
        if (authNav) authNav.classList.remove('hidden');
        if (userNav) userNav.classList.add('hidden');
        userSubscriptions = [];
        updateFollowBtnUI();
    }
}

// --- Subscription Management ---

async function fetchSubscriptions() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/subscriptions/${currentUser.id}`);
        userSubscriptions = await res.json();
        updateFollowBtnUI();
    } catch (err) { console.error(err); }
}

function updateFollowBtnUI() {
    const btn = document.getElementById('followBtn');
    if (!btn) return;

    const isSubscribed = userSubscriptions.includes(activeLocationId);
    if (isSubscribed) {
        btn.classList.add('active');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Following`;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Follow`;
    }
}

async function toggleFollow() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }

    const isSubscribed = userSubscriptions.includes(activeLocationId);
    const endpoint = isSubscribed ? '/api/unsubscribe' : '/api/subscribe';
    
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, locationId: activeLocationId })
        });
        
        if (res.ok) {
            if (isSubscribed) {
                userSubscriptions = userSubscriptions.filter(id => id !== activeLocationId);
            } else {
                userSubscriptions.push(activeLocationId);
            }
            updateFollowBtnUI();
        }
    } catch (err) { console.error(err); }
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthUI();
}

async function submitLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateAuthUI();
            closeAuthModal();
        } else alert(data.error);
    } catch (err) { console.error(err); }
}

async function submitSignup() {
    const username = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateAuthUI();
            closeAuthModal();
        } else alert(data.error);
    } catch (err) { console.error(err); }
}

// --- Notifications ---
function showToast(title, msg, type = 'warning') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'airguard-toast glass';
    
    let icon = '⚠️';
    if (type === 'success') {
        icon = '✅';
        toast.style.borderLeft = '4px solid #10B981';
    } else if (type === 'error') {
        icon = '❌';
        toast.style.borderLeft = '4px solid #ef4444';
    }

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${msg}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// --- User Info Modal ---
function showUserInfoModal() {
    if (!currentUser) return;
    document.getElementById('infoUserID').innerText = currentUser.id || 'N/A';
    document.getElementById('infoUsername').innerText = currentUser.username || 'N/A';
    document.getElementById('infoFtnName').innerText = currentUser.FtnName || currentUser.ftnname || 'Not Provided';
    document.getElementById('infoEmail').innerText = currentUser.email || 'N/A';
    document.getElementById('userInfoModal').classList.remove('hidden');
}

function closeUserInfoModal() {
    document.getElementById('userInfoModal').classList.add('hidden');
}

// --- Data Orchestration ---
async function fetchLocations() {
    try {
        const res = await fetch('/api/locations');
        if (res.ok) {
            allLocations = await res.json();
            const isMock = allLocations.some(l => l.isMock);
            const card = document.getElementById('dbStatusCard');
            if (isMock) { if (card) card.classList.remove('hidden'); }
            else { if (card) card.classList.add('hidden'); }
            syncDropdown();
        } else fallbackLocations();
    } catch (err) { fallbackLocations(); }
}

function fallbackLocations() {
    const selector = document.getElementById('locationSelect');
    if (selector) {
        allLocations = Array.from(selector.options).map(opt => {
            const [name, state] = opt.text.split(', ');
            return { LocationID: opt.value, Name: name, State: state || '' };
        });
    }
    changeLocation();
}

function syncDropdown() {
    const locationSelect = document.getElementById('locationSelect');
    if (locationSelect && allLocations.length > 0) {
        const currentVal = locationSelect.value;
        locationSelect.innerHTML = allLocations.map(l => 
            `<option value="${l.LocationID}">${l.Name}${l.State ? ', ' + l.State : ''}</option>`
        ).join('');
        if (currentVal) locationSelect.value = currentVal;
        changeLocation();
    }
}

function changeLocation() {
    const selector = document.getElementById('locationSelect');
    if (selector && selector.value) {
        activeLocationId = selector.value;
        loadRealData();
    }
}

async function loadRealData() {
    try {
        const activeLoc = allLocations.find(l => l.LocationID === activeLocationId);
        if (!activeLoc) return;
        document.getElementById('activeLocationName').innerText = `${activeLoc.Name}, ${activeLoc.State}`;

        const res = await fetch(`/api/current-aqi/${activeLocationId}`);
        const data = await res.json();
        const card = document.getElementById('dbStatusCard');
        const sourceBadge = document.getElementById('sourceBadge');
        const sourceLabel = document.getElementById('sourceLabel');

        if (data.isMock) {
            if (card) card.classList.remove('hidden');
            if (sourceBadge) sourceBadge.className = 'source-badge mock';
            if (sourceLabel) sourceLabel.innerText = 'Simulated';
        } else {
            if (card) card.classList.add('hidden');
            if (sourceBadge) sourceBadge.className = 'source-badge db';
            if (sourceLabel) sourceLabel.innerText = 'Database';
        }

        values = { aqi: 0, pm25: 0, pm10: 0, no2: 0, so2: 0, co: 0, o3: 0 };
        values.aqi = data.aqi || 0;
        if (data.readings && data.readings.length > 0) {
            data.readings.forEach(r => {
                let key = (r.Pollutant_Name || r.Pollutant || '').toLowerCase().replace('.', '').replace('₂', '2');
                if (key === 'carbon monoxide') key = 'co';
                if (key === 'nitrogen dioxide') key = 'no2';
                if (key === 'sulfur dioxide') key = 'so2';
                if (key === 'ozone') key = 'o3';
                if (values.hasOwnProperty(key)) values[key] = parseFloat(r.Reading_Value || r.Value) || 0;
            });
        }
        updateUI();
    } catch (err) { console.error(err); }
}

function updateUI() {
    ['pm25', 'pm10', 'no2', 'co', 'o3', 'so2'].forEach(p => {
        const valEl = document.getElementById(`val-${p}`);
        const badgeEl = document.getElementById(`badge-${p}`);
        if (valEl) valEl.innerText = values[p].toFixed(2);
        const { cat, col } = getPollutantStatus(p, values[p]);
        if (badgeEl) {
            badgeEl.innerHTML = `<div class="p-status-dot" style="background: ${col}"></div>${cat}`;
            badgeEl.style.color = col;
            badgeEl.style.background = col.replace(')', ', 0.15)').replace('var', 'rgba');
        }
    });

    const valAqiGridEl = document.getElementById('val-aqi-grid');
    const badgeAqiEl = document.getElementById('badge-aqi-grid');
    if (valAqiGridEl) valAqiGridEl.innerText = Math.round(values.aqi);

    let cat, col, desc;
    if (values.aqi <= 50) { cat = 'Optimal'; col = 'var(--color-optimal)'; desc = 'Air quality is satisfactory.'; }
    else if (values.aqi <= 100) { cat = 'Moderate'; col = 'var(--color-moderate)'; desc = 'Air quality is acceptable.'; }
    else { cat = 'Fair'; col = 'var(--color-fair)'; desc = 'Health alert: Risk is increased.'; }

    if (badgeAqiEl) {
        badgeAqiEl.innerText = cat;
        badgeAqiEl.style.color = col;
        badgeAqiEl.style.background = col.replace(')', ', 0.15)').replace('var', 'rgba');
    }
    const summaryDesc = document.getElementById('summary-desc');
    if (summaryDesc) summaryDesc.innerText = desc;
    updateRecommendations(cat);
}

function getPollutantStatus(pollutant, value) {
    const val = parseFloat(value);
    let cat = 'Optimal', col = 'var(--color-optimal)';
    const thresholds = { pm25: [12, 35], pm10: [54, 154], no2: [53, 100], so2: [35, 75], co: [4.4, 9.4], o3: [54, 70] };
    const t = thresholds[pollutant];
    if (t) {
        if (val > t[1]) { cat = 'Fair'; col = 'var(--color-fair)'; }
        else if (val > t[0]) { cat = 'Moderate'; col = 'var(--color-moderate)'; }
    }
    return { cat, col };
}

function updateRecommendations(cat) {
    const recContainer = document.getElementById('recContainer');
    if (!recContainer) return;
    let recs = cat === 'Optimal' ? [
        { label: 'Outdoor Activities', val: 'Perfect for all outdoor exercise.', icon: '🍃' },
        { label: 'General Advice', val: 'No special health precautions required.', icon: '✅' }
    ] : [
        { label: 'Health Alert', val: 'Stay indoors if sensitive.', icon: '🏠' },
        { label: 'Advice', val: 'Avoid exertion outdoors.', icon: '⚠️' }
    ];
    recContainer.innerHTML = recs.map(r => `
        <div class="glass insight-card bulletin-item" style="background: rgba(255,255,255,0.02) !important;">
            <div class="bulletin-icon">${r.icon}</div>
            <div class="bulletin-content"><span class="bulletin-label">${r.label}</span><span class="bulletin-text">${r.val}</span></div>
        </div>
    `).join('');
}

async function manualSync() {
    const btn = document.getElementById('refreshBtn');
    const icon = document.getElementById('refreshIcon');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    icon.style.animation = 'spin 1s linear infinite';
    btn.style.opacity = '0.5';
    try {
        const res = await fetch('/api/sync-now', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId: activeLocationId })
        });
        const data = await res.json();
        if (data.success) {
            setTimeout(() => {
                loadRealData();
                if (data.count > 0) {
                    showToast('Sync Successful', data.message, 'success');
                } else {
                    // Use the specific message from the server (e.g., "API Key missing")
                    showToast('Sync Incomplete', data.message || 'API returned no new data.', 'warning');
                }
            }, 500);
        } else showToast('Sync Error', data.error || 'Failed to fetch data.', 'error');
    } catch (err) { showToast('Sync Error', 'Check server logs.', 'error'); }
    finally { setTimeout(() => { btn.disabled = false; icon.style.animation = 'none'; btn.style.opacity = '1'; }, 1000); }
}

const style = document.createElement('style');
style.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

window.onload = () => {
    updateAuthUI();
    fetchLocations();
    fetchAlerts();
    setInterval(loadRealData, 60000);
    setInterval(fetchAlerts, 30000);
};
