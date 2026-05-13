import type { TemplateAdjustment } from '../domain';

export type TemplateLabelInput = TemplateAdjustment | undefined;

export function templateLabel(adjustment: TemplateLabelInput): string {
  if (adjustment === 'elite') return 'Elite';
  if (adjustment === 'weak') return 'Weak';
  return '';
}
