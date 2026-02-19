import React, {
    createContext, useContext, useState, useEffect,
    useRef, useCallback
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { privateMessageAPI, userAPI } from '../api/api';

const ChatContext = createContext(null);

const SOCKET_URL = 'http://localhost:5000';

export const ChatProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();

    // ── Global UI state ─────────────────────────────────────────────────────
    const [isPickerOpen, setIsPickerOpen] = useState(false);  // user-list drawer
    const [isWindowOpen, setIsWindowOpen] = useState(false);  // chat window
    const [selectedUser, setSelectedUser] = useState(null);   // { id, name, email }
    const [messages, setMessages] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [unreadFrom, setUnreadFrom] = useState(new Set()); // sender IDs w/ unread

    // Users list for picker
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const socketRef = useRef(null);
    const selectedUserRef = useRef(null); // stable ref for socket listener

    // Keep ref in sync
    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    // ── Socket setup — persists for the entire authenticated session ────────
    useEffect(() => {
        if (!isAuthenticated) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 1500
        });

        socketRef.current = socket;

        // ── receive-private listener ──────────────────────────────────────
        socket.on('receive-private', (msg) => {
            const currentSelected = selectedUserRef.current;

            // Is this message part of the currently open conversation?
            const isCurrentConversation =
                currentSelected &&
                (msg.sender_id === currentSelected.id || msg.receiver_id === currentSelected.id);

            if (isCurrentConversation) {
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev; // dedupe
                    return [...prev, msg];
                });
            } else {
                // Mark sender as having unread
                setUnreadFrom(prev => new Set([...prev, msg.sender_id]));
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isAuthenticated]);

    // ── Fetch user list for picker ─────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoadingUsers(true);
        try {
            const res = await userAPI.getAll();
            // Exclude self
            setUsers(res.data.users.filter(u => u.id !== user?.id));
        } catch (err) {
            console.error('Failed to fetch users for chat picker:', err);
        } finally {
            setLoadingUsers(false);
        }
    }, [isAuthenticated, user?.id]);

    // ── Open the picker (user-list drawer) ────────────────────────────────
    const openPicker = useCallback(() => {
        fetchUsers();
        setIsPickerOpen(true);
    }, [fetchUsers]);

    const closePicker = useCallback(() => setIsPickerOpen(false), []);

    // ── Select a user → open chat window ─────────────────────────────────
    const openChat = useCallback(async (targetUser) => {
        setIsPickerOpen(false);
        setSelectedUser(targetUser);
        setIsWindowOpen(true);
        setMessages([]);

        // Clear unread for this user
        setUnreadFrom(prev => {
            const next = new Set(prev);
            next.delete(targetUser.id);
            return next;
        });

        // Join private socket room
        const socket = socketRef.current;
        if (socket?.connected) {
            socket.emit('join-private', { targetUserId: targetUser.id });
        }

        // Fetch message history
        setLoadingHistory(true);
        try {
            const res = await privateMessageAPI.getHistory(targetUser.id, { limit: 50 });
            setMessages(res.data.messages);
        } catch (err) {
            console.error('Failed to load private message history:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    // ── Close chat window ─────────────────────────────────────────────────
    const closeChat = useCallback(() => {
        setIsWindowOpen(false);
        setSelectedUser(null);
        setMessages([]);
    }, []);

    // ── Send message ──────────────────────────────────────────────────────
    const sendMessage = useCallback((content) => {
        const socket = socketRef.current;
        if (!socket?.connected || !selectedUser || !content.trim()) return false;

        socket.emit('send-private', {
            receiverId: selectedUser.id,
            content: content.trim()
        });
        return true;
    }, [selectedUser]);

    const value = {
        isPickerOpen,
        isWindowOpen,
        selectedUser,
        messages,
        loadingHistory,
        users,
        loadingUsers,
        unreadCount: unreadFrom.size,
        openPicker,
        closePicker,
        openChat,
        closeChat,
        sendMessage,
        socket: socketRef.current,
        currentUserId: user?.id
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
    return ctx;
};
