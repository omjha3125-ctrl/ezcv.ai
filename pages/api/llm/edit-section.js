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

5) Truthfulness (non-negotiable)
- Do NOT invent employers, job titles, tools, certifications, degrees, dates, or metrics.
- If info is missing, use [fill] placeholders instead of fabricating.

6) Page break rule
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

function firstNonEmptyLine(text) {
  const lines = (text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i].trimEnd();
    if (l.trim().length > 0) return lines[i];
  }
  return '';
}

function extractNumberTokens(text) {
  const matches = (text || '').match(/\b\d+(?:\.\d+)?%?\b/g);
  return new Set(matches || []);
}

function countKeyLines(text, key) {
  const re = new RegExp(`^\\s*#${key}\\b`, 'mi');
  const lines = (text || '').split(/\r?\n/);
  return lines.filter((l) => re.test(l)).length;
}

function pickChatContent(json) {
  if (!json) return null;
  // OpenAI-style
  if (json.choices && json.choices[0] && json.choices[0].message) {
    return json.choices[0].message.content;
  }
  // some providers return `text` or other shapes
  if (json.output_text) return json.output_text;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const {
      provider,
      instruction,
      sectionText,
      jobDescription,
      safeMode = true,
    } = req.body || {};

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
    if (!sectionText || typeof sectionText !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing sectionText' });
      return;
    }
    if (!instruction || typeof instruction !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing instruction' });
      return;
    }

    const mustKeepHeader = firstNonEmptyLine(sectionText);

    const dslRules = loadDslRules();
    const safeLine = safeMode
      ? '- Interview-safe mode is ON: do not introduce any new numbers/metrics that are not already present in the input section.\n'
      : '';
    const system = `${dslRules}

You are an expert resume editor.
You will be given ONE resume section in ezcv plaintext format.

Hard rules:
- Output ONLY the updated section text (no markdown, no commentary).
- Preserve the first non-empty line EXACTLY as provided.
- Preserve the ezcv trigger format (#section/#section1/#section2/#header plus field lines like #title/#subtitle/#date/#description).
- Do not add new sections.
- Do not invent experience, employers, roles, tools, certifications, or metrics.
${safeLine}
If the instruction asks for something unsupported by the text, prefer a conservative rewrite rather than adding new claims.
`;

    const user = `INSTRUCTION:\n${instruction.trim()}\n\n${
      jobDescription && jobDescription.trim().length > 0
        ? `JOB DESCRIPTION:\n${jobDescription.trim()}\n\n`
        : ''
    }SECTION (keep first line exactly):\n${sectionText}`;

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
      max_tokens: 900,
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

    const content = (pickChatContent(out.json) || '').trim();
    if (!content) {
      res.status(502).json({ ok: false, error: 'Empty model response' });
      return;
    }

    const updatedHeader = firstNonEmptyLine(content);
    if (mustKeepHeader.trimEnd() !== updatedHeader.trimEnd()) {
      res.status(200).json({
        ok: false,
        error:
          'The AI did not preserve the section header line. This is rejected to prevent format breakage.',
      });
      return;
    }

    const warnings = [];

    // Guardrails: avoid accidental structure expansion.
    const keys = ['title', 'subtitle', 'date', 'description', 'section', 'header'];
    keys.forEach((k) => {
      const before = countKeyLines(sectionText, k);
      const after = countKeyLines(content, k);
      if (after > before) {
        warnings.push(
          `AI added extra "#${k}" lines. Verify this does not create new claims or break structure.`
        );
      }
    });

    if (safeMode) {
      const beforeNums = extractNumberTokens(sectionText);
      const afterNums = extractNumberTokens(content);
      const newNums = [];
      afterNums.forEach((n) => {
        if (!beforeNums.has(n)) newNums.push(n);
      });
      if (newNums.length > 0) {
        warnings.push(
          `Interview-safe mode: AI introduced new numbers (${newNums.join(
            ', '
          )}). Verify these are true before applying.`
        );
      }
    }

    res.status(200).json({
      ok: true,
      updatedSectionText: content,
      warnings,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}
