import { SOCKET_URL } from './lib/config';

export const FRONTEND_ONLY = import.meta.env.VITE_FRONTEND_ONLY === 'true';

const getSocketUrl = () => {
    try {
        if (!SOCKET_URL) return 'ws://localhost:3008';
        const url = new URL(SOCKET_URL);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return url.toString();
    } catch (e) {
        console.warn('[SOCKET] Invalid URL in config:', SOCKET_URL);
        return 'ws://localhost:3008';
    }
};

class SimpleSocket {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.listeners = {};
        this.connected = false;
        this.auth = {};
    }

    connect() {
        if (FRONTEND_ONLY) return;
        try {
            if (this.socket) {
                this.socket.onopen = null;
                this.socket.onmessage = null;
                this.socket.onclose = null;
                this.socket.onerror = null;
                this.socket.close();
            }

            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                console.log('[SOCKET] Connected to', this.url);
                this.connected = true;
                this.trigger('connect');
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.type) {
                        this.trigger(data.type, data.state || data.data || data);
                    }
                } catch (e) {
                    // Ignore non-JSON messages
                }
            };

            this.socket.onclose = () => {
                console.log('[SOCKET] Disconnected');
                this.connected = false;
                this.trigger('disconnect');
                // Simple reconnect
                setTimeout(() => this.connect(), 5000);
            };

            this.socket.onerror = (err) => {
                console.error('[SOCKET] Connection error:', err);
            };
        } catch (e) {
            console.error('[SOCKET] Initialization error:', e);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (typeof callback !== 'function') return;
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        
        // Match socket.io behavior for connect
        if (event === 'connect' && this.connected) {
            callback();
        }
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        if (!callback) {
            delete this.listeners[event];
        } else {
            this.listeners[event] = this.listeners[event].filter(l => l !== callback);
        }
    }

    emit(event, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: event, data }));
        } else {
            console.warn('[SOCKET] Attempted to emit while disconnected:', event);
        }
    }

    trigger(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`[SOCKET] Error in listener for ${event}:`, e);
                }
            });
        }
    }
}

const url = getSocketUrl();
export const socket = new SimpleSocket(url);
const token = sessionStorage.getItem('matrix_token') || sessionStorage.getItem('token');
socket.auth = token ? { token } : {};

if (!FRONTEND_ONLY) {
    socket.connect();
}

export const API_URL = `${SOCKET_URL}/api`;
