'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const {tools, readPageContent, siteWideSearch} = require("./tools.js");
const { getWebsiteByUrl, getUrlsByWebsiteId, getPageByUrl} = require('./database.js');
dotenv.config();

const prompt = require("./systemPrompt.js");

class Chatbot {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.endpoint = "https://api.openai.com/v1/chat/completions";
        this.maxHistory = 16;
        this.model = "gpt-4o-mini";
        this.systemMessage = prompt.content // TODO: load prompt from a database
        this.tools = tools;
    }
    // function that gives the AI relevant info 
    async init() {
        // get all urls related to this site
        let baseUrl = 'https://solvecc.org'
        let website = await getWebsiteByUrl(baseUrl);
        let websiteId = website.id;
        let urls = await getUrlsByWebsiteId(websiteId);

        let allPages = [];
        for (let i = 0; i < urls.length; i++) {
            let url = urls[i];
            // TODO: make this more efficient by only fetching summaries, not the full page
            let page = await getPageByUrl(url);
            allPages.push(page);
        }
        // add the urls to the system message
        this.systemMessage += "\nHere are all the resources you have access to on this site: \n"
        for (let i = 0; i < allPages.length; i++) {
            let page = allPages[i];
            this.systemMessage += page.url;
            if (page.summary) {
            this.systemMessage += "   notes: " + page.summary;
            }
            this.systemMessage += "\n";
        }
        console.log(this.systemMessage);
    }

    async sendMessage(history) {
        let toolCall = true;
        let textResponse;
        while (toolCall) {
            toolCall = false;
            // only include the last maxHistory messages to save tokens
            const historyLength = history.length;
            if (historyLength > this.maxHistory) {
                history = history.slice(-this.maxHistory);
                // while the first message is a tool response, remove it
                while (history[0].role === "tool") {
                    history.shift();
                }
            }
            // prepend the system message to the history if it's not already there
            if (history[0].role !== "system") {
                history.unshift({ role: "system", content: this.systemMessage });
            }
            // Send the user's message to the chatbot and receive a response
            const response = await this.getChatCompletion(history);
            console.log(response.usage);

            // get the response from the chatbot
            textResponse = response.choices[0].message.content;
            // get tool calls from the response
            let tool_calls = response.choices[0].message.tool_calls;
            // if there are tool calls, set toolCall to false
            if (!tool_calls) {
                history.push({ role: "assistant", content: textResponse });
                toolCall = false;
            } else {
                history.push({ role: "assistant", content: textResponse, tool_calls: tool_calls });
                toolCall = true;
                for (let i = 0; i < tool_calls.length; i++) {
                    let tool_call = tool_calls[i]
                    let function_name = tool_call.function.name
                    let tool_result = "Sorry, this tool is not yet implemented."
                    if (function_name === "readPageContent") {
                        tool_result = await readPageContent(tool_call.function.arguments)
                    } else if (function_name === "siteWideSearch") {
                        tool_result = await siteWideSearch(tool_call.function.arguments)
                    }
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