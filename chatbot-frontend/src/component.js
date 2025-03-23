// Import assets
import { loadDomPurify } from './js/dompurify';
import { chatbotComponent } from './js/ui';
import { chatbotId } from './js/utils';

(function() {
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