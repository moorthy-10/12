/**
 * Database Migration Script
 * Adds forcePasswordChange column to users table
 * 
 * Run this script once to update the database schema
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('📦 Connected to SQLite database');
        runMigration();
    }
});

function runMigration() {
    db.serialize(() => {
        // Check if the column already exists
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('❌ Error checking table schema:', err.message);
                db.close();
                process.exit(1);
            }

            const hasForcePasswordChange = columns.some(col => col.name === 'forcePasswordChange');

            if (hasForcePasswordChange) {
                console.log('✅ Column forcePasswordChange already exists. No migration needed.');
                db.close();
                process.exit(0);
            } else {
                // Add the new column
                db.run(`
                    ALTER TABLE users 
                    ADD COLUMN forcePasswordChange INTEGER DEFAULT 0
                `, (err) => {
                    if (err) {
                        console.error('❌ Error adding forcePasswordChange column:', err.message);
                        db.close();
                        process.exit(1);
                    } else {
                        console.log('✅ Successfully added forcePasswordChange column to users table');
                        db.close();
                        process.exit(0);
                    }
                });
            }
        });
    });
}
