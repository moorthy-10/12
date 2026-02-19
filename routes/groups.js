const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── Promisified DB helpers ──────────────────────────────────────────────────
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

// ── Multer Setup ────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
];

const uploadsDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: pdf, docx, png, jpg, jpeg'));
        }
    }
});

// ── POST /api/groups — Create group (Admin only) ────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('name').notEmpty().trim().isLength({ max: 100 }),
    body('memberIds').isArray({ min: 1 }).withMessage('memberIds must be a non-empty array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, memberIds } = req.body;
    const createdBy = req.user.id;

    try {
        // Create the group
        const { lastID: groupId } = await dbRun(
            'INSERT INTO chat_groups (name, created_by) VALUES (?, ?)',
            [name.trim(), createdBy]
        );

        // Always add the creator as member
        const allMembers = [...new Set([createdBy, ...memberIds.map(Number)])];

        // Validate that all memberIds exist
        const placeholders = allMembers.map(() => '?').join(', ');
        const existingUsers = await dbAll(
            `SELECT id FROM users WHERE id IN (${placeholders})`,
            allMembers
        );
        const existingIds = new Set(existingUsers.map(u => u.id));

        // Insert valid members
        for (const uid of allMembers) {
            if (existingIds.has(uid)) {
                await dbRun(
                    'INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
                    [groupId, uid]
                );
            }
        }

        // Return the created group with members
        const group = await dbGet('SELECT * FROM chat_groups WHERE id = ?', [groupId]);
        const members = await dbAll(
            `SELECT u.id, u.name, u.email, u.role
             FROM group_members gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = ?`,
            [groupId]
        );

        res.status(201).json({ success: true, group: { ...group, members } });
    } catch (err) {
        console.error('Create group error:', err);
        res.status(500).json({ success: false, message: 'Failed to create group' });
    }
});

// ── GET /api/groups — Get groups where user is a member ────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const groups = await dbAll(
            `SELECT g.*, u.name as creator_name,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                    (SELECT COUNT(*) FROM chat_messages WHERE group_id = g.id) as message_count
             FROM chat_groups g
             JOIN group_members gm ON g.id = gm.group_id
             JOIN users u ON g.created_by = u.id
             WHERE gm.user_id = ?
             ORDER BY g.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, groups });
    } catch (err) {
        console.error('Get groups error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/groups/:id — Get single group details ─────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Validate membership
        const member = await dbGet(
            'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!member) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const group = await dbGet('SELECT * FROM chat_groups WHERE id = ?', [req.params.id]);
        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const members = await dbAll(
            `SELECT u.id, u.name, u.email, u.role
             FROM group_members gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = ?`,
            [req.params.id]
        );

        res.json({ success: true, group: { ...group, members } });
    } catch (err) {
        console.error('Get group error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/groups/:id/messages — Get messages (membership required) ───────
router.get('/:id/messages', authenticateToken, async (req, res) => {
    try {
        // Validate membership server-side
        const member = await dbGet(
            'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!member) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const messages = await dbAll(
            `SELECT m.*, u.name as sender_name, u.email as sender_email
             FROM chat_messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.group_id = ?
             ORDER BY m.created_at ASC
             LIMIT ? OFFSET ?`,
            [req.params.id, limit, offset]
        );

        res.json({ success: true, messages });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/groups/:id/files — Upload file (membership required) ──────────
router.post('/:id/files', authenticateToken, (req, res) => {
    // Validate membership first
    db.get(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err, member) => {
            if (err || !member) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            // Process upload
            const uploadMiddleware = upload.single('file');
            uploadMiddleware(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ success: false, message: uploadErr.message });
                }
                if (!req.file) {
                    return res.status(400).json({ success: false, message: 'No file uploaded' });
                }

                const fileUrl = `/uploads/${req.file.filename}`;
                const fileName = req.file.originalname;
                const content = `[File] ${fileName}`;

                try {
                    // Save message record
                    const { lastID } = await dbRun(
                        `INSERT INTO chat_messages (group_id, sender_id, type, content, file_url, file_name)
                         VALUES (?, ?, 'file', ?, ?, ?)`,
                        [req.params.id, req.user.id, content, fileUrl, fileName]
                    );

                    const message = await dbGet(
                        `SELECT m.*, u.name as sender_name, u.email as sender_email
                         FROM chat_messages m
                         JOIN users u ON m.sender_id = u.id
                         WHERE m.id = ?`,
                        [lastID]
                    );

                    // Emit via socket so all room members get the file message in real-time
                    const io = req.app.get('io');
                    if (io) {
                        io.to(`group:${req.params.id}`).emit('receive-message', message);
                    }

                    res.status(201).json({ success: true, message });
                } catch (dbErr) {
                    console.error('File message save error:', dbErr);
                    res.status(500).json({ success: false, message: 'File uploaded but failed to save message' });
                }
            });
        }
    );
});

module.exports = router;
