'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'employee', 'manager', 'HR', 'hr_admin', 'teamlead', 'intern'], default: 'employee' },
    roles: { type: [String], default: [] },
    permissions: { type: [String], default: [] },
    department: { type: String, trim: true, default: '' },
    department_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    reports_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employment_type: { type: String, enum: ['fulltime', 'intern'], default: 'fulltime' },
    position: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    forcePasswordChange: { type: Boolean, default: false },
    fcmToken: { type: String, default: null },
}, { timestamps: true });

// Auto-populate permissions on save if roles changed
userSchema.pre('save', async function () {
    if (this.isModified('roles') || this.isModified('role')) {
        const { getPermissionsForRoles } = require('../config/permissions');
        // Merge legacy 'role' into 'roles' if not already present
        const combinedRoles = [...(this.roles || [])];
        if (this.role && !combinedRoles.includes(this.role)) {
            combinedRoles.push(this.role);
        }
        this.permissions = getPermissionsForRoles(combinedRoles);
    }
});

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
