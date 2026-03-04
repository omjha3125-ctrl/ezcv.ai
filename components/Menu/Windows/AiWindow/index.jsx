import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { COLORS, TRIGGERS } from '../../../../constants';
import Button from '../../../Button';

const Container = styled.div`
  height: calc(100vh - 170px);
  border: 2px solid ${COLORS.darkBrown};
  background: ${COLORS.yellow};
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px;

  @media only screen and (max-width: ${TRIGGERS.mobileBreakpoint}) {
    height: 500px;
  }
`;

const Card = styled.div`
  border: 2px solid ${COLORS.darkBrown};
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  padding: 12px;
  margin-bottom: 12px;
`;

const Title = styled.div`
  font-weight: 900;
  margin-bottom: 4px;
`;

const Desc = styled.div`
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 10px;
  line-height: 1.35;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media only screen and (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Label = styled.div`
  font-weight: 800;
  margin-bottom: 6px;
  font-size: 12px;
`;

const Input = styled.input`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  &:focus {
    background: rgba(255, 255, 255, 0.9);
  }
`;

const Select = styled.select`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
`;

const Textarea = styled.textarea`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 120px;
  resize: vertical;

  &:focus {
    background: rgba(255, 255, 255, 0.9);
  }
`;

const Pre = styled.pre`
  margin: 0;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  border: 2px solid ${COLORS.darkBrown};
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  max-height: 260px;
  overflow: auto;
