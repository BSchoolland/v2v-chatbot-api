const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));