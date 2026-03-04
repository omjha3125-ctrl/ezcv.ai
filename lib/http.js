import http from 'http';
import https from 'https';

function getAgent(url) {
  return url.startsWith('https:') ? https : http;
}

export function requestJson({
  url,
  method = 'POST',
  headers = {},
  body = null,
  timeoutMs = 30000,
  lookup = undefined,
  // Safety cap to reduce memory/DoS risk if a provider returns an unexpectedly large payload.
  // 1 MiB is far above typical chat completion responses.
  maxResponseBytes = 1024 * 1024,
}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const agent = getAgent(u.protocol);

      const req = agent.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || undefined,
          path: `${u.pathname}${u.search}`,
          method,
          headers,
          lookup,
        },
        (res) => {
          let data = '';
          let bytes = 0;
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            bytes += Buffer.byteLength(chunk, 'utf8');
            if (bytes > maxResponseBytes) {
              res.destroy(new Error('Response too large'));
              return;
            }
            data += chunk;
          });
          res.on('error', (err) => reject(err));
          res.on('end', () => {
            const status = res.statusCode || 0;
            let json = null;
            try {
              json = data ? JSON.parse(data) : null;
            } catch (e) {
              // non-json response
              json = null;
            }
            resolve({ status, json, text: data, headers: res.headers });
          });
        }
      );

      req.on('error', (err) => reject(err));

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Request timed out'));
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
