const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PROXY_PORT = 8787;
const cache = new Map();
let lastRequestAt = 0;

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=86400',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
};

const proxy = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://localhost:${PROXY_PORT}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    response.end();
    return;
  }

  if (requestUrl.pathname !== '/geocode') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const query = requestUrl.searchParams.get('q')?.trim();
  if (!query) {
    sendJson(response, 400, { error: 'Missing query' });
    return;
  }

  const key = query.toLowerCase();
  if (cache.has(key)) {
    sendJson(response, 200, cache.get(key));
    return;
  }

  try {
    const waitMs = Math.max(0, 1100 - (Date.now() - lastRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();

    const upstreamUrl = new URL('https://nominatim.openstreetmap.org/search');
    upstreamUrl.searchParams.set('format', 'json');
    upstreamUrl.searchParams.set('addressdetails', '0');
    upstreamUrl.searchParams.set('limit', '1');
    upstreamUrl.searchParams.set('accept-language', 'sr-Latn');
    upstreamUrl.searchParams.set('q', query);

    const upstream = await fetch(upstreamUrl, {
      headers: {
        'Accept-Language': 'sr-Latn',
        'User-Agent': 'JobHop/1.0 (local Expo development)',
      },
    });

    if (!upstream.ok) throw new Error(`Geocoder returned ${upstream.status}`);

    const results = await upstream.json();
    const first = Array.isArray(results) ? results[0] : null;
    const payload = first?.lat && first?.lon
      ? { lat: Number(first.lat), lon: Number(first.lon) }
      : null;

    cache.set(key, payload);
    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: 'Geocoding unavailable' });
  }
});

proxy.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`Geocoding proxy listening on http://localhost:${PROXY_PORT}`);
});

const expoCli = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const expo = spawn(process.execPath, [expoCli, 'start', '--web', ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

const shutdown = () => {
  proxy.close();
  expo.kill();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
expo.on('exit', (code) => {
  proxy.close();
  process.exit(code ?? 0);
});
