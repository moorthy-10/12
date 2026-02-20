'use strict';

const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    event_type: { type: String, enum: ['holiday', 'company-event', 'meeting', 'other'], default: 'other' },
    type: { type: String, default: 'announcement' }, // extended type (announcement, training, etc.)
    start_date: { type: String, required: true },
    end_date: { type: String, required: true },
    is_holiday: { type: Boolean, default: false },
    all_day: { type: Boolean, default: true },
    location: { type: String, default: '' },
    start_time: { type: String, default: null },
    end_time: { type: String, default: null },
    recurrence: { type: String, enum: ['none', 'monthly', 'yearly'], default: 'none' },
    recurrence_interval: { type: Number, default: 1 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

calendarEventSchema.virtual('id').get(function () { return this._id.toString(); });
calendarEventSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
