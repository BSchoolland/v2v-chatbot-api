// this script will be called by any client that wants to use the chatbot component
// it will load the component.html file and inject it into the client's DOM, along with the component.css file
const scriptTag = document.currentScript;

let chatbotId = null;
try {
    chatbotId = scriptTag.getAttribute('chatbot-id');
} catch (e) {
    chatbotId = '9c80e92f232b8542b22ec31744221aa8';
}

// Determine the base URL from the script's source
const getBaseUrl = () => {
    let scriptSrc = null
    try {
        scriptSrc = scriptTag.src;
    } catch (e) {
        scriptSrc = 'https://chatbot.visionstovisuals.com';
    }
    // If the script is loaded from localhost, use localhost
    if (scriptSrc.includes('localhost')) {
        return 'http://localhost:3000';
    }
    // Otherwise, extract the origin from the script's source URL
    try {
        const url = new URL(scriptSrc);
        return url.origin;
    } catch (e) {
        console.error('Failed to parse script URL:', e);
        return 'http://localhost:3000'; // Fallback to localhost
    }
};

function initChatbotComponent() {
    // domPurify
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js';
    script.integrity = 'sha512-Ll+TuDvrWDNNRnFFIM8dOiw7Go7dsHyxRp4RutiIFW/wm3DgDmCnRZow6AqbXnCbpWu93yM1O34q+4ggzGeXVA==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    
    script.onload = () => {
        console.log('DOMPurify loaded!');
    };
    
    script.onerror = () => {
        console.error('Failed to load DOMPurify.');
    };
    
    document.head.appendChild(script);

    // get the base url
    const baseUrl = getBaseUrl();
    
    const container = document.createElement('div');
    container.id = 'v2v-chatbot-component';
    document.body.appendChild(container);
    
    chatbotComponent(chatbotId);
}

document.addEventListener('DOMContentLoaded', () => {
    initChatbotComponent();
});

// if the dom is already loaded, initialize the chatbot component
if (document.readyState === 'complete') {
    initChatbotComponent();
}


function chatbotComponent(chatbotId) {
    const container = document.getElementById('v2v-chatbot-component');
    const baseUrl = getBaseUrl();
    // Create a shadow root
    const shadow = container.attachShadow({ mode: 'open' });
    
    // Add styles to the shadow DOM
    const style = document.createElement('style');
    fetch(`${baseUrl}/chatbot/api/frontend/component.css`)
        .then(response => response.text())
        .then(css => {
            style.textContent = css;
            shadow.appendChild(style);
            
            // Add the HTML content to the shadow DOM
            fetch(`${baseUrl}/chatbot/api/frontend/component.html`)
                .then(response => response.text())
                .then(html => {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = html;
                    shadow.appendChild(wrapper);
                    
                    // Add initial welcome message
                    const chatbox = shadow.querySelector('.chatbox');
                    const botMessageContainer = document.createElement('div');
                    botMessageContainer.classList.add('message-container');

                    const botImage = document.createElement('img');
                    botImage.src = 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png';
                    botImage.alt = 'Chatbot';
                    botImage.classList.add('message-image');

                    const botMessage = document.createElement('div');
                    botMessage.classList.add('message-text');
                    botMessage.innerHTML = "Welcome to the Future of Work Challenge! If you have any questions about the site or need help finding information, just let me know! I'm here to assist you with anything related to the challenge, resources, or how to participate. What would you like to know?<br><br>Here are some common questions we get -<br></br><button class='faq-button'>What is the Future of Work Challenge, and how can I participate?</button><button class='faq-button'>What are the judging criteria for submissions to the challenge?</button><button class='faq-button'>When is the registration deadline for the Future of Work Challenge?</button>";

                    botMessageContainer.appendChild(botImage);
                    botMessageContainer.appendChild(botMessage);
                    chatbox.appendChild(botMessageContainer);

                    const botDivider = document.createElement('hr');
                    botDivider.classList.add('message-divider');
                    chatbox.appendChild(botDivider);

                    // Update selectors to use classes
                    const container = shadow.querySelector('.v2v-chatbot-container');
                    const button = shadow.querySelector('.v2v-chatbot-button');
                    const overlay = shadow.querySelector('.overlay');
                    const closeButton = shadow.querySelector('.v2v-chatbot-close');
                    const submitButton = shadow.querySelector('.submit-button');

                    button.addEventListener('click', () => {
                        container.style.display = 'flex';
                        button.style.display = 'none';
                        overlay.style.display = 'block';
                    });

                    closeButton.addEventListener('click', () => {
                        container.style.display = 'none';
                        button.style.display = 'flex';
                        overlay.style.display = 'none';
                    });

                    overlay.addEventListener('click', () => {
                        container.style.display = 'none';
                        button.style.display = 'flex';
                        overlay.style.display = 'none';
                    });

                    submitButton.addEventListener('click', (e) => sendMessage(e, shadow));

                    // if a button is clicked, add it's text to the input field, then automatically click the submit button
                    const faqButtons = shadow.querySelectorAll('.faq-button');
                    faqButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            const userInput = shadow.querySelector('.user-input');
                            userInput.value = e.target.textContent;
                            submitButton.click();
                        });
                    });
                });
        });
}

