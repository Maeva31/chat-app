const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
});

const port = 3000;
const hostname = '0.0.0.0';

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});