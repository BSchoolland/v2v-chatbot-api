const {getPageByUrl} = require('./database.js');
const defaultPath = "https://beanythingmuseum.org";
async function readPageContent(params) {
    // convert params to json
    params = JSON.parse(params);
    let path = params.path;
    // if the path does not begin with http, add the default path
    if (!path.startsWith("http")) {
        path = defaultPath + path;
    }
    // if there's no / at the end add it
    if (path[path.length - 1] !== "/") {
        path = path + "/";
    }
    const page = await getPageByUrl(path);
    console.log(page);
    if (page) {
        return page.content;
    } else {
        return `No information found for path ${path}.  Are you sure you entered it correctly?`;
    }
}

module.exports = readPageContent;