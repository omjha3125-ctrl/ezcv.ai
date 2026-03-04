import React, { useRef } from 'react';
import TabMenu from './TabMenu';
import SectionsWindow from './Windows/SectionsWindow';
import Textbox from './Textbox';
import ThemesWindow from './Windows/ThemesWindow';
import AiWindow from './Windows/AiWindow';
import getAppendJobs from './utils';

export default function Menu({
  content,
  styling,
  lines,
  text,
  setText,
  aiSettings,
  setAiSettings,
  onOpenAi,
  onGenerateDraft,
  onApplyDraft,
  onTailorResume,
}) {
  const textbox = useRef();

  const { appendStyling, appendSection } = getAppendJobs(
    lines,
    text,
    setText,
    textbox
  );

  const getSectionsWindow = (tab) => (
    <>
      <SectionsWindow
        content={content}
        onClick={appendSection}
        key={tab.title}
      />
      <Textbox text={text} setText={setText} textbox={textbox} />
    </>
  );

  const getThemesWindow = (tab) => (
    <ThemesWindow
      styling={styling}
      appendStyling={appendStyling}
      key={tab.title}
    />
  );

  const getAiWindow = (tab) => (
    <AiWindow
      key={tab.title}
      aiSettings={aiSettings}
      setAiSettings={setAiSettings}
      onOpenAi={onOpenAi}
      onGenerateDraft={onGenerateDraft}
      onApplyDraft={onApplyDraft}
      onTailorResume={onTailorResume}
      resumeText={text}
    />
  );

  const TABS = [
    {
      title: 'Sections',
      getTab: getSectionsWindow,
    },
    {
      title: 'Customize',
      getTab: getThemesWindow,
    },
    {
      title: 'AI',
      getTab: getAiWindow,
    },
  ];

  return <TabMenu tabs={TABS} />;
}

export { Textbox };
