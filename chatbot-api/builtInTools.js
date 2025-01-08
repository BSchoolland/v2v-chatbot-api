const {db, dbAll} = require('../database/database.js');
const { getPageByUrlAndWebsiteId } = require('../database/pages.js');
const {getWebsiteById} = require('../database/websites.js');
const wsManager = require('./wsManager');
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

function getLevenshteinDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[a.length][b.length];
}

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

        // Get all available paths
        let paths = [];
        console.log(metadata.websiteId);
        paths = await dbAll('SELECT url FROM page WHERE website_id = ?', [metadata.websiteId]);

        // Extract URLs from the database result
        const pathUrls = paths.map(path => path.url);

        // Calculate the most similar path based on substring
        const paramsPath = params.path.slice(1).toLowerCase(); // Normalize for case-insensitive matching

        // Count occurrences of the input substring in each URL
        const scores = pathUrls.map(url => ({
            url,
            count: (url.toLowerCase().match(new RegExp(paramsPath, 'g')) || []).length // Count occurrences
        }));

        // Sort paths by count (descending) and resolve ties by original order
        scores.sort((a, b) => b.count - a.count || pathUrls.indexOf(a.url) - pathUrls.indexOf(b.url));

        // Get the best match, default to the first element if all scores are 0
        let bestMatch = scores.every(score => score.count === 0) ? pathUrls[0] : scores[0].url;

        // if one path ends with the input path, return that path
        for (let i = 0; i < pathUrls.length; i++) {
            if (pathUrls[i].endsWith(params.path)) {
                bestMatch = pathUrls[i];
            }
        }

        // Construct the message
        const message = `You entered ${params.path}.  Please try again using a full path (e.g. www.example.com/page instead of just /page). The system also thinks you may be interested in: ${bestMatch}`;
        console.log(message);
        return message;
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
    wsManager.broadcastToolUsage(toolName, reference);
}

async function useTool(toolName, params, metadata = {}) {
    let reference = '';
    let result;
    
    try {
        // Execute the tool first
        switch (toolName) {
            case 'readPageContent':
                result = await readPageContent(params, metadata);
                // Only broadcast if the page was found (result doesn't contain error message)
                if (!result.includes("No information found for path")) {
                    const parsedParams = JSON.parse(params);
                    let path = parsedParams.path;
                    if (!path.startsWith("http")) {
                        const website = await getWebsiteById(metadata.websiteId);
                        path = website.domain + path;
                    }
                    reference = `page "${path}"`;
                    broadcastToolUsage(toolName, reference);
                }
                break;
            case 'siteWideSearch':
                result = await siteWideSearch(params, metadata);
                const parsedParams = JSON.parse(params);
                reference = `search "${parsedParams.term}"`;
                broadcastToolUsage(toolName, reference);
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        return result;
    } catch (error) {
        console.error(`Error using tool ${toolName}:`, error);
        throw error;
    }
}

module.exports = {getTools, useTool};