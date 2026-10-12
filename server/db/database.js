require('dotenv').config();
const { createClient } = require('@libsql/client');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'coupon_system.db');

let tursoClient = null;
let localDb = null;
let isTurso = false;

// Check if Turso cloud database credentials are configured
const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl) {
  isTurso = true;
  tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
  console.log('🌐 Connected to Turso persistent cloud database');
} else {
  console.log('📁 Turso credentials not set, using local SQLite database (coupon_system.db)');
}

async function getDb() {
  if (isTurso) {
    return {
      exec: async (sql, params = []) => {
        const res = await tursoClient.execute({ sql, args: params });
        if (!res.rows || res.rows.length === 0) return [];
        return [
          {
            columns: res.columns,
            values: res.rows.map(row =>
              res.columns.map((col, idx) => (row[col] !== undefined ? row[col] : row[idx]))
            )
          }
        ];
      },
      run: async (sql, params = []) => {
        return await tursoClient.execute({ sql, args: params });
      }
    };
  }

  if (localDb) {
    return {
      exec: async (sql, params = []) => localDb.exec(sql, params),
      run: async (sql, params = []) => localDb.run(sql, params)
    };
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    localDb = new SQL.Database(fileBuffer);
  } else {
    localDb = new SQL.Database();
  }

  return {
    exec: async (sql, params = []) => localDb.exec(sql, params),
    run: async (sql, params = []) => localDb.run(sql, params)
  };
}

function saveDb() {
  if (isTurso) {
    // Cloud database automatically persists on every execute
    return;
  }
  if (localDb) {
    const data = localDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initializeDatabase() {
  const db = await getDb();

  // Create admins table
  await db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create merchants table
  await db.run(`
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
  await db.run(`
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
  await db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_uuid ON coupons(uuid)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_merchant_id ON coupons(merchant_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_validation_code ON coupons(validation_code)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_merchants_merchant_number ON merchants(merchant_number)`);

  // Configure Super Admin from environment variables (no hardcoded credentials)
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminUsername && adminPassword) {
    const existing = await db.exec('SELECT id FROM admins WHERE username = ?', [adminUsername]);
    const hash = bcrypt.hashSync(adminPassword, 10);
    if (existing.length === 0 || existing[0].values.length === 0) {
      await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUsername, hash]);
      console.log(`✅ Super admin created from environment variables (username: ${adminUsername})`);
    } else {
      await db.run('UPDATE admins SET password_hash = ? WHERE username = ?', [hash, adminUsername]);
      console.log(`✅ Super admin password synced from environment variables (username: ${adminUsername})`);
    }
  } else {
    const countResult = await db.exec('SELECT COUNT(*) as count FROM admins');
    const count = (countResult.length > 0 && countResult[0].values.length > 0) ? countResult[0].values[0][0] : 0;
    if (count === 0) {
      console.log('⚠️ No super admin found in database. Set ADMIN_USERNAME and ADMIN_PASSWORD in environment variables to configure one.');
    }
  }

  saveDb();
  console.log('✅ Database schema verified and ready');
}

// Auto-save periodically for local database
if (!isTurso) {
  setInterval(() => {
    saveDb();
  }, 30000);
}

module.exports = { getDb, saveDb, initializeDatabase };
