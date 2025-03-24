const { dbAll } = require('../../database/config/database.js');
const { getPageByUrlAndWebsiteId } = require('../../database/queries');
const { getWebsiteById } = require('../../database/queries');
const { searchFileContent, getFileByFilename, getFilesByWebsiteId } = require('../../database/queries');
const { logToolCall } = require('../../database/logging/toolCalls.js');
const wsManager = require('./wsManager.js');
const { Tools } = require('@benschoolland/ai-tools');


// read the content of a page
async function readPageContent(path, customIdentifier) {
    broadcastToolUsage("readPageContent", path, customIdentifier, `Referencing ${path}`);
    // if the path does not begin with http, add the default path
    if (!path.startsWith("http")) {
        const website = await getWebsiteById(customIdentifier.websiteId);
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
    const page = await getPageByUrlAndWebsiteId(customIdentifier.websiteId, path);
    if (page) {
        return page.content;
    } else {
        // try with www. instead
        path = path.replace("://", "://www.");
        const page = await getPageByUrlAndWebsiteId(customIdentifier.websiteId, path);
        if (page) {
            return page.content;
        }
        console.warn('No information found for path', path);

        // Get all available paths
        let paths = [];
        paths = await dbAll('SELECT url FROM page WHERE website_id = ?', [customIdentifier.websiteId]);

        // Extract URLs from the database result
        const pathUrls = paths.map(path => path.url);

        // Calculate the most similar path based on substring
        const paramsPath = path.slice(1).toLowerCase(); // Normalize for case-insensitive matching

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
            if (pathUrls[i].endsWith(path)) {
                bestMatch = pathUrls[i];
            }
        }

        // Construct the message
        const message = `You entered ${path}. Please try again using a full path (e.g. www.example.com/page instead of just /page). The system also thinks you may be interested in: ${bestMatch}`;
        return message;
    }
}

async function siteWideSearch(term, customIdentifier) {
    broadcastToolUsage("siteWideSearch", term, customIdentifier, `Searching for "${term}"`);
    const searchString = term.toLowerCase();
    if (!searchString) {
        return "Please provide a search term";
    }

    // Search website pages
    const pages = await dbAll(
        'SELECT url, content FROM page WHERE website_id = ?',
        [customIdentifier.websiteId]
    );

    // Search uploaded files
    const files = await getFilesByWebsiteId(customIdentifier.websiteId);
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
    const fileResults = await searchFileContent(customIdentifier.websiteId, searchString);
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
                return `Page ${res.url}: ${res.excerpt} (Match Score: ${res.score})`;
            } else {
                return `File "${res.filename}": ${res.excerpt} (Match Score: ${res.score})`;
            }
        })
        .join("\n\n");
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

// Read file content by filename
async function readFileContent(filename, customIdentifier) {
    broadcastToolUsage("readFileContent", filename, customIdentifier, `Reading file ${filename}`);
    const file = await getFileByFilename(customIdentifier.websiteId, filename);
    
    // check if the file exists
    if (!file) {
        return "File not found";
    }

    // check if the file is visible and allowed to be referenced
    if (!file.is_visible || !file.allow_referencing) {
        return "This file is not available for reference";
    }

    // check if the file has readable content
    if (!file.text_content) {
        return "No readable content available for this file";
    }

    // Limit content to 50,000 characters
    const maxLength = 50000;
    let content = file.text_content;
    let truncated = false;

    if (content.length > maxLength) {
        content = content.substring(0, maxLength);
        truncated = true;
    }

    // Format the content
    content = formatTextContent(content);
    
    // Add truncation notice if needed
    if (truncated) {
        content += "...\n\n[Note: This file's content has been truncated due to length. Showing first 50,000 characters.]";
    }

    return content;
}

// Helper function to format text content
function formatTextContent(content) {
    if (!content) return '';

    // Replace multiple spaces with a single space
    let formatted = content.replace(/\s+/g, ' ');

    // Fix common PDF extraction issues where words get joined
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Preserve meaningful line breaks (e.g., between paragraphs)
    formatted = formatted.replace(/\.\s+/g, '.\n\n');  // Add line break after periods
    formatted = formatted.replace(/[•●]\s*/g, '\n• '); // Format bullet points properly

    // Clean up excessive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Trim any leading/trailing whitespace
    formatted = formatted.trim();

    return formatted;
}

// Function to broadcast tool usage to all connected clients
function broadcastToolUsage(toolName, reference, customIdentifier, message) {
    if (customIdentifier && customIdentifier.chatId) {
        wsManager.sendToolUsage(customIdentifier.chatId, toolName, reference, message);
    } else {
        console.warn('No chatId in metadata, cannot send tool usage notification:', customIdentifier);
    }
}

// Create tools using @benschoolland/ai-tools format
const defaultTools = new Tools([
    {
        func: readPageContent,
        description: 'Reads the text content of a URL path (internal or external), use if the user asks for information that can be found on a page of the website.',
        parameters: {
            path: {
                type: 'string',
                description: 'The full path of the page to read, e.g. https://www.example.com/page',
            }
        },
        acceptsCustomIdentifier: true
    },
    {
        func: siteWideSearch,
        description: 'Searches the entire website, external resources, and uploaded documents for specific words (exact match), returning a list of pages and files that contain those exact words. If this fails, it could be due to a small issue with phrasing. In that case, try reading page content or file content.',
        parameters: {
            term: {
                type: 'string',
                description: 'The exact word or phrase to search for.',
            }
        },
        acceptsCustomIdentifier: true
    },
    {
        func: readFileContent,
        description: 'Reads the content of an uploaded file. Use this when you want to read the full content of a specific file that was found in a search.',
        parameters: {
            filename: {
                type: 'string',
                description: 'The name of the file to read (e.g. "example.pdf").',
            }
        },
        acceptsCustomIdentifier: true
    }
]);

module.exports = { defaultTools };