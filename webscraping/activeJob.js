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

module.exports = { ActiveJob };