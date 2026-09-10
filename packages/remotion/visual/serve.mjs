// @ts-check
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

/** @type {Record<string, string>} */
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

/** @param {string} directory @param {string} requestUrl */
export function bundlePath(directory, requestUrl) {
  const root = resolve(directory);
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep)) throw new Error('Bundle request escapes its directory');
  return file;
}

/** A single loopback origin avoids Chromium navigation races when many short
 * renders repeatedly create/destroy Remotion's default localhost page server.
 * Only the owned bundle is served; no public directory or external proxy.
 * @param {string} directory */
export async function serveBundle(directory) {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    void (async () => {
      try {
        const file = bundlePath(directory, request.url ?? '/');
        const bytes = await readFile(file);
        response.writeHead(200, {
          'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
          'Content-Length': bytes.length, 'Cache-Control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : bytes);
      } catch {
        response.writeHead(404, {'Content-Type': 'text/plain'}).end('Bundle resource not found');
      }
    })();
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveReady(undefined);
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Visual bundle server did not acquire a loopback TCP port');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClosed, reject) => {
      server.close((error) => error ? reject(error) : resolveClosed(undefined));
      server.closeAllConnections();
    }),
  };
}
