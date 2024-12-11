const getCleanHtmlContent = require('./htmlProcessing.js');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

class WebPageData {
    constructor(url, internalLinks, externalLinks, content, summary) {
        this.url = url;
        this.internalLinks = internalLinks;
        this.externalLinks = externalLinks;
        this.content = content;
        this.summary = summary;
        this.scrapedAt = new Date();
    }
}

class ActiveJob {
    constructor(baseUrl, maxDepth = 5, maxPages = 50) { // TODO: think more about the maxPages parameter. Should it be higher? Should it also apply to external links?
        this.baseUrl = baseUrl;
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
    }

    getNextPage() {
        if (this.queue.length === 0 || this.completedPages.length >= this.maxPages) {
            return null;
        }
        this.processing++;
        return this.queue.shift();
    }
    addCompletedPage(page) {
        this.completedPages.push(page);
    }
    markPageComplete() {
        this.processing--;
        if (this.processing === 0 && this.queue.length === 0) {
            this.done = true;
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

            if (this.verbose) {
                console.log(`Unique Links Found: ${uniqueLinks.length} ${uniqueLinks}`);
                console.log(`New Internal Links Added: ${newInternalLinks.length}`);
                console.log(`Queue Size: ${this.queue.length}`);
                console.log(`Total external links found: ${this.externalLinks.size}`);
            }

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
            console.log(`Job completed in ${elapsedTime}ms`);
            console.log(`seconds: ${elapsedTime / 1000}`);
            console.log(`total pages: ${this.completedPages.length}`);
            console.log(`all pages visited`);
            for (let page of this.completedPages) {
                console.log(page.url);
            }
            return true;
        } else {
            console.log('Job not complete');
            return false;
        }
    }        
}

class ScraperManager {
    constructor() {
        this.browser = null;
        this.pages = [];
        this.minPageCount = 1;
        this.maxPageCount = 10;
        this.currentPageCount = 300; // here
        this.verbose = true;
        this.activeJobs = [];
        this.allJobs = [];

        // Flags to track the state of the scraper
        this.isReady = false;
        this.isRunning = false;
        this.isInitializing = false;
        this.isCleaning = false;
    }

