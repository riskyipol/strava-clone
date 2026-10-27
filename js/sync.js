// Sync module - Handle background sync with Service Worker
class SyncManager {
    constructor() {
        this.syncQueue = [];
        this.isSyncing = false;
        this.init();
    }

    async init() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('service-worker.js');
                console.log('Service Worker registered with scope:', registration.scope);
                this.registration = registration;
            }
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    }

    async requestBackgroundSync() {
        if (!this.registration) return;
        try {
            await this.registration.sync.register('sync-activity');
            console.log('Background sync requested');
        } catch (err) {
            console.error('Background sync failed:', err);
        }
    }

    queueSync(activity) {
        this.syncQueue.push(activity);
        this.requestBackgroundSync();
        this.processQueue();
    }

    async processQueue() {
        if (this.isSyncing || this.syncQueue.length === 0) return;
        this.isSyncing = true;

        const activity = this.syncQueue.shift();
        try {
            // Try to send to server
            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activity)
            });

            if (!response.ok) throw new Error('Sync failed');
            console.log('Activity synced successfully');
        } catch (err) {
            console.error('Sync failed, requeueing:', err);
            this.syncQueue.unshift(activity);
        }

        this.isSyncing = false;
        if (this.syncQueue.length > 0) {
            this.processQueue();
        }
    }

    handleSyncEvent(event) {
        event.waitUntil(this.syncAll());
    }

    async syncAll() {
        const history = JSON.parse(localStorage.getItem('stravaHistory') || '[]');
        const unsynced = history.filter(a => !a.synced);

        for (const activity of unsynced) {
            try {
                const response = await fetch('/api/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(activity)
                });

                if (response.ok) {
                    activity.synced = true;
                    localStorage.setItem('stravaHistory', JSON.stringify(history));
                }
            } catch (err) {
                console.error('Sync error:', err);
            }
        }
    }
}

const syncManager = new SyncManager();

// Handle sync from service worker
if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('sync', (event) => {
            if (event.tag === 'sync-activity') {
                syncManager.handleSyncEvent(event);
            }
        });
    });
}