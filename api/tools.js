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
                    },
                    "queryString": {
                        "type": "string",
                        "description": "The query string to append to the path, for example '?id=123'.",
                    },
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