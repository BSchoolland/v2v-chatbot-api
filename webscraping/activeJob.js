const { addPage, getPageByUrlAndWebsiteId } = require('../backend/database/queries');
const { addWebsite, getWebsiteByUrl } = require('../backend/database/queries');
const getCleanHtmlContent = require('./htmlProcessing.js');
const summarizeContent = require('./summarizeContent.js');
const { logScrapeJobStart, logScrapeJobCompletion } = require('../backend/database/logging/scraper.js');

class ActiveJob {
    constructor(baseUrl, chatbotId, maxDepth = 5, maxPages = 500) { // TODO: think more about the maxPages parameter. Should it be higher? Should it also apply to external links?
        this.baseUrl = baseUrl;
        this.chatbotId = chatbotId;
        this.completedPages = [];
        this.queue = [{url: baseUrl, depth: 0}];
        this.externalLinks = new Set();
        this.startTime = new Date();
        this.startTimestamp = new Date().toISOString();
        this.maxDepth = maxDepth;
        this.maxPages = maxPages;
        this.visitedUrls = new Set();
        // add the base URL to the visited URLs
        this.visitedUrls.add(baseUrl);
        this.endTime = null;
        this.done = false;
        this.processingUrls = new Set();
        // flags for initialization
        this.websiteId = null;
        this.isReady = false;
        this.isInitializing = false;
        this.externalQueued = false;
        this.failedPages = 0;
        this.action = 'unknown';
        this.init();
        this.cleanup = this.cleanup.bind(this);
        
        // Log the start of the scrape job
        this.logJobStart();
    }

    async init() {
        if (this.isInitializing || this.isReady) {
            // wait for ready
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.websiteId;
        }
        this.isInitializing = true;
        // check if the website exists in the database
        try {
            const website = await getWebsiteByUrl(this.baseUrl);
            if (website) {
                this.websiteId = website.website_id;
            } else {
                // add the website to the database
                this.websiteId = await addWebsite(this.baseUrl, this.chatbotId);
            }
        } catch (error) {
            console.error(`Error!: ${error.message}`);
        } finally {
            this.isReady = true;
            this.isInitializing = false;
            return this.websiteId;
        }
    }

    async getWebsiteId() {
        if (!this.isReady) {
            await this.init();
        }
        // if the website id is not set, throw an error
        if (!this.websiteId) {
            throw new Error('Website ID not found');
        }
        return this.websiteId;
    }

    getCurrentPage() {
        return this.queue[0];
    }

    getCompletedPagesExcludingList(list) {
        return [...this.completedPages.filter(page => !list.some(p => p.url === page.url))];
    }

    getTotalPagesFound() {
        return this.queue.length + this.completedPages.length;
    }

    getScrapedPagesCount() {
        return this.completedPages.length;
    }

    needsWork() {
        // Return true if there are pages in the queue or external links to process
        // and we haven't hit our max pages limit
        return (!this.done && (this.queue.length > 0 || (!this.externalQueued && this.externalLinks.size > 0)));
    }

    getNextPage() {
        if (this.queue.length === 0) {
            return null;
        }
        const nextPage = this.queue.shift();
        this.processingUrls.add(nextPage.url);
        return nextPage;
    }
    async addCompletedPage(url, allLinks, content) {
        try {
            if (!this.isReady) {
                await this.init();
            }

            // Safely process links
            let internalLinks = [];
            let externalLinks = [];
            try {
                internalLinks = allLinks.filter(link => link && link.startsWith(this.baseUrl));
                externalLinks = allLinks.filter(link => link && !link.startsWith(this.baseUrl));
            } catch (error) {
                console.warn(`Error processing links for ${url}: ${error.message}`);
            }

            // Convert links to strings safely
            let internalLinksStr = '';
            let externalLinksStr = '';
            try {
                internalLinksStr = internalLinks.join('\n');
                externalLinksStr = externalLinks.join('\n');
            } catch (error) {
                console.warn(`Error converting links to string for ${url}: ${error.message}`);
            }

            // Clean and summarize content
            let cleanedContent = '';
            let summary = [];
            try {
                cleanedContent = await getCleanHtmlContent(content);
                summary = summarizeContent(cleanedContent);
            } catch (error) {
                console.warn(`Error cleaning/summarizing content for ${url}: ${error.message}`);
                cleanedContent = content; // Use original content if cleaning fails
                summary = ['Failed to summarize content'];
            }

            const internal = url.startsWith(this.baseUrl);
            
            // Add to completed pages even if some processing failed
            this.completedPages.push({
                url, 
                summary, 
                content: cleanedContent, 
                internal, 
                internalLinks: internalLinksStr, 
                externalLinks: externalLinksStr
            });
        } catch (error) {
            console.error(`Failed to add completed page ${url}: ${error.message}`);
            // Add minimal page data to ensure the process continues
            this.completedPages.push({
                url,
                summary: ['Failed to process page'],
                content: '',
                internal: url.startsWith(this.baseUrl),
                internalLinks: '',
                externalLinks: ''
            });
        }
    }
    async markPageComplete(url) {
        this.processingUrls.delete(url);
        if (this.processingUrls.size === 0 && this.queue.length === 0) {
            if (!this.externalQueued) {
                // add all the external links to the queue
                for (let link of this.externalLinks) {
                    this.queue.push({url: link, depth: 0, external: true});
                }
                this.externalQueued = true;
            } else {
                await this.completeJob();
                this.done = true;
                this.cleanup();  // Clean up after job is complete
            }
        }
    }


