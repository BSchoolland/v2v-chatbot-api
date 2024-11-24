'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
dotenv.config();

const prompt = require("./systemPrompt.js");

class Chatbot {
  constructor() {
      this.apiKey = process.env.OPENAI_API_KEY;
      this.endpoint = "https://api.openai.com/v1/chat/completions";
      this.maxHistory = 4;
      this.model = "gpt-4o-mini";
      this.systemMessage = prompt.content;
  }

  async sendMessage(history) {
      // only include the last maxHistory messages to save tokens
      const historyLength = history.length;
      if (historyLength > this.maxHistory) {
          history = history.slice( -this.maxHistory );
      }
      // prepend the system message to the history
      history.unshift({ role: "system", content: this.systemMessage });
      
      // Send the user's message to the chatbot and receive a response
      const response = await this.getChatCompletion(history);

      // get the response from the chatbot
      const textResponse = response.choices[0].message.content;
      // Return the response
      return textResponse;
  }

  async getChatCompletion(history) {
      try {
          const response = await fetch(this.endpoint, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${this.apiKey}`,
              },
              body: JSON.stringify({
                  model: this.model,
                  messages: history,
              }),
          });

          if (!response.ok) {
              console.error(response);
              const message = `An error has occurred: ${response.status}`;
              throw new Error(message);
          }
          const data = await response.json();
          return data;
      } catch (error) {
          console.error(error);
          return {
              choices: [{ message: { content: "Oops, an error has occurred!" } }],
          };
      }
  }
}

module.exports = Chatbot;