`;

const PROVIDERS = {
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    modelHint: 'e.g. llama3.1',
    needsKey: false,
  },
  lmstudio: {
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    modelHint: 'e.g. the loaded model id',
    needsKey: false,
  },
  openrouter: {
    label: 'OpenRouter (cloud)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    modelHint: 'e.g. openai/gpt-4o-mini',
    needsKey: true,
  },
  groq: {
    label: 'Groq (cloud)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    modelHint: 'e.g. llama-3.3-70b-versatile',
    needsKey: true,
  },
};

export default function AiWindow({
  aiSettings,
  setAiSettings,
  onOpenAi,
  onGenerateDraft,
  onApplyDraft,
  onTailorResume,
  resumeText,
}) {
  const providerMeta = useMemo(() => PROVIDERS[aiSettings?.providerId], [
    aiSettings?.providerId,
  ]);

  const [targetRole, setTargetRole] = useState('');
  const [rawInfo, setRawInfo] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [includeJD, setIncludeJD] = useState(false);

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Tailor existing resume state
  const [tailorJD, setTailorJD] = useState('');
  const [tailorBusy, setTailorBusy] = useState(false);
  const [tailored, setTailored] = useState('');
  const [tailorError, setTailorError] = useState(null);
  const [tailorWarnings, setTailorWarnings] = useState([]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const out = await onGenerateDraft({
        targetRole,
        rawInfo,
        jobDescription: includeJD ? jobDescription : '',
        safeMode: aiSettings?.safeMode !== false,
      });

      if (out.ok === false) {
        setError(out.error || 'Failed to generate');
        setDraft('');
        return;
      }

      setDraft(out.generatedText || '');
      setWarnings(out.warnings || []);
    } finally {
      setBusy(false);
    }
  };


  const tailor = async () => {
    setTailorBusy(true);
    setTailorError(null);
    setTailorWarnings([]);
    try {
      if (!onTailorResume) {
        setTailorError('Tailor is not wired up.');
        return;
      }
      if (!resumeText || resumeText.trim().length === 0) {
        setTailorError('No resume text found. Add content first.');
        return;
      }
      if (!tailorJD || tailorJD.trim().length < 20) {
        setTailorError('Paste a job description first.');
        return;
      }

      const out = await onTailorResume({
        jobDescription: tailorJD,
        safeMode: aiSettings?.safeMode !== false,
      });

      if (out.ok === false) {
        setTailorError(out.error || 'Failed to tailor');
        setTailored('');
        return;
      }

      setTailored(out.tailoredText || '');
      setTailorWarnings(out.warnings || []);
    } finally {
      setTailorBusy(false);
    }
  };

  return (
    <Container>
      <Card>
        <Title>AI setup</Title>
        <Desc>
          Configure your AI provider once. Then:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>Click a resume section in the preview to edit it with AI.</li>
            <li>Or generate a first draft from raw notes below.</li>
          </ul>
        </Desc>

        <FieldGrid>
          <div>
            <Label>Provider</Label>
            <Select
              value={aiSettings?.providerId}
              onChange={(e) => {
                const providerId = e.target.value;
                const meta = PROVIDERS[providerId];
                setAiSettings({
                  ...aiSettings,
                  providerId,
                  baseUrl: meta.baseUrl,
                  model: meta.defaultModel || aiSettings.model || '',
                });
              }}
            >
              {Object.entries(PROVIDERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Base URL</Label>
            <Input
              value={aiSettings?.baseUrl || ''}
              onChange={(e) =>
                setAiSettings({ ...aiSettings, baseUrl: e.target.value })
              }
              placeholder="http://localhost:11434/v1"
            />
          </div>

          <div>
            <Label>Model</Label>
            <Input
              value={aiSettings?.model || ''}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              placeholder={providerMeta ? providerMeta.modelHint : 'Model'}
            />
          </div>

          <div>
            <Label>API key</Label>
            {providerMeta && providerMeta.needsKey ? (
              <Input
                value={aiSettings?.apiKey || ''}
                onChange={(e) =>
                  setAiSettings({ ...aiSettings, apiKey: e.target.value })
                }
                placeholder="Stored locally"
                type="password"
              />
            ) : (
              <Input value="(not required for local providers)" disabled />
            )}
          </div>
        </FieldGrid>

        <div style={{ marginTop: 10 }}>
          <label
            style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}
          >
            <input
              type="checkbox"
              checked={aiSettings?.safeMode !== false}
              onChange={(e) =>
                setAiSettings({ ...aiSettings, safeMode: e.target.checked })
              }
            />
            Interview-safe mode (recommended)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Button
            content="Open AI dock"
            onClick={() => (onOpenAi ? onOpenAi('settings') : null)}
            style={{ padding: '10px 12px' }}
          />
          <Button
            content="Generate draft"
            onClick={() => (onOpenAi ? onOpenAi('generate') : null)}
            style={{ padding: '10px 12px', background: COLORS.darkBrown, color: 'white' }}
            hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
          />
        </div>

        <Desc style={{ marginTop: 10 }}>
          Formatting tip: use <b>**bold**</b> to emphasize words in your resume. You can
          also use <i>_italics_</i> and <s>~strikethrough~</s>.
        </Desc>
      </Card>

      <Card>
        <Title>Tailor current resume to a job description</Title>
        <Desc>
          Paste the job description and generate a revised version of your <b>existing</b> resume.
          It rewrites wording and bullets to match relevant keywords <b>without inventing</b> new experience.
        </Desc>

        <div style={{ marginBottom: 10 }}>
          <Label>Job description</Label>
          <Textarea
            value={tailorJD}
            onChange={(e) => setTailorJD(e.target.value)}
            placeholder="Paste the job description here…"
            style={{ minHeight: 120 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={aiSettings?.safeMode !== false}
              onChange={(e) =>
                setAiSettings({ ...(aiSettings || {}), safeMode: e.target.checked })
              }
            />
            Interview-safe mode
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button
            content={tailorBusy ? 'Tailoring…' : 'Tailor my resume'}
            onClick={tailorBusy ? null : tailor}
            style={{
              padding: '10px 14px',
              background: COLORS.darkBrown,
              color: 'white',
              opacity: tailorBusy ? 0.7 : 1,
            }}
            hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
          />
        </div>

        {tailorError ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'crimson' }}>
            {tailorError}
          </div>
        ) : null}

        {tailorWarnings && tailorWarnings.length > 0 ? (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Warnings</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {tailorWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <Label>Proposed resume text (ezcv format)</Label>
          <Pre>{tailored || 'Run tailoring to see a proposal here.'}</Pre>

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              marginTop: 10,
            }}
          >
            <Button
              content="Apply tailored resume"
              onClick={
                tailored && tailored.trim().length > 0
                  ? () => onApplyDraft(tailored)
                  : null
              }
              style={{
                padding: '10px 14px',
                background: COLORS.green,
                opacity: tailored && tailored.trim().length > 0 ? 1 : 0.55,
                cursor:
                  tailored && tailored.trim().length > 0
                    ? 'pointer'
                    : 'not-allowed',
              }}
            />
          </div>
        </div>
      </Card>


      <Card>
        <Title>Generate a resume from raw notes</Title>
        <Desc>
          Paste messy info (projects, internships, skills). AI will convert it into ezcv
          sections. If you don’t provide a detail, it will use <b>[fill]</b> placeholders
          instead of fabricating.
        </Desc>

        <div style={{ marginBottom: 10 }}>
          <Label>Target role (optional)</Label>
          <Input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Junior Backend Developer"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <Label>Your raw info</Label>
          <Textarea
            value={rawInfo}
            onChange={(e) => setRawInfo(e.target.value)}
            placeholder={`Name: Om\nEmail: ...\nProjects: ...\nInternship: ...\nSkills: ...\nEducation: ...`}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={includeJD}
              onChange={(e) => setIncludeJD(e.target.checked)}
            />
            Include job description
          </label>
        </div>

        {includeJD ? (
          <div style={{ marginTop: 10 }}>
            <Label>Job description (optional)</Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Button
            content={busy ? 'Generating…' : 'Generate'}
            onClick={busy ? null : generate}
            style={{ padding: '10px 16px', background: COLORS.darkBrown, color: 'white' }}
            hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
          />
          <Button
            content="Use draft"
            onClick={draft && draft.trim().length > 0 ? () => onApplyDraft(draft) : null}
            style={{
              padding: '10px 16px',
              background: COLORS.green,
              opacity: draft && draft.trim().length > 0 ? 1 : 0.5,
              cursor: draft && draft.trim().length > 0 ? 'pointer' : 'not-allowed',
            }}
          />
        </div>

        {warnings && warnings.length > 0 ? (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Warnings</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 10, fontSize: 12, color: COLORS.darkBrown }}>
            <div style={{ fontWeight: 900 }}>Error</div>
            <div>{error}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <Label>Draft output</Label>
          <Pre>{draft || 'Generate to see the ezcv text here.'}</Pre>
        </div>
      </Card>
    </Container>
  );
}
