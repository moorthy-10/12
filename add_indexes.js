/**
 * Performance Index Migration
 * Adds missing database indexes to speed up common queries.
 * Safe to run multiple times (IF NOT EXISTS).
 * 
 * Run with: node add_indexes.js
 */

const db = require('./config/database');

const indexes = [
    // attendance: user_id + date composite (most common lookup pattern)
    `CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date)`,
    // attendance: date alone (admin dashboard TODAY queries)
    `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`,
    // attendance: status (filter queries)
    `CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)`,
    // leaves: user_id (employee views own leaves)
    `CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON leaves(user_id)`,
    // leaves: status (pending/approved filters)
    `CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status)`,
    // leaves: start_date (date range queries)
    `CREATE INDEX IF NOT EXISTS idx_leaves_start_date ON leaves(start_date)`,
    // tasks: assigned_to (employee views own tasks)
    `CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`,
    // tasks: status
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    // calendar_events: is_holiday + date range (holiday check on clock-in)
    `CREATE INDEX IF NOT EXISTS idx_calendar_holiday ON calendar_events(is_holiday, start_date, end_date)`,
    // users: email (login lookup — already unique but explicit index helps planner)
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    // users: status (active user filter)
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`,
];

setTimeout(() => {
    console.log('📊 Adding performance indexes...\n');
    let done = 0;
    indexes.forEach((sql, i) => {
        const name = sql.match(/idx_\w+/)[0];
        db.run(sql, (err) => {
            if (err) {
                console.log(`  ❌ [${name}]: ${err.message}`);
            } else {
                console.log(`  ✅ [${name}]`);
            }
            done++;
            if (done === indexes.length) {
                console.log('\n✅ All indexes created (or already existed).');
                process.exit(0);
            }
        });
    });
}, 700);
