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
    const userInitial = document.getElementById('userInitial');
    
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
function showToast(title, msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'airguard-toast glass';
    toast.innerHTML = `
        <div class="toast-icon">⚠️</div>
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
    // Mapping FtnName correctly from the new server object
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
            
            // If any location is mock, show the card
            const isMock = allLocations.some(l => l.isMock);
            const card = document.getElementById('dbStatusCard');
            if (isMock) {
                if (card) card.classList.remove('hidden');
            } else {
                if (card) card.classList.add('hidden');
            }

            syncDropdown();
        } else {
            fallbackLocations();
        }
    } catch (err) { 
        console.error('Database connection required for dynamic locations, using fallback', err);
        fallbackLocations();
    }
}

function fallbackLocations() {
    // Populate allLocations from the hardcoded HTML options if API fails
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
        console.log("Changing location to:", activeLocationId);
        loadRealData();
        // fetchHistory(activeLocationId); // Disabled: Chart removed from UI
    }
}

async function loadRealData() {
    try {
        const activeLoc = allLocations.find(l => l.LocationID === activeLocationId);
        if (!activeLoc) return;
        
        document.getElementById('activeLocationName').innerText = `${activeLoc.Name}, ${activeLoc.State}`;

        const res = await fetch(`/api/current-aqi/${activeLocationId}`);
        const data = await res.json();

        // Handle DB connection status UI
        const card = document.getElementById('dbStatusCard');
        const sourceBadge = document.getElementById('sourceBadge');
        const sourceLabel = document.getElementById('sourceLabel');

        if (data.isMock) {
            if (card) card.classList.remove('hidden');
            if (sourceBadge) sourceBadge.className = 'source-badge mock';
            if (sourceLabel) sourceLabel.innerText = 'Simulated';
            
            // Show toast only once per mock state change
            if (!window.dbErrorNotified) {
                showToast('Database Error', 'Falling back to simulated sensor data.');
                window.dbErrorNotified = true;
            }
        } else {
            if (card) card.classList.add('hidden');
            if (sourceBadge) sourceBadge.className = 'source-badge db';
            if (sourceLabel) sourceLabel.innerText = 'Database';
            window.dbErrorNotified = false;
        }

        if (!data || !data.readings) {
            console.error('Invalid data received from server:', data);
            return;
        }

        // Reset values before populating from DB
        values = { aqi: 0, pm25: 0, pm10: 0, no2: 0, so2: 0, co: 0, o3: 0 };
        
        values.aqi = data.aqi || 0;
        if (data.readings && data.readings.length > 0) {
            data.readings.forEach(r => {
                const rawName = (r.Pollutant_Name || r.Pollutant || '').toLowerCase();
                let key = rawName.replace('.', '').replace('₂', '2');
                
                // Map shorthand to internal keys
                if (key === 'carbon monoxide') key = 'co';
                if (key === 'nitrogen dioxide') key = 'no2';
                if (key === 'sulfur dioxide') key = 'so2';
                if (key === 'ozone') key = 'o3';

                if (values.hasOwnProperty(key)) {
                    values[key] = parseFloat(r.Reading_Value || r.Value) || 0;
                }
            });
        } else if (!data.isMock) {
            showToast('Empty Database', 'Connected to MySQL but no sensor readings found. Run node db-init.js');
        }

        updateUI();
    } catch (err) { 
        console.error('Error loading real data:', err);
    }
}

function updateUI() {
    const pollutants = ['pm25', 'pm10', 'no2', 'co', 'o3', 'so2'];

    pollutants.forEach(p => {
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
    if (values.aqi <= 50) { 
        cat = 'Optimal'; 
        col = 'var(--color-optimal)'; 
        desc = 'Air quality is satisfactory, and air pollution poses little or no risk.';
    }
    else if (values.aqi <= 100) { 
        cat = 'Moderate'; 
        col = 'var(--color-moderate)'; 
        desc = 'Air quality is acceptable. However, there may be a risk for some people.';
    }
    else { 
        cat = 'Fair'; 
        col = 'var(--color-fair)'; 
        desc = 'Health alert: The risk of health effects is increased for everyone.';
    }

    const aqiHeroCard = document.getElementById('aqiHeroCard');
    if (aqiHeroCard) {
        aqiHeroCard.style.borderColor = col.replace(')', ', 0.3)').replace('var', 'rgba');
    }

    if (badgeAqiEl) {
        badgeAqiEl.innerText = cat;
        badgeAqiEl.style.color = col;
        badgeAqiEl.style.background = col.replace(')', ', 0.15)').replace('var', 'rgba');
    }

    const summaryTitle = document.getElementById('summary-title');
    const summaryDesc = document.getElementById('summary-desc');

    if (summaryTitle) {
        summaryTitle.innerText = cat;
        summaryTitle.style.color = col;
    }
    if (summaryDesc) summaryDesc.innerText = desc;

    updateRecommendations(cat);
}

function getPollutantStatus(pollutant, value) {
    const val = parseFloat(value);
    let cat = 'Optimal', col = 'var(--color-optimal)';

    const thresholds = {
        pm25: [12, 35],
        pm10: [54, 154],
        no2: [53, 100],
        so2: [35, 75],
        co: [4.4, 9.4],
        o3: [54, 70]
    };

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

    let recs = [];
    if (cat === 'Optimal') {
        recs = [
            { label: 'Outdoor Activities', val: 'Perfect for all outdoor exercise and play.', icon: '🍃' },
            { label: 'Ventilation', val: 'Ideal time to open windows and air out indoor spaces.', icon: '🪟' },
            { label: 'General Advice', val: 'No special health precautions required today.', icon: '✅' }
        ];
    } else if (cat === 'Fair') {
        recs = [
            { label: 'Sensitive Groups', val: 'Consider reducing intense outdoor exercise if sensitive.', icon: '🏃' },
            { label: 'Ventilation', val: 'Keep windows closed if you notice any respiratory discomfort.', icon: '🚪' },
            { label: 'General Advice', val: 'Air quality is acceptable for the general public.', icon: '⚠️' }
        ];
    } else {
        recs = [
            { label: 'Health Alert', val: 'Stay indoors. Avoid all physical exertion outside.', icon: '🏠' },
            { label: 'Filtration', val: 'Use air purifiers and keep all entry points sealed.', icon: '🔒' },
            { label: 'Protective Gear', val: 'Wear a certified N95 mask for any necessary travel.', icon: '😷' }
        ];
    }

    recContainer.innerHTML = recs.map(r => `
        <div class="glass insight-card bulletin-item" style="border-bottom: none; background: rgba(255,255,255,0.02) !important;">
            <div class="bulletin-icon">${r.icon}</div>
            <div class="bulletin-content">
                <span class="bulletin-label">${r.label}</span>
                <span class="bulletin-text">${r.val}</span>
            </div>
        </div>
    `).join('');
}


async function fetchHistory(locationId) {
    try {
        const res = await fetch(`/api/history/${locationId}`);
        const data = await res.json();
        renderChart(data);
    } catch (err) { console.error(err); }
}

function renderChart(data) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (trendChart) trendChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradient.addColorStop(1, 'transparent');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.Time || d.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
            datasets: [{ 
                label: 'AQI', 
                data: data.map(d => d.Value), 
                borderColor: '#10B981', 
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#10B981',
                pointBorderColor: 'rgba(255,255,255,0.1)',
                tension: 0.4, 
                fill: true, 
                backgroundColor: gradient
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { display: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } }, 
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } } 
            } 
        }
    });
}

async function fetchSafetyReport() {
    try {
        const res = await fetch(`/api/safety-report/${activeLocationId}`);
        const data = await res.json();
        let reportText = "Location Safety Summary (SQL Cursor Output):\n\n";
        data.forEach(item => {
            reportText += `${item.pol_name}: Avg ${parseFloat(item.avg_val).toFixed(2)}\n`;
        });
        alert(reportText);
    } catch (err) { alert("Stored Procedure call requires active database connection."); }
}

// --- Lifecycle ---
window.onload = () => {
    updateAuthUI();
    fetchLocations();
    fetchAlerts();
    setInterval(loadRealData, 60000);
    setInterval(fetchAlerts, 30000); // Check for alerts every 30 seconds
};
