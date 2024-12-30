const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const { insertOrUpdatePage, getWebsiteByUrl, insertWebsite } = require('./database.js')
const summarizePage = require('./summarizeContent.js');
const url = require("./url.js");
// catch all uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

class WebScraper {
    constructor(startUrl, maxDepth = 2) {
        this.startUrl = startUrl;
        this.maxDepth = maxDepth;
        this.browser = null;
        this.page = null;
        this.visitedUrls = new Set();
        this.ready = false;
        this.verbose = true;
    }
    async init() {
        this.browser = await puppeteer.launch(
            {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                ignoreHTTPSErrors: true, // Ignore HTTPS errors (rare but some clients may have issues with SSL and we don't want to stop the process)
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
            await this.page.goto(pageUrl, { timeout: 30000, waitUntil: 'networkidle0' });
            const content = await this.page.content();
            return content;
        } catch (error) {
            console.error('Error fetching page content:', error.message);
            try {
                await this.page.goto(pageUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
                return await this.page.content();
            } catch (error) {
                console.error('Error fetching page content:', error.message);
                return '';
            }
        }
    }

    async getAllPageUrls(pageUrl, manuallyAddedPages = []) {
        const queue = [{ url: pageUrl, depth: 0 }, ...manuallyAddedPages];
        let totalCompleted = 0;
        let totalStartTime = Date.now();
        const urlContentMap = new Map();
        const allExternalLinks = new Set();
        
        while (queue.length > 0) {
            const { url, depth } = queue.shift();
            if (depth >= this.maxDepth) continue;
    
            totalCompleted++;
            let uniqueLinks = [];
            let pageContent = '';
    
            try {
                pageContent = await this.getPageContent(url);
                uniqueLinks = await this.getUniqueLinks(pageContent);
            } catch (error) {
                console.error(`Failed to fetch content or links from URL: ${url}`);
                console.error(`Error: ${error.message}`);
                continue;
            }

            pageContent = await this.getCleanHtmlContent(pageContent, ['href']);
            urlContentMap.set(url, pageContent);
    
            try {
                let internalLinks = uniqueLinks.filter(link => link.startsWith(this.startUrl));
                internalLinks = internalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
                const newInternalLinks = internalLinks.filter(link => !this.visitedUrls.has(link));

                let externalLinks = uniqueLinks.filter(link => !link.startsWith(this.startUrl));
                externalLinks = externalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
                externalLinks.forEach(link => allExternalLinks.add(link));
    
                for (let link of newInternalLinks) {
                    this.visitedUrls.add(link);
                    queue.push({ url: link, depth: depth + 1 });
                }
            } catch (error) {
                console.error(`Error processing links for URL: ${url}`);
                console.error(`Error: ${error.message}`);
                continue;
            }
        }

        let externalUrlContentMap = new Map();
        for (let url of allExternalLinks) {
            try {
                const content = await this.getPageContent(url);
                let cleanedContent = await this.getCleanHtmlContent(content, ['href']);
                if (content.trim() === '') {
                    cleanedContent = 'Content not accessible to chatbot. Provide user with link to view content if needed.';
                }
                externalUrlContentMap.set(url, cleanedContent);
            } catch (error) {
                console.error(`Error fetching content for external URL: ${url}`);
                console.error(`Error: ${error.message}`);
            }
        }
    
        this.visitedUrls = new Set(Array.from(this.visitedUrls).map(url => url.endsWith('/') ? url : url + '/'));
    
        return { urlContentMap, externalUrlContentMap };
    }

    async getUniqueLinks(pageContent) {
        let content = pageContent;
        content = content.replace(/<style.*?>.*?<\/style>/gs, '');
        content = content.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
        const dom = new JSDOM(content);
        const { document } = dom.window;
        const uniqueLinks = new Set();
        const links = document.querySelectorAll('a');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.trim() !== '') {
                try {
                    const cleanUrl = this.cleanUrl(href);
                    uniqueLinks.add(cleanUrl);
                } catch (error) {
                    console.error(`Invalid URL: ${href}`);
                }
            }
        });
    
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


function summarizeAllPages(urlContentMap, website) {
    let allPages = [];
    let allSummaries = [];
    for (let [pageUrl, content] of urlContentMap.entries()) {
        let summary = summarizePage(content);
        for (let str of summary) {
            allSummaries.push(str);
        }
        let page = {
            website_id: website.id,
            url: pageUrl,
            content: content,
            summary: summary
        };
        allPages.push(page);
    }
    let commonSummaryItems = new Set();
    for (let str of allSummaries) {
        let count = allSummaries.filter(s => s === str).length;
        if (count > allPages.length / 20 && count > 1) {
            commonSummaryItems.add(str);
        } 
    }
    for (let page of allPages) {
        page.summary = page.summary.filter(s => !commonSummaryItems.has(s));
        if (page.summary.length > 3) {
            page.summary = page.summary.slice(0, 3);
        }
    }
    return allPages;
}

async function crawlSite() {
    let website = await getWebsiteByUrl(url);
    if (!website) {
        console.log('Website does not exist in the database. Inserting...');
        await insertWebsite(url);
        website = await getWebsiteByUrl(url);
    }
    console.log('Website exists in the database.');
    const scraper = new WebScraper(url, 7);
    await scraper.init();
    let manuallyAddedPages = [{ url: "https://www.futureofworkchallenge.com/champions", depth: 1 }];
    const { urlContentMap, externalUrlContentMap } = await scraper.getAllPageUrls(url, manuallyAddedPages);
    await scraper.browser.close();
    
    let allInternalPages = summarizeAllPages(urlContentMap, website);

    for (let page of allInternalPages) {
        let summaryStr = page.summary.join(', ');
        if (!page.url.endsWith('/')) {
            page.url += '/';
        }
        await insertOrUpdatePage(page.website_id, page.url, page.content, summaryStr, false);
    }
    console.log('All pages inserted into the database.');
    
    for (let [url, content] of externalUrlContentMap.entries()) {
        if (!url.endsWith('/')) {
            url += '/';
        }
        await insertOrUpdatePage(website.id, url, content, '', true);
    }
}


module.exports = crawlSite;