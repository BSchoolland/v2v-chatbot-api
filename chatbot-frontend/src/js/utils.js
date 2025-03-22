const scriptTag = document.currentScript;
const chatbotId = scriptTag.getAttribute('chatbot-id') || 'no-chatbot-id-provided';

const getBaseUrl = () => {
    const defaultBaseUrl = 'http://localhost:3000';
    const scriptSrc = scriptTag && scriptTag.src ? scriptTag.src : defaultBaseUrl;
    try {
        const url = new URL(scriptSrc);
        return url.origin;
    } catch (e) {
        console.error('Failed to parse script URL:', e);
        return defaultBaseUrl;
    }
};

export { getBaseUrl, chatbotId };