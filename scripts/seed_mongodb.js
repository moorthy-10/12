'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');

async function seed() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB for seeding...');

        // Create Admin
        const adminEmail = 'admin@genlab.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const password = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Admin User',
                email: adminEmail,
                password: password,
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_temp_password: false
            });
            console.log('✅ Admin user created');
        } else {
            console.log('Admin user already exists');
        }

        // Create Demo Employee
        const demoEmail = 'demo@genlab.com';
        const existingDemo = await User.findOne({ email: demoEmail });
        if (!existingDemo) {
            const password = await bcrypt.hash('demo123', 10);
            await User.create({
                name: 'Demo Employee',
                email: demoEmail,
                password: password,
                role: 'employee',
                roles: ['employee'],
                status: 'active',
                is_temp_password: false
            });
            console.log('✅ Demo employee created');
        } else {
            console.log('Demo employee already exists');
        }

        console.log('Seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