    async init() {
        if (this.isCleaning) {
            // wait for cleanup to complete
            while (this.isCleaning) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (this.isInitializing) {
            // wait for initialization to complete
            while (this.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }
        this.isInitializing = true;
        if (!this.browser) {
            this.browser = await puppeteer.launch(
                {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    ignoreHTTPSErrors: true, // Ignore HTTPS errors (rare but some clients may have issues with SSL and we don't want to stop the process)
                }
            );
        } 

        for (let i = 0; i < this.currentPageCount; i++) {
            this.pages.push({ page: await this.browser.newPage(), assigned: false });
        }
        try {
            // Enable request interception to block unnecessary resources
            for (let i = 0; i < this.currentPageCount; i++) {
            let page = this.pages[i].page;
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                    req.abort(); // Abort loading these resource types
                } else {
                    req.continue(); // Allow other requests
                }
            });
            }
        }
        catch (error) {
            console.error('Error setting up request interception:', error.message);
        }
        this.isReady = true;
        this.isInitializing = false;
        console.log('Scraper initialized.');
    }

    async addJob(baseUrl, maxDepth = 5, maxPages = 50) {
        if (!this.isReady) {
            await this.init();
        }
        let job = new ActiveJob(baseUrl, maxDepth, maxPages);
        this.activeJobs.push(job);
        this.allJobs.push(job);
        this.runJobs();
    }   

    async runJobs() {
        if (this.isRunning) return;
        console.log('Starting jobs...');
        this.isRunning = true;
        try {
            while (this.isRunning) {
                const availablePages = this.pages.filter(p => !p.assigned);
                console.log('Available pages:', availablePages.length);
                // No pages available, wait and try again
                if (availablePages.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
        
                // Filter out completed jobs
                this.activeJobs = this.activeJobs.filter(job => !job.isJobComplete());
                console.log('Active jobs:', this.activeJobs.length);
                // Stop if no more jobs
                if (this.activeJobs.length === 0) {
                    // wait n seconds for any remaining pages to complete
                    // call the log completion function on all jobs
                    console.log('\n\n\n\n\n\n -----ALL JOBS COMPLETED-----');
                    for (let job of this.allJobs) {
                        job.isJobComplete();
                        console.log('\n\n\n');
                    }
                    this.isRunning = false;
                    console.log('All jobs completed.');
                    break;
                }
                const tasks = [];
                let jobIndex = 0;
                
                // Distribute pages across jobs evenly
                for (const page of availablePages) {
                    // Try each job once
                    let foundWork = false;
                    let attempts = 0;
                    
                    while (!foundWork && attempts < this.activeJobs.length) {
                        const job = this.activeJobs[jobIndex];
                        const nextPage = job.getNextPage();
                        
                        if (nextPage) {
                            page.assigned = true;
                            tasks.push(this.processPage(page, job, nextPage));
                            foundWork = true;
                        }
                        
                        jobIndex = (jobIndex + 1) % this.activeJobs.length;
                        attempts++;
                    }
                }
                console.log('Tasks:', tasks.length);
                if (tasks.length === 0) {
                    console.log('No work to do, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
        
                // Execute tasks in parallel, and once one is done, start the next one
                await Promise.race(tasks);
            }
        } finally {
            await this.cleanup();
            this.isRunning = false;
        }        
    }


    async cleanup() {
        // set flag to prevent re-initialization during cleanup
        this.isReady = false;
        this.isCleaning = true;
        this.isRunning = false;

        console.log('Cleaning scraper resources...');

        // close all pages
        for (let page of this.pages) {
            try {
                await page.page.close();
            } catch (error) {
                console.error('Error closing page:', error.message);
            }
        }

        // close the browser
        try {
            await this.browser.close();
            this.browser = null;
        } catch (error) {
            console.error('Error closing browser:', error.message);
        }

        // clear the pages array
        this.pages = [];
        this.activeJobs = [];
        this.allJobs = [];
        // reset flags
        this.isReady = false;
        this.isInitializing = false;
        this.isCleaning = false;
    }
    
    async processPage(page, job, pageInfo) {
        try {
            const url = pageInfo.url;
            const content = await this.getPageContent(url, page.page);
            // get the unique links from the page
            const links = await this.getUniqueLinks(content, job.baseUrl);
            // add the links to the job
            job.addLinks(links, pageInfo.depth);
            let cleanedContent = await getCleanHtmlContent(content, ['href']);
            if (content.trim() === '') {
                cleanedContent = 'Content not accessible to chatbot. Provide user with link to view content if needed.';
            }
            // update the job with the completed page
            job.addCompletedPage(new WebPageData(url, [], [], cleanedContent, ''));
            page.available = true;
        } finally {
            // Make sure to release the page when done
            page.assigned = false;
            job.markPageComplete();
        }
    }

    async getPageContent(pageUrl, page) {
        if (!this.isReady) {
            await this.init();
        }
        try {
            await page.goto(pageUrl, { timeout: 30000, waitUntil: 'networkidle0' });
            const content = await page.content();
            return content;
        } catch (error) {
            console.error('Error fetching page content:', error.message);
            console.log('Trying without waiting for network idle...');
            try {
                await page.goto(pageUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
                console.log('Success!');
                return await page.content();
            } catch (error) {
                console.error('Error fetching page content:', error.message);
                console.log('Giving up on page:', pageUrl, ' :(');
                return '';
            }
        }
    }

    async getUniqueLinks(pageContent, baseUrl) {
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

        // Loop through each link and add to the Set
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            // Basic filtering
            if (href && href.trim() !== '') {
                // Normalize the URL and remove hash fragment
                try {
                    // Clean the URL
                    const cleanUrl = this.cleanUrl(href, baseUrl);
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

    cleanUrl(url, baseUrl) {
        // if it's a relative URL, convert to absolute
        if (!url.startsWith('http')) {
            url = new URL(url, baseUrl).toString();
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
}


// test the scraper manager
const scraperManager = new ScraperManager();

scraperManager.addJob('https://www.example.com', 5, 5);
scraperManager.addJob('https://bschoolland.com', 5, 100);
setTimeout(() => {
    scraperManager.addJob('https://solvecc.org', 5, 200);
}, 5040);
setTimeout(() => {
    scraperManager.addJob('https://chalkwild.com', 5, 200);
}, 90000);

    
