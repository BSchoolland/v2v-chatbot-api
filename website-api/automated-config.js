const { editChatbotName, editChatbotSystemPrompt, editChatbotInitialMessage, editChatbotQuestions } = require('../database/chatbots');
const { getPagesByWebsite } = require('../database/pages');
const { getWebsiteById } = require('../database/websites');

async function automateConfiguration(chatbot) {
    // Only proceed with configuration if the chatbot hasn't been configured yet
    if (!chatbot.name && !chatbot.system_prompt && !chatbot.initial_message && (!chatbot.questions || chatbot.questions === '[]')) {
        // Get website content to customize the configuration
        const website = await getWebsiteById(chatbot.website_id);
        const pages = await getPagesByWebsite(website.website_id);
        
        // Extract page titles and content for analysis
        const pageInfo = pages
            .filter(page => page.internal)
            .map(page => ({
                url: page.url,
                title: page.url.split('/').pop() || 'Home',
                summary: page.summary || '',
                content: page.content || ''
            }));

        // Set name based on website domain
        const name = website.domain.replace(/^https?:\/\/(www\.)?/, '').split('.')[0];
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1) + " Assistant";

        // Create a more focused system prompt using website information
        const systemPrompt = `You are a knowledgeable AI assistant for ${website.domain}. Your role is to:
1. Provide accurate information about our website's content and services
2. Help users navigate to the right pages and resources
3. Answer questions based on our website's actual content
4. Be friendly and professional while maintaining the website's tone
5. Admit when information isn't available and suggest contacting support`;

        // Create an initial message that mentions key pages/sections
        const initialMessage = `Welcome! I'm here to help you with anything related to ${website.domain}. I can assist you with:
${pageInfo.slice(0, 3).map(p => `- Information about ${p.title.replace(/-/g, ' ')}`).join('\n')}
What would you like to know?`;

        // Generate suggested questions based on page content
        const suggestedQuestions = [
            `What can I find on ${pageInfo[0]?.title.replace(/-/g, ' ') || 'the homepage'}?`,
            "How can I contact support?",
            pageInfo.length > 1 ? `Tell me about ${pageInfo[1]?.title.replace(/-/g, ' ')}` : "What services do you offer?"
        ];

        // Update the chatbot with customized values
        await editChatbotName(chatbot.chatbot_id, formattedName);
        await editChatbotSystemPrompt(chatbot.chatbot_id, systemPrompt);
        await editChatbotInitialMessage(chatbot.chatbot_id, initialMessage);
        await editChatbotQuestions(chatbot.chatbot_id, JSON.stringify(suggestedQuestions));
        return true;
    }
    return false;
}

module.exports = {
    automateConfiguration
}; 