import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ReactToPrint from 'react-to-print';
import Image from 'next/image';
import styled from 'styled-components';
import ScrollContainer from 'react-indiana-drag-scroll';
import { AiOutlineDownload, AiOutlineRobot } from 'react-icons/ai';
import { Resume, Menu, Button, AiAssist } from '../components';
import { parseIntoContent, getTextByLineRange, replaceTextByLineRange } from '../utils';
import { SECTIONS, STYLING, COLORS, TRIGGERS } from '../constants';
import logo from '../public/logo.png';

const DEFAULT_AI_SETTINGS = {
  providerId: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: '',
  model: 'llama3.1',
  extraHeaders: {},
  safeMode: true,
};

const styles = {
  page: {
    height: '100%',
  },
  button: {
    padding: '20px',
    borderLeft: `2px solid ${COLORS.darkBrown}`,
    borderTop: 'none',
    borderBottom: 'none',
    borderRight: 'none',
    fontWeight: 'normal',
    fontFamily: 'Mabry',
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    background: COLORS.yellow,
  },
  hover: {
    background: COLORS.red,
    color: COLORS.darkBrown,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    padding: 15,
    cursor: 'pointer',
  },
  right: {
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
};

const Header = styled.div`
  margin-bottom: 10px;
  border-bottom: 2px solid ${COLORS.darkBrown};
  display: flex;
  flex-grow: 1;
`;

const Body = styled.div`
  display: flex;
  justify-content: center;
  margin: 0 10px 30px;
  height: calc(100vh - 130px);

  @media only screen and (max-width: ${TRIGGERS.mobileBreakpoint}) {
    display: block;
  }
`;

const ColumnLeft = styled.div`
  min-width: 49.5%;
  max-width: 49.5%;
  height: 100%;
  flex-direction: column;

  @media only screen and (max-width: ${TRIGGERS.mobileBreakpoint}) {
    min-width: 100%;
    max-width: 100%;
    margin-bottom: 10px;
  }
`;

const ColumnRight = styled(ScrollContainer)`
  margin-left: 10px;
  border: 2px solid ${COLORS.darkBrown};
  background-color: ${COLORS.redOrange};
  overflow: scroll;
  height: 100%;
  position: relative;

  @media only screen and (max-width: ${TRIGGERS.mobileBreakpoint}) {
    height: 1000px;
    margin-left: 0;
  }
`;

const AiHint = styled.div`
  position: sticky;
  top: 10px;
  z-index: 5;
  margin: 10px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 2px solid ${COLORS.darkBrown};
  background: rgba(255, 255, 255, 0.85);
  max-width: 520px;

  @media print {
    display: none;
  }
`;

function HeaderButton({ content, onClick, style }) {
  return (
    <Button
      content={<div style={styles.content}>{content}</div>}
      style={{ ...styles.button, ...style }}
      onClick={onClick}
      hoverStyle={styles.hover}
    />
  );
}

export default function Builder() {
  const [text, setText] = useState(SECTIONS.getDefaultText());
  const [styling, setStyling] = useState(STYLING.getDefaultStyling());
  const [isCopying, setIsCopying] = useState(false);

  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [history, setHistory] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState('edit');
  const [aiHintDismissed, setAiHintDismissed] = useState(false);
  const [dockMetrics, setDockMetrics] = useState(null);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedText = localStorage.getItem('text');
      const storedAi = localStorage.getItem('aiSettings');
      const hintDismissed = localStorage.getItem('aiHintDismissed');

      if (storedText !== null && storedText !== '') {
        setText(storedText);
      }

      if (storedAi) {
        try {
          setAiSettings({ ...DEFAULT_AI_SETTINGS, ...JSON.parse(storedAi) });
        } catch (e) {
          // ignore
        }
      }

      setAiHintDismissed(hintDismissed === 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportH(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    }
  }, [aiSettings]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setIsCopying(true);
    setTimeout(() => {
      setIsCopying(false);
    }, [600]);
  };

  const handleTextChange = (newText) => {
    localStorage.setItem('text', newText);
    setText(newText);
  };

  /* Info parsed from plaintext */
  const { lines, content } = useMemo(
    () => parseIntoContent(text, styling, setStyling),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text]
  );

  const selectedSection = useMemo(() => {
    if (selectedSectionId === null) return null;
    return content.find((c) => c.id === selectedSectionId) || null;
  }, [content, selectedSectionId]);

  const selectedText = useMemo(() => {
    if (!selectedSection) return '';
    return getTextByLineRange(lines, selectedSection.startLine, selectedSection.endLine);
  }, [lines, selectedSection]);

  const dockPadBottom = useMemo(() => {
    if (!aiOpen || !dockMetrics || !viewportH) return 0;
    const isDockedBottom =
      dockMetrics.top + dockMetrics.height >= viewportH - 24;
    return isDockedBottom ? Math.ceil(dockMetrics.height) + 26 : 0;
  }, [aiOpen, dockMetrics, viewportH]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!aiOpen || selectedSectionId === null) return;

    // When a bottom section is selected, the dock can cover it.
    // Add padding and nudge the preview scroll so the selected section remains visible.
    const t = setTimeout(() => {
      const el = document.querySelector('[data-ai-selected="true"]');
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const safeBottom = window.innerHeight - dockPadBottom - 12;

      if (rect.bottom > safeBottom) {
        const delta = rect.bottom - safeBottom + 12;
        const scroller =
          el.closest('.indiana-scroll-container') ||
          el.closest('.indiana-scroll') ||
          el.closest('[data-scroll-container]') ||
          el.parentElement;

        if (scroller && typeof scroller.scrollTop === 'number') {
          scroller.scrollTop += delta;
        } else {
          el.scrollIntoView({ block: 'end' });
        }
      }
    }, 0);

    return () => clearTimeout(t);
  }, [aiOpen, selectedSectionId, dockPadBottom]);


  const onApplyAi = (updatedSectionText) => {
    if (!selectedSection) return;
    setHistory((h) => [text, ...h].slice(0, 30));
    const next = replaceTextByLineRange(
      text,
      selectedSection.startLine,
      selectedSection.endLine,
      updatedSectionText
    );
    handleTextChange(next);
  };

  const onApplyDraft = (draftText) => {
    if (!draftText || draftText.trim().length === 0) return;
    setHistory((h) => [text, ...h].slice(0, 30));
    setSelectedSectionId(null);
    handleTextChange(draftText);
  };

  const onUndo = () => {
    if (history.length < 1) return;
    const [prev, ...rest] = history;
    setHistory(rest);
    setSelectedSectionId(null);
    setAiOpen(false);
    handleTextChange(prev);
  };

  const onRunAi = async ({ instruction, jobDescription, safeMode }) => {
    const effectiveSafeMode =
      typeof safeMode === 'boolean' ? safeMode : aiSettings.safeMode !== false;
    const response = await fetch('/api/llm/edit-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: {
          providerId: aiSettings.providerId,
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
          extraHeaders: aiSettings.extraHeaders || {},
        },
        instruction,
        jobDescription,
        safeMode: effectiveSafeMode,
        sectionText: selectedText,
      }),
    });
    return response.json();
  };

  const onGenerateAiDraft = async ({ targetRole, rawInfo, jobDescription, safeMode }) => {
    const effectiveSafeMode =
      typeof safeMode === 'boolean' ? safeMode : aiSettings.safeMode !== false;
    const response = await fetch('/api/llm/generate-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: {
          providerId: aiSettings.providerId,
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
          extraHeaders: aiSettings.extraHeaders || {},
        },
        targetRole,
        rawInfo,
        jobDescription,
        safeMode: effectiveSafeMode,
      }),
    });
    return response.json();
  };

  const onTailorResumeAi = async ({ jobDescription, safeMode }) => {
    const effectiveSafeMode =
      typeof safeMode === 'boolean' ? safeMode : aiSettings.safeMode !== false;

    const response = await fetch('/api/llm/tailor-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: {
          providerId: aiSettings.providerId,
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
          extraHeaders: aiSettings.extraHeaders || {},
        },
        resumeText: text,
        jobDescription,
        safeMode: effectiveSafeMode,
      }),
    });

    return response.json();
  };


  /* Resume reference for print */
  const resume = useRef();

  return (
    <>
      <Head>
        <title>ezcv — Easy Resume Maker</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.page}>
        <Header>
          <div style={styles.logo}>
            <Link href="/">
              <Image src={logo} alt="logo" width={60} height={60} />
            </Link>
          </div>

          <div style={styles.right}>
            <HeaderButton
              content={
                <div style={styles.center}>
                  AI <AiOutlineRobot />
                </div>
              }
              onClick={() => {
                setAiTab('settings');
                setAiOpen(true);
              }}
            />

            <HeaderButton
              content={isCopying ? 'Copied!' : 'Copy Text'}
              onClick={handleCopyText}
            />

            <ReactToPrint
              documentTitle="Resume"
              trigger={() =>
                HeaderButton({
                  content: (
                    <div style={styles.center}>
                      Export <AiOutlineDownload />
                    </div>
                  ),
                  style: { background: COLORS.darkBrown, color: 'white' },
                })
              }
              content={() => resume.current}
            />
          </div>
        </Header>

        <Body>
          <ColumnLeft>
            <div style={styles.page}>
              <Menu
                content={content}
                lines={lines}
                styling={styling}
                text={text}
                setText={handleTextChange}
                aiSettings={aiSettings}
                setAiSettings={setAiSettings}
                onOpenAi={(tab) => {
                  setAiTab(tab);
                  setAiOpen(true);
                }}
                onGenerateDraft={onGenerateAiDraft}
                onApplyDraft={onApplyDraft}
                onTailorResume={onTailorResumeAi}
              />
            </div>
          </ColumnLeft>

          <ColumnRight style={dockPadBottom ? { paddingBottom: dockPadBottom } : undefined}>
            {!aiHintDismissed ? (
              <AiHint>
                <div style={{ fontWeight: 800 }}>AI is built-in.</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Click any section to edit it. Or open <b>AI → Generate Draft</b>{' '}
                  to create a first resume from raw notes.
                </div>
                <Button
                  content="Got it"
                  onClick={() => {
                    setAiHintDismissed(true);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('aiHintDismissed', 'true');
                    }
                  }}
                  style={{ padding: '8px 10px' }}
                />
              </AiHint>
            ) : null}

            <Resume
              content={content}
              styling={styling}
              ref={resume}
              selectedSectionId={selectedSectionId}
              onSelectSection={(id) => {
                setSelectedSectionId(id);
                setAiTab('edit');
                setAiOpen(true);
              }}
            />
          </ColumnRight>
        </Body>

        <AiAssist
          isOpen={aiOpen}
          activeTab={aiTab}
          setActiveTab={setAiTab}
          selectedHeader={selectedSection?.header}
          selectedType={selectedSection?.type}
          selectedText={selectedText}
          aiSettings={aiSettings}
          setAiSettings={setAiSettings}
          onRun={onRunAi}
          onApply={onApplyAi}
          onGenerate={onGenerateAiDraft}
          onTailor={onTailorResumeAi}
          onApplyDraft={onApplyDraft}
          onUndo={onUndo}
          canUndo={history.length > 0}
          onDockMetrics={setDockMetrics}
          onClose={() => setAiOpen(false)}
        />
      </main>

      <style jsx global>{`
        body {
          background: ${COLORS.background};
          margin: 0;
          font-family: Helvetica;
        }

        button,
        input,
        textarea,
        select {
          font-size: 13px;
          font-family: Helvetica;
        }

        p {
          font-size: 13px;
        }

        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        ::-webkit-scrollbar-track {
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background-color: ${COLORS.darkBrown};
        }

        ::-webkit-input-placeholder {
          color: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </>
  );
}
