'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');

async function createSuperAdmin() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB...');

        const email = 'superadmin@genlab.com';
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log('User superadmin@genlab.com already exists.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('password123', 10);

        // Creating with full admin role and bypassing temp password for convenience
        await User.create({
            name: 'Super Admin',
            email: email,
            password: hashedPassword,
            role: 'admin',
            roles: ['admin'],
            status: 'active',
            is_temp_password: false,
            // Permissions are auto-populated by the 'pre-save' hook in User model
        });

        console.log('✅ Super Admin user created successfully!');
        console.log('Email: superadmin@genlab.com');
        console.log('Password: password123');
        process.exit(0);
    } catch (error) {
        console.error('Failed to create super admin:', error);
        process.exit(1);
    }
}

createSuperAdmin();
