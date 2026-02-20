'use strict';

const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'file'], default: 'text' },
    content: { type: String, required: true },
    file_url: { type: String, default: null },
    file_name: { type: String, default: null },
}, { timestamps: true });

chatMessageSchema.index({ group: 1, createdAt: 1 });

chatMessageSchema.virtual('id').get(function () { return this._id.toString(); });
chatMessageSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
