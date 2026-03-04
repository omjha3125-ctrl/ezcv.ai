import dns from 'dns';
import net from 'net';

// Security posture:
// - Default: only https://, block private/loopback/link-local IPs.
// - Allow overrides via env for local development / self-hosting.

const DEFAULT_ALLOW_INSECURE_HTTP = false;
const DEFAULT_ALLOW_PRIVATE_IPS = false;

function envBool(name, fallback) {
  const v = (process.env[name] || '').trim().toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envCsv(name) {
  const v = (process.env[name] || '').trim();
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateIpv4(ip) {
  // Assumes ip is a valid dotted quad.
  const parts = ip.split('.').map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 0 || a === 10 || a === 127) return true;
  // 169.254.0.0/16 (link-local, includes cloud metadata IPs)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // Documentation / test / special-purpose ranges — treat as non-public.
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0) return true;

  // Multicast / reserved
  if (a >= 224) return true;

  return false;
}

function isPrivateIpv6(ip) {
  const v = ip.toLowerCase();
  // Loopback
  if (v === '::1') return true;
  // Unspecified
  if (v === '::') return true;
  // Link-local fe80::/10
  if (
    v.startsWith('fe8') ||
    v.startsWith('fe9') ||
    v.startsWith('fea') ||
    v.startsWith('feb')
  )
    return true;
  // Unique local fc00::/7
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  // Multicast ff00::/8
  if (v.startsWith('ff')) return true;
  // Documentation 2001:db8::/32
  if (v.startsWith('2001:db8')) return true;
  return false;
}

function isNonPublicIp(ip) {
  const t = net.isIP(ip);
  if (t === 4) return isPrivateIpv4(ip);
  if (t === 6) return isPrivateIpv6(ip);
  return true;
}

export function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  return String(baseUrl).trim().replace(/\/+$/, '');
}

export function sanitizeExtraHeaders(extraHeaders) {
  const out = {};
  const banned = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'upgrade',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
  ]);

  Object.entries(extraHeaders || {}).forEach(([k, v]) => {
    if (!k) return;
    const key = String(k).trim();
    const lower = key.toLowerCase();
    if (!key || banned.has(lower)) return;
    if (typeof v !== 'string' || !v.trim()) return;
    // Allow common provider headers and generic X-*.
    if (lower === 'http-referer' || lower === 'x-title' || lower.startsWith('x-')) {
      out[key] = v;
    }
  });

  return out;
}

export async function validateAndNormalizeProviderBaseUrl(inputBaseUrl) {
  const allowInsecureHttp = envBool(
    'EZCV_ALLOW_INSECURE_LLM_HTTP',
    DEFAULT_ALLOW_INSECURE_HTTP
  );
  const allowPrivateIps = envBool('EZCV_ALLOW_PRIVATE_LLM_IPS', DEFAULT_ALLOW_PRIVATE_IPS);
  const allowHosts = envCsv('EZCV_LLM_HOST_ALLOWLIST');
  const requireAllowlist = envBool('EZCV_REQUIRE_LLM_HOST_ALLOWLIST', false);

  const baseUrl = normalizeBaseUrl(inputBaseUrl);
  if (!baseUrl) throw new Error('Invalid provider URL');

  let u;
  try {
    u = new URL(baseUrl);
  } catch (e) {
    throw new Error('Invalid provider URL');
  }

  if (u.username || u.password) throw new Error('Invalid provider URL');
  if (u.protocol !== 'https:' && !(allowInsecureHttp && u.protocol === 'http:')) {
    throw new Error('Invalid provider URL');
  }

  // Optional allowlist of hostnames (recommended for multi-tenant hosted deployments).
  if (requireAllowlist && allowHosts.length === 0) {
    throw new Error('Invalid provider URL');
  }
  if (allowHosts.length > 0) {
    const host = u.hostname.toLowerCase();
    const ok = allowHosts.includes(host);
    if (!ok) throw new Error('Invalid provider URL');
  }

  // Block obvious local hostnames early.
  const h = u.hostname.toLowerCase();
  if (!allowPrivateIps && (h === 'localhost' || h.endsWith('.local'))) {
    throw new Error('Invalid provider URL');
  }

  // Resolve DNS and block private/loopback/link-local targets.
  // NOTE: this mitigates common SSRF. For stricter protection against DNS rebinding,
  // set a hostname allowlist (EZCV_LLM_HOST_ALLOWLIST) and avoid arbitrary hosts.
  let validatedAddrs = null;
  if (!allowPrivateIps) {
    const addrs = await dns.promises.lookup(u.hostname, {
      all: true,
      verbatim: true,
    });

    if (!Array.isArray(addrs) || addrs.length === 0) {
      throw new Error('Invalid provider URL');
    }

    const bad = addrs.find((a) => isNonPublicIp(a.address));
    if (bad) throw new Error('Invalid provider URL');

    validatedAddrs = addrs
      .map((a) => (a && typeof a.address === 'string' ? a.address.trim() : ''))
      .filter(Boolean);

    // Defensive: never build a custom lookup with an empty address list.
    // If this happens, treat it as invalid rather than passing undefined to net.connect.
    if (!Array.isArray(validatedAddrs) || validatedAddrs.length === 0) {
      throw new Error('Invalid provider URL');
    }
  }

  // Mitigate basic DNS-rebinding by forcing the TCP connection to use the
  // addresses validated above (instead of re-resolving during the request).
  const lookup = validatedAddrs
    ? (hostname, options, cb) => {
        // Node may call lookup(hostname, cb) or lookup(hostname, options, cb)
        let opts = options;
        let callback = cb;
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }

        const family =
          opts && typeof opts === 'object' && typeof opts.family === 'number'
            ? opts.family
            : 0;

        let ip = null;
        if (family === 4 || family === 6) {
          ip = validatedAddrs.find((a) => net.isIP(a) === family) || null;
        }

        ip =
          ip ||
          validatedAddrs.find((a) => net.isIP(a) === 4) ||
          validatedAddrs.find((a) => net.isIP(a) === 6) ||
          validatedAddrs[0];

        if (!ip) {
          callback(new Error('DNS validation yielded no usable IPs'));
          return;
        }

        callback(null, ip, net.isIP(ip));
      }
    : undefined;

  return { baseUrl: normalizeBaseUrl(u.toString()), lookup };
}

export function joinUrl(baseUrl, p) {
  const b = `${normalizeBaseUrl(baseUrl)}/`;
  const u = new URL(String(p || '').replace(/^\//, ''), b);
  return u.toString();
}
