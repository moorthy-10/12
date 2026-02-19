import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationProvider';
import './NotificationBell.css';

// Map notification type → route to navigate to when clicked
const TYPE_ROUTES = {
    task: '/my-tasks',      // employee; admin goes to /tasks
    leave: '/my-leaves',
    chat: '/groups',
    attendance: '/my-attendance',
};

const ADMIN_ROUTES = {
    task: '/tasks',
    leave: '/leaves',
    chat: '/groups',
    attendance: '/attendance',
};

const TYPE_ICONS = {
    task: '📋',
    leave: '📅',
    chat: '💬',
    attendance: '⏰',
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

const NotificationBell = ({ isAdmin }) => {
    const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification } =
        useNotifications();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotifClick = useCallback(async (notif) => {
        if (!notif.is_read) await markRead(notif.id);

        const routes = isAdmin ? ADMIN_ROUTES : TYPE_ROUTES;
        const path = routes[notif.type];
        if (path) navigate(path);
        setOpen(false);
    }, [markRead, isAdmin, navigate]);

    const visibleNotifs = notifications.slice(0, 25);

    return (
        <div className="notif-bell-wrapper" ref={dropdownRef}>
            {/* Bell button */}
            <button
                className="notif-bell-btn"
                onClick={() => setOpen(o => !o)}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                title="Notifications"
            >
                <span className="notif-bell-icon">🔔</span>
                {unreadCount > 0 && (
                    <span className="notif-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="notif-dropdown">
                    <div className="notif-dropdown-header">
                        <span className="notif-dropdown-title">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="notif-unread-chip">{unreadCount} new</span>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <button className="notif-mark-all-btn" onClick={markAllRead}>
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="notif-list">
                        {loading && (
                            <div className="notif-empty">Loading…</div>
                        )}

                        {!loading && visibleNotifs.length === 0 && (
                            <div className="notif-empty">
                                <span style={{ fontSize: '2rem' }}>🔕</span>
                                <p>No notifications yet</p>
                            </div>
                        )}

                        {visibleNotifs.map(notif => (
                            <div
                                key={notif.id}
                                className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                                onClick={() => handleNotifClick(notif)}
                            >
                                <div className="notif-item-icon">
                                    {TYPE_ICONS[notif.type] || '🔔'}
                                </div>
                                <div className="notif-item-body">
                                    <div className="notif-item-title">{notif.title}</div>
                                    <div className="notif-item-msg">{notif.message}</div>
                                    <div className="notif-item-time">{timeAgo(notif.created_at)}</div>
                                </div>
                                <button
                                    className="notif-item-delete"
                                    title="Dismiss"
                                    onClick={e => {
                                        e.stopPropagation();
                                        deleteNotification(notif.id);
                                    }}
                                >
                                    ×
                                </button>
                                {!notif.is_read && <div className="notif-unread-dot" />}
                            </div>
                        ))}
                    </div>

                    {visibleNotifs.length > 0 && (
                        <div className="notif-dropdown-footer">
                            Showing {visibleNotifs.length} of {notifications.length}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
