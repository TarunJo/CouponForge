const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'coupon_system.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initializeDatabase() {
  const db = await getDb();

  // Create admins table
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create merchants table
  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_number TEXT UNIQUE NOT NULL,
      org_name TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      address TEXT,
      logo_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES admins(id)
    )
  `);

  // Create coupons table
  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      merchant_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      currency TEXT DEFAULT 'INR',
      is_scratched INTEGER DEFAULT 0,
      is_redeemed INTEGER DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scratched_at DATETIME,
      redeemed_at DATETIME,
      validation_code TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_uuid ON coupons(uuid)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_merchant_id ON coupons(merchant_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_validation_code ON coupons(validation_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchants_merchant_number ON merchants(merchant_number)`);

  // Seed default super admin if not exists
  const adminResult = db.exec('SELECT id FROM admins WHERE username = ?', ['superadmin']);
  if (adminResult.length === 0 || adminResult[0].values.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['superadmin', hash]);
    console.log('✅ Default super admin created (username: superadmin, password: admin123)');
  }

  saveDb();
  console.log('✅ Database initialized successfully');
}

// Auto-save periodically
setInterval(() => {
  saveDb();
}, 30000); // Save every 30 seconds

module.exports = { getDb, saveDb, initializeDatabase };
