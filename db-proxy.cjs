const net = require('net');

const server = net.createServer((sock) => {
  const target = net.connect(5432, 'postgres');
  sock.pipe(target).pipe(sock);
  sock.on('error', () => {});
  target.on('error', () => {});
});

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('Proxy error:', err);
  }
});

server.listen(25432, '0.0.0.0', () => {
  console.log('PostgreSQL proxy running: 0.0.0.0:25432 -> postgres:5432');
});
