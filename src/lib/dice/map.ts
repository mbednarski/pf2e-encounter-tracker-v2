export interface MapVariant {
  step: 0 | 1 | 2;
  label: string;
  modifier: number;
}

// Per pf2e-creature-types-spec §3.3, MAP penalties are not stored — they're
// computed at display time from the base modifier and the agile trait.
//   agile     →  +0 / -4 / -8
//   non-agile →  +0 / -5 / -10
export function mapVariants(baseModifier: number, traits: readonly string[] = []): MapVariant[] {
  const agile = traits.some((t) => t.toLowerCase() === 'agile');
  const step = agile ? 4 : 5;
  return [
    { step: 0, label: '1st', modifier: baseModifier },
    { step: 1, label: '2nd', modifier: baseModifier - step },
    { step: 2, label: '3rd', modifier: baseModifier - step * 2 }
  ];
}
