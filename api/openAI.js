'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const tools = require("./tools.js");
const readPageContent = require("./readPageContent.js")
dotenv.config();

const prompt = require("./systemPrompt.js");

class Chatbot {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.endpoint = "https://api.openai.com/v1/chat/completions";
        this.maxHistory = 4;
        this.model = "gpt-4o-mini";
        this.systemMessage = prompt.content;
        this.tools = tools;
    }

    async sendMessage(history) {
        console.log("sendMessage")
        let toolCall = true;
        let textResponse;
        while (toolCall) {
            toolCall = false;
            console.log('messaging openAI');
            // only include the last maxHistory messages to save tokens
            const historyLength = history.length;
            if (historyLength > this.maxHistory) {
                history = history.slice(-this.maxHistory);
            }
            // prepend the system message to the history if it's not already there
            if (history[0].role !== "system") {
                history.unshift({ role: "system", content: this.systemMessage });
            }
            // Send the user's message to the chatbot and receive a response
            const response = await this.getChatCompletion(history);
            // get the response from the chatbot
            textResponse = response.choices[0].message.content;
            // get tool calls from the response
            let tool_calls = response.choices[0].message.tool_calls
            // if there are tool calls, set toolCall to false
            if (!tool_calls) {
                history.push({ role: "assistant", content: textResponse });
                toolCall = false;
            } else {
                console.log("tool_calls", tool_calls)
                history.push({ role: "assistant", content: textResponse, tool_calls: tool_calls });
                toolCall = true;
                console.log("tool_calls", tool_calls)
                for (let i = 0; i < tool_calls.length; i++) {
                    let tool_call = tool_calls[i]
                    let function_name = tool_call.function.name
                    let tool_result = "Tool not defined"
                    if (function_name === "readPageContent") {
                        tool_result = await readPageContent(tool_call.function.arguments)
                    }
                    console.log(tool_result)
                    history.push({ tool_call_id: tool_call.id, role: "tool", name: function_name, content: tool_result })
                }
            }
        }
        // Return the response
        return history;
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
                    tools: this.tools
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