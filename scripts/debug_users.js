'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');

async function debugLogin() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('--- DEBUG USER INFO ---');

        const emails = ['superadmin@genlab.com', 'admin@genlab.com', 'demo@genlab.com'];

        for (const email of emails) {
            const user = await User.findOne({ email });
            if (user) {
                console.log(`Email: ${user.email}`);
                console.log(`Role: ${user.role}`);
                console.log(`Is Temp Password: ${user.is_temp_password}`);
                console.log(`Has Permissions: ${user.permissions.length > 0}`);

                const isMatch = await bcrypt.compare('password123', user.password);
                const isAdminMatch = await bcrypt.compare('admin123', user.password);
                const isDemoMatch = await bcrypt.compare('demo123', user.password);

                console.log(`Matches 'password123': ${isMatch}`);
                console.log(`Matches 'admin123': ${isAdminMatch}`);
                console.log(`Matches 'demo123': ${isDemoMatch}`);
                console.log('---');
            } else {
                console.log(`Email: ${email} -> NOT FOUND`);
                console.log('---');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugLogin();
