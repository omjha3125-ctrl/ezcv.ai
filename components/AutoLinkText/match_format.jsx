import React from 'react';

// Inline formatting supported inside any text field.
// - **bold**
// - _italic_
// - ~strikethrough~
//
// NOTE: We intentionally keep this formatter simple (no nesting / no overlap).

const boldRegex = /\*{2}(.+?)\*{2}/g;
const italicRegex = /_{1}(.+?)_{1}/g;
const strikethroughRegex = /~{1}(.+?)~{1}/g;

const FORMAT = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
};

export class FormatMatch {
  constructor(text, position, format) {
    this.text = text;
    this.position = position;
    this.format = format;
  }

  render() {
    const { start, end } = this.position;
    const formattedText = this.text.substring(start, end);

    /* kind of hard-coded removal of special characters */
    switch (this.format) {
      case FORMAT.BOLD:
        return React.createElement(
          'b',
          null,
          formattedText.substring(2, formattedText.length - 2)
        );
      case FORMAT.ITALIC:
        return React.createElement(
          'i',
          null,
          formattedText.substring(1, formattedText.length - 1)
        );
      case FORMAT.STRIKETHROUGH:
        return React.createElement(
          's',
          null,
          formattedText.substring(1, formattedText.length - 1)
        );
      default:
        return this.text;
    }
  }
}

function collectMatches({ regex, format }, text) {
  const re = new RegExp(regex.source, 'gi');
  const out = [];
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(text)) !== null) {
    out.push(
      new FormatMatch(
        text,
        {
          start: m.index,
          end: re.lastIndex,
        },
        format
      )
    );

    // Defensive: avoid infinite loops for zero-width matches
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

export default function formatterMatchParser(text) {
  if (!text) return [];

  const patterns = [
    { regex: boldRegex, format: FORMAT.BOLD },
    { regex: italicRegex, format: FORMAT.ITALIC },
    { regex: strikethroughRegex, format: FORMAT.STRIKETHROUGH },
  ];

  const matches = patterns.flatMap((p) => collectMatches(p, text));

  // Sort by start position
  matches.sort((a, b) => a.position.start - b.position.start);

  // Drop overlaps (no nesting)
  const filtered = [];
  let lastEnd = -1;
  matches.forEach((m) => {
    if (m.position.start < lastEnd) return;
    filtered.push(m);
    lastEnd = m.position.end;
  });

  return filtered;
}
