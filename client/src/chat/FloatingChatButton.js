import React from 'react';
import { useChat } from './ChatProvider';
import { useAuth } from '../context/AuthContext';

/**
 * Fixed floating button — bottom-right corner.
 * Only renders when user is authenticated.
 */
const FloatingChatButton = () => {
    const { isAuthenticated } = useAuth();
    const { isPickerOpen, isWindowOpen, unreadCount, openPicker, closePicker } = useChat();

    if (!isAuthenticated) return null;

    const handleClick = () => {
        if (isWindowOpen) return; // window already open; let user use it
        if (isPickerOpen) {
            closePicker();
        } else {
            openPicker();
        }
    };

    return (
        <button
            id="floating-chat-btn"
            className={`fchat-fab ${isPickerOpen ? 'active' : ''}`}
            onClick={handleClick}
            title="Private Chat"
            aria-label="Open private chat"
        >
            {/* Icon toggles between chat bubble and X */}
            {isPickerOpen ? (
                <span className="fchat-fab-icon" aria-hidden="true">✕</span>
            ) : (
                <span className="fchat-fab-icon" aria-hidden="true">💬</span>
            )}

            {/* Unread badge */}
            {unreadCount > 0 && !isWindowOpen && (
                <span className="fchat-fab-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};

export default FloatingChatButton;
