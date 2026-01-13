const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = path.join(__dirname, '..');

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Normalize path
    let filePath = path.join(ROOT, req.url);

    // If requesting a directory, try listing it or index.html
    // But for our purpose (simulating raw file fetch), we usually request files directly.

    const ext = path.extname(filePath);
    let contentType = 'text/plain';

    if (ext === '.json') contentType = 'application/json';
    if (ext === '.md') contentType = 'text/markdown';
    if (ext === '.js') contentType = 'application/javascript';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`  -> 404 Not Found: ${filePath}`);
                res.writeHead(404);
                res.end('Not Found');
            } else {
                console.log(`  -> 500 Server Error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            console.log(`  -> 200 OK (${content.length} bytes)`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving files from: ${ROOT}`);
});
