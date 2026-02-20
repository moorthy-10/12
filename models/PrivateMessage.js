'use strict';

const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
}, { timestamps: true });

privateMessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });

privateMessageSchema.virtual('id').get(function () { return this._id.toString(); });
privateMessageSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('PrivateMessage', privateMessageSchema);
