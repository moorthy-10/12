'use strict';

const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

/**
 * Initializes default chat groups on system boot.
 * Groups are only created if they don't already exist.
 */
async function initDefaultGroups() {
    try {
        console.log('🏘️ Initializing default chat groups...');

        const defaults = [
            { name: 'General', description: 'Company-wide discussion for all employees', type: 'public' },
            { name: 'Announcements', description: 'Important updates from management (Admin only posting)', type: 'public' },
            { name: 'HR', description: 'Human Resources and Management discussion', type: 'private' }
        ];

        const adminUser = await User.findOne({ role: 'admin' });
        const creatorId = adminUser ? adminUser._id : null;

        if (!creatorId) {
            console.log('⚠️ No admin user found to assign as group creator. Skipping group initialization.');
            return;
        }

        for (const def of defaults) {
            let group = await Group.findOne({ name: def.name });

            if (!group) {
                console.log(`  + Creating group: ${def.name}`);
                group = await Group.create({
                    ...def,
                    created_by: creatorId
                });
            }

            // Sync members based on roles
            const users = await User.find({ status: 'active' });
            const memberIds = [];

            for (const user of users) {
                const userId = user._id.toString();
                let shouldAdd = false;

                if (def.name === 'General') {
                    shouldAdd = true; // Everyone in General
                } else if (def.name === 'Announcements') {
                    if (user.role === 'admin') shouldAdd = true;
                } else if (def.name === 'HR') {
                    if (user.role === 'admin' || user.role === 'hr') shouldAdd = true;
                }

                if (shouldAdd) {
                    memberIds.push(user._id);
                }
            }

            // Update group members (avoid duplicates)
            if (memberIds.length > 0) {
                await Group.findByIdAndUpdate(group._id, {
                    $addToSet: { members: { $each: memberIds } }
                });
            }
        }

        console.log('✅ Default groups initialization complete');
    } catch (error) {
        console.error('❌ Failed to initialize default groups:', error);
    }
}

module.exports = { initDefaultGroups };
