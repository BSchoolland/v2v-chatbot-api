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

async function planTypeMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating plan types if necessary...');

    // Add subscription_active column to plans table if it doesn't exist
    if (!(await columnExists('plans', 'subscription_active', dbAll))) {
        console.log('Adding subscription_active column to plans table...');
        await dbRun(`ALTER TABLE plans ADD COLUMN subscription_active INTEGER DEFAULT 0`);
    }

    // Insert default plan types if they don't exist
    const planTypes = [
        {
            id: 0,
            name: 'Free Plan',
            description: 'Basic features with limited usage',
            monthly_credits: 50,
            cost_monthly: 0,
            cost_yearly: 0
        },
        {
            id: 1,
            name: 'Basic Plan',
            description: 'Enhanced features with moderate usage',
            monthly_credits: 1000,
            cost_monthly: 10,
            cost_yearly: 100
        },
        {
            id: 2,
            name: 'Pro Plan',
            description: 'Full features with high usage limits',
            monthly_credits: 10000,
            cost_monthly: 50,
            cost_yearly: 500
        }
    ];

    for (const planType of planTypes) {
        const exists = await dbGet('SELECT 1 FROM plan_type WHERE plan_type_id = ?', [planType.id]);
        if (!exists) {
            console.log(`Adding plan type: ${planType.name}`);
            await dbRun(
                `INSERT INTO plan_type (plan_type_id, name, description, monthly_credits, cost_monthly, cost_yearly) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [planType.id, planType.name, planType.description, planType.monthly_credits, planType.cost_monthly, planType.cost_yearly]
            );
        }
    }
}

async function migrate(dbGet, dbRun, dbAll) {
    await chatbotMigration(dbGet, dbRun, dbAll);
    await conversationMigration(dbGet, dbRun, dbAll);
    await planTypeMigration(dbGet, dbRun, dbAll);
}

module.exports = {
    migrate,
    version
};