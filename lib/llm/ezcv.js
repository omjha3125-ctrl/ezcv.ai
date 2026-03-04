import fs from 'fs';
import path from 'path';

// Optional override: create prompts/ezcv_dsl_rules.txt in your project root.
export const DEFAULT_DSL_RULES = `EZCV PLAINTEXT DSL RULES (v1)

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

5) Truthfulness
- Do NOT invent employers, job titles, tools, certifications, degrees, dates, or metrics.
- If info is missing, use [fill] placeholders instead of fabricating.

6) Page break rule
- If the resume is likely to exceed one page OR there are more than 4 sections, insert at least ONE #pagebreak.
- Default location: after Experience (or after Projects if no Experience).
- "#pagebreak" must be on its own line with blank lines around it.
`;

let cachedRules = null;
let cachedRulesPromise = null;

export async function loadDslRules() {
  if (cachedRules) return cachedRules;
  if (cachedRulesPromise) return cachedRulesPromise;

  cachedRulesPromise = (async () => {
    try {
      const p = path.join(process.cwd(), 'prompts', 'ezcv_dsl_rules.txt');
      const txt = await fs.promises.readFile(p, 'utf8');
      cachedRules = txt;
    } catch (e) {
      cachedRules = DEFAULT_DSL_RULES;
    } finally {
      cachedRulesPromise = null;
    }
    return cachedRules;
  })();

  return cachedRulesPromise;
}

export function pickChatContent(json) {
  if (!json) return null;
  // OpenAI-style
  if (json?.choices?.[0]?.message?.content) {
    return json.choices[0].message.content;
  }
  // Some providers return `output_text`.
  if (json.output_text) return json.output_text;
  return null;
}

export function hasTrigger(text, key) {
  const re = new RegExp(`^\\s*#${key}\\b`, 'mi');
  return re.test(text || '');
}

export function firstNonEmptyLine(text) {
  const lines = (text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim()) return lines[i];
  }
  return '';
}

export function extractNumberTokens(text) {
  const matches = (text || '').match(/\b\d+(?:\.\d+)?%?\b/g);
  return new Set(matches || []);
}

export function countKeyLines(text, key) {
  const re = new RegExp(`^\\s*#${key}\\b`, 'mi');
  const lines = (text || '').split(/\r?\n/);
  return lines.filter((l) => re.test(l)).length;
}

export function sanitizeHeaderBlock(text) {
  // Removes labels like "Email:" and normalizes email to mailto:
  const lines = (text || '').split(/\r?\n/);
  const isSectionStart = (l) => /^\s*#(section|section1|section2|pagebreak)\b/i.test(l);
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
      const emailMatch = l.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch) l = `mailto:${emailMatch[0]}`;
    }

    out.push(l);
  }

  return [...lines.slice(0, headerIdx), ...out, ...lines.slice(end)].join('\n');
}

export function ensureAtLeastOnePagebreak(text) {
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

  // If the user has an "end" section (certificates/awards/etc.), prefer breaking
  // *before* it so the tail doesn't get clipped in the preview.
  const preferredBreakBefore = [
    'Certifications',
    'Certificates',
    'Certification',
    'Awards',
    'Publications',
  ];

  let preferredIdx = -1;
  for (let i = 0; i < preferredBreakBefore.length; i += 1) {
    preferredIdx = findSectionLine(preferredBreakBefore[i]);
    if (preferredIdx !== -1) break;
  }

  if (preferredIdx !== -1) {
    const insert = ['', '', '#pagebreak', '', ''];
    const newLines = [
      ...lines.slice(0, preferredIdx),
      ...insert,
      ...lines.slice(preferredIdx),
    ];
    return { text: newLines.join('\n'), inserted: true };
  }

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
