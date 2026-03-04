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
    const { provider, rawInfo, targetRole, jobDescription, safeMode } = req.body || {};
    if (!rawInfo || typeof rawInfo !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing rawInfo' });
      return;
    }

    const dslRules = await loadDslRules();
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

    const outJson = await callOpenAiCompatible({
      provider,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      maxTokens: 1800,
    });

    let content = (pickChatContent(outJson) || '').trim();
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

    if (safeMode) {
      const beforeNums = extractNumberTokens(rawInfo);
      const afterNums = extractNumberTokens(content);
      const newNums = [];
      afterNums.forEach((n) => {
        if (!beforeNums.has(n)) newNums.push(n);
      });
      if (newNums.length > 0) {
        warnings.push(
          `Interview-safe mode: AI introduced new numbers (${newNums.join(
            ', '
          )}). Verify these are true before using.`
        );
      }
    }

    res.status(200).json({ ok: true, generatedText: content, warnings });
  } catch (err) {
    if (err instanceof ProviderError) {
      res.status(err.status || 502).json({ ok: false, error: err.message });
      return;
    }
    // Don't leak internal errors (paths, stack traces) to clients.
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
