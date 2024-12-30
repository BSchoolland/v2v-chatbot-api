const { addPage } = require('../database/pages.js');
const { addWebsite, getWebsiteByUrl } = require('../database/websites.js');
const getCleanHtmlContent = require('./htmlProcessing.js');
const summarizeContent = require('./summarizeContent.js');

class ActiveJob {
    constructor(baseUrl, chatbotId, maxDepth = 5, maxPages = 50) { // TODO: think more about the maxPages parameter. Should it be higher? Should it also apply to external links?
        this.baseUrl = baseUrl;
        this.chatbotId = chatbotId;
        this.completedPages = [];
        this.queue = [{url: baseUrl, depth: 0}];
        this.externalLinks = new Set();
        this.startTime = new Date();
        this.maxDepth = maxDepth;
        this.maxPages = maxPages;
        this.visitedUrls = new Set();
        // add the base URL to the visited URLs
        this.visitedUrls.add(baseUrl);
        this.endTime = null;
        this.done = false;
        this.processing = 0;
        // flags for initialization
        this.websiteId = null;
        this.isReady = false;
        this.isInitializing = false;
        this.externalQueued = false;
        this.init();
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
        return (!this.done && 
                (this.queue.length > 0 || (!this.externalQueued && this.externalLinks.size > 0)) && 
                this.completedPages.length < this.maxPages);
    }

    getNextPage() {
        if (this.queue.length === 0 || this.completedPages.length >= this.maxPages) {
            return null;
        }
        this.processing++;
        return this.queue.shift();
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
    async markPageComplete() {
        this.processing--;
        if (this.processing === 0 && this.queue.length === 0) {
            if (!this.externalQueued) {
                console.log('Adding external links to the queue');
                // add all the external links to the queue
                for (let link of this.externalLinks) {
                    this.queue.push({url: link, depth: 0, external: true});
                }
                this.externalQueued = true;
            } else {
                await this.completeJob();
                this.done = true;
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
            // Filter out pages with file extensions like .pdf, .jpg, etc.
            internalLinks = internalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
            // Filter out already visited links adding to queue
            const newInternalLinks = internalLinks.filter(link => !this.visitedUrls.has(link));

            // get external links
            let externalLinks = uniqueLinks.filter(link => !link.startsWith(this.baseUrl));
            // Filter out pages with file extensions like .pdf, .jpg, etc.
            externalLinks = externalLinks.filter(link => !link.match(/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx|webp|zip)$/i));
            // Add external links to the set
            externalLinks.forEach(link => this.externalLinks.add(link));

            // Add new links to the queue and mark them as visited
            for (let link of newInternalLinks) {
                this.visitedUrls.add(link); // Mark as visited immediately
                this.queue.push({ url: link, depth: depth + 1 });
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
        } catch (error) {
            console.error(`Error in completeJob: ${error.message}`);
        }
    }

    async processPage(pageObj) {
        const nextPage = this.getNextPage();
        if (!nextPage) {
            pageObj.assigned = false;
            return;
        }

        const page = pageObj.page;
        try {
            // Navigate to the URL
            await page.goto(nextPage.url, { waitUntil: 'networkidle0', timeout: 30000 });

            // Get page content
            const content = await page.content();

            // Extract all links
            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a');
                return Array.from(anchors)
                    .map(a => a.href)
                    .filter(href => href && href.startsWith('http'));
            });

            // Add unique links to the queue
            const uniqueLinks = [...new Set(links)];
            this.addLinks(uniqueLinks, nextPage.depth);

            // Add the completed page
            await this.addCompletedPage(nextPage.url, uniqueLinks, content);
            await this.markPageComplete();
        } catch (error) {
            console.error(`Error processing page ${nextPage.url}:`, error);
            // Still mark the page as complete to avoid getting stuck
            await this.markPageComplete();
        } finally {
            pageObj.assigned = false;
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
        let pageUrl = page.url;
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