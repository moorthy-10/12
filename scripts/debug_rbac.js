'use strict';

const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debugRBAC() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Connected.\n');

        // 1. Find the first admin or user to test
        const testUser = await User.findOne({ status: 'active' });
        if (!testUser) {
            console.log('❌ No active users found in database.');
            return;
        }

        console.log(`👤 Testing with User: ${testUser.name} (${testUser.email})`);
        console.log(`Current Role: ${testUser.role}`);
        console.log(`Current Roles Array: ${JSON.stringify(testUser.roles)}`);
        console.log(`Current Permissions: ${JSON.stringify(testUser.permissions)}\n`);

        // 2. test updating roles to 'manager'
        console.log('🔄 Updating roles to ["manager"]...');
        testUser.roles = ['manager'];
        await testUser.save();

        const updatedManager = await User.findById(testUser._id);
        console.log('✅ Update Complete.');
        console.log(`New Roles: ${JSON.stringify(updatedManager.roles)}`);
        console.log(`New Permissions (Auto-populated): ${JSON.stringify(updatedManager.permissions)}`);
        console.log('   - Manager should have: VIEW_TEAM_ATTENDANCE, APPROVE_TEAM_LEAVE, etc.\n');

        // 3. test updating to 'hr'
        console.log('🔄 Updating roles to ["hr"]...');
        updatedManager.roles = ['hr'];
        await updatedManager.save();

        const updatedHR = await User.findById(testUser._id);
        console.log('✅ Update Complete.');
        console.log(`New Roles: ${JSON.stringify(updatedHR.roles)}`);
        console.log(`New Permissions (Auto-populated): ${JSON.stringify(updatedHR.permissions)}`);
        console.log('   - HR should have: MANAGE_EMPLOYEES, VIEW_DEPARTMENT_ATTENDANCE, etc.\n');

        // 4. Revert to original (optional, but let's set back to admin if it was admin)
        console.log('🔄 Reverting to legacy Admin role logic...');
        updatedHR.role = 'admin';
        updatedHR.roles = ['hr_admin'];
        await updatedHR.save();

        const final = await User.findById(testUser._id);
        console.log(`Final Role: ${final.role}`);
        console.log(`Final Permissions: ${JSON.stringify(final.permissions)}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected.');
    }
}

debugRBAC();
