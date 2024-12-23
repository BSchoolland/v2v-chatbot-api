const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const db = new sqlite3.Database('data/api_database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Promisify db methods to use with async/await
const dbRun = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
      if (err) reject(err);
      resolve(this.lastID);
  });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
      if (err) reject(err);
      resolve(row);
  });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
  });
});

// Function to initialize the database
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS payment_method (
          payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS plans (
          plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatbot_id INTEGER,
          plan_type_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          remaining_credits INTEGER DEFAULT 0,
          additional_credits INTEGER DEFAULT 0,
          renews_at TEXT,
          rate_limiting_policy TEXT,
          name TEXT,
          FOREIGN KEY (chatbot_id) REFERENCES chatbot(chatbot_id),
          FOREIGN KEY (plan_type_id) REFERENCES plan_type(plan_type_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS plan_type (
          plan_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
          monthly_credits INTEGER NOT NULL,
          cost_monthly REAL NOT NULL,
          cost_yearly REAL NOT NULL,
          name TEXT NOT NULL,
          description TEXT
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS plan_type_model (
          plan_type_id INTEGER NOT NULL,
          model_id INTEGER NOT NULL,
          PRIMARY KEY (plan_type_id, model_id),
          FOREIGN KEY (plan_type_id) REFERENCES plan_type(plan_type_id),
          FOREIGN KEY (model_id) REFERENCES model(model_id)
        )
      `);
      // chatbot id is a string so we can use the generateUniqueId function
      db.run(`
        CREATE TABLE IF NOT EXISTS chatbots (
          chatbot_id TEXT PRIMARY KEY,
          plan_id INTEGER,
          website_id INTEGER,
          model_id INTEGER NOT NULL,
          name TEXT,
          system_prompt TEXT,
          initial_message TEXT,
          questions TEXT,
          FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
          FOREIGN KEY (website_id) REFERENCES website(website_id),
          FOREIGN KEY (model_id) REFERENCES models(model_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS models (
          model_id INTEGER PRIMARY KEY AUTOINCREMENT,
          max_context INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          api_string TEXT,
          service TEXT,
          message_cost INTEGER NOT NULL
        )
      `);
      // add the gpt-4o-mini model if it doesn't exist yet
      db.run(`
        INSERT INTO models (max_context, name, description, api_string, service, message_cost)
        SELECT 8192, 'gpt-4o-mini', 'OpenAIs GPT-4o-mini model', 'gpt-4o-mini', 'openai', 1
        WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'gpt-4o-mini')
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS recorded_conversations (
          recorded_conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatbot_id INTEGER NOT NULL,
          conversation TEXT NOT NULL,
          page_url TEXT,
          date TEXT,
          FOREIGN KEY (chatbot_id) REFERENCES chatbots(chatbot_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS website (
          website_id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatbot_id INTEGER NOT NULL,
          domain TEXT NOT NULL,
          last_crawled TEXT,
          FOREIGN KEY (chatbot_id) REFERENCES chatbots(chatbot_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          visitor_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_visitor_timestamp ON rate_limits(visitor_id, timestamp);
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS page (
          page_id INTEGER PRIMARY KEY AUTOINCREMENT,
          website_id INTEGER NOT NULL,
          internal BOOLEAN NOT NULL,
          url TEXT NOT NULL,
          summary TEXT,
          content TEXT,
          date_updated TEXT,
          FOREIGN KEY (website_id) REFERENCES website(website_id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables initialized.');
          resolve();
        }
      });
    });
  });
};

// Add this helper function for guaranteed unique IDs
const generateUniqueId = async (tableName, idColumn) => {
  let id;
  let isUnique = false;
  
  while (!isUnique) {
    id = crypto.randomBytes(16).toString('hex');
    try {
      await dbGet(`SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} = ?`, [id]);
      // If we get here and row is null, the ID is unique
      isUnique = true;
    } catch (err) {
      // If there's a unique constraint violation, try again (even though this should never happen)
      console.warn('WOW! This event was so astronomically unlikely, it should probably be studied, or win a spot in the Guinness Book of World Records!');
      continue;
    }
  }
  return id;
};

module.exports = { initializeDatabase, dbRun, dbGet, dbAll, generateUniqueId };