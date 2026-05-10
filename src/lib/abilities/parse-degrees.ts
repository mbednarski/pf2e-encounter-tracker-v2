export type Degree = 'critSuccess' | 'success' | 'failure' | 'critFailure';

export interface DegreeOutcome {
  degree: Degree;
  text: string;
}

export interface ParsedAbility {
  preface: string;
  outcomes: DegreeOutcome[];
}

const LABEL_TO_DEGREE: Record<string, Degree> = {
  'critical success': 'critSuccess',
  'success': 'success',
  'failure': 'failure',
  'critical failure': 'critFailure'
};

const SPLIT_RE = /(?:^|\n)[ \t]*(Critical Success|Critical Failure|Success|Failure)\b[ \t:.\-]*/g;

// Splits an ability description into a preface block and zero or more degree-of-success
// outcomes. Recognises the four standard PF2e labels at the start of a line (allowing
// leading spaces and an optional separator like ":", ".", or "-"). If no labels are
// found, returns the whole text as preface with an empty outcomes list — the caller
// renders the description unchanged.
export function parseDegrees(description: string): ParsedAbility {
  const text = description ?? '';

  const matches: { index: number; label: string; end: number }[] = [];
  for (const match of text.matchAll(SPLIT_RE)) {
    if (match.index === undefined) continue;
    const labelStart = match[0].indexOf(match[1], 0);
    matches.push({
      index: match.index + labelStart,
      label: match[1],
      end: match.index + match[0].length
    });
  }

  if (matches.length === 0) {
    return { preface: text.trim(), outcomes: [] };
  }

  const preface = text.slice(0, matches[0].index).trim();
  const outcomes: DegreeOutcome[] = matches.map((m, i) => {
    const next = matches[i + 1];
    const sliceEnd = next ? next.index : text.length;
    const body = text.slice(m.end, sliceEnd).trim();
    return {
      degree: LABEL_TO_DEGREE[m.label.toLowerCase()],
      text: body
    };
  });

  return { preface, outcomes };
}
