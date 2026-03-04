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
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
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
