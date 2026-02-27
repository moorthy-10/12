'use strict';

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD stored as string to match old format
    status: { type: String, enum: ['present', 'absent', 'half-day', 'leave'], required: true },
    check_in_time: { type: String, default: null },
    check_out_time: { type: String, default: null },
    // Full UTC timestamps for accurate totalHours calculation
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    totalHours: { type: Number, default: null },
    autoClosed: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    // Manual Edit Fields
    is_manual: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    edit_history: [
        {
            edited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            old_check_in: { type: Date },
            old_check_out: { type: Date },
            edited_at: { type: Date, default: Date.now },
            reason: { type: String }
        }
    ],
}, { timestamps: true });

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

// Virtual id
attendanceSchema.virtual('id').get(function () { return this._id.toString(); });
attendanceSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('Attendance', attendanceSchema);
