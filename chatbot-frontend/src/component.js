// Import assets
import chatbotLogo from './assets/chatbot-logo.png';
import userIcon from './assets/user.png';
import { loadDomPurify } from './js/dompurify';
import { chatbotComponent } from './js/ui';
import { chatbotId } from './js/utils';

(function() {
    let chatId = -1;

    const appendMessage = (chatbox, messageHtml, imgSrc, isUser, isError = false) => {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add(isUser ? 'user-message-container' : 'message-container');

        const messageImage = document.createElement('img');
        messageImage.src = isUser ? userIcon : chatbotLogo;
        messageImage.alt = isUser ? 'User' : 'Chatbot';
        messageImage.classList.add(isUser ? 'user-message-image' : 'message-image');

        const messageText = document.createElement('div');
        messageText.classList.add(isUser ? 'user-message-text' : (isError ? 'error-message-text' : 'message-text'));
        messageText.innerHTML = messageHtml;

        messageContainer.appendChild(messageImage);
        messageContainer.appendChild(messageText);
        chatbox.appendChild(messageContainer);

        const divider = document.createElement('hr');
        divider.classList.add('message-divider');
        chatbox.appendChild(divider);

        chatbox.scrollTop = chatbox.scrollHeight;
    };

    

    const initChatbotComponent = () => {
        loadDomPurify(); // Load dompurify to sanitize the chatbot messages

        const container = document.createElement('div');
        container.id = 'v2v-chatbot-component';
        document.body.appendChild(container);

        chatbotComponent(chatbotId);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbotComponent);
    } else {
        initChatbotComponent();
    }
})();