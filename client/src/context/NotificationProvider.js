import React, {
    createContext, useContext, useState, useEffect,
    useCallback, useRef
} from 'react';
import { useAuth } from './AuthContext';
import api from '../api/api';

const NotificationContext = createContext(null);

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
    return ctx;
};

export const NotificationProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // We reuse the socket that ChatProvider also uses.
    // To avoid a second connection, we listen on the window-level custom event
    // that Header/ChatProvider fires, OR we grab the io socket from the chat context.
    // Simplest cross-provider solution: keep a minimal socket here.
    const socketRef = useRef(null);

    const SOCKET_URL = 'http://localhost:5000';

    // ── Fetch from REST ──────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // ── Mark single as read ──────────────────────────────────────────────────
    const markRead = useCallback(async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    }, []);

    // ── Mark all as read ─────────────────────────────────────────────────────
    const markAllRead = useCallback(async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    }, []);

    // ── Delete notification ───────────────────────────────────────────────────
    const deleteNotification = useCallback(async (id) => {
        try {
            await api.delete(`/notifications/${id}`);
            setNotifications(prev => {
                const n = prev.find(x => x.id === id);
                if (n && !n.is_read) setUnreadCount(c => Math.max(0, c - 1));
                return prev.filter(x => x.id !== id);
            });
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    }, []);

    // ── Load on login ────────────────────────────────────────────────────────
    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, fetchNotifications]);

    // ── Real-time socket listener ─────────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated) return;

        // Dynamically import socket.io-client to reuse the same version already installed
        import('socket.io-client').then(({ io }) => {
            const token = localStorage.getItem('token');
            if (!token) return;

            const socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay: 2000
            });

            socketRef.current = socket;

            socket.on('new-notification', (notif) => {
                setNotifications(prev => {
                    // Deduplicate by id
                    if (prev.some(n => n.id === notif.id)) return prev;
                    return [notif, ...prev];
                });
                setUnreadCount(prev => prev + 1);
            });

            return () => {
                socket.disconnect();
                socketRef.current = null;
            };
        });
    }, [isAuthenticated]);

    const value = {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markRead,
        markAllRead,
        deleteNotification
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
