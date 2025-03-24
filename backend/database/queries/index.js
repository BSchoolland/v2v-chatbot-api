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
    getChatbotModel,
    getWebsiteId
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

const {
    addFile,
    getFileById,
    getFileByFilename,
    getFilesByWebsiteId,
    updateFileVisibility,
    updateFileReferencing,
    updateFileTextContent,
    deleteFile,
    searchFileContent,
    uploadsDir
} = require('./data/files.js');

const {
    storeConversation,
    getConversationsByChatbot,
    deleteConversation,
    getConversationById
} = require('./data/conversations.js');

const {
    allocateMonthlyCredits,
    resetToFreeCredits,
    checkAndRenewCredits,
    getMonthlyCredits,
    checkAndSetWarningFlag
} = require('./billing/credits.js');

const {
    addPaymentMethod,
    getPaymentMethods,
    removePaymentMethod,
} = require('./billing/payment.js');

const {
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan,
    setChatbotIdForPlan,
    subtractFromPlan,
    getPlanFromChatbotId,
    cancelActiveSubscriptions
} = require('./billing/plans.js');

const {
    createStripeCustomer,
    getStripeCustomer,
    createSubscription,
    updateSubscription,
    addStripePaymentMethod,
    recordInvoice
} = require('./billing/stripe.js');

const {
    registerUser,
    getUserByEmail,
    getUserById,
    checkEmailExists,
    getUserByPlanId
} = require('./auth/users.js');

const {
    addModel,
    getModelById,
    getModelByName,
    getAvailableModelsForPlanType,
    isModelAvailableForPlanType,
    getDefaultModel,
    deleteModel
} = require('./config/models.js');

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
    getChatbotModel,
    getWebsiteId,
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

    // file queries
    addFile,
    getFileById,
    getFileByFilename,
    getFilesByWebsiteId,
    updateFileVisibility,
    updateFileReferencing,
    updateFileTextContent,
    deleteFile,
    searchFileContent,
    uploadsDir,

    // conversation queries
    storeConversation,
    getConversationsByChatbot,
    deleteConversation,
    getConversationById,

    // credit queries
    allocateMonthlyCredits,
    resetToFreeCredits,
    checkAndRenewCredits,
    getMonthlyCredits,
    checkAndSetWarningFlag,

    // payment queries
    addPaymentMethod,
    getPaymentMethods,
    removePaymentMethod,

    // plan queries
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan,
    setChatbotIdForPlan,
    subtractFromPlan,
    getPlanFromChatbotId,
    cancelActiveSubscriptions,

    // stripe queries
    createStripeCustomer,
    getStripeCustomer,
    createSubscription,
    updateSubscription,
    addStripePaymentMethod,
    recordInvoice,

    // user queries
    registerUser,
    getUserByEmail,
    getUserById,
    checkEmailExists,
    getUserByPlanId,

    // model queries
    addModel,
    getModelById,
    getModelByName,
    getAvailableModelsForPlanType,
    isModelAvailableForPlanType,
    getDefaultModel,
    deleteModel
}