// Tracker module - GPS tracking and activity management
class ActivityTracker {
    constructor() {
        this.position = null;
        this.path = [];
        this.startTime = null;
        this.pauseTime = null;
        this.totalPaused = 0;
        this.timerInterval = null;
        this.wakeLock = null;
        this.trackingId = null;
        this.watchId = null;
        this.distance = 0;
        this.speed = 0;
        this.isTracking = false;
        this.isPaused = false;
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
            }
        } catch (err) {
            console.error(err.name + ', ' + err.message);
        }
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
            } catch (err) {
                console.error(err);
            }
        }
    }

    startTracking() {
        if (this.isTracking) return;

        this.trackingId = Date.now().toString();
        this.startTime = Date.now();
        this.path = [];
        this.distance = 0;
        this.speed = 0;
        this.isTracking = true;
        this.isPaused = false;

        this.requestWakeLock();
        this.updateUI();

        this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.onPositionUpdate(position),
                (error) => this.onPositionError(error),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
        } else {
            alert('Geolocation not supported');
        }
    }

    pauseTracking() {
        if (!this.isTracking || this.isPaused) return;

        this.isPaused = true;
        this.pauseTime = Date.now();
        clearInterval(this.timerInterval);
        navigator.geolocation.clearWatch(this.watchId);
        this.updateUI();
    }

    resumeTracking() {
        if (!this.isTracking || !this.isPaused) return;

        this.totalPaused += Date.now() - this.pauseTime;
        this.isPaused = false;
        this.pauseTime = null;

        this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.onPositionUpdate(position),
            (error) => this.onPositionError(error),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );

        this.updateUI();
    }

    stopTracking() {
        if (!this.isTracking) return;

        navigator.geolocation.clearWatch(this.watchId);
        clearInterval(this.timerInterval);
        this.releaseWakeLock();

        const endTime = Date.now();
        const duration = endTime - this.startTime - this.totalPaused;

        const activity = {
            id: this.trackingId,
            startTime: this.startTime,
            endTime: endTime,
            duration: duration,
            distance: this.distance,
            path: this.path,
            speed: this.speed
        };

        this.saveActivity(activity);

        this.isTracking = false;
        this.path = [];
        this.distance = 0;
        this.speed = 0;

        updateStatus('Tracking saved');
        loadHistory();
        clearMap();

        return activity;
    }

    onPositionUpdate(position) {
        this.position = position;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.path.push({ lat, lng, time: position.timestamp });

        if (this.path.length > 1) {
            const prevPoint = this.path[this.path.length - 2];
            this.distance += this.haversineDistance(prevPoint.lat, prevPoint.lng, lat, lng);
        }

        this.speed = position.coords.speed ? position.coords.speed * 3.6 : 0;

        if (typeof map !== 'undefined' && map) {
            addPathPoint(lat, lng);
        }

        this.updateUI();
    }

    onPositionError(error) {
        console.error('GPS Error:', error);
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    updateTimer() {
        if (!this.startTime) return;
        const elapsed = Date.now() - this.startTime - this.totalPaused;
        const el = document.getElementById('duration');
        if (el) el.textContent = this.formatTime(elapsed);
    }

    formatTime(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60) % 60;
        const h = Math.floor(m / 60);
        return String(h).padStart(2, '0') + ':' +
               String(m).padStart(2, '0') + ':' +
               String(s % 60).padStart(2, '0');
    }

    saveActivity(activity) {
        const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
        history.unshift(activity);
        localStorage.setItem('stravaHistory', JSON.stringify(history));
    }

    updateUI() {
        const dEl = document.getElementById('distance');
        const sEl = document.getElementById('speed');
        if (dEl) dEl.textContent = this.distance.toFixed(2) + ' km';
        if (sEl) sEl.textContent = Math.round(this.speed) + ' km/h';
    }
}

const tracker = new ActivityTracker();