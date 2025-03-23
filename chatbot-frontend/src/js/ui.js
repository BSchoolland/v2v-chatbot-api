import cssContent from '../css/component.css';
import htmlTemplate from '../html/component.html';
import chatbotLogo from '../assets/chatbot-logo.png';
import closeIcon from '../assets/close.svg';
import sendIcon from '../assets/send.png';
import { getBaseUrl, chatbotId } from './utils';
import { sendMessage, appendMessage } from './chat';

const initializeChatInterface = async (shadow, baseUrl) => {
    const chatbox = shadow.querySelector('.chatbox');
    let ws = null;
    let chatId = -1;

    // Get initial chat ID
    try {
        const response = await fetch(`${baseUrl}/chatbot/api/init-chat`);
        const data = await response.json();
        chatId = data.chatId;
    } catch (error) {
        // TODO: display error message or try again
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
                const inProgressMessage = chatbox.querySelector('.v2v-chatbot-in-progress .message-text');
                if (inProgressMessage) {
                    inProgressMessage.innerHTML = data.toolMessage;
                }
            } else if (data.type === 'connection_status') {
            }
        };

        ws.onerror = (error) => {
            // TODO: display error message
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
            

            appendMessage(chatbox, botMessageHtml, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);
            // add FAQ buttons
            const faqSection = document.createElement('div');
            faqSection.classList.add('v2v-chatbot-faq-section');
            // sort questions by length
            const sortedQuestions = data.questions.sort((a, b) => a.length - b.length);
            if (sortedQuestions && sortedQuestions.length > 0) {
                sortedQuestions.forEach(question => {
                    const faqButton = document.createElement('button');
                    faqButton.classList.add('v2v-chatbot-faq-button');
                    faqButton.textContent = question;
                    faqSection.appendChild(faqButton);
                });
            }
            chatbox.appendChild(faqSection);
            
            // When a FAQ button is clicked, ask the question
            shadow.querySelectorAll('.v2v-chatbot-faq-button').forEach(faqButton => {
                faqButton.addEventListener('click', (e) => {
                    userInput.value = e.target.textContent;
                    submitButton.click();
                });
            });
        } catch (error) {
            // TODO: determine if fallback is acceptable
            const fallbackMessage = 'Hi! How can I assist you today?';
            appendMessage(chatbox, fallbackMessage, `${baseUrl}/chatbot/api/frontend/chatbot-logo.png`, false);
        }
    };

    addInitialMessage();

    const container = shadow.querySelector('.v2v-chatbot-container');
    const button = shadow.querySelector('.v2v-chatbot-button');
    const overlay = shadow.querySelector('.overlay');
    const closeButton = shadow.querySelector('.v2v-chatbot-button-close');
    const submitButton = shadow.querySelector('.v2v-chatbot-submit-button');
    const userInput = shadow.querySelector('.v2v-chatbot-user-input');

    const toggleChatVisibility = (isVisible) => {
        container.style.display = isVisible ? 'flex' : 'none';
        button.style.display = isVisible ? 'none' : 'flex';
        overlay.style.display = isVisible ? 'block' : 'none';
        closeButton.style.display = isVisible ? 'flex' : 'none';
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
            // TODO: display error message
        }
    };

    checkContactInfo();

    submitButton.addEventListener('click', (e) => sendMessage(e, shadow, chatId));

    shadow.querySelector('.v2v-chatbot-submit-button img').src = sendIcon;

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

    // Create and append style element with the raw CSS content
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(cssContent);
    shadow.adoptedStyleSheets = [styleSheet];

    // Create and append HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlTemplate;
    shadow.appendChild(wrapper);

    // Update image sources
    shadow.querySelector('.v2v-chatbot-submit-button img').src = sendIcon;
    shadow.querySelector('.v2v-chatbot-button-close-icon').src = closeIcon;
    shadow.querySelectorAll('.v2v-chatbot-button-icon').forEach(icon => {
        icon.src = chatbotLogo;
    });

    initializeChatInterface(shadow, baseUrl);
};


export { chatbotComponent };