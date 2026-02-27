'use strict';

const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { authenticateToken, authorize } = require('../middleware/auth');

// GET /api/departments - Get all active departments
router.get('/', authenticateToken, async (req, res) => {
    try {
        const departments = await Department.find({ status: 'active' }).sort({ name: 1 });
        res.json({ success: true, departments });
    } catch (error) {
        console.error('GET /departments error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
