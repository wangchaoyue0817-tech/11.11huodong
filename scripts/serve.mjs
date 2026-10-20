import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function isInside(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function resolveFile(root, pathname) {
  const requested = path.resolve(root, `.${pathname}`);
  if (!isInside(root, requested)) return null;
  const candidates = [requested];
  if (!path.extname(requested)) candidates.push(`${requested}.html`);
  candidates.push(path.join(requested, 'index.html'));
  for (const candidate of candidates) {
    try {
      const actual = await realpath(candidate);
      if (isInside(root, actual) && (await stat(actual)).isFile()) return actual;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
  return null;
}

export async function createStaticServer({root = path.join(projectDir, 'public')} = {}) {
  const canonicalRoot = await realpath(path.resolve(root));
  return createServer(async (request, response) => {
    const reply = (status, message) => {
      response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return reply(405, 'Method not allowed');
    }
    let pathname;
    try {
      pathname = decodeURIComponent((request.url || '/').split(/[?#]/)[0]);
    } catch {
      return reply(400, 'Invalid URL');
    }
    // Check the original path before a URL parser can normalize traversal segments.
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\') ||
        pathname.split('/').some(part => part === '..' || part.startsWith('.'))) {
      return reply(403, 'Forbidden');
    }
    try {
      const filename = await resolveFile(canonicalRoot, pathname);
      if (!filename) return reply(404, 'Not found');
      const details = await stat(filename);
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': details.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(filename);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      console.error('Static request failed:', error.message);
      reply(500, 'Server error');
    }
  });
}

export function parseArguments(args) {
  const options = {host: '127.0.0.1', port: 4181, root: path.join(projectDir, 'public')};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!['--host', '--port', '--root'].includes(flag) || !args[index + 1]) {
      throw new Error(`Unsupported argument: ${flag}`);
    }
    const value = args[++index];
    if (flag === '--port') {
      if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error('Port must be between 0 and 65535');
      options.port = Number(value);
    } else if (flag === '--host') options.host = value;
    else options.root = path.resolve(projectDir, value);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const server = await createStaticServer(options);
    server.on('error', error => {
      console.error(error.message);
      process.exitCode = 1;
    });
    server.listen(options.port, options.host, () => {
      console.log(`图灵鉴 X: http://${options.host}:${server.address().port}`);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
