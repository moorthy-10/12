'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: [
            'GROUP_MESSAGE',
            'TASK_ASSIGNED',
            'LEAVE_REQUEST',
            'LEAVE_APPROVED',
            'LEAVE_REJECTED',
            'ATTENDANCE_REMINDER',
            'STANDUP_REMINDER',
            'CALENDAR_EVENT',
            'chat',
            'task',
            'leave',
            'attendance',
            'calendar'
        ],
        required: true
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    related_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    related_model: { type: String, default: null },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ user: 1, is_read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read_at: 1, createdAt: -1 });
notificationSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

notificationSchema.virtual('id').get(function () { return this._id.toString(); });
notificationSchema.set('toJSON', {
    virtuals: true,
    transform: (_, r) => {
        delete r._id;
        delete r.__v;
        // Legacy field name compatibility
        r.user_id = r.user;
        return r;
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
