import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const uploadDir = path.join(projectRoot, 'output', 'upload-test');
const uploadRoute = '/image';
const uploadPublicPath = '/uploads/';
const defaultPort = 5173;
const maxUploadBytes = 10 * 1024 * 1024;
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp']
]);

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const port = readPort(process.argv.slice(2));

const server = createServer(async (request, response) => {
  try {
    await routeRequest(request, response);
  } catch (error) {
    sendError(response, error);
  }
});

server.listen(port, () => {
  console.log(`Moonglade.Editor upload test server running at http://localhost:${port}/demo/`);
  console.log(`Image uploads: POST ${uploadRoute}`);
  console.log(`Uploaded files: ${uploadDir}`);
});

async function routeRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `localhost:${port}`}`);

  if (request.method === 'POST' && url.pathname === uploadRoute) {
    await handleImageUpload(request, response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    if (url.pathname.startsWith(uploadPublicPath)) {
      await serveUploadedFile(request, response, url.pathname);
      return;
    }

    await serveProjectFile(request, response, url.pathname);
    return;
  }

  response.writeHead(405, {
    Allow: 'GET, HEAD, POST',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({ error: 'Method not allowed.' }));
}

async function handleImageUpload(request, response) {
  const contentType = request.headers['content-type'] ?? '';
  const boundary = getMultipartBoundary(contentType);

  if (!boundary) {
    throw new HttpError(400, 'Expected multipart/form-data with a boundary.');
  }

  const body = await readRequestBody(request, maxUploadBytes);
  const filePart = parseMultipartFormData(body, boundary).find((part) => part.name === 'file' && part.filename);

  if (!filePart) {
    throw new HttpError(400, 'Expected an uploaded file in the "file" form field.');
  }

  if (filePart.data.length === 0) {
    throw new HttpError(400, 'Uploaded file is empty.');
  }

  const originalName = sanitizeOriginalFileName(filePart.filename);
  const extension = path.extname(originalName).toLowerCase();

  if (!allowedImageExtensions.has(extension)) {
    throw new HttpError(415, `Unsupported image extension "${extension || '(none)'}".`);
  }

  const partContentType = filePart.headers.get('content-type')?.toLowerCase() ?? '';
  if (partContentType && !partContentType.startsWith('image/')) {
    throw new HttpError(415, `Unsupported content type "${partContentType}".`);
  }

  await mkdir(uploadDir, { recursive: true });

  const storedName = createStoredFileName(originalName);
  const storedPath = path.join(uploadDir, storedName);
  await writeFile(storedPath, filePart.data);

  sendJson(response, 200, {
    location: `${uploadPublicPath}${encodeURIComponent(storedName)}`,
    filename: originalName,
    title: originalName,
    size: filePart.data.length,
    contentType: partContentType || 'application/octet-stream'
  });
}

async function serveUploadedFile(request, response, pathname) {
  const fileName = pathname.slice(uploadPublicPath.length);
  const filePath = getSafeFilePath(uploadDir, fileName);

  await serveFile(request, response, filePath, {
    'Cache-Control': 'no-store'
  });
}

async function serveProjectFile(request, response, pathname) {
  const normalizedPath = pathname === '/' ? '/demo/' : pathname;
  const staticPath = normalizedPath.endsWith('/') ? `${normalizedPath}index.html` : normalizedPath;
  const filePath = getSafeFilePath(projectRoot, staticPath);

  await serveFile(request, response, filePath, {
    'Cache-Control': staticPath.endsWith('.html') ? 'no-store' : 'public, max-age=60'
  });
}

async function serveFile(request, response, filePath, headers) {
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new HttpError(404, 'File not found.');
  }

  if (!fileStats.isFile()) {
    throw new HttpError(404, 'File not found.');
  }

  response.writeHead(200, {
    ...headers,
    'Content-Length': fileStats.size,
    'Content-Type': getContentType(filePath)
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    response.end('Unable to read file.');
  });
  stream.pipe(response);
}

function parseMultipartFormData(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from('\r\n\r\n');
  const parts = [];
  let position = body.indexOf(boundaryBuffer);

  while (position >= 0) {
    position += boundaryBuffer.length;

    if (body[position] === 45 && body[position + 1] === 45) {
      break;
    }

    if (body[position] === 13 && body[position + 1] === 10) {
      position += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, position);
    if (headerEnd < 0) {
      break;
    }

    const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundary}`), headerEnd + headerSeparator.length);
    if (nextBoundary < 0) {
      break;
    }

    const headers = parsePartHeaders(body.subarray(position, headerEnd).toString('latin1'));
    const disposition = parseContentDisposition(headers.get('content-disposition') ?? '');

    parts.push({
      headers,
      name: disposition.name,
      filename: disposition.filename,
      data: body.subarray(headerEnd + headerSeparator.length, nextBoundary)
    });

    position = nextBoundary + 2;
  }

  return parts;
}

function parsePartHeaders(rawHeaders) {
  const headers = new Map();

  for (const line of rawHeaders.split('\r\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    headers.set(
      line.slice(0, separatorIndex).trim().toLowerCase(),
      line.slice(separatorIndex + 1).trim()
    );
  }

  return headers;
}

function parseContentDisposition(value) {
  const result = {};

  for (const segment of value.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = segment.slice(separatorIndex + 1).trim();
    result[key] = unquoteHeaderValue(rawValue);
  }

  return result;
}

function unquoteHeaderValue(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }

  return value;
}

function getMultipartBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2]?.trim() ?? null;
}

function readRequestBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > limit) {
        request.destroy();
        reject(new HttpError(413, `Upload exceeds the ${formatBytes(limit)} test server limit.`));
        return;
      }

      chunks.push(chunk);
    });

    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function sanitizeOriginalFileName(fileName) {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? '';
  return baseName || 'image';
}

function createStoredFileName(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  const stem = path.basename(originalName, extension)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-${randomUUID()}-${stem}${extension}`;
}

function getSafeFilePath(basePath, requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    throw new HttpError(400, 'Invalid URL path.');
  }

  if (decodedPath.includes('\0')) {
    throw new HttpError(400, 'Invalid URL path.');
  }

  const filePath = path.resolve(basePath, `.${decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`}`);
  const relativePath = path.relative(basePath, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new HttpError(403, 'Path is outside the served directory.');
  }

  return filePath;
}

function getContentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(payload);
}

function sendError(response, error) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';

  if (statusCode >= 500) {
    console.error(error);
  }

  sendJson(response, statusCode, { error: message });
}

function readPort(args) {
  const portFlagIndex = args.indexOf('--port');
  const explicitPort = portFlagIndex >= 0 ? Number(args[portFlagIndex + 1]) : Number.NaN;
  const environmentPort = Number(process.env.PORT);
  const selectedPort = Number.isInteger(explicitPort) ? explicitPort : environmentPort;

  return Number.isInteger(selectedPort) && selectedPort > 0 ? selectedPort : defaultPort;
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
