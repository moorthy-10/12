const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get tasks
router.get('/', authenticateToken, (req, res) => {
    const { status, priority, assigned_to } = req.query;

    let query = `
    SELECT t.*, 
           u1.name as assigned_to_name, u1.email as assigned_to_email,
           u2.name as assigned_by_name
    FROM tasks t
    JOIN users u1 ON t.assigned_to = u1.id
    JOIN users u2 ON t.assigned_by = u2.id
    WHERE 1=1
  `;
    const params = [];

    // If employee, only show their assigned tasks
    if (req.user.role === 'employee') {
        query += ' AND t.assigned_to = ?';
        params.push(req.user.id);
    } else if (assigned_to) {
        query += ' AND t.assigned_to = ?';
        params.push(assigned_to);
    }

    if (status) {
        query += ' AND t.status = ?';
        params.push(status);
    }

    if (priority) {
        query += ' AND t.priority = ?';
        params.push(priority);
    }

    query += ' ORDER BY t.created_at DESC';

    db.all(query, params, (err, tasks) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, tasks });
    });
});

// Get single task
router.get('/:id', authenticateToken, (req, res) => {
    db.get(`
    SELECT t.*, 
           u1.name as assigned_to_name, u1.email as assigned_to_email,
           u2.name as assigned_by_name
    FROM tasks t
    JOIN users u1 ON t.assigned_to = u1.id
    JOIN users u2 ON t.assigned_by = u2.id
    WHERE t.id = ?
  `, [req.params.id], (err, task) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Employees can only view their own assigned tasks
        if (req.user.role === 'employee' && task.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, task });
    });
});

// Create task (Admin only)
router.post('/', authenticateToken, isAdmin, [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('assigned_to').isInt(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('due_date').optional().isDate()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, assigned_to, priority, due_date } = req.body;
    const assigned_by = req.user.id;

    // Verify the assigned_to user exists
    db.get('SELECT id FROM users WHERE id = ?', [assigned_to], (err, user) => {
        if (!user) {
            return res.status(400).json({ success: false, message: 'Assigned user not found' });
        }

        db.run(`
      INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, description, assigned_to, assigned_by, priority || 'medium', due_date], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to create task' });
            }

            db.get(`
        SELECT t.*, 
               u1.name as assigned_to_name, u1.email as assigned_to_email,
               u2.name as assigned_by_name
        FROM tasks t
        JOIN users u1 ON t.assigned_to = u1.id
        JOIN users u2 ON t.assigned_by = u2.id
        WHERE t.id = ?
      `, [this.lastID], (err, task) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Task created but failed to fetch' });
                }
                res.status(201).json({ success: true, message: 'Task created successfully', task });
            });
        });
    });
});

// Update task
router.put('/:id', authenticateToken, [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('due_date').optional().isDate()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // First check if task exists
    db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, task) => {
        if (err || !task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Employees can only update their own tasks and only the status field
        if (req.user.role === 'employee') {
            if (task.assigned_to !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            // Employees can ONLY update status
            const { status } = req.body;
            if (!status || Object.keys(req.body).length > 1) {
                return res.status(403).json({
                    success: false,
                    message: 'Employees can only update task status'
                });
            }

            const completed_at = status === 'completed' ? 'CURRENT_TIMESTAMP' : null;

            db.run(`
        UPDATE tasks 
        SET status = ?, completed_at = ${completed_at ? completed_at : 'NULL'}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [status, req.params.id], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to update task' });
                }

                db.get(`
          SELECT t.*, 
                 u1.name as assigned_to_name, u1.email as assigned_to_email,
                 u2.name as assigned_by_name
          FROM tasks t
          JOIN users u1 ON t.assigned_to = u1.id
          JOIN users u2 ON t.assigned_by = u2.id
          WHERE t.id = ?
        `, [req.params.id], (err, task) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Task updated but failed to fetch' });
                    }
                    res.json({ success: true, message: 'Task status updated successfully', task });
                });
            });
        } else {
            // Admin can update all fields
            const { title, description, status, priority, due_date, assigned_to } = req.body;
            const updates = [];
            const params = [];

            if (title) { updates.push('title = ?'); params.push(title); }
            if (description !== undefined) { updates.push('description = ?'); params.push(description); }
            if (status) {
                updates.push('status = ?');
                params.push(status);
                if (status === 'completed') {
                    updates.push('completed_at = CURRENT_TIMESTAMP');
                }
            }
            if (priority) { updates.push('priority = ?'); params.push(priority); }
            if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }
            if (assigned_to) { updates.push('assigned_to = ?'); params.push(assigned_to); }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, message: 'No fields to update' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(req.params.id);

            const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;

            db.run(query, params, function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to update task' });
                }

                db.get(`
          SELECT t.*, 
                 u1.name as assigned_to_name, u1.email as assigned_to_email,
                 u2.name as assigned_by_name
          FROM tasks t
          JOIN users u1 ON t.assigned_to = u1.id
          JOIN users u2 ON t.assigned_by = u2.id
          WHERE t.id = ?
        `, [req.params.id], (err, task) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Task updated but failed to fetch' });
                    }
                    res.json({ success: true, message: 'Task updated successfully', task });
                });
            });
        }
    });
});

// Delete task (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete task' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        res.json({ success: true, message: 'Task deleted successfully' });
    });
});

module.exports = router;
