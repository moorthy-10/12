const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('📦 Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
        department TEXT,
        position TEXT,
        phone TEXT,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attendance table
    db.run(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status TEXT CHECK(status IN ('present', 'absent', 'half-day', 'leave')) DEFAULT 'present',
        check_in_time TIME,
        check_out_time TIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      )
    `);

    // Leaves table
    db.run(`
      CREATE TABLE IF NOT EXISTS leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        leave_type TEXT CHECK(leave_type IN ('sick', 'casual', 'vacation', 'unpaid')) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        review_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )
    `);

    // Tasks table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'in-progress', 'completed', 'cancelled')) DEFAULT 'pending',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        due_date DATE,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )
    `);

    // Calendar Events table
    db.run(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT CHECK(event_type IN ('holiday', 'company-event', 'meeting', 'other')) DEFAULT 'other',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_holiday INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Chat: Groups table
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Chat: Group members table
    db.run(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(group_id, user_id)
      )
    `);

    // Chat: Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('text', 'file')) DEFAULT 'text',
        content TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
    `);

    // Chat: Private messages table (1-to-1)
    db.run(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);

    // Index for fast conversation lookup
    db.run(`CREATE INDEX IF NOT EXISTS idx_pm_conversation
      ON private_messages(sender_id, receiver_id, created_at)`);

    // Notifications table
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('chat', 'task', 'leave', 'attendance')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notif_user
      ON notifications(user_id, is_read, created_at)`);

    // Create default admin user
    const adminEmail = 'admin@genlab.com';
    const adminPassword = bcrypt.hashSync('admin123', 10);

    db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, row) => {
      if (!row) {
        db.run(`
          INSERT INTO users (name, email, password, role, department, position, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['Admin User', adminEmail, adminPassword, 'admin', 'Management', 'System Administrator', '+1234567890'], (err) => {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('✅ Default admin user created (admin@genlab.com / admin123)');
          }
        });
      }
    });

    // Create demo employee
    const demoEmail = 'demo@genlab.com';
    const demoPassword = bcrypt.hashSync('demo123', 10);

    db.get('SELECT * FROM users WHERE email = ?', [demoEmail], (err, row) => {
      if (!row) {
        db.run(`
          INSERT INTO users (name, email, password, role, department, position, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['Demo Employee', demoEmail, demoPassword, 'employee', 'Engineering', 'Software Developer', '+1234567891'], (err) => {
          if (err) {
            console.error('Error creating demo user:', err);
          } else {
            console.log('✅ Demo employee user created (demo@genlab.com / demo123)');
          }
        });
      }
    });
  });
}

module.exports = db;
