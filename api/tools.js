const {getPageByUrl, db} = require('./database.js');
const url = require("./url.js");
const defaultPath = url;

// a set of tools the chatbot can use to find information for the user
tools = [
    {
        "type": "function",
        "function": {
            "name": "readPageContent",
            "description": "Reads the text content of a URL path, use if the user asks for information that can be found on a page of the website.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The path to read from, for example '/' for the landing page of the website.",
                    }
                    // "queryString": {
                    //     "type": "string",
                    //     "description": "The query string to append to the path, for example '?id=123'.",
                    // },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "siteWideSearch",
            "description": "Searches the entire website for a specific term, returning a list of pages that contain the term.  Useful if you're not sure where the information the user is looking for might be located.",
            "parameters": {
                "type": "object",
                "properties": {
                    "term": {
                        "type": "string",
                        "description": "The term to search for.",
                    },
                },
                "required": ["term"],
            },
        },
    },
]



async function readPageContent(params) {
    // convert params to json
    params = JSON.parse(params);
    let path = params.path;
    console.log(path);
    // if the path does not begin with http, add the default path
    if (!path.startsWith("http")) {
        path = defaultPath + path;
    }
    console.log(path);
    // if the path ends with #something, remove the #something
    if (path.includes("#")) {
        path = path.split("#")[0];
    }
    // if there's a //:www. in the path, remove it
    if (path.includes("://www.")) {
        path = path.replace("://www.", "://");
    }
    // if there's no / at the end add it
    if (path[path.length - 1] !== "/") {
        path = path + "/";
    }
    console.log(path);
    const page = await getPageByUrl(path);
    if (page) {
        return page.content;
    } else {
        // try with www. instead
        path = path.replace("://", "://www.");
        const page = await getPageByUrl(path);
        if (page) {
            return page.content;
        }
        return `No information found for path ${path}.  Are you sure you entered it correctly?`;
    }
}

// FIXME: this function returns results from all pages in the database, not just the current website
async function siteWideSearch(params) {
    // convert params to json
    params = JSON.parse(params);
    const searchString = params.term;
    return new Promise((resolve, reject) => {
        db.all('SELECT url, content FROM pages', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let matchingPaths = rows
                    .filter(row => row.content.includes(searchString))
                    .map(row => row.url);
                // turn matching paths into a string
                matchingPaths = matchingPaths.join("\n");
                resolve(matchingPaths);
            }
        });
    });
}

module.exports = {readPageContent, siteWideSearch, tools};