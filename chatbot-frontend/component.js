// this script will be called by any client that wants to use the chatbot component
// it will load the component.html file and inject it into the client's DOM, along with the component.css file
const scriptTag = document.currentScript;

const chatbotId = scriptTag.getAttribute('chatbot-id');


document.addEventListener('DOMContentLoaded', () => {
    // domPurify
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js';
    script.integrity = 'sha512-Ll+TuDvrWDNNRnFFIM8dOiw7Go7dsHyxRp4RutiIFW/wm3DgDmCnRZow6AqbXnCbpWu93yM1O34q+4ggzGeXVA==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    
    script.onload = () => {
        console.log('DOMPurify loaded!');
        // Use DOMPurify or execute any logic depending on the library
    };
    
    script.onerror = () => {
        console.error('Failed to load DOMPurify.');
    };
    
    document.head.appendChild(script);

    
    const container = document.createElement('div');
    container.id = 'v2v-chatbot-component-63v93w6d11sj';
    fetch('http://localhost:3000/chatbot/api/frontend/component.html')
        .then(response => response.text())
        .then(html => {
            document.body.appendChild(container);

            // load the component.css file
            fetch('http://localhost:3000/chatbot/api/frontend/component.css')
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
            const response = await fetch(`http://localhost:3000/chatbot/api/chat/${chatbotId}`, {
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