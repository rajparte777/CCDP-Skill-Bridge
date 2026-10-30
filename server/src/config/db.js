const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

dotenv.config();

let pgPool = null;
let sqliteDb = null;
let isPostgres = false;

// Ensure local data directory exists for SQLite fallback
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Convert PostgreSQL positional param syntax ($1, $2) to SQLite ordered parameters
function prepareSqliteQuery(sql, params) {
  const newParams = [];
  const convertedSql = sql.replace(/\$([0-9]+)/g, (match, index) => {
    const idx = parseInt(index, 10) - 1;
    newParams.push(params[idx]);
    return '?';
  });
  return { sql: convertedSql, params: newParams };
}

async function initDb() {
  const databaseUrl = process.env.DATABASE_URL;

  // Always initialize embedded SQLite so local storage and instant fallback are ready
  const sqlitePath = path.join(dataDir, 'devcollab.sqlite');
  sqliteDb = new Database(sqlitePath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  if (databaseUrl) {
    try {
      console.log('[Database] Attempting connection to PostgreSQL...');
      const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 4000 });
      pool.on('error', (err) => {
        console.warn('[Database] PostgreSQL pool background event:', err.message);
      });
      await pool.query('SELECT 1');
      pgPool = pool;
      isPostgres = true;
      console.log('[Database] Connected to PostgreSQL successfully.');
    } catch (err) {
      console.warn('[Database] PostgreSQL connection failed. Using embedded SQLite:', err.message);
      pgPool = null;
      isPostgres = false;
    }
  }

  // Run schema
  await runSchema();
}

async function runSchema() {
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  if (isPostgres && pgPool) {
    try {
      await pgPool.query(schemaSql);
      await pgPool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(100) DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
        ALTER TABLE collaboration_offers ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;
        ALTER TABLE collaboration_offers ADD COLUMN IF NOT EXISTS milestone_title VARCHAR(255) DEFAULT '';
        ALTER TABLE collaboration_offers ADD COLUMN IF NOT EXISTS deliverable_note TEXT DEFAULT '';
        ALTER TABLE collaboration_offers ADD COLUMN IF NOT EXISTS deliverable_url TEXT DEFAULT '';
        ALTER TABLE collaboration_offers ADD COLUMN IF NOT EXISTS milestone_status VARCHAR(30) DEFAULT 'in_progress';
      `);
      console.log('[Database] PostgreSQL schema applied successfully.');
    } catch (e) {
      console.warn('[Database] PostgreSQL schema notice:', e.message);
    }
  }

  // Always ensure SQLite schema is prepared for seamless dual-operation
  if (sqliteDb) {
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        sqliteDb.exec(statement);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn('[Database] SQLite schema notice:', err.message);
        }
      }
    }

    try {
      const tableInfo = sqliteDb.prepare("PRAGMA table_info(users)").all();
      const colNames = tableInfo.map(c => c.name);
      if (!colNames.includes('github_id')) {
        sqliteDb.exec("ALTER TABLE users ADD COLUMN github_id TEXT DEFAULT '';");
      }
      if (!colNames.includes('github_access_token')) {
        sqliteDb.exec("ALTER TABLE users ADD COLUMN github_access_token TEXT DEFAULT '';");
      }
      if (!colNames.includes('reset_token')) {
        sqliteDb.exec("ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT '';");
      }
      if (!colNames.includes('reset_token_expires')) {
        sqliteDb.exec("ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP;");
      }

      const offerTableInfo = sqliteDb.prepare("PRAGMA table_info(collaboration_offers)").all();
      const offerColNames = offerTableInfo.map(c => c.name);
      if (!offerColNames.includes('task_id')) {
        sqliteDb.exec("ALTER TABLE collaboration_offers ADD COLUMN task_id TEXT;");
      }
      if (!offerColNames.includes('milestone_title')) {
        sqliteDb.exec("ALTER TABLE collaboration_offers ADD COLUMN milestone_title TEXT DEFAULT '';");
      }
      if (!offerColNames.includes('deliverable_note')) {
        sqliteDb.exec("ALTER TABLE collaboration_offers ADD COLUMN deliverable_note TEXT DEFAULT '';");
      }
      if (!offerColNames.includes('deliverable_url')) {
        sqliteDb.exec("ALTER TABLE collaboration_offers ADD COLUMN deliverable_url TEXT DEFAULT '';");
      }
      if (!offerColNames.includes('milestone_status')) {
        sqliteDb.exec("ALTER TABLE collaboration_offers ADD COLUMN milestone_status TEXT DEFAULT 'in_progress';");
      }
    } catch (migErr) {
      console.warn('[Database] SQLite migration notice:', migErr.message);
    }

    console.log('[Database] SQLite schema verified and ready.');
  }
}

function runSqliteQuery(sql, params = []) {
  const { sql: sqliteSql, params: sqliteParams } = prepareSqliteQuery(sql, params);
  const trimmed = sqliteSql.trim();
  const isSelect = /^SELECT\b/i.test(trimmed);
  const hasReturning = /\bRETURNING\b/i.test(trimmed);

  try {
    const stmt = sqliteDb.prepare(sqliteSql);
    if (isSelect || hasReturning) {
      const rows = stmt.all(...sqliteParams);
      return { rows };
    } else {
      const info = stmt.run(...sqliteParams);
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (error) {
    console.error('[Database Error] SQLite Query:', sqliteSql, 'Params:', sqliteParams, 'Error:', error.message);
    throw error;
  }
}

/**
 * Universal query runner
 * @param {string} sql Query with $1, $2 or ?
 * @param {Array} params Parameter values
 * @returns {Promise<{ rows: Array<any> }>}
 */
async function query(sql, params = []) {
  if (isPostgres && pgPool) {
    try {
      return await pgPool.query(sql, params);
    } catch (pgErr) {
      console.warn('[Database] PostgreSQL query error, falling back to SQLite:', pgErr.message);
      if (sqliteDb) {
        return runSqliteQuery(sql, params);
      }
      throw pgErr;
    }
  }
  return runSqliteQuery(sql, params);
}

module.exports = {
  initDb,
  query,
  isPostgres: () => isPostgres,
  getDbInstance: () => (isPostgres ? pgPool : sqliteDb),
  getSqliteInstance: () => sqliteDb
};
