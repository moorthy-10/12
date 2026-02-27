'use strict';

const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    head_of_department: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
