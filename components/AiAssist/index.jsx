import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { COLORS } from '../../constants';
import Button from '../Button';

const Dock = styled.div`
  position: fixed;
  left: 12px;
  top: 12px;
  width: min(1120px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  min-width: 520px;
  min-height: 220px;

  background: ${COLORS.yellow};
  border: 2px solid ${COLORS.darkBrown};
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  z-index: 50;

  /* enables user resizing */
  resize: both;
  overflow: auto;

  @media (max-width: 560px) {
    min-width: 0;
  }

  @media print {
    display: none;
  }
`;


const Inner = styled.div`
  padding: 14px;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const Title = styled.div`
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${COLORS.darkBrown};
`;

const Pill = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.6);
`;


const DragGrip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 800;
  user-select: none;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

const GripDots = styled.span`
  font-size: 14px;
  line-height: 1;
  opacity: 0.9;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  border: 2px solid ${COLORS.darkBrown};
  background: ${(p) => (p.active ? COLORS.darkBrown : 'rgba(255,255,255,0.55)')};
  color: ${(p) => (p.active ? 'white' : COLORS.darkBrown)};
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.disabled ? 0.45 : 1)};

  &:hover {
    background: ${(p) =>
      p.disabled ? undefined : p.active ? COLORS.darkBrown : COLORS.red};
    color: ${(p) => (p.disabled ? undefined : p.active ? 'white' : COLORS.darkBrown)};
  }
`;

const Label = styled.label`
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
`;

const Input = styled.input`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  &:focus {
    background: rgba(255, 255, 255, 0.8);
  }
`;

const Select = styled.select`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  max-width: 100%;
  box-sizing: border-box;
`;

const Textarea = styled.textarea`
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 42px;
  resize: vertical;

  &:focus {
    background: rgba(255, 255, 255, 0.8);
  }
`;

const Panel = styled.div`
  margin-top: 10px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Box = styled.div`
  border: 2px solid ${COLORS.darkBrown};
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
  overflow: hidden;
`;

const BoxHeader = styled.div`
  padding: 10px 12px;
  font-weight: 800;
  border-bottom: 2px solid ${COLORS.darkBrown};
  background: rgba(0, 0, 0, 0.03);
`;

const Pre = styled.pre`
  margin: 0;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  max-height: 250px;
  overflow: auto;
`;

const Warn = styled.div`
  margin-top: 10px;
  border-radius: 12px;
  padding: 10px 12px;
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(218, 105, 64, 0.14);
  font-size: 12px;
`;

const SmallNote = styled.div`
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.8;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
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

const PRESETS = [
  {
    key: 'impact',
    label: 'Rewrite bullets (impact)',
    prompt:
      'Rewrite the bullet points to be impact-first with strong action verbs. Keep meaning. Do NOT invent tools, companies, or numbers.',
  },
  {
    key: 'tighten',
    label: 'Tighten (shorter)',
    prompt:
      'Make this section more concise. Remove filler, keep key specifics, keep formatting intact.',
  },
  {
    key: 'expand',
    label: 'Expand (more specific)',
    prompt:
      'Make this section more specific and clearer. You may reorganize wording, but do NOT invent facts.',
  },
  {
    key: 'ats',
    label: 'ATS align to JD (safe)',
    prompt:
      'Align wording to the job description keywords ONLY where truthful. If a keyword is not supported by the text, do not add it.',
  },
  {
    key: 'grammar',
    label: 'Fix grammar & consistency',
    prompt:
      'Fix grammar, tense, and consistency. Keep content the same. Keep formatting intact.',
  },
];

