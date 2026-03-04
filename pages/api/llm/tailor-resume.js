import {
  ensureAtLeastOnePagebreak,
  extractNumberTokens,
  hasTrigger,
  loadDslRules,
  pickChatContent,
  sanitizeHeaderBlock,
} from '../../../lib/llm/ezcv';
import { callOpenAiCompatible, ProviderError } from '../../../lib/llm/openaiCompatible';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { provider, resumeText, jobDescription, safeMode = true } = req.body || {};

    if (!resumeText || typeof resumeText !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing resumeText' });
      return;
    }
    if (
      !jobDescription ||
      typeof jobDescription !== 'string' ||
      jobDescription.trim().length < 20
    ) {
      res.status(400).json({ ok: false, error: 'Missing jobDescription' });
      return;
    }

    const dslRules = await loadDslRules();
    const safeLine = safeMode
      ? '- Interview-safe mode is ON: do not introduce any new numbers/metrics unless they already appear in RESUME TEXT.\n'
      : '';

    const system = `${dslRules}

You are an expert resume tailor.

You will be given:
1) An EXISTING resume in ezcv plaintext format.
2) A job description.

Task:
- Rewrite the ENTIRE resume to better match the job description.
- Only rephrase, reorder, and emphasize content that is already supported by the existing resume.

Hard rules:
- Output ONLY ezcv plaintext. No markdown. No commentary.
- Preserve the ezcv triggers (#header, #section/#section1/#section2, #title/#subtitle/#date/#description, #pagebreak).
- Do NOT invent employers, job titles, tools, certifications, degrees, dates, or metrics.
- Do NOT add new sections. Keep the existing section list; you may reorder bullets inside sections.
${safeLine}
If the job description asks for something not supported by the resume, do not add it.
Prefer conservative wording over guessing.
`;

    const user = `JOB DESCRIPTION:\n${jobDescription.trim()}\n\nRESUME TEXT (ezcv plaintext):\n${resumeText.trim()}\n\nOUTPUT: Return the full tailored resume in ezcv plaintext.`;

    const outJson = await callOpenAiCompatible({
      provider,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      maxTokens: 2200,
    });

    let content = (pickChatContent(outJson) || '').trim();
    if (!content) {
      res.status(502).json({ ok: false, error: 'Empty model response' });
      return;
    }

    // Normalize header/contact formatting and ensure at least one page break for long resumes.
    content = sanitizeHeaderBlock(content);
    const pb = ensureAtLeastOnePagebreak(content);
    content = pb.text.trim();

    const warnings = [];
    if (!hasTrigger(content, 'header')) {
      warnings.push('Tailored text does not include a #header section.');
    }
    if (!hasTrigger(content, 'section')) {
      warnings.push('Tailored text does not include any #section blocks.');
    }
    if (pb.inserted) {
      warnings.push(
        'Inserted a #pagebreak automatically because the tailored resume looked longer than one page.'
      );
    }

    if (safeMode) {
      const beforeNums = extractNumberTokens(resumeText);
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

    res.status(200).json({ ok: true, tailoredText: content, warnings });
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
