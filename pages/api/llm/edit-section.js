import {
  countKeyLines,
  extractNumberTokens,
  firstNonEmptyLine,
  loadDslRules,
  pickChatContent,
} from '../../../lib/llm/ezcv';
import { callOpenAiCompatible, ProviderError } from '../../../lib/llm/openaiCompatible';

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

    if (!sectionText || typeof sectionText !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing sectionText' });
      return;
    }
    if (!instruction || typeof instruction !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing instruction' });
      return;
    }

    const mustKeepHeader = firstNonEmptyLine(sectionText);

    const dslRules = await loadDslRules();
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

    const outJson = await callOpenAiCompatible({
      provider,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      maxTokens: 900,
    });

    const content = (pickChatContent(outJson) || '').trim();
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
    if (err instanceof ProviderError) {
      res.status(err.status || 502).json({ ok: false, error: err.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
