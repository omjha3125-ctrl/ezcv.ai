import React from 'react';
import styled from 'styled-components';
import Section from '../Section';
import { STYLING } from '../../constants';

const Base = styled.div`
  cursor: pointer;
  border-radius: 8px;
  transition: background 120ms ease, outline 120ms ease;
  position: relative;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  /* small, subtle affordance so users discover AI editing */
  &:hover::after {
    content: 'AI';
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(0, 0, 0, 0.25);
    opacity: 0.85;
  }

  @media print {
    cursor: default;

    &:hover {
      background: transparent;
    }

    &:hover::after {
      content: '';
      display: none;
    }
  }
`;

const Selected = styled(Base)`
  outline: 2px solid rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.05);

  &::after {
    content: 'AI';
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.28);
    opacity: 1;
  }

  @media print {
    outline: none;
    background: transparent;

    &::after {
      content: '';
      display: none;
    }
  }
`;

function Content({
  content,
  styling = STYLING.getDefaultStyling(),
  onSelectSection = null,
  selectedSectionId = null,
}) {
  return (
    <>
      {content.map(({ body, header, type, id }, i) => {
        const key = id ?? i;
        const Wrapper = key === selectedSectionId ? Selected : Base;

        return (
          <Wrapper
            key={`${key}`}
            onClick={() => (onSelectSection ? onSelectSection(key) : null)}
            role={onSelectSection ? 'button' : undefined}
            tabIndex={onSelectSection ? 0 : undefined}
            data-ai-selectable="true"
            data-ai-selected={key === selectedSectionId ? 'true' : 'false'}
            title={onSelectSection ? 'Click to edit this section with AI' : ''}
            onKeyDown={(e) => {
              if (!onSelectSection) return;
              if (e.key === 'Enter' || e.key === ' ') onSelectSection(key);
            }}
          >
            <Section
              styling={styling}
              type={type}
              header={header}
              subsections={body}
            />
          </Wrapper>
        );
      })}
    </>
  );
}

export default Content;
