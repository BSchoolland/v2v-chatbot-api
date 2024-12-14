const sqlite3 = require('sqlite3').verbose();

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
      db.run(`
        CREATE TABLE IF NOT EXISTS chatbot (
          chatbot_id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER,
          model_id INTEGER NOT NULL,
          system_prompt TEXT,
          FOREIGN KEY (plan_id) REFERENCES plan(plan_id),
          FOREIGN KEY (model_id) REFERENCES model(model_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS model (
          model_id INTEGER PRIMARY KEY AUTOINCREMENT,
          max_context INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          api_string TEXT,
          message_cost REAL
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS recorded_conversation (
          recorded_conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatbot_id INTEGER NOT NULL,
          conversation TEXT NOT NULL,
          page_url TEXT,
          date TEXT,
          FOREIGN KEY (chatbot_id) REFERENCES chatbot(chatbot_id)
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS website (
          website_id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatbot_id INTEGER NOT NULL,
          domain TEXT NOT NULL,
          last_crawled TEXT,
          FOREIGN KEY (chatbot_id) REFERENCES chatbot(chatbot_id)
        )
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

module.exports = { initializeDatabase, dbRun, dbGet, dbAll };
