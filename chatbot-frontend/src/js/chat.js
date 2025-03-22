import chatbotLogo from '../assets/chatbot-logo.png';
import { getBaseUrl, chatbotId } from './utils';
import userIcon from '../assets/user.png';


const createLoadingContainer = () => {
    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('message-container', 'loading-container');
    const botImageContainer = document.createElement('div');
    botImageContainer.classList.add('bot-image-container');
    const botImage = document.createElement('img');
    botImage.src = chatbotLogo;
    botImage.alt = 'Chatbot';
    botImage.classList.add('message-image');
    botImageContainer.appendChild(botImage);
    const loadingDots = document.createElement('div');
    loadingDots.classList.add('loading-dots');
    loadingDots.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    loadingContainer.appendChild(botImageContainer);
    loadingContainer.appendChild(loadingDots);
    return loadingContainer;
};

const appendMessage = (chatbox, messageHtml, imgSrc, isUser, isError = false) => {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add(isUser ? 'user-message-container' : 'message-container');
    if (!isUser) {
        const messageImageContainer = document.createElement('div');
        messageImageContainer.classList.add('message-image-container');
        const messageImage = document.createElement('img');
        messageImage.src = chatbotLogo;
        messageImage.alt = 'Chatbot';
        messageImage.classList.add('message-image');
        messageImageContainer.appendChild(messageImage);
        messageContainer.appendChild(messageImageContainer);

    }
    const messageText = document.createElement('div');
    messageText.classList.add(isUser ? 'user-message-text' : (isError ? 'error-message-text' : 'message-text'));
    messageText.innerHTML = messageHtml;

    messageContainer.appendChild(messageText);
    chatbox.appendChild(messageContainer);

    // const divider = document.createElement('hr');
    // divider.classList.add('message-divider');
    // chatbox.appendChild(divider);

    chatbox.scrollTop = chatbox.scrollHeight;
};

const sendMessage = async (e, shadow, chatId) => {
    e.preventDefault();
    const baseUrl = getBaseUrl();
    const userInput = shadow.querySelector('.user-input');
    const chatbox = shadow.querySelector('.chatbox');
    const message = userInput.value.trim();

    if (!message) return;

    appendMessage(chatbox, message, `${baseUrl}/chatbot/api/frontend/user.png`, true);
    userInput.value = '';

    const loadingContainer = createLoadingContainer();
    chatbox.appendChild(loadingContainer);
    chatbox.scrollTop = chatbox.scrollHeight;

    try {
        const response = await fetch(`${baseUrl}/chatbot/api/chat/${chatbotId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, chatId })
        });
        const data = await response.json();

        chatbox.removeChild(loadingContainer);

        const botMessageHtml = data.message ? DOMPurify.sanitize(data.message) : data.error;
        let isError = false;
        if (!data.message) {
            console.error('Error from chatbot API:', data.error);
            isError = true;
        }
        appendMessage(chatbox, botMessageHtml, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, isError);
        
        // If chatId changed, reconnect WebSocket with new chatId
        if (chatId !== data.chatId) {
            chatId = data.chatId;
            if (ws) {
                ws.close();
            }
            connectWebSocket();
        }
    } catch (error) {
        console.error('Error sending message:', error);
        chatbox.removeChild(loadingContainer);
        appendMessage(chatbox, 'Sorry, something went wrong. Please try again later.', `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, true);
    }
};

export { sendMessage, appendMessage };