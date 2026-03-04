import fs from 'fs';
import path from 'path';
import { requestJson } from '../../../lib/http';

// Optional override: create prompts/ezcv_dsl_rules.txt in your project root.
const DEFAULT_DSL_RULES = `EZCV PLAINTEXT DSL RULES (v1)

You MUST output ezcv plaintext only. No markdown. No commentary.

1) Blocks and triggers
- Start with a header block:
  #header Full Name

- Resume sections use one of these triggers (exactly):
  #section  <Header>
  #section1 <Header>
  #section2 <Header>

- Page breaks use this trigger on its own line:
  #pagebreak

2) Subsection fields inside a section
- Within a section, entries use these field lines:
  #title ...
  #subtitle ...
  #description ...
  #date ...
- Additional lines are plain text.
- Bullet lines start with "- " (dash + space).

3) Spacing / readability rules
- Put ONE blank line after each section trigger line.
- Put ONE blank line between entries (between two #title blocks).
- Do NOT cram everything into a single paragraph.

4) Header formatting rules (VERY IMPORTANT)
- After "#header Name", include 3–5 plain contact items on separate lines.
- Do NOT use labels like "Email:" or "Phone:".
- Prefer patterns like:
  mailto:someone@example.com
  (111) 222-3333
  github.com/user
  linkedin.com/in/user
  yoursite.com

5) Section templates
- Education: use #title/#subtitle/#date (+ optional GPA/Coursework lines)
- Experience/Projects: 2–4 bullets starting with "- "
- Skills: plain lines like "Code: ..." "Tools: ..." (avoid #title)

6) Truthfulness
- Do NOT invent employers, job titles, tools, certifications, degrees, dates, or metrics.
- If info is missing, use [fill] placeholders instead of fabricating.

7) Page break rule
- If the resume is likely to exceed one page OR there are more than 4 sections, insert at least ONE #pagebreak.
- Default location: after Experience (or after Projects if no Experience).
- "#pagebreak" must be on its own line with blank lines around it.
`;

function loadDslRules() {
  try {
    const p = path.join(process.cwd(), 'prompts', 'ezcv_dsl_rules.txt');
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return DEFAULT_DSL_RULES;
  }
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  return baseUrl.replace(/\/+$/, '');
}

function pickChatContent(json) {
  if (!json) return null;
  // OpenAI-style
  if (json.choices && json.choices[0] && json.choices[0].message) {
    return json.choices[0].message.content;
  }
  if (json.output_text) return json.output_text;
  return null;
}

function hasTrigger(text, key) {
  const re = new RegExp(`^\\s*#${key}\\b`, 'mi');
  return re.test(text || '');
}

function sanitizeHeaderBlock(text) {
  // Removes labels like "Email:" and normalizes email to mailto:
  const lines = (text || '').split(/\r?\n/);
  const isSectionStart = (l) =>
    /^\s*#(section|section1|section2|pagebreak)\b/i.test(l);
  const headerIdx = lines.findIndex((l) => /^\s*#header\b/i.test(l));
  if (headerIdx === -1) return text;

  let end = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    if (isSectionStart(lines[i])) {
      end = i;
      break;
    }
  }

  const block = lines.slice(headerIdx, end);
  const out = [];
  for (let i = 0; i < block.length; i += 1) {
    const raw = block[i];
    if (i === 0) {
      out.push(raw);
      continue;
    }

    let l = raw.trim();
    if (!l) {
      out.push(raw);
      continue;
    }

    // Strip common labels
    l = l.replace(
      /^(email|e-mail|phone|mobile|website|portfolio|linkedin|github)\s*:\s*/i,
      ''
    );

    // Normalize email
    if (/@/.test(l) && !/^mailto:/i.test(l) && !/^https?:/i.test(l)) {
      const emailMatch = l.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      );
      if (emailMatch) l = `mailto:${emailMatch[0]}`;
    }

    out.push(l);
  }

  return [...lines.slice(0, headerIdx), ...out, ...lines.slice(end)].join('\n');
}

