import type { DamageComponent } from '../../domain';

export function formatDamage(damage: DamageComponent[]): string {
  return damage
    .map((d) => {
      const dice = d.dice && d.dieSize ? `${d.dice}d${d.dieSize}` : '';
      const bonus = d.bonus ? (d.bonus > 0 ? `+${d.bonus}` : `${d.bonus}`) : '';
      const persistent = d.persistent ? ' persistent' : '';
      const head = `${dice}${bonus}` || (d.bonus === 0 ? '0' : '');
      const tail = `${d.type}${persistent}`;
      return head ? `${head} ${tail}` : tail;
    })
    .join(' + ');
}

export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
