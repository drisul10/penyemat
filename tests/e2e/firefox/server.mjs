// HTTP proxy for the Firefox suite. Firefox sends every http:// request here (network.proxy.*
// prefs), and this answers *.example.com from tests/e2e/fixtures.mjs by host and path.
// Nothing reaches the real network.

import { createServer } from 'node:http';
import { fixtureFor } from '../fixtures.mjs';

export function startFixtureProxy() {
  const server = createServer((req, res) => {
    let target;
    try {
      // Proxied requests carry an absolute URL in the request line.
      target = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const fixture = fixtureFor(`https://${target.host}${target.pathname}`);
    if (!fixture) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not a fixture page');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fixture.html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ port, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}
