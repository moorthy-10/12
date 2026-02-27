'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const { getPermissionsForRoles } = require('../config/permissions');

async function syncAllPermissions() {
    try {
        await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/genlab');
        console.log('Connected to DB');

        const users = await User.find({});
        console.log(`Checking ${users.length} users...`);

        for (const user of users) {
            const combinedRoles = [...(user.roles || [])];
            if (user.role && !combinedRoles.includes(user.role)) {
                combinedRoles.push(user.role);
            }

            const newPerms = getPermissionsForRoles(combinedRoles);

            // Only update if they differ
            if (JSON.stringify(user.permissions) !== JSON.stringify(newPerms)) {
                user.permissions = newPerms;
                await user.save();
                console.log(`Updated permissions for: ${user.email} (Roles: ${combinedRoles.join(', ')})`);
            }
        }

        console.log('All users synced.');
        process.exit(0);
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncAllPermissions();
