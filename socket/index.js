const jwt = require('jsonwebtoken');
const db = require('../config/database');
const notify = require('../utils/notify');

// Promisified db helpers
const dbGet = (sql, params) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

const dbRun = (sql, params) =>
    new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        })
    );

const dbAll = (sql, params) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

/**
 * Initialize Socket.io with JWT authentication and group chat events.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
    // ── Authentication Middleware ────────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // { id, email, role }
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    // ── Connection Handler ───────────────────────────────────────────────────
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: user ${socket.user.id} (${socket.user.email})`);

        // Auto-join personal inbox room so user always receives private messages
        socket.join(`user:${socket.user.id}`);

        // ── join-group ──────────────────────────────────────────────────────
        socket.on('join-group', async ({ groupId }, callback) => {
            try {
                if (!groupId) {
                    return callback?.({ success: false, message: 'groupId is required' });
                }

                // Validate membership server-side
                const member = await dbGet(
                    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
                    [groupId, socket.user.id]
                );

                if (!member) {
                    return callback?.({ success: false, message: 'Access denied: not a member of this group' });
                }

                socket.join(`group:${groupId}`);
                console.log(`👥 User ${socket.user.id} joined room group:${groupId}`);
                callback?.({ success: true, message: 'Joined group' });
            } catch (err) {
                console.error('join-group error:', err);
                callback?.({ success: false, message: 'Server error' });
            }
        });

        // ── send-message ────────────────────────────────────────────────────
        socket.on('send-message', async ({ groupId, content, type = 'text', fileUrl = null, fileName = null }, callback) => {
            try {
                if (!groupId || !content) {
                    return callback?.({ success: false, message: 'groupId and content are required' });
                }

                // Server-side membership validation — never trust client senderId
                const member = await dbGet(
                    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
                    [groupId, socket.user.id]
                );

                if (!member) {
                    return callback?.({ success: false, message: 'Access denied: not a member of this group' });
                }

                // Sanitize text content
                const sanitizedContent = String(content).trim().slice(0, 4000);
                if (!sanitizedContent) {
                    return callback?.({ success: false, message: 'Message content cannot be empty' });
                }

                // Save message to DB
                const { lastID } = await dbRun(
                    `INSERT INTO chat_messages (group_id, sender_id, type, content, file_url, file_name)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [groupId, socket.user.id, type, sanitizedContent, fileUrl, fileName]
                );

                // Fetch the saved message with sender info
                const message = await dbGet(
                    `SELECT m.*, u.name as sender_name, u.email as sender_email
                     FROM chat_messages m
                     JOIN users u ON m.sender_id = u.id
                     WHERE m.id = ?`,
                    [lastID]
                );

                // Broadcast to everyone in the room (including sender)
                io.to(`group:${groupId}`).emit('receive-message', message);

                // Notify all group members except the sender
                try {
                    const members = await dbAll(
                        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
                        [groupId, socket.user.id]
                    );
                    // Get group name for the notification title
                    const group = await dbGet('SELECT name FROM chat_groups WHERE id = ?', [groupId]);
                    const groupName = group?.name || 'a group';
                    const senderName = message.sender_name || 'Someone';

                    for (const { user_id } of members) {
                        notify(io, {
                            userId: user_id,
                            type: 'chat',
                            title: `💬 ${groupName}`,
                            message: `${senderName}: ${sanitizedContent.slice(0, 80)}${sanitizedContent.length > 80 ? '…' : ''}`,
                            relatedId: groupId
                        });
                    }
                } catch (notifyErr) {
                    console.error('Group notification error (non-fatal):', notifyErr.message);
                }

                callback?.({ success: true, message });
            } catch (err) {
                console.error('send-message error:', err);
                callback?.({ success: false, message: 'Server error' });
            }
        });

        // ── join-private ────────────────────────────────────────────────────
        // Client emits this when opening a 1-to-1 chat window.
        // Room name is deterministic: private:{smallerUserId}-{largerUserId}
        socket.on('join-private', async ({ targetUserId }, callback) => {
            try {
                if (!targetUserId) {
                    return callback?.({ success: false, message: 'targetUserId is required' });
                }

                const targetId = parseInt(targetUserId, 10);

                // Never trust client — always validate target user exists server-side
                const target = await dbGet('SELECT id FROM users WHERE id = ?', [targetId]);
                if (!target) {
                    return callback?.({ success: false, message: 'User not found' });
                }

                const roomKey = [socket.user.id, targetId].sort((a, b) => a - b).join('-');
                socket.join(`private:${roomKey}`);
                console.log(`💬 User ${socket.user.id} joined private room ${roomKey}`);
                callback?.({ success: true });
            } catch (err) {
                console.error('join-private error:', err);
                callback?.({ success: false, message: 'Server error' });
            }
        });

        // ── send-private ────────────────────────────────────────────────────
        // Saves message to DB.
        // Emits 'receive-private' to the shared room AND to receiver's personal room.
        socket.on('send-private', async ({ receiverId, content }, callback) => {
            try {
                if (!receiverId || !content) {
                    return callback?.({ success: false, message: 'receiverId and content are required' });
                }

                const recvId = parseInt(receiverId, 10);
                if (recvId === socket.user.id) {
                    return callback?.({ success: false, message: 'Cannot send message to yourself' });
                }

                // Validate receiver exists — never trust client
                const receiver = await dbGet('SELECT id FROM users WHERE id = ?', [recvId]);
                if (!receiver) {
                    return callback?.({ success: false, message: 'Receiver not found' });
                }

                const sanitized = String(content).trim().slice(0, 4000);
                if (!sanitized) {
                    return callback?.({ success: false, message: 'Message cannot be empty' });
                }

                // Save to DB using authenticated sender (socket.user.id)
                const { lastID } = await dbRun(
                    'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
                    [socket.user.id, recvId, sanitized]
                );

                const message = await dbGet(
                    `SELECT m.*, u.name as sender_name, u.email as sender_email
                     FROM private_messages m
                     JOIN users u ON m.sender_id = u.id
                     WHERE m.id = ?`,
                    [lastID]
                );

                // 1. Emit to the shared conversation room (if both have chat open)
                const roomKey = [socket.user.id, recvId].sort((a, b) => a - b).join('-');
                io.to(`private:${roomKey}`).emit('receive-private', message);

                // 2. Also emit to receiver's personal inbox room (for notifications)
                io.to(`user:${recvId}`).emit('receive-private', message);

                callback?.({ success: true, message });
            } catch (err) {
                console.error('send-private error:', err);
                callback?.({ success: false, message: 'Server error' });
            }
        });

        // ── disconnect ──────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: user ${socket.user.id}`);
        });
    });
}

module.exports = initSocket;
