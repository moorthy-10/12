'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const Group = require('../models/Group');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { sendPushToMultipleUsers, sendPushToGroup } = require('../services/notificationService');

// ── Multer Setup ──────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
];

const uploadsDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type. Allowed: pdf, docx, png, jpg, jpeg'));
    }
});

// ── Shape helpers ─────────────────────────────────────────────────────────────
function shapeGroup(g, extras = {}) {
    const obj = g.toJSON();
    obj.created_by = g.created_by?._id?.toString() || g.created_by?.toString();
    obj.creator_name = g.created_by?.name || undefined;
    const memberDocs = g.members || [];
    obj.members = memberDocs.map(m => ({
        id: m._id ? m._id.toString() : m.toString(),
        name: m.name, email: m.email, role: m.role
    }));
    obj.member_count = memberDocs.length;
    obj.message_count = extras.message_count ?? 0;
    return obj;
}

function shapeMessage(m) {
    const obj = m.toJSON();
    obj.group_id = m.group?._id?.toString() || m.group?.toString();
    obj.sender_id = m.sender?._id?.toString() || m.sender?.toString();
    obj.sender_name = m.sender?.name || undefined;
    obj.sender_email = m.sender?.email || undefined;
    return obj;
}

// ── POST /api/groups ───────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('name').notEmpty().trim().isLength({ max: 100 }),
    body('memberIds').isArray({ min: 1 }).withMessage('memberIds must be a non-empty array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, memberIds } = req.body;
    const creatorId = req.user.id;

    try {
        const allMemberIds = [...new Set([creatorId, ...memberIds.map(String)])];

        // Validate users exist
        const existingUsers = await User.find({ _id: { $in: allMemberIds } }).select('_id');
        const validIds = existingUsers.map(u => u._id);

        const group = await Group.create({ name: name.trim(), created_by: creatorId, members: validIds });
        const populated = await Group.findById(group._id)
            .populate('created_by', 'name')
            .populate('members', 'name email role');

        res.status(201).json({ success: true, group: shapeGroup(populated) });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ success: false, message: 'Failed to create group' });
    }
});

// ── GET /api/groups ────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user.id })
            .populate('created_by', 'name')
            .populate('members', 'name email role')
            .sort({ createdAt: -1 });

        const withCounts = await Promise.all(groups.map(async g => {
            const message_count = await ChatMessage.countDocuments({ group: g._id });
            return shapeGroup(g, { message_count });
        }));

        res.json({ success: true, groups: withCounts });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/groups/:id ────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('created_by', 'name')
            .populate('members', 'name email role');

        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

        const isMember = group.members.some(m => m._id.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ success: false, message: 'Access denied' });

        res.json({ success: true, group: shapeGroup(group) });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/groups/:id/messages ───────────────────────────────────────────────
router.get('/:id/messages', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).select('members');
        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

        const isMember = group.members.some(m => m.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ success: false, message: 'Access denied' });

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const messages = await ChatMessage.find({ group: req.params.id })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 })
            .skip(offset)
            .limit(limit);

        res.json({ success: true, messages: messages.map(shapeMessage) });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/groups/:id/files ─────────────────────────────────────────────────
router.post('/:id/files', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).select('members');
        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

        const isMember = group.members.some(m => m.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ success: false, message: 'Access denied' });

        const uploadMiddleware = upload.single('file');
        uploadMiddleware(req, res, async (uploadErr) => {
            if (uploadErr) return res.status(400).json({ success: false, message: uploadErr.message });
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

            const fileUrl = `/uploads/${req.file.filename}`;
            const fileName = req.file.originalname;
            const content = `[File] ${fileName}`;

            try {
                const created = await ChatMessage.create({
                    group: req.params.id,
                    sender: req.user.id,
                    type: 'file',
                    content,
                    file_url: fileUrl,
                    file_name: fileName
                });

                const msg = await ChatMessage.findById(created._id).populate('sender', 'name email');
                const message = shapeMessage(msg);

                const io = req.app.get('io');
                if (io) io.to(`group:${req.params.id}`).emit('receive-message', message);

                // Trigger Push Notification to all other members
                try {
                    const groupDoc = await Group.findById(req.params.id).select('members');
                    const otherMemberIds = groupDoc.members
                        .filter(m => m.toString() !== req.user.id)
                        .map(m => m.toString());

                    if (otherMemberIds.length > 0) {
                        sendPushToGroup(req.params.id, otherMemberIds, 'New Group Message', `${req.user.name || 'Someone'}: ${content}`, {
                            type: 'GROUP_MESSAGE',
                            groupId: req.params.id
                        });
                    }
                } catch (pushErr) {
                    console.error('Group file push error:', pushErr.message);
                }

                res.status(201).json({ success: true, message });
            } catch (dbErr) {
                console.error('File message save error:', dbErr);
                res.status(500).json({ success: false, message: 'File uploaded but failed to save message' });
            }
        });
    } catch (error) {
        console.error('File upload access check error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
