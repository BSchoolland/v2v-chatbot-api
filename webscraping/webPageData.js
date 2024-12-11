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

module.exports = { WebPageData };