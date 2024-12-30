(function() {
    let chatId = -1;
    const scriptTag = document.currentScript;

    const chatbotId = scriptTag.getAttribute('chatbot-id') || '9c80e92f232b8542b22ec31744221aa8';

    // Determine the base URL from the script's source
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

    // Load external scripts
    const loadExternalScript = (src, integrity, crossOrigin, referrerPolicy, onLoadCallback) => {
        const script = document.createElement('script');
        script.src = src;
        if (integrity) script.integrity = integrity;
        if (crossOrigin) script.crossOrigin = crossOrigin;
        if (referrerPolicy) script.referrerPolicy = referrerPolicy;

        script.onload = onLoadCallback;
        script.onerror = () => console.error(`Failed to load script: ${src}`);

        document.head.appendChild(script);
    };

    // Initialize the chatbot component
    const initChatbotComponent = () => {
        // Load DOMPurify
        loadExternalScript(
            'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js',
            'sha512-Ll+TuDvrWDNNRnFFIM8dOiw7Go7dsHyxRp4RutiIFW/wm3DgDmCnRZow6AqbXnCbpWu93yM1O34q+4ggzGeXVA==',
            'anonymous',
            'no-referrer',
            () => console.log('DOMPurify loaded!')
        );

        // Get the base URL and create the container
        const baseUrl = getBaseUrl();
        const container = document.createElement('div');
        container.id = 'v2v-chatbot-component';
        document.body.appendChild(container);

        chatbotComponent(chatbotId);
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbotComponent);
    } else {
        initChatbotComponent();
    }

    const chatbotComponent = (chatbotId) => {
        const baseUrl = getBaseUrl();
        const container = document.getElementById('v2v-chatbot-component');
        const shadow = container.attachShadow({ mode: 'open' });

        const loadStylesAndHtml = async () => {
            try {
                // Load and append styles
                const style = document.createElement('style');
                const cssResponse = await fetch(`${baseUrl}/chatbot/api/frontend/component.css`);
                style.textContent = await cssResponse.text();
                shadow.appendChild(style);

                // Load and append HTML content
                const htmlResponse = await fetch(`${baseUrl}/chatbot/api/frontend/component.html`);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = await htmlResponse.text();
                shadow.appendChild(wrapper);

                initializeChatInterface(shadow, baseUrl);
            } catch (error) {
                console.error('Error loading styles or HTML:', error);
            }
        };

        loadStylesAndHtml();
    };

    const initializeChatInterface = (shadow, baseUrl) => {
        const chatbox = shadow.querySelector('.chatbox');

        // Add initial welcome message
        const addInitialMessage = async () => {
            try {
                const response = await fetch(`${baseUrl}/chatbot/api/initial-message/${chatbotId}`);
                const data = await response.json();
                console.log(data);
                // if no message or questions, skip
                if ((!data.message || data.message === '') && (!data.questions || data.questions.length === 0)) {
                    console.log('No initial message or questions, skipping...');
                    return;
                }
                // in case of no message, just show the questions
                let botMessageHtml = '';
                if (data.message && data.message !== '') {
                    botMessageHtml += `${data.message}<br><br>`;
                }
                // if no questions, just show the message, otherwise show the questions
                if (data.questions && data.questions.length > 0) {
                    data.questions.forEach(question => {
                        botMessageHtml += `<button class='faq-button'>${question}</button>`;
                    });
                }

                
                
                appendMessage(chatbox, botMessageHtml, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);

                // Event listeners for FAQ buttons
                shadow.querySelectorAll('.faq-button').forEach(faqButton => {
                    console.log(faqButton);
                    faqButton.addEventListener('click', (e) => {
                        userInput.value = e.target.textContent;
                        submitButton.click();
                    });
                });
            } catch (error) {
                console.error('Error fetching initial message:', error);
                // Fallback message in case of error
                const fallbackMessage = 'Hi! How can I assist you today?';
                appendMessage(chatbox, fallbackMessage, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);
            }
        };

        const appendMessage = (chatbox, messageHtml, imgSrc, isUser) => {
            const messageContainer = document.createElement('div');
            messageContainer.classList.add(isUser ? 'user-message-container' : 'message-container');

            const messageImage = document.createElement('img');
            messageImage.src = imgSrc;
            messageImage.alt = isUser ? 'User' : 'Chatbot';
            messageImage.classList.add(isUser ? 'user-message-image' : 'message-image');

            const messageText = document.createElement('div');
            messageText.classList.add(isUser ? 'user-message-text' : 'message-text');
            messageText.innerHTML = messageHtml;

            messageContainer.appendChild(messageImage);
            messageContainer.appendChild(messageText);
            chatbox.appendChild(messageContainer);

            const divider = document.createElement('hr');
            divider.classList.add('message-divider');
            chatbox.appendChild(divider);

            chatbox.scrollTop = chatbox.scrollHeight;
        };

        addInitialMessage();

        // Update selectors to use classes
        const container = shadow.querySelector('.v2v-chatbot-container');
        const button = shadow.querySelector('.v2v-chatbot-button');
        const overlay = shadow.querySelector('.overlay');
        const closeButton = shadow.querySelector('.v2v-chatbot-close');
        const submitButton = shadow.querySelector('.submit-button');
        const userInput = shadow.querySelector('.user-input');

        // Event listeners for opening and closing chat
        const toggleChatVisibility = (isVisible) => {
            container.style.display = isVisible ? 'flex' : 'none';
            button.style.display = isVisible ? 'none' : 'flex';
            overlay.style.display = isVisible ? 'block' : 'none';
        };

        button.addEventListener('click', () => toggleChatVisibility(true));
        closeButton.addEventListener('click', () => toggleChatVisibility(false));
        overlay.addEventListener('click', () => toggleChatVisibility(false));

        // Event listener for sending messages
        submitButton.addEventListener('click', (e) => sendMessage(e, shadow));

        // Set the src of images
        shadow.querySelector('.submit-button img').src = `${baseUrl}/chatbot/api/frontend/send.png`;
        shadow.querySelector('.v2v-chatbot-button-icon').src = `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`;
    };

    const sendMessage = async (e, shadow) => {
        e.preventDefault();
        const baseUrl = getBaseUrl();
        const userInput = shadow.querySelector('.user-input');
        const chatbox = shadow.querySelector('.chatbox');
        const message = userInput.value.trim();
        const currentUrl = window.location.href;

        if (!message) return;

        // Display user's message
        appendMessage(chatbox, message, `${baseUrl}/chatbot/api/frontend/user.png`, true);
        userInput.value = '';

        // Display loading animation
        const loadingContainer = createLoadingContainer(baseUrl);
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

            const botMessageHtml = data.message ? DOMPurify.sanitize(data.message) : 'error: ' + data.error;
            let isError = false;
            if (!data.message) {
                console.error('Error from chatbot API:', data.error);
                isError = true;
            }
            appendMessage(chatbox, botMessageHtml, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, isError);
            chatId = data.chatId;
        } catch (error) {
            console.error('Error sending message:', error);
            chatbox.removeChild(loadingContainer);
            appendMessage(chatbox, 'error: Sorry, something went wrong. Please try again later.', `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false, true);
        }
    };

    const appendMessage = (chatbox, messageHtml, imgSrc, isUser, isError = false) => {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add(isUser ? 'user-message-container' : 'message-container');

        const messageImage = document.createElement('img');
        messageImage.src = imgSrc;
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

    const createLoadingContainer = (baseUrl) => {
        const loadingContainer = document.createElement('div');
        loadingContainer.classList.add('message-container', 'loading-container');

        const botImage = document.createElement('img');
        botImage.src = `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`;
        botImage.alt = 'Chatbot';
        botImage.classList.add('message-image');

        const loadingDots = document.createElement('div');
        loadingDots.classList.add('loading-dots');
        loadingDots.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        loadingContainer.appendChild(botImage);
        loadingContainer.appendChild(loadingDots);
        return loadingContainer;
    };
})();