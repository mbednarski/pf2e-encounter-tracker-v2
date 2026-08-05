import type { Party } from '../../domain';
import {
  IssueBag,
  requireNonEmptyString,
  requireNumber,
  requireString,
  requireStringArray,
  type ParseOutcome
} from './party-member-validator';

function requireObject(bag: IssueBag, path: string, value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    bag.add(path, 'must be a mapping (object)');
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Structural validation only (spec §8.1 shape rules). Whether each memberId
 * references a stored PartyMember is checked at add-to-encounter time — the
 * importer cannot see IndexedDB, and members may arrive in the same file.
 */
export function validateParty(raw: unknown, documentIndex: number): ParseOutcome<Party> {
  const bag = new IssueBag(documentIndex);
  const obj = requireObject(bag, '', raw);
  if (!obj) return { ok: false, issues: bag.issues };

  let ok = true;

  const id = requireNonEmptyString(bag, 'id', obj.id);
  if (id === null) ok = false;
  const name = requireNonEmptyString(bag, 'name', obj.name);
  if (name === null) ok = false;

  const memberIds = requireStringArray(bag, 'memberIds', obj.memberIds);
  if (memberIds === null) ok = false;
  else {
    for (let i = 0; i < memberIds.length; i++) {
      if (memberIds[i].trim() === '') {
        bag.add(`memberIds[${i}]`, 'must not be empty');
        ok = false;
      }
    }
  }

  const level = requireNumber(bag, 'level', obj.level);
  if (level === null) ok = false;
  else if (level < 1) {
    bag.add('level', 'must be >= 1');
    ok = false;
  }

  let notes: string | undefined;
  if (obj.notes !== undefined) {
    const s = requireString(bag, 'notes', obj.notes);
    if (s === null) ok = false;
    else notes = s;
  }

  if (!ok || id === null || name === null || memberIds === null || level === null) {
    return { ok: false, issues: bag.issues };
  }

  const party: Party = { id, name, memberIds, level };
  if (notes !== undefined) party.notes = notes;
  return { ok: true, value: party, issues: bag.issues };
}