    // FIXME: this has O(n log n) time complexity, can be optimized to O(log n) using a priority queue
    queuePage(url, depth) {
        if (depth <= this.maxDepth) {
            // add the page, sorted by depth with the lowest depth first
            this.queue.push({url, depth});
            this.queue.sort((a, b) => a.depth - b.depth);
        }
    }
    addLinks(uniqueLinks, depth) {
        try {
            // get internal links
            let internalLinks = uniqueLinks.filter(link => link.startsWith(this.baseUrl));
            // Remove anything after # in the link
            internalLinks = internalLinks.map(link => link.split('#')[0]);
            // Remove anything after ? in the link
            internalLinks = internalLinks.map(link => link.split('?')[0]);
            // filter out any links that are already in the visitedUrls set
            internalLinks = internalLinks.filter(link => !this.visitedUrls.has(link));
            // Filter out pages with file extensions like .pdf, .jpg, etc.
            internalLinks = internalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
            // Add internal links to the set
            const newInternalLinks = internalLinks.filter(link => !this.visitedUrls.has(link));

            // get external links
            let externalLinks = uniqueLinks.filter(link => !link.startsWith(this.baseUrl));
            // Filter out pages with file extensions like .pdf, .jpg, etc.
            externalLinks = externalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
            // Remove anything after # in the link
            externalLinks = externalLinks.map(link => link.split('#')[0]);
            // Remove anything after ? in the link
            externalLinks = externalLinks.map(link => link.split('?')[0]);
            // filter out any links that are already in the visitedUrls set
            externalLinks = externalLinks.filter(link => !this.visitedUrls.has(link));
            // Add external links to the set
            externalLinks.forEach(link => this.externalLinks.add(link));

            // Add new links to the queue and mark them as visited
            for (let link of newInternalLinks) {
                // check if the link is already in the visitedUrls set
                if (!this.visitedUrls.has(link)) {
                    this.visitedUrls.add(link); // Mark as visited immediately
                    this.queue.push({ url: link, depth: depth + 1 });
                } 
            }
        } catch (error) {
            console.error(`Error!: ${error.message}`);
        }
    }

    getNextExternalLink() {
        if (this.externalLinks.length === 0) { // for now, we don't have a limit on external links
            return null;
        }
        return this.externalLinks.shift();
    }

    isJobComplete() {
        if (this.done) {
            if (!this.endTime){
                this.endTime = new Date();
            }
            const elapsedTime = this.endTime - this.startTime;
            return true;
        } else {
            return false;
        }
    }     
    
    async completeJob() {
        try {
            // Safely summarize internal pages
            try {
                this.completedPages = summarizeInternalPages(this.completedPages);
            } catch (error) {
                console.error(`Error summarizing internal pages: ${error.message}`);
            }

            // Convert summaries to strings safely
            for (let page of this.completedPages) {
                try {
                    page.summary = Array.isArray(page.summary) ? 
                        page.summary.join(', ') : 
                        'Failed to process summary';
                } catch (error) {
                    console.warn(`Error converting summary to string: ${error.message}`);
                    page.summary = 'Failed to process summary';
                }
            }

            // Add pages to database, continuing even if some fail
            for (let page of this.completedPages) {
                try {
                    await addPage(
                        this.websiteId,
                        page.url,
                        page.summary,
                        page.content,
                        page.internal,
                        page.internalLinks,
                        page.externalLinks
                    );
                } catch (error) {
                    console.error(`Error adding page ${page.url} to database: ${error.message}`);
                    // Continue with next page
                }
            }

            // Log the completion of the scrape job
            try {
                const pagesScraped = this.completedPages.length;
                await logScrapeJobCompletion(
                    this.startTimestamp,
                    pagesScraped,
                    this.failedPages,
                    true, // success
                    this.action,
                    this.chatbotId
                );
            } catch (error) {
                console.error("Failed to log scrape job completion:", error);
            }
        } catch (error) {
            console.error(`Error in completeJob: ${error.message}`);
        }
    }

