const { editChatbotName, editChatbotSystemPrompt, editChatbotInitialMessage, editChatbotQuestions } = require('../database/chatbots');
const { getPagesByWebsite } = require('../database/pages');
const { getWebsiteById } = require('../database/websites');
const fetch = require('node-fetch');
require('dotenv').config();

// Function to make OpenAI API call with function calling
async function callOpenAI(prompt, functions) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: "gpt-4o", // use a powerful model for this one-time and important task
            messages: [
                { role: "system", content: `# You are an expert AI chatbot designer. 
                    
Your task is to analyze website content and create optimal chatbot configurations.` },
                { role: "user", content: prompt }
            ],
            functions: functions,
            function_call: { name: "configure_chatbot" }
        }),
    });
    
    const data = await response.json();
    if (!data.choices?.[0]?.message?.function_call) {
        throw new Error('No function call in response');
    }
    
    return JSON.parse(data.choices[0].message.function_call.arguments);
}

const examplePrompt = `# You are a [ideal chatbot characteristics] chatbot named [chatbot name] integrated into [website name]. 

## Your primary purpose is to assist users by:

[list of 2-3 primary purposes]

## Guidelines for Behavior:

- Never provide information that you didn't find on the site: no matter how obvious, make sure to check the site's content before answering any question.  If there are multiple places where the information could be, look at at least two of them.

- You represent [website name]: Always be professional.  Use "we" when referring to the [organization, company, website], rather than "they" and always take responsibility for any issues that may arise.

- Whenever you give the user information or guidance, ALWAYS cite the source or location on our website you used to find that information (e.g., "According to [the example page](/example), ..." or "# according to the [example section](#abc123)]).

- Always ensure links are correct: Do not link to a page you do not see on the list of pages, or users will get a 404 error.

[0-3 other guidelines as you see fit]
`

async function automateConfiguration(chatbot) {
    // Only proceed with configuration if the chatbot hasn't been configured yet
    if (!chatbot.name && !chatbot.system_prompt && !chatbot.initial_message && (!chatbot.questions || chatbot.questions === '[]')) {
        // Get website content to customize the configuration
        const website = await getWebsiteById(chatbot.website_id);
        const pages = await getPagesByWebsite(website.website_id);
        
        // Extract page information for the first 5 pages
        const pageInfo = pages
            .filter(page => page.internal)
            .slice(0, 5)
            .map(page => ({
                url: page.url,
                title: page.url.split('/').pop() || 'Home',
                summary: page.summary || '',
                content: page.content || ''
            }));

        // Create a prompt for the AI
        const prompt = `I need you to create a configuration for a website chatbot. Here's the information about the website:

Domain: ${website.domain}

Available pages:
${pageInfo.map(p => `
URL: ${p.url}
Title: ${p.title}
Summary: ${p.summary}
First 500 chars of content: ${p.content.substring(0, 500)}
`).join('\n')}

Based on this information, please create a configuration for the chatbot that includes:
1. A name that reflects the website's purpose
2. A system prompt that guides the AI to be helpful and knowledgeable about this specific website
    The system prompt should be based on the following example, with any brackets replaced with what you think is appropriate:
    [start of example prompt]
    ${examplePrompt}
    [end of example prompt]
3. An initial message that welcomes users and highlights key aspects of the website
4. 3 or 4 suggested questions that users might want to ask about the website's content

The configuration should be specific to this website's content and purpose. Use the actual content provided to make informed decisions.

`;

        // Define the function schema
        const functions = [{
            name: "configure_chatbot",
            description: "Configure a chatbot with custom settings based on website content",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The name of the chatbot"
                    },
                    system_prompt: {
                        type: "string",
                        description: "The system prompt that guides the chatbot's behavior"
                    },
                    initial_message: {
                        type: "string",
                        description: "The welcome message shown to users"
                    },
                    questions: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "List of 3-4 suggested questions"
                    }
                },
                required: ["name", "system_prompt", "initial_message", "questions"]
            }
        }];

        try {
            // Get AI-generated configuration
            console.log("Calling AI to configure chatbot");
            const config = await callOpenAI(prompt, functions);
            // to fix an occasional bug, replace any \n in the system prompt with an actual newline character
            config.system_prompt = config.system_prompt.replace(/\\n/g, '\n');
            // Update the chatbot with AI-generated values
            await editChatbotName(chatbot.chatbot_id, config.name);
            await editChatbotSystemPrompt(chatbot.chatbot_id, config.system_prompt);
            await editChatbotInitialMessage(chatbot.chatbot_id, config.initial_message);
            await editChatbotQuestions(chatbot.chatbot_id, JSON.stringify(config.questions));
            console.log("AI configuration complete");
            return true;
        } catch (error) {
            console.error('Error generating AI configuration:', error);
            // Fall back to basic configuration if AI fails
            const name = website.domain.replace(/^https?:\/\/(www\.)?/, '').split('.')[0];
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1) + " Assistant";
            
            await editChatbotName(chatbot.chatbot_id, formattedName);
            await editChatbotSystemPrompt(chatbot.chatbot_id, `You are a knowledgeable AI assistant for ${website.domain}.`);
            await editChatbotInitialMessage(chatbot.chatbot_id, `Welcome! I'm here to help you with anything related to ${website.domain}.`);
            await editChatbotQuestions(chatbot.chatbot_id, JSON.stringify(["How can I help you?"]));
            return true;
        }
    }
    return false;
}

module.exports = {
    automateConfiguration
}; 