import { describe, expect, test } from 'vitest';
import { templateLabel } from './template-label';

describe('templateLabel', () => {
  test('returns "Elite" for elite adjustment', () => {
    expect(templateLabel('elite')).toBe('Elite');
  });

  test('returns "Weak" for weak adjustment', () => {
    expect(templateLabel('weak')).toBe('Weak');
  });

  test('returns "Normal" for explicit normal adjustment', () => {
    expect(templateLabel('normal')).toBe('Normal');
  });

  test('returns empty string for undefined', () => {
    expect(templateLabel(undefined)).toBe('');
  });
});
