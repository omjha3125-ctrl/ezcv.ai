import { requestJson } from '../http';
import {
  joinUrl,
  sanitizeExtraHeaders,
  validateAndNormalizeProviderBaseUrl,
} from './provider';

export class ProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export async function callOpenAiCompatible({
  provider,
  messages,
  temperature = 0.35,
  maxTokens = 1800,
  timeoutMs = 30000,
}) {
  let normalized;
  try {
    normalized = await validateAndNormalizeProviderBaseUrl(provider?.baseUrl);
  } catch (e) {
    throw new ProviderError('Invalid provider.baseUrl', 400);
  }

  const { baseUrl, lookup } = normalized;
  const model = provider?.model;
  const apiKey = provider?.apiKey;
  const extraHeaders = sanitizeExtraHeaders(provider?.extraHeaders || {});

  if (!baseUrl) throw new ProviderError('Missing provider.baseUrl', 400);
  if (!model) throw new ProviderError('Missing provider.model', 400);

  const endpoint = joinUrl(baseUrl, '/chat/completions');
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (apiKey && String(apiKey).trim().length > 0) {
    headers.Authorization = `Bearer ${String(apiKey).trim()}`;
  }

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const out = await requestJson({
    url: endpoint,
    headers,
    body: payload,
    timeoutMs,
    lookup,
  });

  if (out.status < 200 || out.status >= 300) {
    const msg =
      (out.json && (out.json.error?.message || out.json.error)) ||
      out.text ||
      `Provider error (${out.status})`;
    throw new ProviderError(String(msg), 502);
  }

  return out.json;
}
