import type { CreatureTemplateAdjustment } from '../domain';

export type TemplateLabelInput = 'normal' | CreatureTemplateAdjustment | undefined;

export function templateLabel(adjustment: TemplateLabelInput): string {
  if (adjustment === 'elite') return 'Elite';
  if (adjustment === 'weak') return 'Weak';
  if (adjustment === 'normal') return 'Normal';
  return '';
}
