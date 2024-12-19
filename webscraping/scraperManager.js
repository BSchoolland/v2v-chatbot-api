const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const { ActiveJob } = require('./activeJob.js');

class ScraperManager {
    constructor() {
        this.browser = null;
        this.pages = [];
        this.currentPageCount = 15;
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
        console.log('Scraper initialized');
    }

    async addJob(baseUrl, chatbotId, maxDepth = 5, maxPages = 50) {
        if (!this.isReady) {
            await this.init();
        }
        let job = new ActiveJob(baseUrl, chatbotId, maxDepth, maxPages);
        const websiteId = await job.getWebsiteId();
        this.activeJobs.push(job);
        this.allJobs.push(job);
        this.runJobs();
        return {job, websiteId};
    }   

    async runJobs() {
        if (this.isRunning) return;
        console.log('Starting jobs...');
        this.isRunning = true;
        this.waited = 0;
        try {
            while (this.isRunning) {
                const availablePages = this.pages.filter(p => !p.assigned);
                // No pages available, wait and try again
                if (availablePages.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
        
                // Filter out completed jobs
                this.activeJobs = this.activeJobs.filter(job => !job.isJobComplete());
                // Stop if no more jobs
                if (this.activeJobs.length === 0) {
                    // wait n seconds for any remaining pages to complete
                    // call the log completion function on all jobs
                    for (let job of this.allJobs) {
                        job.isJobComplete();
                    }
                    this.isRunning = false;
                    break;
                }
                const tasks = [];
                let jobIndex = 0;
                console.log('Available pages:', availablePages.length);
                console.log("work to do:", this.activeJobs.length);
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
                console.log('Tasks:', tasks);
                if (tasks.length === 0) {
                    this.waited += 100;
                    // FIXME: this is a hack to prevent the scraper from hanging indefinitely, which it sometimes does for unknown reasons.  This is a temporary fix, and would not be effective if many jobs are running since it only detects when all jobs hang, meaning one job could hang for an indefinite amount of time as long as the other jobs are making progress, and clients might be caught waiting for a response from a job that is stuck.
                    if (this.waited > 90000) {
                        console.error('CRITICAL ERROR: Scraper not making progress, forcibly stopping all jobs');
                        // mark all jobs as complete
                        for (let job of this.allJobs) {
                            job.processing = 0;
                            job.done = true;
                            job.completeJob();
                            job.isJobComplete();
                        }
                        this.isRunning = false;
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                this.waited = 0;
        
                // Execute tasks in parallel with timeout, and once one is done, start the next one
                await Promise.race([
                    Promise.race(tasks),
                    new Promise((resolve, reject) => {
                        setTimeout(() => {
                            // Free up pages that timed out
                            this.pages.forEach(p => p.assigned = false);
                            reject(new Error('Tasks timed out after 60 seconds'));
                        }, 60000);
                    })
                ]).catch(error => {
                    if (error.message === 'Tasks timed out after 60 seconds') {
                        console.warn('Some tasks timed out and were cancelled');
                    } else {
                        throw error;
                    }
                });
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
            let content = '';
            try {
                content = await this.getPageContent(url, page.page);
            } catch (error) {
                console.warn(`Failed to get content for ${url}: ${error.message}`);
                // Continue with empty content rather than failing the whole page
            }

            let links = [];
            if (!pageInfo.external) {
                try {
                    links = await this.getUniqueLinks(content, job.baseUrl);
                } catch (error) {
                    console.warn(`Failed to extract links from ${url}: ${error.message}`);
                    // Continue with empty links rather than failing
                }
                try {
                    job.addLinks(links, pageInfo.depth);
                } catch (error) {
                    console.warn(`Failed to add links for ${url}: ${error.message}`);
                }
            }

            try {
                await job.addCompletedPage(url, links, content);
            } catch (error) {
                console.error(`Failed to add completed page ${url}: ${error.message}`);
            }
        } catch (error) {
            console.error(`Error processing page ${pageInfo.url}: ${error.message}`);
        } finally {
            // Always release the page and mark as complete
            page.assigned = false;
            try {
                job.markPageComplete();
            } catch (error) {
                console.error(`Error marking page complete: ${error.message}`);
            }
        }
    }

    async getPageContent(pageUrl, page) {
        if (!this.isReady) {
            try {
                await this.init();
            } catch (error) {
                console.error(`Failed to initialize scraper: ${error.message}`);
                return '';
            }
        }

        try {
            try {
                await page.goto(pageUrl, { 
                    timeout: 30000, 
                    waitUntil: 'networkidle0' 
                });
            } catch (timeoutError) {
                // If networkidle0 times out, try with just domcontentloaded
                await page.goto(pageUrl, { 
                    timeout: 30000, 
                    waitUntil: 'domcontentloaded' 
                });
            }

            try {
                return await page.content();
            } catch (contentError) {
                console.warn(`Error getting page content: ${contentError.message}`);
                return '';
            }
        } catch (error) {
            console.warn(`Failed to load page ${pageUrl}: ${error.message}`);
            return '';
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


module.exports = { ScraperManager };