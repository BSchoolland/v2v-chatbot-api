const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const { insertOrUpdatePage, getWebsiteByUrl, insertWebsite } = require('./database.js')

// catch all uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

class webPageData {
    constructor(url, title, description, content) {
        this.url = url;
        this.title = title;
        this.description = description;
        this.content = content;
    }
}

class WebScraper {
    constructor(startUrl, maxDepth = 2) {
        this.startUrl = startUrl;
        this.maxDepth = maxDepth;
        this.browser = null;
        this.page = null;
        this.visitedUrls = new Set();
        // TODO add more stuff
        this.ready = false;
        this.verbose = true;
    }
    async init() {
        this.browser = await puppeteer.launch(
            {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            }
        );
        this.page = await this.browser.newPage();

        // Enable request interception to block unnecessary resources
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort(); // Abort loading these resource types
            } else {
                req.continue(); // Allow other requests
            }
        });

        this.ready = true;
    }
    async getPageContent(pageUrl) {
        if (!this.ready) {
            await this.init();
        }
        try {
            await this.page.goto(pageUrl, { timeout: 120000 });
            const content = await this.page.content();
            return content;
        } catch (error) {
            console.error('Error getting page content:', error);
            return '';
        }
    }

    async getAllPageUrls(pageUrl) {
        const queue = [{ url: pageUrl, depth: 0 }];
        let totalCompleted = 0;
        let totalStartTime = Date.now();
        const urlContentMap = new Map(); // Store URL and its content
    
        while (queue.length > 0) {
            const { url, depth } = queue.shift();
            if (depth >= this.maxDepth) continue; // Skip if beyond max depth
    
            totalCompleted++;
    
            const startTime = Date.now();
            let uniqueLinks = [];
            let pageContent = '';
    
            try {
                // Fetch the page content and links
                pageContent = await this.getPageContent(url);
                uniqueLinks = await this.getUniqueLinks(pageContent);
            } catch (error) {
                console.error(`Failed to fetch content or links from URL: ${url}`);
                console.error(`Error: ${error.message}`);
                console.error(error.stack);
                continue; // Skip this page and move on
            }
            // get the shortened HTML
            pageContent = await this.getCleanHtmlContent(pageContent, ['href']);
            // Store the page content in the map
            urlContentMap.set(url, pageContent);
    
            try {
                // Filter for internal links only
                let internalLinks = uniqueLinks.filter(link => link.startsWith(this.startUrl));
                // Filter out pages with file extensions like .pdf, .jpg, etc.
                internalLinks = internalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
                // Filter out already visited links adding to queue
                const newLinks = internalLinks.filter(link => !this.visitedUrls.has(link));
    
                const endTime = Date.now();
                if (this.verbose) {
                    console.log(`\n\n--- Processing URL: ${url} ---`);
                    console.log(`Depth: ${depth}`);
                    console.log(`Unique Links Found: ${uniqueLinks.length}`);
                    console.log(`New Links Added: ${newLinks.length}`);
                    console.log(`Queue Size: ${queue.length}`);
                    console.log(`Total Completed: ${totalCompleted}`);
                    console.log(`Time Taken: ${(endTime - startTime) / 1000} seconds`);
                }
    
                // Add new links to the queue and mark them as visited
                for (let link of newLinks) {
                    this.visitedUrls.add(link); // Mark as visited immediately
                    queue.push({ url: link, depth: depth + 1 });
                }
            } catch (error) {
                console.error(`Error processing links for URL: ${url}`);
                console.error(`Error: ${error.message}`);
                console.error(error.stack);
                continue; // Skip problematic link processing and move on
            }
        }
    
        // Add trailing slashes to all URLs
        this.visitedUrls = new Set(Array.from(this.visitedUrls).map(url => url.endsWith('/') ? url : url + '/'));
        let totalEndTime = Date.now();
    
        if (this.verbose) {
            console.log('\n--- Scraping Complete ---');
            console.log(`\nTotal Time Taken: ${(totalEndTime - totalStartTime) / 1000} seconds`);
            console.log(`Total URLs Visited: ${this.visitedUrls.size}`);
        }
    
        // Return the map with URLs and their content
        return urlContentMap;
    }
    
    
    

    // AI: this function was generated by AI
    async getUniqueLinks(pageContent) {
        let content = pageContent;
        // strip any style or linked style sheets
        content = content.replace(/<style.*?>.*?<\/style>/gs, '');
        content = content.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
        // create a DOM from the content
        const dom = new JSDOM(content);
        const { document } = dom.window;
    
        // Use a Set to ensure uniqueness
        const uniqueLinks = new Set();
    
        // Select all anchor tags
        const links = document.querySelectorAll('a');
    
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            // Basic filtering
            if (href && href.trim() !== '') {
                // Normalize the URL and remove hash fragment
                try {
                    // Clean the URL
                    const cleanUrl = this.cleanUrl(href);
                    uniqueLinks.add(cleanUrl);
                } catch (error) {
                    console.error(error);
                    // Ignore invalid URLs
                    console.warn(`Invalid URL: ${href}`);
                }
            }
        });
    
        // Convert Set to Array and return
        return Array.from(uniqueLinks);
    }

    cleanUrl(url) {
        // if it's a relative URL, convert to absolute
        if (!url.startsWith('http')) {
            url = new URL(url, this.startUrl).toString();
        }
        // strip hash fragments
        let urlObj = new URL(url);
        let cleanedUrl = urlObj.origin + urlObj.pathname + urlObj.search;
        // remove trailing slash
        if (cleanedUrl.endsWith('/')) {
            cleanedUrl = cleanedUrl.slice(0, -1);
        }
        // replace ://www with ://
        cleanedUrl = cleanedUrl.replace('://www.', '://');
        // remove any query parameters
        cleanedUrl = cleanedUrl.split('?')[0];
        // return the cleaned URL as a regular string
        return cleanedUrl;
    }

    // AI: this function was generated by AI
    async getCleanHtmlContent(content, keepAttributes = []) {
        if (!this.ready) {
            await this.init();
        }
    
        const dom = new JSDOM(content);
        const { document, Node } = dom.window; // Define Node for easier reference
    
        // Remove scripts, styles, and comments
        document.querySelectorAll('script, style').forEach(el => el.remove());
        document.querySelectorAll('comment').forEach(comment => comment.remove());
    
        function cleanNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                return text ? text : null; // Return text if it's not empty
            }
    
            if (node.nodeType === Node.ELEMENT_NODE) {
                const childNodes = [];
                for (const childNode of node.childNodes) {
                    const cleanedChild = cleanNode(childNode);
                    if (cleanedChild) {
                        childNodes.push(cleanedChild);
                    }
                }
    
                if (childNodes.length === 0) {
                    return null;
                }
    
                if (childNodes.length === 1 && typeof childNodes[0] !== 'string') {
                    return childNodes[0];
                }
    
                const cleanElement = document.createElement(node.tagName.toLowerCase());
                for (const attr of keepAttributes) {
                    if (node.hasAttribute(attr)) {
                        cleanElement.setAttribute(attr, node.getAttribute(attr));
                    }
                }
    
                for (const child of childNodes) {
                    if (typeof child === 'string') {
                        cleanElement.appendChild(document.createTextNode(child));
                    } else {
                        cleanElement.appendChild(child);
                    }
                }
    
                return cleanElement;
            }
    
            return null; // Ignore other types of nodes
        }
    
        function formatHTML(node, indentLevel = 0) {
            const indent = '  '.repeat(indentLevel);
            if (node.nodeType === Node.TEXT_NODE) {
                return `${indent}${node.textContent.trim()}\n`;
            }
    
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                let formatted = `${indent}<${tagName}`;
    
                for (const attr of node.attributes) {
                    formatted += ` ${attr.name}="${attr.value}"`;
                }
    
                formatted += '>\n';
    
                for (const child of node.childNodes) {
                    formatted += formatHTML(child, indentLevel + 1);
                }
    
                formatted += `${indent}</${tagName}>\n`;
                return formatted;
            }
    
            return '';
        }
    
        const cleanBody = cleanNode(dom.window.document.body);
        return cleanBody ? formatHTML(cleanBody).trim() : '';
    }

}

(async () => {
    const url = 'https://outsideopen.com';
    // create or identify the website in the database
    let website = await getWebsiteByUrl(url);
    if (!website) {
        console.log('Website does not exist in the database. Inserting...');
        await insertWebsite(url);
        website = await getWebsiteByUrl(url);
    }
    // scrape the website to find all pages
    console.log('Website exists in the database.');
    const scraper = new WebScraper(url, 7);
    await scraper.init();
    const result = await scraper.getAllPageUrls(url);
    await scraper.browser.close();
    // store each page in the database or overwrite if it already exists
    for (let [pageUrl, content] of result.entries()) {
        // if it doesn't end in a slash, add one (I don't know why this is still necessary, but this fixes the problem)
        if (!pageUrl.endsWith('/')) {
            pageUrl += '/';
        }
        console.log(`Processing page: ${pageUrl}`);
        // create a new page object
        const pageData = new webPageData(pageUrl, '', '', content);
        // insert or update the page in the database
        insertOrUpdatePage(website.id, pageData.url, pageData.content);
    }

})();