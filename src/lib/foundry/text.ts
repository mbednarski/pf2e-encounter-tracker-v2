/**
 * Pure stripper for the Foundry-flavored markup that appears in NPC
 * description fields. Converts the cocktail of HTML + @-prefixed inline
 * macros into plain text suitable for our `notes` / `description` fields.
 *
 * Order matters: process @-macros and bracketed inline rolls *before*
 * collapsing HTML, so attribute-style content inside braces isn't
 * accidentally consumed by the HTML pass.
 */

const UUID_WITH_LABEL = /@UUID\[[^\]]*\]\{([^}]*)\}/g;
const UUID_BARE = /@UUID\[([^\]]*)\]/g;
const CHECK = /@Check\[([^\]]*)\]/g;
// @Damage syntax allows single-level nested [type] brackets:
//   @Damage[2d6[slashing]|options:area-damage]
// So we accept either non-bracket chars or a balanced inner [..] pair.
const DAMAGE = /@Damage\[((?:[^\[\]]|\[[^\[\]]*\])*)\]/g;
const LOCALIZE = /@Localize\[[^\]]*\]/g;
const INLINE_ROLL = /\[\[\/[a-z]+ ([^|#\]]+?)(?:\s+#[^\]]*)?\]\]/g;
const HTML_TAG = /<\/?[^>]+>/g;
const NBSP = / /g;
const MULTI_WHITESPACE = /\s+/g;

function lastSegment(uuid: string): string {
  const trimmed = uuid.trim();
  const dot = trimmed.lastIndexOf('.');
  return dot === -1 ? trimmed : trimmed.slice(dot + 1);
}

function prettifyCheck(body: string): string {
  // @Check[reflex|dc:17|basic] → "Reflex DC 17 basic"
  const parts = body.split('|').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const [first, ...rest] = parts;
  const statistic = first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
  const out: string[] = [];
  if (statistic) out.push(statistic);
  for (const piece of rest) {
    const eq = piece.indexOf(':');
    if (eq === -1) {
      out.push(piece);
      continue;
    }
    const key = piece.slice(0, eq).trim().toLowerCase();
    const value = piece.slice(eq + 1).trim();
    if (key === 'dc') out.push(`DC ${value}`);
    else if (key === 'name') continue;
    else if (key === 'options') continue;
    else out.push(value);
  }
  return out.join(' ');
}

function prettifyDamage(body: string): string {
  // @Damage[2d6[slashing]] or @Damage[2d6[slashing]|options:area-damage]
  // We keep the first pipe segment and rewrite [type] → " type".
  const head = body.split('|')[0] ?? '';
  return head.replace(/\[([^\]]+)\]/g, ' $1').trim();
}

export function stripFoundryMarkup(input: unknown): string {
  if (typeof input !== 'string') return '';
  let text = input;

  text = text.replace(UUID_WITH_LABEL, (_, label) => label);
  text = text.replace(UUID_BARE, (_, body) => lastSegment(body));
  text = text.replace(CHECK, (_, body) => prettifyCheck(body));
  text = text.replace(DAMAGE, (_, body) => prettifyDamage(body));
  text = text.replace(LOCALIZE, '');
  text = text.replace(INLINE_ROLL, (_, expr) => expr);

  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n');

  text = text.replace(HTML_TAG, '');
  text = text.replace(NBSP, ' ');

  const lines = text.split('\n').map((line) => line.replace(MULTI_WHITESPACE, ' ').trim());
  return lines.filter((l) => l.length > 0).join('\n').trim();
}
