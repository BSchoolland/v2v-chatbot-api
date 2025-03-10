const {db, dbAll} = require('../database/database.js');
const { getPageByUrlAndWebsiteId } = require('../database/pages.js');
const {getWebsiteById} = require('../database/websites.js');
const { searchFileContent, readFileContent, getFilesByChatbotId, getFilesByWebsiteId } = require('../database/files.js');
const wsManager = require('./wsManager');
// a set of tools the chatbot can use to find information for the user
tools = [
    {
        "type": "function",
        "function": {
            "name": "readPageContent",
            "description": "Reads the text content of a URL path (internal or external), use if the user asks for information that can be found on a page of the website.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The full path of the page to read, e.g. https://www.example.com/page",
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "siteWideSearch",
            "description": "Searches the entire website, external resources, and uploaded documents for specific words (exact match), returning a list of pages and files that contain those exact words. If this fails, it could be due to a small issue with phrasing. In that case, try reading page content or file content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "term": {
                        "type": "string",
                        "description": "The exact word or phrase to search for.",
                    },
                },
                "required": ["term"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "readFileContent",
            "description": "Reads the content of an uploaded file. Use this when you want to read the full content of a specific file that was found in a search.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "The name of the file to read (e.g. 'sample.pdf').",
                    },
                },
                "required": ["filename"],
            },
        },
    },
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
    // if there's no / at the end of the path, add it
    if (path[path.length - 1] !== "/") {
        path = path + "/";
    }
    console.log("path", path, 'websiteId', metadata.websiteId);
    const page = await getPageByUrlAndWebsiteId(metadata.websiteId, path);
    console.log("page", page);
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
        return message;
    }
}

async function siteWideSearch(params, metadata) {
    params = typeof params === 'string' ? JSON.parse(params) : params;
    console.log("siteWideSearch", params);

    const searchString = params.term.toLowerCase();
    if (!searchString) {
        return "Please provide a search term";
    }

    // Search website pages
    const pages = await dbAll(
        'SELECT url, content FROM page WHERE website_id = ?',
        [metadata.websiteId]
    );

    // Search uploaded files
    const files = await getFilesByWebsiteId(metadata.websiteId);
    const visibleFiles = files.filter(file => file.is_visible && file.allow_referencing && file.text_content);

    if ((!pages || pages.length === 0) && (!visibleFiles || visibleFiles.length === 0)) {
        return "No searchable content found";
    }

    const searchWords = searchString.split(/\s+/);
    
    // Rank page results
    const rankedPages = pages.map(result => {
        const content = result.content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        const contentWords = content.split(/\s+/);
        let score = 0;
        let consecutiveMatchScore = 0;

        // Calculate word match score
        searchWords.forEach(word => {
            const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
            const matches = content.match(wordRegex);
            if (matches) {
                score += matches.length * 10;
            }
        });

        // Calculate consecutive match score
        for (let i = 0; i < contentWords.length - searchWords.length + 1; i++) {
            let matchCount = 0;
            for (let j = 0; j < searchWords.length; j++) {
                if (contentWords[i + j] === searchWords[j]) {
                    matchCount++;
                } else {
                    break;
                }
            }
            if (matchCount > 1) {
                consecutiveMatchScore += matchCount * 20;
            }
        }

        return {
            type: 'page',
            url: result.url,
            score: score + consecutiveMatchScore,
            excerpt: generateSmartExcerpt(result.content, searchWords)
        };
    }).filter(result => result.score > 0);

    // Get file results using searchFileContent
    const fileResults = await searchFileContent(metadata.websiteId, searchString);
    const fileResultsArray = fileResults === "No searchable files found" || fileResults === "No matches found in any files" 
        ? [] 
        : fileResults.split("\n\n").map(res => {
            const [filename, excerpt] = res.split("]: ");
            return {
                type: 'file',
                filename: filename.slice(1),
                excerpt: excerpt,
                score: 100 // Default score for files
            };
        });

    // Combine and sort all results
    const allResults = [...rankedPages, ...fileResultsArray];
    allResults.sort((a, b) => b.score - a.score);

    // Format results string
    const resultString = allResults.slice(0, 15)
        .map(res => {
            if (res.type === 'page') {
                return `Page ${res.url}: ${res.excerpt}`;
            } else {
                return `File "${res.filename}": ${res.excerpt}`;
            }
        })
        .join("\n\n");
    console.log("resultString", resultString);
    if (resultString === '') {
        return "No matches found";
    }

    return resultString;
}

// Helper function to generate an excerpt around the first match
function generateSmartExcerpt(content, searchWords) {
    const normalizedContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const firstMatchIndex = searchWords
        .map(word => normalizedContent.indexOf(word))
        .filter(index => index !== -1)
        .sort((a, b) => a - b)[0]; // Find the earliest match

    if (firstMatchIndex !== undefined) {
        const start = Math.max(0, firstMatchIndex - 30);
        const end = Math.min(normalizedContent.length, firstMatchIndex + 70);
        const snippet = content.substring(start, end);
        return snippet.replace(/\s+/g, ' ').trim() + '...';
    }

    return content.substring(0, 100) + '...'; // Fallback if no match is found
}

async function getTools(chatbotId) {
    // TODO: allow different tools for different chatbots
    return tools;
}

// Function to broadcast tool usage to all connected clients
function broadcastToolUsage(toolName, reference, metadata) {
    if (metadata && metadata.chatId) {
        wsManager.sendToolUsage(metadata.chatId, toolName, reference);
    } else {
        console.warn('No chatId in metadata, cannot send tool usage notification:', metadata);
    }
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
                    broadcastToolUsage(toolName, reference, metadata);
                }
                break;
            case 'siteWideSearch':
                result = await siteWideSearch(params, metadata);
                const parsedParams = JSON.parse(params);
                reference = `search "${parsedParams.term}"`;
                broadcastToolUsage(toolName, reference, metadata);
                break;
            case 'readFileContent':
                const fileParams = JSON.parse(params);
                console.log(`[readFileContent tool] Attempting to read file: ${fileParams.filename}`);
                console.log(`[readFileContent tool] Context:`, {
                    chatbotId: metadata.chatbotId,
                    websiteId: metadata.websiteId,
                    userId: metadata.userId
                });
                
                try {
                    const content = await readFileContent(metadata.websiteId, fileParams.filename);
                    console.log(`[readFileContent tool] Result:`, {
                        success: content !== "File not found" && 
                                 content !== "This file is not available for reference" && 
                                 content !== "No readable content available for this file",
                        errorMessage: content.startsWith("[") ? null : content
                    });
                    result = content;
                } catch (error) {
                    console.error(`[readFileContent tool] Error:`, error);
                    result = "An error occurred while reading the file";
                }
                reference = `file "${fileParams.filename}"`;
                broadcastToolUsage(toolName, reference, metadata);
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