async function sendMessage(e, shadow) {
    e.preventDefault();
    const baseUrl = getBaseUrl();
    const userInput = shadow.querySelector('.user-input');
    const chatbox = shadow.querySelector('.chatbox');
    const message = userInput.value;

    if (message.trim() === '') return;

    // Update class names for message elements
    const userMessageContainer = document.createElement('div');
    userMessageContainer.classList.add('user-message-container');

    const userImage = document.createElement('img');
    userImage.src = `${baseUrl}/chatbot/api/frontend/user.png`;
    userImage.alt = 'User';
    userImage.classList.add('user-message-image');

    const userMessage = document.createElement('div');
    userMessage.classList.add('user-message-text');
    userMessage.textContent = message;

    userMessageContainer.appendChild(userImage);
    userMessageContainer.appendChild(userMessage);
    chatbox.appendChild(userMessageContainer);

    const divider = document.createElement('hr');
    divider.classList.add('message-divider');
    chatbox.appendChild(divider);

    // Add loading animation
    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('message-container', 'loading-container');

    const botImage = document.createElement('img');
    botImage.src = 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png'; 
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
    chatbox.appendChild(loadingContainer);

    // Scroll to the bottom of the chatbox
    chatbox.scrollTop = chatbox.scrollHeight;

    let chatId = -1;
    userInput.value = '';
    
    try {
        const response = await fetch(`${baseUrl}/chatbot/api/chat/${chatbotId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message, chatId })
        });
        console.log(response);
        const data = await response.json();
        console.log(data);
        
        // Remove loading animation
        chatbox.removeChild(loadingContainer);
        
        // Display chatbot's reply with image and divider
        const botMessageContainer = document.createElement('div');
        botMessageContainer.classList.add('message-container');

        const botReplyImage = document.createElement('img');
        botReplyImage.src = 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png'; 
        botReplyImage.alt = 'Chatbot';
        botReplyImage.classList.add('message-image');

        const botMessage = document.createElement('div');
        botMessage.classList.add('message-text');
        try {
            // Sanitize the message
            // set innerHTML to display the message as HTML
            if (!data.message) {
                botMessage.classList.add('error-message-text');
                botMessage.textContent = data.error;
            } else {
                const cleanMessage = DOMPurify.sanitize(data.message);
                botMessage.innerHTML = cleanMessage;
            }
        } catch (error) {
            console.error('Error sanitizing message:', error);
            // Fallback if sanitization fails
            if (!data.message) {
                botMessage.classList.add('error-message-text');
                botMessage.textContent = data.error;
            } else {
                botMessage.textContent = data.message;
            }
        }
        
        botMessageContainer.appendChild(botReplyImage);
        botMessageContainer.appendChild(botMessage);
        chatbox.appendChild(botMessageContainer);

        // Add divider
        const botDivider = document.createElement('hr');
        botDivider.classList.add('message-divider');
        chatbox.appendChild(botDivider);

        // set chatId
        chatId = data.chatId;
        // Scroll to the bottom of the chatbox
        chatbox.scrollTop = chatbox.scrollHeight;
    } catch (error) {
        console.error('Error:', error);
        // Remove loading animation in case of error
        chatbox.removeChild(loadingContainer);
        
        // Optionally, display an error message to the user
        const errorContainer = document.createElement('div');
        errorContainer.classList.add('message-container', 'error-message');

        const errorImage = document.createElement('img');
        errorImage.src = 'https://cdn-icons-png.flaticon.com/512/753/753345.png'; 
        errorImage.alt = 'Error';
        errorImage.classList.add('message-image');

        const errorMessage = document.createElement('div');
        errorMessage.classList.add('message-text');
        errorMessage.textContent = 'Sorry, something went wrong. Please try again later.';

        errorContainer.appendChild(errorImage);
        errorContainer.appendChild(errorMessage);
        chatbox.appendChild(errorContainer);

        // Add divider
        const errorDivider = document.createElement('hr');
        errorDivider.classList.add('message-divider');
        chatbox.appendChild(errorDivider);

        // Scroll to the bottom of the chatbox
        chatbox.scrollTop = chatbox.scrollHeight;
    }
}