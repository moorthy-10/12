'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const connectDB = require('../config/mongo');

async function migrate() {
    console.log('🚀 Starting non-destructive notification migration...');

    try {
        await connectDB();

        const legacyTypeMap = {
            'chat': 'GROUP_MESSAGE',
            'task': 'TASK_ASSIGNED',
            'leave': 'LEAVE_REQUEST',
            'attendance': 'ATTENDANCE_REMINDER',
            'calendar': 'CALENDAR_EVENT'
        };

        const notifications = await Notification.find({
            $or: [
                { read_at: { $exists: false } },
                { priority: { $exists: false } }
            ]
        });

        console.log(`🔍 Found ${notifications.length} notifications to process.`);

        let updatedCount = 0;

        for (const doc of notifications) {
            const updates = {};

            // Convert is_read === true -> set read_at = updatedAt
            if (doc.is_read && !doc.read_at) {
                updates.read_at = doc.updatedAt || new Date();
            }

            // Map legacy types
            if (legacyTypeMap[doc.type]) {
                updates.type = legacyTypeMap[doc.type];
            }

            // Set default priority if missing
            if (!doc.priority) {
                updates.priority = 'normal';
            }

            // Set default related_model if missing
            if (doc.related_model === undefined) {
                updates.related_model = null;
            }

            if (Object.keys(updates).length > 0) {
                await Notification.findByIdAndUpdate(doc._id, { $set: updates });
                updatedCount++;
            }
        }

        console.log(`✅ Migration complete. Updated ${updatedCount} documents.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
