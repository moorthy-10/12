'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    department: { type: String, trim: true, default: '' },
    position: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    forcePasswordChange: { type: Boolean, default: false },
}, { timestamps: true });

// Virtual 'id' as string — keeps legacy req.user.id comparisons working
userSchema.virtual('id').get(function () {
    return this._id.toString();
});

userSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        delete ret.password; // never expose hash
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);
