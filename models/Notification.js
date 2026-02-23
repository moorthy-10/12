'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['chat', 'task', 'leave', 'attendance', 'calendar'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    related_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    is_read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, is_read: 1, createdAt: -1 });

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
