// Main module - UI initialization and event handlers
let map = null;
let pathLayer = null;
let mapMarkers = [];

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadHistory();
    initMap();
    initServiceWorker();
});

function initUI() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    startBtn.addEventListener('click', () => {
        tracker.startTracking();
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        updateStatus('Tracking in progress');
    });

    pauseBtn.addEventListener('click', () => {
        tracker.pauseTracking();
        pauseBtn.disabled = true;
        startBtn.disabled = false;
        updateStatus('Paused');
    });

    stopBtn.addEventListener('click', () => {
        const activity = tracker.stopTracking();
        stopBtn.disabled = true;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        console.log('Activity saved:', activity);
        updateStatus('Activity saved');
    });

    // Menu toggle
    const menuBtn = document.getElementById('menuBtn');
    const closeMenu = document.getElementById('closeMenu');
    const overlay = document.getElementById('overlay');
    const sidebar = document.getElementById('menu');

    menuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    });

    closeMenu.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./public/service-worker.js')
                .then(registration => {
                    console.log('SW registered:', registration.scope);
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                if (confirm('New version available. Refresh now?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    });
                })
                .catch(err => console.error('SW registration failed:', err));
        });
    }
}

function initMap() {
    map = L.map('map').setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    pathLayer = L.polyline([], { color: '#e74c3c', weight: 5, opacity: 0.7 }).addTo(map);
    mapMarkers = [];
}

function addPathPoint(lat, lng) {
    if (map && pathLayer) {
        pathLayer.addLatLng([lat, lng]);
        map.flyTo([lat, lng], 15, { duration: 0.5 });
        
        const marker = L.marker([lat, lng], { opacity: 0.6 }).addTo(map);
        mapMarkers.push(marker);
        if (mapMarkers.length > 20) {
            map.removeLayer(mapMarkers.shift());
        }
    }
}

function clearMap() {
    map.removeLayer(pathLayer);
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];
    pathLayer = L.polyline([], { color: '#e74c3c', weight: 5, opacity: 0.7 }).addTo(map);
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    if (history.length === 0) {
        listEl.innerHTML = '<div class="no-history">No activities yet</div>';
        return;
    }

    listEl.innerHTML = history.map((activity, idx) => {
        const date = new Date(activity.startTime);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
        <div class="history-item" onclick="viewActivity(${idx})">
            <div class="history-date">${dateStr}</div>
            <div class="history-stats">
                <span class="history-duration">${formatDuration(activity.duration)}</span>
                <span class="history-distance">${activity.distance.toFixed(2)} km</span>
            </div>
        </div>
    `}).join('');
}

function viewActivity(idx) {
    const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
    if (!history[idx]) return;

    const activity = history[idx];
    const duration = formatDuration(activity.duration);
    
    const statsHTML = `
        <div class="activity-detail">
            <h2>Activity Details</h2>
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">${new Date(activity.startTime).toLocaleString()}</span></div>
                <div class="detail-item"><span class="detail-label">Duration</span><span class="detail-value">${duration}</span></div>
                <div class="detail-item"><span class="detail-label">Distance</span><span class="detail-value">${activity.distance.toFixed(2)} km</span></div>
                <div class="detail-item"><span class="detail-label">Avg Speed</span><span class="detail-value">${((activity.distance / (activity.duration / 3600000)) || 0).toFixed(1)} km/h</span></div>
            </div>
            <div class="action-buttons">
                <button class="btn" onclick="exportGPX(${idx})">Download GPX</button>
                <button class="btn btn-danger" onclick="deleteActivity(${idx})">Delete</button>
            </div>
            <button class="btn" onclick="closeDetail()">Close</button>
        </div>
    `;

    const contentEl = document.querySelector('.content');
    contentEl.innerHTML = statsHTML;
    contentEl.style.padding = '20px';

    setTimeout(() => {
        clearMap();
        if (activity.path && activity.path.length > 0) {
            const bounds = activity.path.map(p => [p.lat, p.lng]);
            pathLayer = L.polyline(bounds, { color: '#e74c3c', weight: 5 }).addTo(map);
            map.fitBounds(bounds);
        }
    }, 100);
}

function deleteActivity(idx) {
    if (!confirm('Delete this activity?')) return;
    const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
    history.splice(idx, 1);
    localStorage.setItem('stravaHistory', JSON.stringify(history));
    loadHistory();
    clearMap();
    closeDetail();
}

function closeDetail() {
    const contentEl = document.querySelector('.content');
    contentEl.innerHTML = `
        <div class="status-card">
            <div id="status" class="status-text">Ready to track</div>
            <div id="timer" class="timer">00:00:00</div>
            <div class="stats-row">
                <div class="stat-item"><span class="stat-label">Distance</span><span id="distance" class="stat-value">0.00 km</span></div>
                <div class="stat-item"><span class="stat-label">Speed</span><span id="speed" class="stat-value">0 km/h</span></div>
                <div class="stat-item"><span class="stat-label">Duration</span><span id="duration" class="stat-value">00:00:00</span></div>
            </div>
        </div>
        <div class="map-container"><div id="map"></div></div>
        <div class="controls">
            <button id="startBtn" class="btn btn-primary">Start</button>
            <button id="pauseBtn" class="btn btn-warning" disabled>Pause</button>
            <button id="stopBtn" class="btn btn-danger" disabled>Stop</button>
        </div>
        <div class="history-section"><h2>History</h2><div id="historyList" class="history-list"><div class="no-history">No activities yet</div></div></div>
    `;
    
    document.getElementById('startBtn').addEventListener('click', () => {
        tracker.startTracking();
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        updateStatus('Tracking in progress');
    });
    document.getElementById('pauseBtn').addEventListener('click', () => {
        tracker.pauseTracking();
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('startBtn').disabled = false;
        updateStatus('Paused');
    });
    document.getElementById('stopBtn').addEventListener('click', () => {
        const activity = tracker.stopTracking();
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        updateStatus('Activity saved');
        loadHistory();
        clearMap();
    });
    
    initUI();
    loadHistory();
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60) % 60;
    const h = Math.floor(m / 60);
    return String(h).padStart(2, '0') + ':' +
           String(m).padStart(2, '0') + ':' +
           String(s % 60).padStart(2, '0');
}

function exportGPX(idx) {
    const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
    if (!history[idx]) return;
    
    const activity = history[idx];
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Clone" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Activity ${new Date(activity.startTime).toLocaleString()}</name>
    <desc>Distance: ${activity.distance.toFixed(2)} km, Duration: ${formatDuration(activity.duration)}</desc>
    <trkseg>
`;
    
    activity.path.forEach(p => {
        gpx += `      <trkpt lat="${p.lat}" lon="${p.lng}">
        <ele>0</ele>
        <time>${new Date(p.time).toISOString()}</time>
      </trkpt>
`;
    });
    
    gpx += `    </trkseg>
  </trk>
</gpx>`;
    
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_${activity.startTime}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
}

// Register Service Worker for PWA installation
async function registerSW() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./public/service-worker.js');
            console.log('SW registered:', reg.scope);
        } catch (err) {
            console.error('SW registration failed:', err);
        }
    }
}

// Check for PWA installability
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('PWA install prompt available');
});

registerSW();