    async processPage(pageObj) {
        const nextPage = this.getNextPage();
        if (!nextPage) {
            pageObj.assigned = false;
            return 'no page';
        }

        const page = pageObj.page;
        try {
            // Navigate to the URL and get the final URL after any redirects
            try {
                await page.goto(nextPage.url, { waitUntil: 'networkidle0', timeout: 30000 });
            } catch (error) {
                // If networkidle0 times out, try with just domcontentloaded
                try {
                    await page.goto(nextPage.url, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: 30000 
                    });
                } catch (error) {
                    console.error(`Error navigating to ${nextPage.url}: ${error.message}`);
                    await this.markPageComplete(nextPage.url);
                    this.failedPages++; // Increment failed pages counter
                    return 'page processed';
                }
            }
            let finalUrl = page.url(); // Get the final URL after any redirects
            // Remove anything after # in the link
            finalUrl = finalUrl.split('#')[0];
            // Remove anything after ? in the link
            finalUrl = finalUrl.split('?')[0];
            // Check if the page redirected to an external URL
            const isExternal = !finalUrl.startsWith(this.baseUrl);

            // Get page content
            const content = await page.content();

            // Extract all links
            let links
            try {
                links = await page.evaluate(() => {
                    const anchors = document.querySelectorAll('a');
                    return Array.from(anchors)
                        .map(a => a.href)
                        .filter(href => href && href.startsWith('http'));
                });
            } catch (error) {
                console.error(`Error extracting links from ${nextPage.url}: ${error.message}`);
                links = [];
            }
            // Add unique links to the queue
            const uniqueLinks = [...new Set(links)];
            // Only add links to queue if the page is still internal after redirects
            if (!isExternal) {
                this.addLinks(uniqueLinks, nextPage.depth);
            }

            // Add the completed page with the final URL and external status
            await this.addCompletedPage(finalUrl, uniqueLinks, content);
            await this.markPageComplete(nextPage.url);
        } catch (error) {
            console.error(`Error processing page ${nextPage.url}:`, error);
            // Still mark the page as complete to avoid getting stuck
            await this.markPageComplete(nextPage.url);
        } finally {
            pageObj.assigned = false;
            return 'page processed';
        }
    }

    cleanup() {
        // Clear all data structures
        this.queue = [];
        this.visitedUrls.clear();
        this.processingUrls.clear();
        this.externalLinks.clear();
        this.completedPages = [];
        
        // Reset flags
        this.isReady = false;
        this.isInitializing = false;
        this.externalQueued = false;
        
        // Clear any circular references
        this.websiteId = null;
        this.endTime = new Date();
    }

    async logJobStart() {
        try {
            this.startTimestamp = await logScrapeJobStart(this.action, this.chatbotId);
        } catch (error) {
            console.error("Failed to log scrape job start:", error);
            this.startTimestamp = new Date().toISOString();
        }
    }
}

function summarizeInternalPages(pages) {
    // if any summary item ends with :, ., or , remove it
    for (let page of pages) {
        page.summary = page.summary.filter(s => !s.endsWith(':') && !s.endsWith('.') && !s.endsWith(','));
    }
    // an array of all strings that appear in the summaries
    let allSummaries = [];
    for (let page of pages) {
        if (!page.internal) {
            page.summary = [];
            continue;
        }
        let content = page.content;
        let summary = summarizeContent(content);
        // loop through the summary and add each string to the array
        for (let str of summary) {
            allSummaries.push(str);
        }
        // create a new page object
        page.summary = summary;
    }
    let commonSummaryItems = new Set();
    // items that appear more than once
    for (let str of allSummaries) {
        let count = allSummaries.filter(s => s === str).length;
        if (count > 1) {
            commonSummaryItems.add(str);
        } 
    }
    // remove any common items from the summaries
    for (let page of pages) {
        page.summary = page.summary.filter(s => !commonSummaryItems.has(s));
    }
    return pages;
}

module.exports = { ActiveJob };