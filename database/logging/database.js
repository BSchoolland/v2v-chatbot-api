const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const db = new sqlite3.Database('data/logging_database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
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
const initializeLoggingDatabase = async () => {
  try {
    console.log("Initializing logging database...");
    await db.serialize(() => {
        // Tool call logging:
        // Key comparisons:
        // tool call success rate
        // tool calls made per message (max, average, min)
        // what tool calls are most commonly used
        // what tool calls are most commonly used per chatbot
        db.run(`
            CREATE TABLE IF NOT EXISTS tool_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                success BOOLEAN NOT NULL,
                arguments TEXT NOT NULL,
                result TEXT NOT NULL,
                chatbot_id TEXT NOT NULL,
                message_id TEXT 
            )
        `); // TODO: message_id is currently always null, we should add it

        // Chatbot Message logging:
        // Key comparisons:
        // message length (max, average, min)
        // message length by chatbot, which ones are most verbose
        // message count
        db.run(`
            CREATE TABLE IF NOT EXISTS chatbot_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                message TEXT NOT NULL,
                chatbot_id TEXT NOT NULL
            )
        `);

        // credit renewal logging:
        // when a plan is renewed, how many credits are added
        // how many credits were already in the plan
        db.run(`
            CREATE TABLE IF NOT EXISTS credit_renewals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                credits_added INTEGER NOT NULL,
                credits_before INTEGER NOT NULL,
                plan_id TEXT NOT NULL
            )
        `);
        

    });
    console.log('Database tables initialized.');
    return true;
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

// version is a string that is used to track the version of the chatbot (or any other entity in case we need to update the database schema)
// Current version is 0.0.1, when we change the database schema, we increment the version

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

module.exports = { initializeLoggingDatabase, dbRun, dbGet, dbAll, generateUniqueId };