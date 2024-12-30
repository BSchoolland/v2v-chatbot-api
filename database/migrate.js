// this file is used to migrate the database and all entities to the latest version

const version = '0.0.1';

// Helper function to check if a column exists
async function columnExists(table, column, dbAll) {
    const result = await dbAll(`PRAGMA table_info(${table})`, []);
    return result.some(col => col.name === column);
}

async function chatbotMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating chatbots if necessary...');
    // Add any new columns if they don't exist
    const columnsToAdd = [
        { name: 'initial_message', type: 'TEXT' },
        { name: 'questions', type: 'TEXT' },
        { name: 'version', type: 'TEXT' },
        { name: 'initial_config_prompt', type: 'TEXT' },
        { name: 'initial_config_message', type: 'TEXT' },
        { name: 'initial_config_questions', type: 'TEXT' },
        { name: 'ai_config_completed', type: 'INTEGER DEFAULT 0' }
    ];

    for (const column of columnsToAdd) {
        if (!(await columnExists('chatbots', column.name, dbAll))) {
            console.log(`Adding column ${column.name} to chatbots table...`);
            await dbRun(`ALTER TABLE chatbots ADD COLUMN ${column.name} ${column.type}`);
        }
    }

    // Migrate data
    const chatbots = await dbAll('SELECT * FROM chatbots', []);
    for (const chatbot of chatbots) {
        if (chatbot.version === null) {
            console.log(`Migrating chatbot ${chatbot.chatbot_id}...`);
            const defaultInitialMessage = ''; // for other migrations, default may not just be an empty string
            const defaultQuestions = '';
            await dbRun('UPDATE chatbots SET version = ?, initial_message = ?, questions = ? WHERE chatbot_id = ?', 
                [version, defaultInitialMessage, defaultQuestions, chatbot.chatbot_id]);
        }
    }
}

async function conversationMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating conversations if necessary...');
    
    // Add chat_id column if it doesn't exist
    if (!(await columnExists('recorded_conversations', 'chat_id', dbAll))) {
        console.log('Adding chat_id column to recorded_conversations table...');
        await dbRun(`ALTER TABLE recorded_conversations ADD COLUMN chat_id TEXT`);
        
        // Create an index on chat_id for better performance
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_chat_id ON recorded_conversations(chat_id)`);
    }
}

async function migrate(dbGet, dbRun, dbAll) {
    await chatbotMigration(dbGet, dbRun, dbAll);
    await conversationMigration(dbGet, dbRun, dbAll);
}

module.exports = {
    migrate,
    version
};