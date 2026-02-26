'use strict';

const jwt = require('jsonwebtoken');
const Group = require('../models/Group');
const ChatMessage = require('../models/ChatMessage');
const PrivateMessage = require('../models/PrivateMessage');
const User = require('../models/User');
const notify = require('../utils/notify');
const { sendPushToMultipleUsers, sendPushToGroup } = require('../services/notificationService');

/**
 * Initialize Socket.io with JWT authentication and chat events.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
    // ── Authentication Middleware ──────────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication error: No token provided'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // { id, email, role }
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    // ── Connection Handler ─────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: user ${socket.user.id} (${socket.user.email})`);

        // Auto-join personal inbox room
        socket.join(`user:${socket.user.id}`);
        socket.join(socket.user.id.toString()); // Support direct userId room for notifications

        // ── join-group ──────────────────────────────────────────────────────
        socket.on('join-group', async ({ groupId }, callback) => {
            try {
                if (!groupId) return callback?.({ success: false, message: 'groupId is required' });

                const group = await Group.findById(groupId).select('members');
                if (!group) return callback?.({ success: false, message: 'Group not found' });

                const isMember = group.members.some(m => m.toString() === socket.user.id);
                if (!isMember) return callback?.({ success: false, message: 'Access denied: not a member of this group' });

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
                if (!groupId || !content) return callback?.({ success: false, message: 'groupId and content are required' });

                // Server-side membership check — never trust client
                const group = await Group.findById(groupId).select('members name');
                if (!group) return callback?.({ success: false, message: 'Group not found' });

                const isMember = group.members.some(m => m.toString() === socket.user.id);
                if (!isMember) return callback?.({ success: false, message: 'Access denied: not a member of this group' });

                const sanitizedContent = String(content).trim().slice(0, 4000);
                if (!sanitizedContent) return callback?.({ success: false, message: 'Message content cannot be empty' });

                // Save message
                const created = await ChatMessage.create({
                    group: groupId,
                    sender: socket.user.id,
                    type, content: sanitizedContent,
                    file_url: fileUrl, file_name: fileName
                });

                const msg = await ChatMessage.findById(created._id).populate('sender', 'name email');
                const message = {
                    id: msg._id.toString(),
                    group_id: groupId,
                    sender_id: msg.sender._id.toString(),
                    sender_name: msg.sender.name,
                    sender_email: msg.sender.email,
                    type: msg.type,
                    content: msg.content,
                    file_url: msg.file_url,
                    file_name: msg.file_name,
                    createdAt: msg.createdAt,
                };

                // Broadcast to room (including sender)
                io.to(`group:${groupId}`).emit('receive-message', message);

                // Notify all group members except sender (non-blocking)
                try {
                    const otherMembers = group.members.filter(m => m.toString() !== socket.user.id);
                    const groupName = group.name || 'a group';
                    const senderName = message.sender_name || 'Someone';

                    const otherMemberIds = otherMembers.map(m => m.toString());

                    // Regular notification (Socket + DB)
                    for (const memberId of otherMemberIds) {
                        notify(io, {
                            userId: memberId,
                            type: 'chat',
                            title: `💬 ${groupName}`,
                            message: `${senderName}: ${sanitizedContent.slice(0, 80)}${sanitizedContent.length > 80 ? '…' : ''}`,
                            relatedId: groupId
                        });
                    }

                    // Push Notification (FCM) - Bundled for efficiency with 10s cooldown
                    if (otherMemberIds.length > 0) {
                        sendPushToGroup(groupId, otherMemberIds, 'New Group Message', `${senderName}: ${sanitizedContent}`, {
                            type: 'GROUP_MESSAGE',
                            groupId: groupId
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
        socket.on('join-private', async ({ targetUserId }, callback) => {
            try {
                if (!targetUserId) return callback?.({ success: false, message: 'targetUserId is required' });

                const target = await User.findById(targetUserId).select('_id');
                if (!target) return callback?.({ success: false, message: 'User not found' });

                // Deterministic room key using string comparison
                const ids = [socket.user.id, targetUserId].sort();
                const roomKey = ids.join('-');
                socket.join(`private:${roomKey}`);
                console.log(`💬 User ${socket.user.id} joined private room ${roomKey}`);
                callback?.({ success: true });
            } catch (err) {
                console.error('join-private error:', err);
                callback?.({ success: false, message: 'Server error' });
            }
        });

        // ── send-private ────────────────────────────────────────────────────
        socket.on('send-private', async ({ receiverId, content }, callback) => {
            try {
                if (!receiverId || !content) return callback?.({ success: false, message: 'receiverId and content are required' });
                if (receiverId === socket.user.id) return callback?.({ success: false, message: 'Cannot send message to yourself' });

                const receiver = await User.findById(receiverId).select('_id name email');
                if (!receiver) return callback?.({ success: false, message: 'Receiver not found' });

                const sanitized = String(content).trim().slice(0, 4000);
                if (!sanitized) return callback?.({ success: false, message: 'Message cannot be empty' });

                const created = await PrivateMessage.create({
                    sender: socket.user.id,
                    receiver: receiverId,
                    content: sanitized
                });

                const msg = await PrivateMessage.findById(created._id).populate('sender', 'name email');
                const message = {
                    id: msg._id.toString(),
                    sender_id: msg.sender._id.toString(),
                    sender_name: msg.sender.name,
                    sender_email: msg.sender.email,
                    receiver_id: receiverId,
                    content: msg.content,
                    createdAt: msg.createdAt,
                };

                // Emit to shared conv room and receiver's personal inbox
                const ids = [socket.user.id, receiverId].sort();
                const roomKey = ids.join('-');
                io.to(`private:${roomKey}`).emit('receive-private', message);
                io.to(`user:${receiverId}`).emit('receive-private', message);

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