function ensureAtLeastOnePagebreak(text) {
  const t = text || '';
  if (/^\s*#pagebreak\b/im.test(t)) return { text: t, inserted: false };

  const lines = t.split(/\r?\n/);
  const sectionStarts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (
      /^\s*#section\b/i.test(lines[i]) ||
      /^\s*#section1\b/i.test(lines[i]) ||
      /^\s*#section2\b/i.test(lines[i])
    ) {
      sectionStarts.push(i);
    }
  }

  const shouldBreak = lines.length > 75 || sectionStarts.length > 4;
  if (!shouldBreak) return { text: t, inserted: false };

  const findSectionLine = (name) =>
    lines.findIndex((l) =>
      new RegExp(`^\\s*#section\\d?\\s+${name}\\b`, 'i').test(l)
    );

  let startIdx = findSectionLine('Experience');
  if (startIdx === -1) startIdx = findSectionLine('Projects');
  if (startIdx === -1 && sectionStarts.length >= 3) startIdx = sectionStarts[2];
  if (startIdx === -1) return { text: t, inserted: false };

  // Find end of section (next block trigger or EOF)
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (/^\s*#(section|section1|section2|header|pagebreak)\b/i.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  const insert = ['', '', '#pagebreak', '', ''];
  const newLines = [...lines.slice(0, endIdx), ...insert, ...lines.slice(endIdx)];
  return { text: newLines.join('\n'), inserted: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { provider, rawInfo, targetRole, jobDescription, safeMode } = req.body || {};

    const baseUrl = normalizeBaseUrl(provider?.baseUrl);
    const model = provider?.model;
    const apiKey = provider?.apiKey;
    const extraHeaders = provider?.extraHeaders || {};

    if (!baseUrl) {
      res.status(400).json({ ok: false, error: 'Missing provider.baseUrl' });
      return;
    }
    if (!model) {
      res.status(400).json({ ok: false, error: 'Missing provider.model' });
      return;
    }
    if (!rawInfo || typeof rawInfo !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing rawInfo' });
      return;
    }

    const dslRules = loadDslRules();
    const safeLine = safeMode
      ? '- Interview-safe mode is ON: do not introduce any new numbers/metrics unless they appear in RAW INFO.\n'
      : '';
    const system = `${dslRules}

You are an expert resume writer.
Create an ezcv resume in ezcv plaintext format.

Extra instruction:
- If a job description is provided, align wording ONLY where supported by the raw info. Otherwise, do not add the keyword.
${safeLine}`;

    const jdBlock =
      jobDescription && jobDescription.trim().length > 0
        ? `JOB DESCRIPTION:\n${jobDescription.trim()}\n\n`
        : '';

    const user = `TARGET ROLE (optional):\n${(targetRole || '').trim()}\n\nRAW INFO:\n${rawInfo.trim()}\n\n${jdBlock}OUTPUT: Generate the full ezcv plaintext resume.`;

    const endpoint = `${baseUrl}/chat/completions`;

    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (apiKey && apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      max_tokens: 1800,
    };

    const out = await requestJson({ url: endpoint, headers, body: payload });

    if (out.status < 200 || out.status >= 300) {
      const msg =
        (out.json && (out.json.error?.message || out.json.error)) ||
        out.text ||
        `Provider error (${out.status})`;
      res.status(502).json({ ok: false, error: String(msg) });
      return;
    }

    let content = (pickChatContent(out.json) || '').trim();
    if (!content) {
      res.status(502).json({ ok: false, error: 'Empty model response' });
      return;
    }

    content = sanitizeHeaderBlock(content);
    const pb = ensureAtLeastOnePagebreak(content);
    content = pb.text.trim();

    // Basic validation so we don't inject garbage into the editor.
    const warnings = [];
    if (!hasTrigger(content, 'header')) {
      warnings.push('Generated text does not include a #header section.');
    }
    if (!hasTrigger(content, 'section')) {
      warnings.push('Generated text does not include any #section blocks.');
    }
    if (pb.inserted) {
      warnings.push(
        'Inserted a #pagebreak automatically because the generated resume looked longer than one page.'
      );
    }

    res.status(200).json({ ok: true, generatedText: content, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}
