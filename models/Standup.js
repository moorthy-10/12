'use strict';

const mongoose = require('mongoose');

const taskItemSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    estimatedHours: { type: Number, required: true, min: 0.1 }
}, { _id: false });

const standupSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },   // 'YYYY-MM-DD'
    yesterdayWork: { type: String, required: true, trim: true },
    todayTasks: { type: [taskItemSchema], required: true },
    blockers: { type: String, default: '', trim: true },
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Enforce one standup per user per day
standupSchema.index({ userId: 1, date: 1 }, { unique: true });
standupSchema.index({ date: 1 });

standupSchema.virtual('id').get(function () { return this._id.toString(); });
standupSchema.set('toJSON', {
    virtuals: true,
    transform: (_, r) => { delete r._id; delete r.__v; return r; }
});

module.exports = mongoose.model('Standup', standupSchema);
