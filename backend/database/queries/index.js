const {
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId,
    editChatbotName,
    editChatbotSystemPrompt,
    editChatbotInitialMessage,
    editChatbotQuestions,
    editChatbotContactInfo,
    editChatbotRateLimit,
    assignWebsiteIdToChatbot,
    getSystemPrompt,
    getInitialMessage,
    getChatbotById,
    saveInitialConfig,
    resetConfig,
    editChatbotModel,
} = require('./core/chatbots');

const {
    addWebsite,
    getWebsiteById,
    getWebsiteByUrl,
    getWebsitesByLastScrapedBefore,
    setLastCrawled,
    getWebsiteByChatbotId
} = require('./core/websites.js');

const {
    addPage,
    getPagesByWebsite,
    getPageByUrlAndWebsiteId,
    deletePage,
    getPageSummariesBySiteId,
    getExternalPages,
} = require('./core/pages.js');

module.exports = {
    // chatbot queries
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId,
    editChatbotName,
    editChatbotSystemPrompt,
    editChatbotInitialMessage,
    editChatbotQuestions,
    editChatbotContactInfo,
    editChatbotRateLimit,
    assignWebsiteIdToChatbot,
    getSystemPrompt,
    getInitialMessage,
    getChatbotById,
    saveInitialConfig,
    resetConfig,
    editChatbotModel,

    // website queries
    addWebsite,
    getWebsiteById,
    getWebsiteByUrl,
    getWebsitesByLastScrapedBefore,
    setLastCrawled,
    getWebsiteByChatbotId,

    // page queries
    addPage,
    getPagesByWebsite,
    getPageByUrlAndWebsiteId,
    deletePage,
    getPageSummariesBySiteId,
    getExternalPages,
}