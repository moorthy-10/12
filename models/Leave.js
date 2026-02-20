'use strict';

const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leave_type: { type: String, enum: ['sick', 'casual', 'vacation', 'unpaid'], required: true },
    start_date: { type: String, required: true },
    end_date: { type: String, required: true },
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed_at: { type: Date, default: null },
    review_notes: { type: String, default: '' },
}, { timestamps: true });

leaveSchema.virtual('id').get(function () { return this._id.toString(); });
leaveSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('Leave', leaveSchema);
