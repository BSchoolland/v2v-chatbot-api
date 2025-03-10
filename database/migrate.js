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
        { name: 'ai_config_completed', type: 'INTEGER DEFAULT 0' },
        { name: 'model_id', type: 'INTEGER' },
        { name: 'contact_info', type: 'TEXT' },
        { name: 'rate_limit', type: 'INTEGER DEFAULT 25' }  // Default to 25 messages per day
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
            const defaultContactInfo = ''; // default contact info is blank
            await dbRun('UPDATE chatbots SET version = ?, initial_message = ?, questions = ?, contact_info = ? WHERE chatbot_id = ?', 
                [version, defaultInitialMessage, defaultQuestions, defaultContactInfo, chatbot.chatbot_id]);
        }
    }

    // Handle chatbots without a model_id
    console.log('Checking for chatbots without a model_id...');
    const chatbotsWithoutModel = await dbAll('SELECT chatbot_id FROM chatbots WHERE model_id IS NULL');
    if (chatbotsWithoutModel.length > 0) {
        console.log(`Found ${chatbotsWithoutModel.length} chatbots without a model_id, assigning default model...`);
        await dbRun(`
            UPDATE chatbots 
            SET model_id = (SELECT model_id FROM models WHERE name = 'default')
            WHERE model_id IS NULL
        `);
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

    // Add Stripe columns to plan_type if they don't exist
    if (!(await columnExists('plan_type', 'stripe_product_id', dbAll))) {
        console.log('Adding stripe_product_id column to plan_type table...');
        await dbRun(`ALTER TABLE plan_type ADD COLUMN stripe_product_id TEXT`);
    }

    if (!(await columnExists('plan_type', 'stripe_price_id', dbAll))) {
        console.log('Adding stripe_price_id column to plan_type table...');
        await dbRun(`ALTER TABLE plan_type ADD COLUMN stripe_price_id TEXT`);
    }

    // Insert default plan types if they don't exist
    const planTypes = [
        {
            id: 0,
            name: 'Free Plan',
            description: 'Perfect for personal projects and testing - includes 50 monthly credits',
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

async function modelMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating models if necessary...');

    // Add the new models if they don't exist
    const models = [
        {
            name: 'default',
            description: 'Default model - periodically updated by developers',
            max_context: 8192,
            api_string: 'gpt-4o-mini',
            service: 'openai',
            message_cost: 1
        },
        {
            name: 'gpt-4o-mini',
            description: 'OpenAI GPT-4o-mini model',
            max_context: 8192,
            api_string: 'gpt-4o-mini',
            service: 'openai',
            message_cost: 1
        },
        {
            name: 'gpt-4o',
            description: 'OpenAI GPT-4o model',
            max_context: 8192,
            api_string: 'gpt-4o',
            service: 'openai',
            message_cost: 2
        }
    ];

    for (const model of models) {
        const exists = await dbGet('SELECT 1 FROM models WHERE name = ?', [model.name]);
        if (!exists) {
            console.log(`Adding model: ${model.name}`);
            await dbRun(
                `INSERT INTO models (name, description, max_context, api_string, service, message_cost) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [model.name, model.description, model.max_context, model.api_string, model.service, model.message_cost]
            );
        }
    }

    // Set up plan type model relationships
    // Get model IDs
    const defaultModel = await dbGet('SELECT model_id FROM models WHERE name = ?', ['default']);
    const gpt4oMini = await dbGet('SELECT model_id FROM models WHERE name = ?', ['gpt-4o-mini']);
    const gpt4o = await dbGet('SELECT model_id FROM models WHERE name = ?', ['gpt-4o']);

    // Set up relationships - Free plan gets default only, Basic gets default and gpt4o-mini, Pro gets all
    const planModelRelations = [
        { plan_type_id: 0, model_id: defaultModel.model_id },  // Free plan - default only
        { plan_type_id: 1, model_id: defaultModel.model_id },  // Basic plan - default
        { plan_type_id: 1, model_id: gpt4oMini.model_id },    // Basic plan - gpt4o-mini
        { plan_type_id: 2, model_id: defaultModel.model_id },  // Pro plan - default
        { plan_type_id: 2, model_id: gpt4oMini.model_id },    // Pro plan - gpt4o-mini
        { plan_type_id: 2, model_id: gpt4o.model_id }         // Pro plan - gpt4o
    ];

    for (const relation of planModelRelations) {
        const exists = await dbGet(
            'SELECT 1 FROM plan_type_model WHERE plan_type_id = ? AND model_id = ?',
            [relation.plan_type_id, relation.model_id]
        );
        if (!exists) {
            console.log(`Adding plan type model relation: plan_type_id=${relation.plan_type_id}, model_id=${relation.model_id}`);
            await dbRun(
                'INSERT INTO plan_type_model (plan_type_id, model_id) VALUES (?, ?)',
                [relation.plan_type_id, relation.model_id]
            );
        }
    }
}

async function pageMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating pages if necessary...');

    // make sure every page ends with a /
    const pages = await dbAll('SELECT * FROM pages', []);
    for (const page of pages) {
        if (!page.url.endsWith('/')) {
            await dbRun('UPDATE pages SET url = ? WHERE page_id = ?', [page.url + '/', page.page_id]);
        }
    }
}

async function planMigration(dbGet, dbRun, dbAll) {
    console.log('Migrating plans for billing anchor if necessary...');

    // Add billing_anchor_day column to plans table if it doesn't exist
    if (!(await columnExists('plans', 'billing_anchor_day', dbAll))) {
        console.log('Adding billing_anchor_day column to plans table...');
        await dbRun(`ALTER TABLE plans ADD COLUMN billing_anchor_day INTEGER`);
        
        // Set the billing_anchor_day for existing plans based on their renewal date
        const plans = await dbAll('SELECT plan_id, renews_at FROM plans WHERE renews_at IS NOT NULL', []);
        for (const plan of plans) {
            const renewalDate = new Date(plan.renews_at);
            const anchorDay = renewalDate.getDate();
            await dbRun('UPDATE plans SET billing_anchor_day = ? WHERE plan_id = ?', [anchorDay, plan.plan_id]);
        }
    }
}

async function migrate(dbGet, dbRun, dbAll) {
    await modelMigration(dbGet, dbRun, dbAll);
    await chatbotMigration(dbGet, dbRun, dbAll);
    await conversationMigration(dbGet, dbRun, dbAll);
    await planTypeMigration(dbGet, dbRun, dbAll);
    await planMigration(dbGet, dbRun, dbAll);
}

module.exports = {
    migrate,
    version
};