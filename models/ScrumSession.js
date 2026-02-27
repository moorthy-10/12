'use strict';

const mongoose = require('mongoose');

const scrumSessionSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    meet_link: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    started_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    started_at: { type: Date, default: Date.now },
    status: { type: String, enum: ['live', 'ended'], default: 'live' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('ScrumSession', scrumSessionSchema);
