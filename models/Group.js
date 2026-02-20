'use strict';

const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

groupSchema.virtual('id').get(function () { return this._id.toString(); });
groupSchema.set('toJSON', { virtuals: true, transform: (_, r) => { delete r._id; delete r.__v; return r; } });

module.exports = mongoose.model('Group', groupSchema);
