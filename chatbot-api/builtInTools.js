const {db} = require('../database/database.js');
const { getPageByUrlAndWebsiteId } = require('../database/pages.js');
const {getWebsiteById} = require('../database/websites.js');
const { wss } = require('../server.js');
const { WebSocket } = require('ws');
// a set of tools the chatbot can use to find information for the user
tools = [
    {
        "type": "function",
        "function": {
            "name": "readPageContent",
            "description": "Reads the text content of a URL path, use if the user asks for information that can be found on a page of the website.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The path to read from, for example '/' for the landing page of the website.",
                    }
                },
                "required": ["path"],
            },
        },
    },
    // {
    //     "type": "function",
    //     "function": {
    //         "name": "siteWideSearch",
    //         "description": "Searches the entire website for a specific term, returning a list of pages that contain the term.  Useful if you're not sure where the information the user is looking for might be located.",
    //         "parameters": {
    //             "type": "object",
    //             "properties": {
    //                 "term": {
    //                     "type": "string",
    //                     "description": "The term to search for.",
    //                 },
    //             },
    //             "required": ["term"],
    //         },
    //     },
    // },
]

// read the content of a page
async function readPageContent(params, metadata) {
    // convert params to json
    params = JSON.parse(params);
    let path = params.path;
    // if the path does not begin with http, add the default path
    if (!path.startsWith("http")) {
        const website = await getWebsiteById(metadata.websiteId);
        path = website.domain + path;
    }
    // if the path ends with #something, remove the #something
    if (path.includes("#")) {
        path = path.split("#")[0];
    }
    // if there's a //:www. in the path, remove it
    if (path.includes("://www.")) {
        path = path.replace("://www.", "://");
    }
    // if there's a / at the end remove it
    if (path[path.length - 1] === "/") {
        path = path.slice(0, -1);
    }
    console.log('Chatbot referenced:', path);
    const page = await getPageByUrlAndWebsiteId(metadata.websiteId, path);
    if (page) {
        return page.content;
    } else {
        // try with www. instead
        path = path.replace("://", "://www.");
        const page = await getPageByUrlAndWebsiteId(metadata.websiteId, path);
        if (page) {
            return page.content;
        }
        console.warn('No information found for path', path);
        return `No information found for path ${path}.  Are you sure you entered it correctly?`;
    }
}

// search the entire website for a term
async function siteWideSearch(params, metadata) {
    // convert params to json
    params = JSON.parse(params);
    const searchString = params.term;
    return new Promise((resolve, reject) => {
        db.all('SELECT url, content FROM page WHERE website_id = ?', [metadata.websiteId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let matchingPaths = rows
                    .filter(row => row.content.includes(searchString))
                    .map(row => row.url);
                // turn matching paths into a string
                matchingPaths = matchingPaths.join("\n");
                resolve(matchingPaths);
            }
        });
    });
}

async function getTools(chatbotId) {
    // TODO: allow different tools for different chatbots
    return tools;
}

// Function to broadcast tool usage to all connected clients
function broadcastToolUsage(toolName, reference) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'tool_usage',
                toolName,
                reference
            }));
        }
    });
}

async function useTool(toolName, params, metadata = {}) {
    let reference = '';
    
    // Determine reference based on tool type
    if (toolName === 'readPageContent') {
        const parsedParams = JSON.parse(params);
        reference = `page "${parsedParams.path}"`;
    } else if (toolName === 'siteWideSearch') {
        const parsedParams = JSON.parse(params);
        reference = `search "${parsedParams.term}"`;
    }
    
    // Broadcast tool usage before executing the tool
    if (reference) {
        broadcastToolUsage(toolName, reference);
    }
    
    // Execute the tool
    switch (toolName) {
        case 'readPageContent':
            return await readPageContent(params, metadata);
        case 'siteWideSearch':
            return await siteWideSearch(params, metadata);
        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

module.exports = {getTools, useTool};