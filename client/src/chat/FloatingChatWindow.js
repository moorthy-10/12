import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';

const FloatingChatWindow = () => {
    const {
        isPickerOpen, isWindowOpen,
        selectedUser, messages, loadingHistory,
        users, loadingUsers,
        openChat, closeChat, closePicker, openPicker, sendMessage,
        currentUserId
    } = useChat();

    const [text, setText] = useState('');
    const [search, setSearch] = useState('');
    const messagesEndRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        if (isWindowOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isWindowOpen]);

    // Clear text when switching users
    useEffect(() => { setText(''); }, [selectedUser]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const sent = sendMessage(text);
        if (sent) setText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    // ── User Picker Panel ──────────────────────────────────────────────────
    if (isPickerOpen && !isWindowOpen) {
        return (
            <div className="fchat-window fchat-picker" id="chat-user-picker">
                <div className="fchat-header">
                    <span className="fchat-header-title">💬 New Message</span>
                    <button className="fchat-close-btn" onClick={closePicker} title="Close">✕</button>
                </div>

                <div className="fchat-search-bar">
                    <input
                        id="chat-user-search"
                        type="text"
                        className="fchat-search-input"
                        placeholder="Search people…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="fchat-user-list">
                    {loadingUsers ? (
                        <div className="fchat-loading">
                            <div className="fchat-spinner"></div>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="fchat-empty-label">No users found</div>
                    ) : (
                        filteredUsers.map(u => (
                            <button
                                key={u.id}
                                id={`chat-user-${u.id}`}
                                className="fchat-user-row"
                                onClick={() => { setSearch(''); openChat(u); }}
                            >
                                <div className="fchat-user-avatar">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="fchat-user-info">
                                    <div className="fchat-user-name">{u.name}</div>
                                    <div className="fchat-user-sub">{u.role}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // ── Chat Window ─────────────────────────────────────────────────────────
    if (isWindowOpen && selectedUser) {
        return (
            <div className="fchat-window fchat-chat" id="chat-window">
                {/* Header */}
                <div className="fchat-header">
                    <button
                        className="fchat-back-btn"
                        onClick={() => { openPicker(); }}
                        title="Change contact"
                    >
                        ‹
                    </button>
                    <div className="fchat-header-user">
                        <div className="fchat-header-avatar">
                            {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="fchat-header-name">{selectedUser.name}</div>
                            <div className="fchat-header-role">{selectedUser.role}</div>
                        </div>
                    </div>
                    <button
                        id="chat-window-close"
                        className="fchat-close-btn"
                        onClick={closeChat}
                        title="Close chat"
                    >
                        ✕
                    </button>
                </div>

                {/* Messages */}
                <div className="fchat-messages" id="fchat-messages-scroll">
                    {loadingHistory ? (
                        <div className="fchat-loading">
                            <div className="fchat-spinner"></div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="fchat-no-messages">
                            <span>👋</span>
                            <p>Say hello to {selectedUser.name}!</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <PrivateBubble
                                key={msg.id}
                                msg={msg}
                                isMine={msg.sender_id === currentUserId}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form className="fchat-input-bar" onSubmit={handleSend}>
                    <input
                        id="fchat-text-input"
                        type="text"
                        className="fchat-text-input"
                        placeholder={`Message ${selectedUser.name}…`}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                        autoFocus
                    />
                    <button
                        id="fchat-send-btn"
                        type="submit"
                        className="fchat-send-btn"
                        disabled={!text.trim()}
                        title="Send"
                    >
                        ➤
                    </button>
                </form>
            </div>
        );
    }

    return null;
};

// ── Message Bubble ──────────────────────────────────────────────────────────
const PrivateBubble = ({ msg, isMine }) => {
    const time = new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className={`fchat-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
            {!isMine && (
                <div className="fchat-bubble-avatar">
                    {msg.sender_name?.charAt(0).toUpperCase()}
                </div>
            )}
            <div className="fchat-bubble-col">
                {!isMine && (
                    <div className="fchat-bubble-sender">{msg.sender_name}</div>
                )}
                <div className={`fchat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                    <span className="fchat-bubble-text">{msg.content}</span>
                    <span className="fchat-bubble-time">{time}</span>
                </div>
            </div>
        </div>
    );
};

export default FloatingChatWindow;
