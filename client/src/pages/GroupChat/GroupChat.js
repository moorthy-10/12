import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import MainLayout from '../../components/Layout/MainLayout';
import { groupAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import './GroupChat.css';

const SOCKET_URL = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace('/api', '')
    : 'http://localhost:5000';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];

const GroupChat = () => {
    const { id: groupId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [group, setGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [error, setError] = useState('');
    const [showMembers, setShowMembers] = useState(false);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // ── Scroll to bottom helper ────────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // ── Initial load: group info + history ───────────────────────────────
    useEffect(() => {
        const loadData = async () => {
            try {
                const [groupRes, msgRes] = await Promise.all([
                    groupAPI.getById(groupId),
                    groupAPI.getMessages(groupId, { limit: 50 })
                ]);
                setGroup(groupRes.data.group);
                setMessages(msgRes.data.messages);
            } catch (err) {
                if (err.response?.status === 403) {
                    setError('Access denied: you are not a member of this group.');
                } else {
                    setError('Failed to load group chat.');
                }
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [groupId]);

    // ── Socket.io setup ──────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setSocketConnected(true);
            // Join the group room
            socket.emit('join-group', { groupId }, (ack) => {
                if (!ack?.success) {
                    console.error('join-group failed:', ack?.message);
                }
            });
        });

        socket.on('disconnect', () => {
            setSocketConnected(false);
        });

        socket.on('receive-message', (msg) => {
            setMessages(prev => {
                // Avoid duplicate if we already added it optimistically
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [groupId]);

    // ── Scroll on new messages ───────────────────────────────────────────
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // ── Send text message ────────────────────────────────────────────────
    const sendMessage = async (e) => {
        e.preventDefault();
        const content = text.trim();
        if (!content || sending) return;

        setSending(true);
        setText('');

        const socket = socketRef.current;
        if (socket?.connected) {
            socket.emit('send-message', { groupId, content, type: 'text' }, (ack) => {
                if (!ack?.success) {
                    console.error('send-message failed:', ack?.message);
                    setError('Failed to send message. Please try again.');
                }
                setSending(false);
            });
        } else {
            // Fallback: socket not connected
            setError('Not connected to server. Please refresh.');
            setSending(false);
        }
    };

    // ── Upload file ──────────────────────────────────────────────────────
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Client-side validation
        const ext = file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setError(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('File too large. Maximum size is 10 MB.');
            return;
        }

        setError('');
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            await groupAPI.uploadFile(groupId, formData);
            // The backend emits receive-message via socket, so no need to push here
        } catch (err) {
            setError(err.response?.data?.message || 'File upload failed.');
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Loading / error states ───────────────────────────────────────────
    if (loading) {
        return (
            <MainLayout title="Group Chat">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    if (error && !group) {
        return (
            <MainLayout title="Group Chat">
                <div className="chat-error-state">
                    <div className="empty-icon">⛔</div>
                    <h3>{error}</h3>
                    <button className="btn btn-secondary" onClick={() => navigate('/groups')}>
                        ← Back to Groups
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title={group?.name || 'Group Chat'}>
            <div className="groupchat-page">
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="chat-header">
                    <button
                        id="back-to-groups-btn"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate('/groups')}
                    >
                        ← Groups
                    </button>

                    <div className="chat-header-info">
                        <div className="chat-header-avatar">
                            {group?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="chat-header-name">{group?.name}</div>
                            <div className="chat-header-members">
                                {group?.members?.length} members
                            </div>
                        </div>
                    </div>

                    <div className="chat-header-actions">
                        <div className={`socket-indicator ${socketConnected ? 'connected' : 'disconnected'}`}>
                            <span className="socket-dot"></span>
                            {socketConnected ? 'Live' : 'Reconnecting...'}
                        </div>
                        <button
                            id="members-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowMembers(v => !v)}
                        >
                            👥 Members
                        </button>
                    </div>
                </div>

                <div className="chat-body">
                    {/* ── Members Sidebar ────────────────────────────── */}
                    {showMembers && (
                        <div className="members-panel">
                            <div className="members-panel-header">Members</div>
                            {group?.members?.map(m => (
                                <div key={m.id} className="member-item">
                                    <div className="member-avatar">{m.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div className="member-name">{m.name}</div>
                                        <div className="member-role">{m.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Messages ───────────────────────────────────── */}
                    <div className="messages-area">
                        {messages.length === 0 ? (
                            <div className="messages-empty">
                                <div className="empty-icon">👋</div>
                                <p>No messages yet. Say hello!</p>
                            </div>
                        ) : (
                            messages.map(msg => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isMine={msg.sender_id === user?.id}
                                />
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* ── Error Banner ──────────────────────────────────── */}
                {error && group && (
                    <div className="chat-error-banner">
                        {error}
                        <button onClick={() => setError('')}>✕</button>
                    </div>
                )}

                {/* ── Input Bar ─────────────────────────────────────── */}
                <form className="chat-input-bar" onSubmit={sendMessage}>
                    <label
                        id="file-upload-label"
                        className={`btn-attach ${uploading ? 'disabled' : ''}`}
                        title="Attach file"
                    >
                        {uploading ? '⏳' : '📎'}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            style={{ display: 'none' }}
                        />
                    </label>

                    <input
                        id="chat-text-input"
                        type="text"
                        className="chat-input"
                        placeholder={socketConnected ? 'Type a message…' : 'Connecting…'}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        disabled={!socketConnected || sending}
                        autoComplete="off"
                    />

                    <button
                        id="send-message-btn"
                        type="submit"
                        className="btn-send"
                        disabled={!text.trim() || !socketConnected || sending}
                    >
                        {sending ? '⏳' : '➤'}
                    </button>
                </form>
            </div>
        </MainLayout>
    );
};

// ── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isMine }) => {
    const isFile = msg.type === 'file';
    const time = new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className={`msg-wrapper ${isMine ? 'mine' : 'theirs'}`}>
            {!isMine && (
                <div className="msg-avatar" title={msg.sender_name}>
                    {msg.sender_name?.charAt(0).toUpperCase()}
                </div>
            )}
            <div className="msg-col">
                {!isMine && (
                    <div className="msg-sender">{msg.sender_name}</div>
                )}
                <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} ${isFile ? 'file-bubble' : ''}`}>
                    {isFile ? (
                        <div className="file-attachment">
                            <div className="file-icon">{getFileIcon(msg.file_name)}</div>
                            <div className="file-info">
                                <div className="file-name">{msg.file_name}</div>
                                <a
                                    href={`http://localhost:5000${msg.file_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="file-download-link"
                                    download={msg.file_name}
                                >
                                    ⬇ Download
                                </a>
                            </div>
                        </div>
                    ) : (
                        <span className="msg-text">{msg.content}</span>
                    )}
                    <span className="msg-time">{time}</span>
                </div>
            </div>
        </div>
    );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const getFileIcon = (fileName) => {
    if (!fileName) return '📎';
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', docx: '📝', doc: '📝', png: '🖼️', jpg: '🖼️', jpeg: '🖼️' };
    return icons[ext] || '📎';
};

export default GroupChat;
