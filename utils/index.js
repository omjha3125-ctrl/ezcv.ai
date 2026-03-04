import { STYLING, SECTIONS, TRIGGERS } from '../constants';

function getFirst(text, symbol, defaultValue) {
  const index = text.indexOf(symbol);
  return index === -1 ? defaultValue : index;
}

function getFirstSpace(text) {
  return getFirst(text, ' ', -1);
}

export function getKeyValuePair(text) {
  const spaceIndex = getFirstSpace(text);
  const key = text.substring(0, spaceIndex);
  const value = text.substring(spaceIndex + 1);

  if (spaceIndex === -1) {
    return { key: value, value: key };
  }

  return { key, value };
}

// Parses plaintext from Textbox into usable format for Resume
// Type: [{ header: "experience", body: [{key: "title", value: "professional clown"}, ...] }, ...]
// Sets styling if it finds it
export function parseIntoContent(text, styling = {}, setStyling = () => null) {
  const lines = text.split(/\r?\n/);
  // Each item in `state` represents a single resume block (header/section/pagebreak)
  // and includes the line-range it originated from.
  const state = [
    {
      id: 0,
      header: '',
      body: [SECTIONS.getEmptySubsection()],
      type: SECTIONS.TYPES.SECTION,
      startLine: 0,
      endLine: 0, // exclusive; finalized during parsing
    },
  ];

  const style = { ...styling };

  function isCurrentFieldsEmpty(f) {
    const { title, subtitle, date, description, other } = f;

    const isEmpty =
      !title && !subtitle && !date && !description && other.length < 1;

    return isEmpty;
  }

  function isCurrentSectionEmpty(s) {
    // Pagebreak blocks are intentionally empty and should NEVER be "reused" by
    // the next section trigger. Treat them as non-empty so the parser always
    // starts a new block after a #pagebreak line.
    if (s?.type === SECTIONS.TYPES.PAGEBREAK) return false;

    const { header, body } = s;
    const isEmpty =
      !header && body.length === 1 && isCurrentFieldsEmpty(body[0]);
    return isEmpty;
  }

  function pushSectionToState(t, key = null, value = null) {
    const currentSection = state[state.length - 1];
    const currentBody = currentSection.body;
    const currentFields = currentBody[currentBody.length - 1];
    const emptySubsection = SECTIONS.getEmptySubsection(currentSection.header);

    const k = key && key.toLowerCase();

    if (k && k in emptySubsection) {
      if (k === 'title' && !isCurrentFieldsEmpty(currentFields)) {
        // If title & last fields is not empty
        const emptyFields = emptySubsection;
        emptyFields.title = value;
        currentBody.push(emptyFields);
      } else if (k === 'style') {
        currentFields.style.push(value.trim());
      } else {
        currentFields[k] = value;
      }
    } else {
      currentFields.other.push(t.trim());
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const trimmedLine = line.substring(1).trim();
    const { key, value } = getKeyValuePair(trimmedLine);
    const currentSection = state[state.length - 1];

    // check to see symbol, if any
    switch (line[0]) {
      case TRIGGERS.trigger:
        // if HEADER or SECTION
        if (Object.values(SECTIONS.TYPES).includes(key)) {
          if (key === SECTIONS.TYPES.PAGEBREAK) {
            // close current section and start a pagebreak block
            currentSection.endLine = i;
            state.push({
              id: state.length,
              header: '',
              body: [
                {
                  ...SECTIONS.getEmptySubsection(),
                  type: SECTIONS.TYPES.PAGEBREAK,
                },
              ],
              type: key,
              startLine: i,
              endLine: i,
            });
            break;
          }

          // sets key -> k to ensure "header" gets picked up
          if (!isCurrentSectionEmpty(currentSection)) {
            // close current section and start a new one
            currentSection.endLine = i;
            state.push({
              id: state.length,
              header: value,
              body: [SECTIONS.getEmptySubsection()],
              type: key,
              startLine: i,
              endLine: i,
            });
            break;
          }

          currentSection.header = value;
          currentSection.type = key;
          // If the current section was empty, it should start at this trigger line.
          currentSection.startLine = i;
          break;
        }
        pushSectionToState(trimmedLine, key, value);
        break;
      case TRIGGERS.stylingTrigger:
        // eslint-disable-next-line no-case-declarations
        const validStyle = STYLING.isValidStyling(key, value);
        if (validStyle !== undefined) {
          style[key] = validStyle;
        }
        break;
      case TRIGGERS.commentTrigger:
        break;
      default:
        if (line.length > 0) {
          pushSectionToState(line);
        }
        break;
    }
  }

  // close the final section
  state[state.length - 1].endLine = lines.length;

  setStyling(style);
  return { lines, content: state };
}

/** Extract a specific block from `lines` using an exclusive range. */
export function getTextByLineRange(lines, startLine, endLine) {
  return lines.slice(startLine, endLine).join('\n');
}

/** Replace a specific block in plaintext using an exclusive line-range. */
export function replaceTextByLineRange(text, startLine, endLine, replacement) {
  const lines = text.split(/\r?\n/);
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine);
  const mid = replacement.split(/\r?\n/);
  return [...before, ...mid, ...after].join('\n');
}

export function partition(xs, pred) {
  const trues = [];
  const falses = [];
  xs.forEach((x) => {
    if (pred(x)) {
      trues.push(x);
    } else {
      falses.push(x);
    }
  });
  return [trues, falses];
}
