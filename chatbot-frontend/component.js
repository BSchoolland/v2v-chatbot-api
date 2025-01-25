(function() {
    let chatId = -1;
    const scriptTag = document.currentScript;
    const chatbotId = scriptTag.getAttribute('chatbot-id') || '9c80e92f232b8542b22ec31744221aa8';

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

    const sendMessage = async (e, shadow) => {
        e.preventDefault();
        const baseUrl = getBaseUrl();
        const userInput = shadow.querySelector('.user-input');
        const chatbox = shadow.querySelector('.chatbox');
        const message = userInput.value.trim();

        if (!message) return;

        appendMessage(chatbox, message, `${baseUrl}/chatbot/api/frontend/user.png`, true);
        userInput.value = '';

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

    const initializeChatInterface = async (shadow, baseUrl) => {
        const chatbox = shadow.querySelector('.chatbox');
        let ws = null;

        // Get initial chat ID
        try {
            const response = await fetch(`${baseUrl}/chatbot/api/init-chat`);
            const data = await response.json();
            chatId = data.chatId;
        } catch (error) {
            console.error('Error initializing chat:', error);
        }

        /**
         * Establishes and manages WebSocket connection for real-time updates
         * Handles connection events, tool usage notifications, and automatic reconnection
         */
        const connectWebSocket = () => {
            const wsUrl = new URL(`${baseUrl.replace('http', 'ws')}/chatbot/api/ws`);
            wsUrl.searchParams.set('chatId', chatId);
            ws = new WebSocket(wsUrl.toString());
            
            ws.onopen = () => {
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'tool_usage' && data.chatId === chatId) {
                    appendToolUsageIndicator(chatbox, data.toolName, data.reference);
                } else if (data.type === 'connection_status') {
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                // Attempt to reconnect after a delay
                setTimeout(connectWebSocket, 3000);
            };
        };

        // Connect to WebSocket server
        connectWebSocket();

        /**
         * Creates a visual indicator for tool usage events
         */
        const createToolUsageIndicator = (toolName, reference) => {
            const indicator = document.createElement('div');
            indicator.className = 'tool-usage-indicator';
            indicator.innerHTML = `Chatbot referenced <code>${reference}</code>`;
            return indicator;
        };

        /**
         * Appends a tool usage indicator to the chatbox and scrolls to it
         */
        const appendToolUsageIndicator = (chatbox, toolName, reference) => {
            const indicator = createToolUsageIndicator(toolName, reference);
            chatbox.appendChild(indicator);
            chatbox.scrollTop = chatbox.scrollHeight;
        };

        const addInitialMessage = async () => {
            try {
                const response = await fetch(`${baseUrl}/chatbot/api/initial-message/${chatbotId}`);
                const data = await response.json();
                
                if ((!data.message || data.message === '') && (!data.questions || data.questions.length === 0)) {
                    return;
                }
                let botMessageHtml = '';
                if (data.message && data.message !== '') {
                    botMessageHtml += `${data.message}<br><br>`;
                }
                if (data.questions && data.questions.length > 0) {
                    data.questions.forEach(question => {
                        botMessageHtml += `<button class='faq-button'>${question}</button>`;
                    });
                }

                appendMessage(chatbox, botMessageHtml, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);

                shadow.querySelectorAll('.faq-button').forEach(faqButton => {
                    faqButton.addEventListener('click', (e) => {
                        userInput.value = e.target.textContent;
                        submitButton.click();
                    });
                });
            } catch (error) {
                console.error('Error fetching initial message:', error);
                const fallbackMessage = 'Hi! How can I assist you today?';
                appendMessage(chatbox, fallbackMessage, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);
            }
        };

        addInitialMessage();

        const container = shadow.querySelector('.v2v-chatbot-container');
        const button = shadow.querySelector('.v2v-chatbot-button');
        const overlay = shadow.querySelector('.overlay');
        const closeButton = shadow.querySelector('.v2v-chatbot-close');
        const submitButton = shadow.querySelector('.submit-button');
        const userInput = shadow.querySelector('.user-input');

        const toggleChatVisibility = (isVisible) => {
            container.style.display = isVisible ? 'flex' : 'none';
            button.style.display = isVisible ? 'none' : 'flex';
            overlay.style.display = isVisible ? 'block' : 'none';
            
            // Prevent body scroll when chat is open on mobile
            if (window.innerWidth <= 768) {
                document.body.style.overflow = isVisible ? 'hidden' : '';
            }
        };

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                document.body.style.overflow = '';
            } else if (container.style.display === 'flex') {
                document.body.style.overflow = 'hidden';
            }
        });

        // Handle keyboard navigation
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleChatVisibility(true);
            }
        });

        // Ensure chat is properly sized on mobile orientation change
        window.addEventListener('orientationchange', () => {
            if (container.style.display === 'flex') {
                setTimeout(() => {
                    container.style.height = `${window.innerHeight}px`;
                }, 100);
            }
        });

        button.addEventListener('click', () => toggleChatVisibility(true));
        closeButton.addEventListener('click', () => toggleChatVisibility(false));
        overlay.addEventListener('click', () => toggleChatVisibility(false));

        // Add contact button handler
        const contactButton = shadow.querySelector('.v2v-chatbot-contact');

        // Check if contact info exists and show button if it does
        const checkContactInfo = async () => {
            try {
                const response = await fetch(`${baseUrl}/chatbot/api/contact-info/${chatbotId}`);
                const data = await response.json();
                
                if (data.contact_info && data.contact_info.trim() !== '') {
                    contactButton.style.display = 'block';
                    contactButton.href = data.contact_info;
                    
                    // Only add target="_blank" for http(s) links
                    if (data.contact_info.startsWith('http')) {
                        contactButton.setAttribute('target', '_blank');
                        contactButton.textContent = 'Talk to a human';
                    } else if (data.contact_info.startsWith('mailto:')) {
                        contactButton.removeAttribute('target');
                        const email = data.contact_info.replace('mailto:', '');
                        contactButton.textContent = "Contact us at: " + email;
                    } else {
                        contactButton.removeAttribute('target');
                        contactButton.textContent = data.contact_info;
                    }
                }
            } catch (error) {
                console.error('Error fetching contact info:', error);
            }
        };

        checkContactInfo();

        submitButton.addEventListener('click', (e) => sendMessage(e, shadow));

        shadow.querySelector('.submit-button img').src = `${baseUrl}/chatbot/api/frontend/send.png`;
        shadow.querySelector('.v2v-chatbot-button-icon').src = `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`;

        // Add touch event handling for better mobile experience
        let touchStartY = 0;
        let touchEndY = 0;
        
        container.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
            const diff = touchStartY - touchEndY;
            
            // If user is scrolling up and chatbox is at top, prevent pull-to-refresh
            if (diff < 0 && chatbox.scrollTop === 0) {
                e.preventDefault();
            }
        }, { passive: false });

        // Improve input handling on mobile
        userInput.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 300);
            }
        });
    };

    const chatbotComponent = (chatbotId) => {
        const baseUrl = getBaseUrl();
        const container = document.getElementById('v2v-chatbot-component');
        const shadow = container.attachShadow({ mode: 'open' });

        const loadStylesAndHtml = async () => {
            try {
                const style = document.createElement('style');
                const cssResponse = await fetch(`${baseUrl}/chatbot/api/frontend/component.css`);
                style.textContent = await cssResponse.text();
                shadow.appendChild(style);

                const htmlResponse = await fetch(`${baseUrl}/chatbot/api/frontend/component.html`);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = await htmlResponse.text();
                shadow.appendChild(wrapper);

                await initializeChatInterface(shadow, baseUrl);
            } catch (error) {
                console.error('Error loading styles or HTML:', error);
            }
        };

        loadStylesAndHtml();
    };

    const initChatbotComponent = () => {
        loadExternalScript(
            'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js',
            'sha512-Ll+TuDvrWDNNRnFFIM8dOiw7Go7dsHyxRp4RutiIFW/wm3DgDmCnRZow6AqbXnCbpWu93yM1O34q+4ggzGeXVA==',
            'anonymous',
            'no-referrer'
        );

        const baseUrl = getBaseUrl();
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