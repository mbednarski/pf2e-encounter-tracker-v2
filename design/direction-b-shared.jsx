// Direction B — "Console"
// Dark slate dashboard. JetBrains Mono labels + Inter body.
// Dense, color-coded, designed for fast scanning during play.

const B_COLORS = {
  bg: "#0E1116",
  panel: "#161B22",
  panel2: "#1C232C",
  panelHi: "#222A35",
  rule: "#2A3340",
  ruleHi: "#3A4555",
  text: "#E6EDF3",
  textSoft: "#9BA8B8",
  textMute: "#6B7787",
  accent: "#7DD3C0",      // teal — active turn / PC
  accentDim: "#1F4A43",
  red: "#F47174",         // damage / enemy
  redDim: "#3A1F22",
  amber: "#E8B86B",
  green: "#7CC082",
  blue: "#7AA7E0",
  violet: "#B492E0",
};

function PipsB({ used, max, color = B_COLORS.text }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: 2,
          border: `1px solid ${color}`,
          background: i < (max - used) ? color : "transparent",
          opacity: i < (max - used) ? 1 : 0.3,
        }} />
      ))}
    </div>
  );
}

function HpBarB({ hp, max, temp }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const tempPct = temp ? Math.min(25, (temp / max) * 100) : 0;
  let color = B_COLORS.green;
  if (pct < 60) color = B_COLORS.amber;
  if (pct < 30) color = B_COLORS.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{
        position: "relative", height: 8, background: B_COLORS.panel2,
        borderRadius: 1, overflow: "hidden", border: `1px solid ${B_COLORS.rule}`,
      }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: color }} />
        {temp > 0 && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: `${tempPct}%`,
            background: B_COLORS.blue, opacity: 0.85,
          }} />
        )}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11, color: B_COLORS.textSoft, display: "flex", justifyContent: "space-between",
      }}>
        <span><span style={{ color: B_COLORS.text, fontWeight: 600 }}>{hp}</span><span style={{ color: B_COLORS.textMute }}>/{max}</span></span>
        {temp > 0 && <span style={{ color: B_COLORS.blue }}>+{temp} TEMP</span>}
      </div>
    </div>
  );
}

function ConditionTagB({ name, value }) {
  const colorMap = {
    "Frightened": B_COLORS.amber, "Stunned": B_COLORS.red, "Slowed": B_COLORS.amber,
    "Sickened": B_COLORS.amber, "Wounded": B_COLORS.red, "Dying": B_COLORS.red,
    "Off-Guard": B_COLORS.textSoft, "Concentrating": B_COLORS.violet,
    "Quickened": B_COLORS.green, "Prone": B_COLORS.textSoft,
  };
  const c = colorMap[name] || B_COLORS.textSoft;
  return (
    <div title={name} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
      letterSpacing: 0.4, textTransform: "uppercase",
      color: c, border: `1px solid ${c}`, padding: "1px 6px",
      borderRadius: 2, background: `${c}1A`,
    }}>
      <span>{name}</span>
      {value != null && <span style={{ color: B_COLORS.text, background: c, padding: "0 4px", borderRadius: 1 }}>{value}</span>}
    </div>
  );
}

window.B_COLORS = B_COLORS;
window.PipsB = PipsB;
window.HpBarB = HpBarB;
window.ConditionTagB = ConditionTagB;
