// this script will be called by any client that wants to use the chatbot component
// it will load the component.html file and inject it into the client's DOM, along with the component.css file
const scriptTag = document.currentScript;

const chatbotId = scriptTag.getAttribute('chatbot-id');

// Determine the base URL from the script's source
const getBaseUrl = () => {
    const scriptSrc = scriptTag.src;
    console.log(scriptSrc);
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

document.addEventListener('DOMContentLoaded', () => {
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
    container.id = 'v2v-chatbot-component-63v93w6d11sj';
    fetch(`${baseUrl}/chatbot/api/frontend/component.html`)
        .then(response => response.text())
        .then(html => {
            document.body.appendChild(container);

            // load the component.css file
            fetch(`${baseUrl}/chatbot/api/frontend/component.css`)
                .then(response => response.text())
                .then(css => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    document.head.appendChild(style);

                    // inject the html into the container
                    container.innerHTML = html;

                    chatbotComponent(chatbotId);
                });
        });
});



function chatbotComponent(chatbotId) {

    const baseUrl = getBaseUrl();
    console.log("connected to chatbot:", chatbotId);
    let chatId = -1;
    async function sendMessage() {
        const userInput = document.getElementById('userInput-63v93w6d11sj');
        const chatbox = document.getElementById('chatbox-63v93w6d11sj');
        const message = userInput.value;

        if (message.trim() === '') return;

        // Display user's message
        const userMessage = document.createElement('div');
        userMessage.textContent = 'You: ' + message;
        chatbox.appendChild(userMessage);

        // Clear input field
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
            // Display chatbot's reply
            const botMessage = document.createElement('div');
            try {
                // Sanitize the message
                const cleanMessage = DOMPurify.sanitize(data.message);
                // set innerHTML to display the message as HTML
                botMessage.innerHTML = 'Chatbot: ' + cleanMessage;
            } catch (error) {
                console.error('Error sanitizing message:', error);
                // TODO: determine if this slightly less secure method is acceptable
                botMessage.innerHTML = 'Chatbot: ' + data.message;
            }
            
            // set chatId
            chatId = data.chatId;
            chatbox.appendChild(botMessage);

            // Scroll to the bottom of the chatbox
            chatbox.scrollTop = chatbox.scrollHeight;
        } catch (error) {
            console.error('Error:', error);
        }
    }
    // when the submit button is clicked, send the message
    const submitButton = document.getElementById('submitButton-63v93w6d11sj');
    submitButton.addEventListener('click', sendMessage);
}