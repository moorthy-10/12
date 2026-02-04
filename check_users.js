const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('📊 Recent Users in Database:\n');

db.all(
    `SELECT id, name, email, role, forcePasswordChange, status, created_at 
     FROM users 
     ORDER BY id DESC 
     LIMIT 5`,
    [],
    (err, rows) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        console.table(rows);

        console.log(`\n✅ Total users checked: ${rows.length}`);
        console.log(`\n💡 Latest user: ${rows[0]?.name} (${rows[0]?.email})`);
        console.log(`   - forcePasswordChange: ${rows[0]?.forcePasswordChange === 1 ? 'Yes ✓' : 'No'}`);
        console.log(`   - role: ${rows[0]?.role}`);
        console.log(`   - status: ${rows[0]?.status}`);

        db.close();
    }
);
