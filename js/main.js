// Main module - UI initialization and event handlers
let map = null;
let pathLayer = null;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadHistory();
    initMap();
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
    });
}

function updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = message;
}

function initMap() {
    // Use Leaflet for map (loaded from CDN)
    map = L.map('map').setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    pathLayer = L.polyline([], { color: 'red', weight: 5 }).addTo(map);
}

function addPathPoint(lat, lng) {
    if (map && pathLayer) {
        pathLayer.addLatLng([lat, lng]);
        map.panTo([lat, lng]);
    }
}

function clearMap() {
    if (pathLayer) {
        map.removeLayer(pathLayer);
    }
    pathLayer = L.polyline([], { color: 'red', weight: 5 }).addTo(map);
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    listEl.innerHTML = history.map(activity => `
        <div class="history-item">
            <div class="history-date">${new Date(activity.startTime).toLocaleDateString()}</div>
            <div class="history-stats">
                <span>${formatDuration(activity.duration)}</span>
                <span>${activity.distance.toFixed(2)} km</span>
            </div>
        </div>
    `).join('');

    if (history.length === 0) {
        listEl.innerHTML = '<div class="no-history">No activities yet</div>';
    }
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60) % 60;
    const h = Math.floor(m / 60);
    return String(h).padStart(2, '0') + ':' +
           String(m).padStart(2, '0') + ':' +
           String(s % 60).padStart(2, '0');
}

// Register Service Worker for PWA installation
async function registerSW() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js');
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