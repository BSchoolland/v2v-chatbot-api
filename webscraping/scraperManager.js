const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const { ActiveJob } = require('./activeJob.js');
const dotenv = require('dotenv');
dotenv.config();

class ScraperManager {
    constructor() {
        this.browser = null;
        this.pages = [];
        this.currentPageCount = process.env.PAGE_COUNT || 3;
        this.verbose = process.env.VERBOSE || false;
        this.activeJobs = [];
        this.allJobs = [];

        // Flags to track the state of the scraper
        this.isReady = false;
        this.isRunning = false;
        this.isInitializing = false;
        this.isCleaning = false;
        this.lastCleanup = 0; // the last time the cleanup was triggered is never
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
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage', // Disable /dev/shm usage
                        '--disable-accelerated-2d-canvas', // Disable GPU acceleration
                        '--disable-gpu', // Disable GPU hardware acceleration
                        '--js-flags="--max-old-space-size=512"' // Limit V8 heap size
                    ],
                    ignoreHTTPSErrors: true,
                }
            );
        } 

        for (let i = 0; i < this.currentPageCount; i++) {
            const page = await this.browser.newPage();
            // Set up CDP session for network controls
            const client = await page.createCDPSession();
            await client.send('Network.enable');
            await client.send('Network.setBypassServiceWorker', {bypass: true});
            
            // Set request interception
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            this.pages.push({ page, assigned: false });
        }
        this.isReady = true;
        this.isInitializing = false;
        console.log('Scraper initialized');
    }

    async addJob(baseUrl, chatbotId, maxDepth = 5, maxPages = 50) {
        if (!this.isReady) {
            await this.init();
        }
        // if it's been more than 10 minutes since the last cleanup delay the job until the scraperManager has a chance to clean up (if the scraper is not active, ignore this)
        if (Date.now() - this.lastCleanup > 600000 && this.isRunning) {
            console.warn('No cleanup since', (Date.now() - this.lastCleanup) / 60000, 'minutes ago, delaying job');
            // loop with 10s intervals until cleanup is triggered by another job completing
            // if this takes more than 10 minutes, force a cleanup
            let waited = 0;
            while (Date.now() - this.lastCleanup > 600000) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                waited += 10000;
            }
            if (waited > 600000) {
                console.warn('Assumed scraper is stuck, forcibly cleaning up (which will cancel any existing jobs)');
                await this.cleanup();
                // force the last cleanup to be now, ending the loop
                this.lastCleanup = Date.now();
            }
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
        this.isRunning = true;
        this.waited = 0;
        try {
            while (this.isRunning) {
                const availablePages = this.pages.filter(p => !p.assigned);
                if (availablePages.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
        
                this.activeJobs = this.activeJobs.filter(job => !job.isJobComplete());
                if (this.activeJobs.length === 0) {
                    // Wait n seconds for any remaining pages to complete
                    // Call the log completion function on all jobs
                    for (let job of this.allJobs) {
                        job.isJobComplete();
                    }
                    this.isRunning = false;
                    // Clean up resources when all jobs are complete
                    console.log('cleaning up due to all jobs being complete');
                    await this.cleanup();
                    break;
                }
                const tasks = [];
                let jobIndex = 0;
                
                // Distribute pages across jobs evenly
                for (const page of availablePages) {
                    let foundWork = false;
                    let attempts = 0;
                    
                    while (!foundWork && attempts < this.activeJobs.length) {
                        const job = this.activeJobs[jobIndex];
                        if (job.needsWork()) {
                            tasks.push(job.processPage(page));
                            page.assigned = true;
                            foundWork = true;
                        } else {
                            console.log('no work found for job', jobIndex);
                            console.log('job queue length', job.queue.length);
                            console.log('job is processing', job.processingUrls.size);
                        }
                        jobIndex = (jobIndex + 1) % this.activeJobs.length;
                        attempts++;
                    }
                }
                console.log('tasks', tasks);
                if (tasks.length === 0) {
                    this.waited += 100;
                    // FIXME: this is a hack to prevent the scraper from hanging indefinitely,
                    // which it sometimes does for unknown reasons. This is a temporary fix,
                    // and would not be effective if many jobs are running since it only detects
                    // when all jobs hang, meaning one job could hang for an indefinite amount
                    // of time as long as the other jobs are making progress, and clients
                    // might be caught waiting for a response from a job that is stuck.
                    if (this.waited > 90000) {
                        console.error('CRITICAL ERROR: Scraper not making progress, forcibly stopping all jobs');
                        for (let job of this.allJobs) {
                            job.processing = 0;
                            job.done = true;
                        }
                        this.isRunning = false;
                        break;
                    }
                    continue;
                }
                this.waited = 0;
                await Promise.race([
                    Promise.all(tasks),
                    new Promise((resolve, reject) => {
                        setTimeout(() => {
                            this.pages.forEach(p => p.assigned = false);
                            reject(new Error('Tasks timed out after 90 seconds'));
                        }, 90000);
                    })
                ]);
            }
        } catch (error) {
            console.error('Error in runJobs:', error);
            this.isRunning = false;
            // Free up any assigned pages
            this.pages.forEach(p => p.assigned = false);
            // Clean up resources on error
            console.log('cleaning up due to critical error');
            await this.cleanup();
            throw error;
        }        
    }

    async cleanup() {
        // Set flag to prevent re-initialization during cleanup
        this.isReady = false;
        this.isCleaning = true;
        this.isRunning = false;

        console.log('Cleaning scraper resources...');
        this.lastCleanup = Date.now();
        // Force close the browser process first
        if (this.browser) {
            try {
                const browserProcess = this.browser.process();
                if (browserProcess) {
                    // Force kill the browser process
                    browserProcess.kill('SIGKILL');
                }
            } catch (error) {
                console.error('Error force killing browser:', error.message);
            }
            this.browser = null;
        }

        // Clear all references
        this.pages = [];
        this.activeJobs = [];
        this.allJobs.forEach(job => job.cleanup());
        this.allJobs = [];
        
        // Reset flags
        this.isReady = false;
        this.isInitializing = false;
        this.isCleaning = false;

        // Nuclear memory cleanup
        try {
            // Force V8 garbage collection
            if (global.gc) {
                global.gc();
            }
            
            // Clear module cache to prevent memory leaks from requiring modules
            Object.keys(require.cache).forEach(function(key) {
                delete require.cache[key];
            });

            // Request system to release memory back to OS
            try {
                // Some systems support this
                process.memoryUsage();
                if (process.hasOwnProperty('release')) {
                    process.release();
                }
            } catch (e) {
                console.warn('System memory release not supported');
            }
        } catch (error) {
            console.error('Error during memory cleanup:', error.message);
        }
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

// export a singleton instance of the ScraperManager to prevent multiple instances
const scraperManager = new ScraperManager();
// initialize the scraper manager
scraperManager.init();

module.exports = { scraperManager };