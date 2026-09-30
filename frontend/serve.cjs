const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8000';
const DIST_DIR = path.join(__dirname, 'dist');
const PORTS = [3000, 23080];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Reverse proxy for backend endpoints (matching nginx.conf)
  if (
    pathname.startsWith('/api/') ||
    pathname === '/health' ||
    pathname === '/healthz' ||
    pathname === '/ping' ||
    pathname === '/metrics' ||
    pathname === '/docs' ||
    pathname.startsWith('/docs/')
  ) {
    const targetUrl = new URL(pathname + reqUrl.search, BACKEND_URL);
    const options = {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host }
    };

    const proxyReq = http.request(targetUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Serve static files from dist/
  let filePath = path.join(DIST_DIR, pathname);
  
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        // SPA Fallback: serve index.html for non-asset routes
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.readFile(indexPath, (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexContent);
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

// Start listeners on required ports
for (const port of PORTS) {
  const server = http.createServer(handleRequest);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Frontend server listening on http://0.0.0.0:${port}`);
  });
  server.on('error', (e) => {
    console.warn(`Could not bind frontend to port ${port}:`, e.message);
  });
}
