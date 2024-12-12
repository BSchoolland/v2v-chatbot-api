const { JSDOM } = require('jsdom');
// define DOMParser
global.DOMParser = new JSDOM().window.DOMParser;

function summarizePage(content) {

  // Create a DOM parser to work with the HTML content
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  // Extract main headings
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3"))
    .map((el) => el.textContent.trim())
    .filter(Boolean);

  // Extract visible text (excluding links)
  const paragraphs = Array.from(doc.querySelectorAll("p, span"))
    .map((el) => el.textContent.trim())
    .filter(Boolean);

  // Combine and deduplicate content
  const uniqueContent = [...new Set([...headings, ...paragraphs])];

  // Filter out sections with more than 10 words
  const filteredContent = uniqueContent.filter(section => section.split(' ').length <= 10);

  // return summary as an array of strings
  return filteredContent;
}

module.exports = summarizePage;