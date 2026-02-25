'use strict';

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'cancelled'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    due_date: { type: Date, default: null },
    completed_at: { type: Date, default: null }
}, { timestamps: true });

// Indexes for frequently queried fields
taskSchema.index({ assigned_to: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ due_date: 1 });

taskSchema.virtual('id').get(function () { return this._id.toString(); });
taskSchema.set('toJSON', {
    virtuals: true,
    transform: (_, r) => { delete r._id; delete r.__v; return r; }
});

module.exports = mongoose.model('Task', taskSchema);
