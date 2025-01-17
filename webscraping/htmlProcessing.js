// Import the required modules
const { JSDOM } = require('jsdom');

// Define the function
async function getCleanHtmlContent(content, keepAttributes = ['href', 'alt', 'id']) {
    // Strip style tags before JSDOM parsing to prevent CSS parsing errors
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // href allows for navigation, alt allows for accessibility, id allows for identification
    const dom = new JSDOM(content);
    const { document, Node } = dom.window; // Define Node for easier reference

    // Remove scripts and comments
    document.querySelectorAll('script').forEach(el => el.remove());
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

// Export
module.exports = getCleanHtmlContent;