export default function AiAssist({
  isOpen,
  activeTab,
  setActiveTab,
  selectedHeader,
  selectedType,
  selectedText,
  aiSettings,
  setAiSettings,
  onRun,
  onApply,
  onGenerate,
  onTailor,
  onApplyDraft,
  onUndo,
  canUndo,
  onDockMetrics,
  onClose,
}) {
  const [preset, setPreset] = useState('impact');
  const [instruction, setInstruction] = useState(PRESETS[0].prompt);
  const [jobDescription, setJobDescription] = useState('');
  const [showJD, setShowJD] = useState(false);
  const safeMode = aiSettings?.safeMode !== false;
  const setSafeMode = (next) => {
    if (!setAiSettings) return;
    setAiSettings({ ...(aiSettings || {}), safeMode: !!next });
  };

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // Draft generation state
  const [targetRole, setTargetRole] = useState('');
  const [rawInfo, setRawInfo] = useState('');
  const [draft, setDraft] = useState(null);
  const [busyDraft, setBusyDraft] = useState(false);
  const [draftError, setDraftError] = useState(null);

  // Tailor existing resume state
  const [tailoredText, setTailoredText] = useState(null);
  const [tailorWarnings, setTailorWarnings] = useState([]);
  const [busyTailor, setBusyTailor] = useState(false);
  const [tailorError, setTailorError] = useState(null);

  // Floating/resizable dock state (persists in localStorage)
  const dockRef = useRef(null);
  const dragRef = useRef({ active: false, pointerId: null, dx: 0, dy: 0 });
  const [dock, setDock] = useState({ x: null, y: null, w: null, h: null });

  const clampDock = (next) => {
    if (typeof window === 'undefined') return next;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const w = Math.min(next.w ?? 980, vw - pad * 2);
    const h = Math.min(next.h ?? 480, vh - pad * 2);

    const x = Math.min(Math.max(next.x ?? pad, pad), vw - w - pad);
    const y = Math.min(Math.max(next.y ?? pad, pad), vh - h - pad);

    return { ...next, x, y, w, h };
  };

  const computeDefaultDock = () => {
    const w = Math.min(1120, Math.max(720, window.innerWidth - 24));
    const h = Math.min(520, Math.max(280, Math.round(window.innerHeight * 0.42)));
    const x = Math.round((window.innerWidth - w) / 2);
    const y = Math.round(window.innerHeight - h - 14);
    return clampDock({ x, y, w, h });
  };

  const resetDock = () => {
    if (typeof window === 'undefined') return;
    const next = computeDefaultDock();
    setDock(next);
    try {
      localStorage.setItem('aiDock_v1', JSON.stringify(next));
    } catch (e) {
      // ignore storage failures
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // initialize once per open
    try {
      const raw = localStorage.getItem('aiDock_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        setDock((prev) => clampDock({ ...prev, ...parsed }));
        return;
      }
    } catch (e) {
      // ignore
    }
    setDock(computeDefaultDock());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dock.x == null) return;
    try {
      localStorage.setItem('aiDock_v1', JSON.stringify(dock));
    } catch (e) {
      // ignore
    }
  }, [dock]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setDock((prev) => clampDock(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dockRef.current) return;

    // report size/position up so the preview can pad its bottom when docked
    const report = () => {
      if (!dockRef.current || !onDockMetrics) return;
      const r = dockRef.current.getBoundingClientRect();
      onDockMetrics({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    };

    report();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const ro = new ResizeObserver(() => {
      // keep state in sync if user resizes with the CSS handle
      const r = dockRef.current.getBoundingClientRect();
      setDock((prev) => {
        const next = { ...prev, w: Math.round(r.width), h: Math.round(r.height) };
        const clamped = clampDock(next);
        if (
          clamped.w === prev.w &&
          clamped.h === prev.h &&
          clamped.x === prev.x &&
          clamped.y === prev.y
        )
          return prev;
        return clamped;
      });
      report();
    });

    ro.observe(dockRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDockMetrics]);

  const onGripPointerDown = (e) => {
    if (!dockRef.current) return;
    const r = dockRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
  };

  const onGripPointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    setDock((prev) =>
      clampDock({
        ...prev,
        x: Math.round(e.clientX - dragRef.current.dx),
        y: Math.round(e.clientY - dragRef.current.dy),
      })
    );
  };

  const onGripPointerUp = (e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = { active: false, pointerId: null, dx: 0, dy: 0 };
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    const picked = PRESETS.find((p) => p.key === preset);
    if (picked) setInstruction(picked.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    // reset edit result when the selection changes
    setResult(null);
  }, [selectedText]);

  const providerMeta = useMemo(() => PROVIDERS[aiSettings.providerId], [
    aiSettings.providerId,
  ]);

  if (!isOpen) return null;

  const runEdit = async () => {
    if (!selectedText || selectedText.trim().length === 0) return;
    setBusy(true);
    try {
      const out = await onRun({
        instruction,
        jobDescription: showJD ? jobDescription : '',
        safeMode,
      });
      setResult(out);
    } finally {
      setBusy(false);
    }
  };

  const runDraft = async () => {
    setBusyDraft(true);
    setDraftError(null);
    try {
      const out = await onGenerate({
        targetRole,
        rawInfo,
        jobDescription,
        safeMode,
      });

      if (out.ok === false) {
        setDraftError(out.error || 'Failed to generate a draft');
        setDraft(null);
      } else {
        setDraft(out.generatedText || '');
      }
    } finally {
      setBusyDraft(false);
    }
  };


  const runTailor = async () => {
    setBusyTailor(true);
    setTailorError(null);
    setTailorWarnings([]);
    setTailoredText(null);

    try {
      if (!onTailor) {
        setTailorError('Tailor is not configured.');
        return;
      }
      if (!jobDescription || jobDescription.trim().length < 20) {
        setTailorError('Paste a job description first.');
        return;
      }

      const out = await onTailor({
        jobDescription,
        safeMode,
      });

      if (out.ok === false) {
        setTailorError(out.error || 'Failed to tailor');
        return;
      }

      setTailoredText(out.tailoredText || '');
      setTailorWarnings(out.warnings || []);
    } finally {
      setBusyTailor(false);
    }
  };

  const hardError = result && result.ok === false;
  const updated = result && result.updatedSectionText;
  const canEdit = selectedText && selectedText.trim().length > 0;

  const safeSetTab = (next) => {
    if (next === 'edit' && !canEdit) return;
    setActiveTab(next);
  };

  const dockStyle = dock.x != null ? {
    left: `${dock.x}px`,
    top: `${dock.y}px`,
    width: `${dock.w}px`,
    height: `${dock.h}px`,
  } : undefined;

  return (
    <Dock ref={dockRef} style={dockStyle}>
      <Inner>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <DragGrip
              role="button"
              tabIndex={0}
              onPointerDown={onGripPointerDown}
              onPointerMove={onGripPointerMove}
              onPointerUp={onGripPointerUp}
              onPointerCancel={onGripPointerUp}
              title="Drag to move this panel. Resize from the bottom-right corner."
              onKeyDown={(e) => {
                if (e.key === 'Enter') resetDock();
              }}
            >
              <GripDots>⠿</GripDots>
              Move
            </DragGrip>
            <Title>AI</Title>
            <Pill>
              <strong>Selected:</strong>{' '}
              {canEdit ? selectedHeader || 'Untitled' : 'None'}{' '}
              {canEdit ? (
                <span style={{ opacity: 0.7 }}>({selectedType})</span>
              ) : (
                <span style={{ opacity: 0.7 }}>(click a section to edit)</span>
              )}
            </Pill>
          </Row>

          <Row>
            <Button
              content="Reset"
              onClick={resetDock}
              style={{ padding: '10px 12px' }}
            />
            <Button
              content="Undo"
              onClick={canUndo ? onUndo : null}
              style={{
                padding: '10px 12px',
                opacity: canUndo ? 1 : 0.5,
                cursor: canUndo ? 'pointer' : 'not-allowed',
              }}
            />
            <Button
              content="Close"
              onClick={onClose}
              style={{ padding: '10px 12px' }}
            />
          </Row>
        </Row>

        <Tabs>
          <TabButton
            type="button"
            active={activeTab === 'tailor'}
            onClick={() => safeSetTab('tailor')}
          >
            Tailor to JD
          </TabButton>
          <TabButton
            type="button"
            active={activeTab === 'edit'}
            disabled={!canEdit}
            onClick={() => safeSetTab('edit')}
            title={!canEdit ? 'Click a section in the preview first' : ''}
          >
            Edit Section
          </TabButton>
          <TabButton
            type="button"
            active={activeTab === 'generate'}
            onClick={() => safeSetTab('generate')}
          >
            Generate Draft
          </TabButton>
          <TabButton
            type="button"
            active={activeTab === 'settings'}
            onClick={() => safeSetTab('settings')}
          >
            Settings
          </TabButton>
        </Tabs>

        {activeTab === 'tailor' ? (
                  <Panel>
                    <Row style={{ alignItems: 'stretch' }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>
                          Paste a job description
                        </div>

                        <Textarea
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder="Paste the job description here. This will rewrite your existing resume (all sections) to better match the JD, without inventing experience."
                          style={{ minHeight: 180 }}
                        />

                        <div style={{ marginTop: 10 }}>
                          <Label>
                            <input
                              type="checkbox"
                              checked={safeMode}
                              onChange={(e) => setSafeMode(e.target.checked)}
                            />
                            Interview-safe mode
                          </Label>
                        </div>

                        <Row style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                          <Button
                            content={busyTailor ? 'Tailoring…' : 'Tailor my resume'}
                            onClick={busyTailor ? null : runTailor}
                            style={{
                              padding: '10px 16px',
                              background: COLORS.darkBrown,
                              color: 'white',
                              opacity: busyTailor ? 0.7 : 1,
                            }}
                            hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
                          />
                        </Row>

                        {tailorError ? (
                          <Warn>
                            <div style={{ fontWeight: 800 }}>Tailoring failed</div>
                            <div style={{ marginTop: 6 }}>{tailorError}</div>
                          </Warn>
                        ) : null}

                        {tailorWarnings && tailorWarnings.length > 0 ? (
                          <Warn style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 800 }}>Warnings</div>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                              {tailorWarnings.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </ul>
                          </Warn>
                        ) : null}
                      </div>

                      <div style={{ flex: 1, minWidth: 280 }}>
                        <Box>
                          <BoxHeader>Proposed tailored resume (ezcv format)</BoxHeader>
                          <Pre>{tailoredText || 'Run tailoring to see a proposal.'}</Pre>
                        </Box>

                        <Row style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                          <Button
                            content="Apply tailored resume"
                            onClick={
                              tailoredText && tailoredText.trim().length > 0
                                ? () => onApplyDraft(tailoredText)
                                : null
                            }
                            style={{
                              padding: '10px 16px',
                              background: COLORS.green,
                              opacity:
                                tailoredText && tailoredText.trim().length > 0 ? 1 : 0.55,
                              cursor:
                                tailoredText && tailoredText.trim().length > 0
                                  ? 'pointer'
                                  : 'not-allowed',
                            }}
                          />
                        </Row>

                        <SmallNote>
                          This rewrites <b>your current resume</b> to better match the job description.
                          It should not add new claims. Review before applying.
                        </SmallNote>
                      </div>
                    </Row>
                  </Panel>
                ) : null}

        {activeTab === 'settings' ? (
          <Panel>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Label>
                <input
                  type="checkbox"
                  checked={safeMode}
                  onChange={(e) => setSafeMode(e.target.checked)}
                />
                Interview-safe mode (default)
              </Label>
              <SmallNote style={{ margin: 0 }}>
                When ON, AI won’t introduce new numbers/metrics.
              </SmallNote>
            </Row>
            <FieldGrid>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Provider
                </div>
                <Select
                  value={aiSettings.providerId}
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
                  style={{ width: '100%' }}
                >
                  {Object.entries(PROVIDERS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Base URL</div>
                <Input
                  value={aiSettings.baseUrl}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, baseUrl: e.target.value })
                  }
                  placeholder="e.g. http://localhost:11434/v1"
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Model</div>
                <Input
                  value={aiSettings.model}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, model: e.target.value })
                  }
                  placeholder={providerMeta ? providerMeta.modelHint : 'Model'}
                />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>API key</div>
                {providerMeta && providerMeta.needsKey ? (
                  <Input
                    value={aiSettings.apiKey}
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

            <SmallNote>
              Tip: Local providers (Ollama / LM Studio) only work if this app runs on
              the same machine as the provider.
            </SmallNote>
          </Panel>
        ) : null}

        {activeTab === 'generate' ? (
          <Panel>
            <Row style={{ alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Target role (optional)
                </div>
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Junior Backend Developer"
                />

                <div style={{ marginTop: 10 }}>
                  <Label>
                    <input
                      type="checkbox"
                      checked={safeMode}
                      onChange={(e) => setSafeMode(e.target.checked)}
                    />
                    Interview-safe mode
                  </Label>
                </div>

                <div style={{ fontWeight: 800, margin: '10px 0 6px' }}>
                  Your raw info
                </div>
                <Textarea
                  value={rawInfo}
                  onChange={(e) => setRawInfo(e.target.value)}
                  placeholder={`Paste anything here: name/contact, projects, internships, skills, tools, education, achievements.\n\nExample:\nName: Om\nEmail: ...\nProject: ... (what you did, tools, outcomes)\nInternship: ...`}
                  style={{ minHeight: 130 }}
                />

                <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
                  <Button
                    content={showJD ? 'Hide Job Description' : 'Add Job Description'}
                    onClick={() => setShowJD((s) => !s)}
                    style={{ padding: '10px 12px' }}
                  />

                  <Button
                    content={busyDraft ? 'Generating…' : 'Generate'}
                    onClick={busyDraft ? null : runDraft}
                    style={{
                      padding: '10px 16px',
                      background: COLORS.darkBrown,
                      color: 'white',
                      opacity: busyDraft ? 0.7 : 1,
                    }}
                    hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
                  />
                </Row>

                {showJD ? (
                  <div style={{ marginTop: 10 }}>
                    <Textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the job description here (optional)."
                      style={{ minHeight: 90 }}
                    />
                  </div>
                ) : null}

                {draftError ? (
                  <Warn>
                    <div style={{ fontWeight: 800 }}>Draft generation failed</div>
                    <div style={{ marginTop: 6 }}>{draftError}</div>
                  </Warn>
                ) : null}
              </div>

              <div style={{ flex: 1, minWidth: 280 }}>
                <Box>
                  <BoxHeader>Generated resume text (ezcv format)</BoxHeader>
                  <Pre>{draft || 'Generate to see a draft here.'}</Pre>
                </Box>

                <Row style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                  <Button
                    content="Use this draft"
                    onClick={draft && draft.trim().length > 0 ? () => onApplyDraft(draft) : null}
                    style={{
                      padding: '10px 16px',
                      background: COLORS.green,
                      opacity: draft && draft.trim().length > 0 ? 1 : 0.55,
                      cursor:
                        draft && draft.trim().length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  />
                </Row>

                <SmallNote>
                  Drafts may include placeholders like <b>[fill]</b> when you did not
                  provide enough detail. That’s intentional: it keeps the output
                  interview-safe.
                </SmallNote>
              </div>
            </Row>
          </Panel>
        ) : null}

        {activeTab === 'edit' ? (
          <Panel>
            <Row>
              <Label>
                <input
                  type="checkbox"
                  checked={safeMode}
                  onChange={(e) => setSafeMode(e.target.checked)}
                />
                Interview-safe mode
              </Label>

              <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Row>

            <Row style={{ marginTop: 10, alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <Textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Tell the AI what to change in the selected section…"
                />

                <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
                  <Button
                    content={showJD ? 'Hide Job Description' : 'Add Job Description'}
                    onClick={() => setShowJD((s) => !s)}
                    style={{ padding: '10px 12px' }}
                  />

                  <Button
                    content={busy ? 'Running…' : 'Run'}
                    onClick={busy || !canEdit ? null : runEdit}
                    style={{
                      padding: '10px 16px',
                      background: COLORS.darkBrown,
                      color: 'white',
                      opacity: busy || !canEdit ? 0.7 : 1,
                      cursor: busy || !canEdit ? 'not-allowed' : 'pointer',
                    }}
                    hoverStyle={{ background: COLORS.red, color: COLORS.darkBrown }}
                  />
                </Row>

                {showJD ? (
                  <div style={{ marginTop: 10 }}>
                    <Textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the job description here (optional)."
                      style={{ minHeight: 90 }}
                    />
                  </div>
                ) : null}

                {!canEdit ? (
                  <SmallNote>
                    Click a section in the preview to edit it. Or use <b>Generate
                    Draft</b> if you want a fresh starting point.
                  </SmallNote>
                ) : null}
              </div>

              <div style={{ flex: 1, minWidth: 280 }}>
                <Grid>
                  <Box>
                    <BoxHeader>Current</BoxHeader>
                    <Pre>{selectedText}</Pre>
                  </Box>
                  <Box>
                    <BoxHeader>Proposed</BoxHeader>
                    <Pre>{updated || 'Run an edit to see a proposal.'}</Pre>
                  </Box>
                </Grid>

                {result && result.warnings && result.warnings.length > 0 ? (
                  <Warn>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Review warnings before applying
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </Warn>
                ) : null}

                {hardError ? (
                  <Warn>
                    <div style={{ fontWeight: 800 }}>AI edit rejected</div>
                    <div style={{ marginTop: 6 }}>{result.error}</div>
                  </Warn>
                ) : null}

                <Row style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                  <Button
                    content="Apply to Resume"
                    onClick={updated && !hardError ? () => onApply(updated) : null}
                    style={{
                      padding: '10px 16px',
                      background: COLORS.green,
                      opacity: updated && !hardError ? 1 : 0.55,
                      cursor: updated && !hardError ? 'pointer' : 'not-allowed',
                    }}
                  />
                </Row>
              </div>
            </Row>
          </Panel>
        ) : null}
      </Inner>
    </Dock>
  );
}
