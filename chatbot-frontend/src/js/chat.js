import chatbotLogo from '../assets/chatbot-logo.png';
import { getBaseUrl, chatbotId } from './utils';
import userIcon from '../assets/user.png';



const appendMessage = (chatbox, messageHtml, imgSrc, isUser, isError = false, complete = true) => {
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
    if (!complete) {
        console.log('in progress');
        messageContainer.classList.add('v2v-chatbot-in-progress');
    }
    messageContainer.appendChild(messageText);
    chatbox.appendChild(messageContainer);

    // const divider = document.createElement('hr');
    // divider.classList.add('message-divider');
    // chatbox.appendChild(divider);

    chatbox.scrollTop = chatbox.scrollHeight;
    return messageContainer;
};

const editMessage = (messageContainer, messageHtml) => {
    const messageText = messageContainer.querySelector('.message-text');
    messageText.innerHTML = messageHtml;
}

const completeMessage = (messageContainer) => {
    messageContainer.classList.remove('v2v-chatbot-in-progress');
}

const sendMessage = async (e, shadow, chatId) => {
    e.preventDefault();
    const baseUrl = getBaseUrl();
    const userInput = shadow.querySelector('.v2v-chatbot-user-input');
    const chatbox = shadow.querySelector('.chatbox');
    const message = userInput.value.trim();

    if (!message) return;

    appendMessage(chatbox, message, `${baseUrl}/chatbot/api/frontend/user.png`, true);
    userInput.value = '';

    const chatbotMessageContainer = appendMessage(chatbox, 'Thinking ...', `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, false, false);

    try {
        const response = await fetch(`${baseUrl}/chatbot/api/chat/${chatbotId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, chatId })
        });
        const data = await response.json();


        const botMessageHtml = data.message ? DOMPurify.sanitize(data.message) : data.error;
        let isError = false;
        if (!data.message) {
            console.error('Error from chatbot API:', data.error);
            isError = true;
        }
        editMessage(chatbotMessageContainer, botMessageHtml);
        completeMessage(chatbotMessageContainer);
        
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
        appendMessage(chatbox, 'Sorry, something went wrong. Please try again later.', `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, true);
    }
};

export { sendMessage, appendMessage };