// Radial / pie menu condition picker — 4 sequential states

function RadialMenu({ state = "hub" }) {
  const A = {
    bg: "#FBF7EC", panel: "#F5EFE2", panel2: "#F1E9D5",
    ink: "#1F1A14", inkSoft: "#5C5345", inkMute: "#8C8270",
    rule: "#D9CFB6", ruleStrong: "#B5A887",
    red: "#9B2D20", green: "#3F6B3A", amber: "#A57A1F", blue: "#2F5773",
  };

  const cx = 220, cy = 220;
  const innerR = 56;       // hub radius
  const ringR = 130;       // primary wedge outer radius
  const subRingR = 200;    // sub-arc outer radius
  const labelR = 95;       // primary label distance from center
  const subLabelR = 165;   // sub-arc label distance

  // Six primary wedges, top-aligned
  const PRIMARY = [
    { id: "recent",     ic: "↺", label: "Recent",     count: 3,   color: A.amber },
    { id: "conditions", ic: "✦", label: "Conditions", count: 28,  color: A.ink },
    { id: "persistent", ic: "✷", label: "Persistent", count: 7,   color: A.red },
    { id: "remove",     ic: "✕", label: "Remove",     count: 2,   color: A.red, danger: true },
    { id: "buffs",      ic: "✚", label: "Buffs",      count: 9,   color: A.green },
    { id: "afflict",    ic: "☣", label: "Afflictions",count: 6,   color: A.blue },
  ];

  // helper: convert (angle in deg from 12-o'clock, clockwise) → x,y
  const polar = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };
  // wedge path (annulus segment)
  const wedge = (a0, a1, r0, r1) => {
    const p0 = polar(a0, r1), p1 = polar(a1, r1);
    const p2 = polar(a1, r0), p3 = polar(a0, r0);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
  };

  const slice = 360 / PRIMARY.length;
  // start at -slice/2 so the first wedge is centered at 12 o'clock
  const wedgeAngle = (i) => ({ a0: i * slice - slice / 2, a1: i * slice + slice / 2, mid: i * slice });

  // condition sub-arc (only shown in states 3+4) — centered around "Conditions" wedge (index 1, mid = 60deg)
  const conditionsMid = 60;
  const subItems = [
    "Off-Guard", "Frightened", "Sickened", "Stunned",
    "Slowed", "Prone", "Dying", "Wounded",
    "Clumsy",
  ];
  // sub items span ±55° around mid
  const subSpan = 110;
  const subStep = subSpan / (subItems.length - 1);
  const subAngle = (i) => conditionsMid - subSpan / 2 + i * subStep;

  // selected condition for state 4
  const selected = "Frightened";
  const selectedIdx = subItems.indexOf(selected);

  return (
    <svg width="440" height="440" viewBox="0 0 440 440" style={{ display: "block" }}>
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="4" stdDeviation="3" floodColor="#1F1A14" floodOpacity="0.18" />
        </filter>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={A.rule} strokeWidth="1" />
        </pattern>
      </defs>

      {/* Outer guide ring (only on states past hub for context) */}
      {(state === "subarc" || state === "scrub") && (
        <circle cx={cx} cy={cy} r={subRingR + 2} fill="none" stroke={A.rule} strokeDasharray="2 4" />
      )}

      {/* Primary wedges (all states except 'closed') */}
      {state !== "closed" && PRIMARY.map((w, i) => {
        const { a0, a1, mid } = wedgeAngle(i);
        const isHover = (state === "hub" && w.id === "conditions") ||
                        ((state === "subarc" || state === "scrub") && w.id === "conditions");
        const dim = (state === "subarc" || state === "scrub") && w.id !== "conditions";
        const labelPos = polar(mid, labelR);
        return (
          <g key={w.id} opacity={dim ? 0.35 : 1}>
            <path
              d={wedge(a0 + 1.5, a1 - 1.5, innerR + 4, ringR)}
              fill={isHover ? A.ink : A.bg}
              stroke={A.ink}
              strokeWidth="1"
              filter={isHover ? "url(#shadow)" : undefined}
            />
            <text
              x={labelPos.x}
              y={labelPos.y - 4}
              textAnchor="middle"
              fill={isHover ? A.bg : (w.danger ? A.red : A.ink)}
              fontFamily="'Source Serif 4', Georgia, serif"
              fontSize="18"
              fontWeight="600"
            >{w.ic}</text>
            <text
              x={labelPos.x}
              y={labelPos.y + 14}
              textAnchor="middle"
              fill={isHover ? A.bg : A.inkSoft}
              fontFamily="Inter, sans-serif"
              fontSize="9"
              fontWeight="700"
              letterSpacing="1.2"
            >{w.label.toUpperCase()}</text>
            {/* count pip */}
            <text
              x={labelPos.x}
              y={labelPos.y + 26}
              textAnchor="middle"
              fill={isHover ? A.bg : A.inkMute}
              fontFamily="'JetBrains Mono', monospace"
              fontSize="9"
            >{w.count}</text>
          </g>
        );
      })}

      {/* Sub-arc for Conditions (states 3 & 4) */}
      {(state === "subarc" || state === "scrub") && (
        <g>
          {/* sub-arc track */}
          <path
            d={wedge(conditionsMid - subSpan/2 - 6, conditionsMid + subSpan/2 + 6, ringR + 8, subRingR)}
            fill={A.panel}
            stroke={A.rule}
            strokeWidth="1"
          />
          {subItems.map((c, i) => {
            const ang = subAngle(i);
            const labelPos = polar(ang, subLabelR);
            const isSel = state === "scrub" && i === selectedIdx;
            const isHover = state === "subarc" && c === "Frightened";
            return (
              <g key={c}>
                {(isSel || isHover) && (
                  <circle cx={labelPos.x} cy={labelPos.y} r="22"
                    fill={isSel ? A.amber : A.ink} opacity={isSel ? 0.18 : 0.10} />
                )}
                <text
                  x={labelPos.x}
                  y={labelPos.y + 4}
                  textAnchor="middle"
                  fill={isSel ? A.amber : (isHover ? A.ink : A.inkSoft)}
                  fontFamily="Inter, sans-serif"
                  fontSize={isSel || isHover ? "11" : "10"}
                  fontWeight={isSel || isHover ? "700" : "500"}
                >{c}</text>
              </g>
            );
          })}
        </g>
      )}

      {/* Value scrub strip on selected wedge (state 4) */}
      {state === "scrub" && (
        <g>
          {[1, 2, 3, 4].map((v, i) => {
            const ang = subAngle(selectedIdx) + (i - 1.5) * 5;
            const r = subRingR + 18;
            const pos = polar(ang, r);
            const active = v === 2;
            return (
              <g key={v}>
                <circle cx={pos.x} cy={pos.y} r={active ? 13 : 10}
                  fill={active ? A.amber : A.bg}
                  stroke={A.ink}
                  strokeWidth={active ? 1.5 : 1} />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle"
                  fontFamily="'Source Serif 4', Georgia, serif"
                  fontSize={active ? "14" : "11"}
                  fontWeight="700"
                  fill={active ? A.bg : A.ink}>{v}</text>
              </g>
            );
          })}
          {/* drag indicator */}
          <text x={cx} y={cy + subRingR + 50} textAnchor="middle"
            fontFamily="Inter, sans-serif" fontSize="10" fontWeight="600"
            letterSpacing="1.4" fill={A.amber}>
            DRAG TO SET VALUE
          </text>
        </g>
      )}

      {/* Hub (always shown except 'closed') */}
      {state !== "closed" && (
        <g filter="url(#shadow)">
          <circle cx={cx} cy={cy} r={innerR} fill={A.bg} stroke={A.ink} strokeWidth="1.5" />
          <circle cx={cx} cy={cy - 18} r="14" fill={A.panel2} stroke={A.ruleStrong} strokeWidth="1" />
          <text x={cx} y={cy - 14} textAnchor="middle"
            fontFamily="'Source Serif 4', Georgia, serif" fontSize="14" fontWeight="700"
            fill={A.ink}>CB</text>
          <text x={cx} y={cy + 8} textAnchor="middle"
            fontFamily="'Source Serif 4', Georgia, serif" fontSize="11" fontWeight="600"
            fill={A.ink}>Cult Brute</text>
          <text x={cx} y={cy + 22} textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace" fontSize="8" fontWeight="600"
            fill={A.inkMute} letterSpacing="0.5">64/75 HP</text>
          <text x={cx} y={cy + 34} textAnchor="middle"
            fontFamily="Inter, sans-serif" fontSize="8" fontWeight="700"
            fill={A.amber} letterSpacing="0.8">● STUNNED 1</text>
        </g>
      )}

      {/* Closed state — just shows the right-click trigger point */}
      {state === "closed" && (
        <g>
          <rect x={cx - 80} y={cy - 30} width="160" height="60" fill={A.bg} stroke={A.ink} strokeWidth="1.5" />
          <text x={cx} y={cy - 8} textAnchor="middle"
            fontFamily="'Source Serif 4', Georgia, serif" fontSize="14" fontWeight="700"
            fill={A.ink}>Cult Brute</text>
          <text x={cx} y={cy + 10} textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace" fontSize="10"
            fill={A.inkMute}>64/75 HP · AC 22</text>
          {/* cursor + ring */}
          <circle cx={cx + 50} cy={cy + 40} r="22" fill="none" stroke={A.amber} strokeWidth="2" strokeDasharray="3 3" />
          <text x={cx + 50} y={cy + 44} textAnchor="middle"
            fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700"
            fill={A.amber}>RT</text>
          <line x1={cx + 50} y1={cy + 62} x2={cx + 50} y2={cy + 100} stroke={A.amber} strokeWidth="1" strokeDasharray="2 3" />
          <text x={cx + 50} y={cy + 116} textAnchor="middle"
            fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700"
            fill={A.amber} letterSpacing="1.2">RIGHT-CLICK</text>
        </g>
      )}
    </svg>
  );
}

function RadialStatesMockup() {
  const A = { bg: "#F5EFE2", panel: "#FBF7EC", ink: "#1F1A14", inkMute: "#8C8270", rule: "#D9CFB6" };

  const Frame = ({ n, title, sub, hint, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{
          fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 28, fontWeight: 700,
          color: A.ink, lineHeight: 1,
        }}>{n}</span>
        <div>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
            letterSpacing: 1.4, textTransform: "uppercase", color: A.inkMute,
          }}>{title}</div>
          <div style={{
            fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600,
            color: A.ink, marginTop: 1,
          }}>{sub}</div>
        </div>
      </div>
      <div style={{
        background: A.bg, border: `1px solid ${A.rule}`,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {children}
      </div>
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 11, color: A.inkMute,
        lineHeight: 1.45, fontStyle: "italic",
      }}>{hint}</div>
    </div>
  );

  return (
    <div style={{
      width: 1880, height: 720, background: A.panel, padding: 32,
      fontFamily: "Inter, sans-serif", color: A.ink,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20,
    }}>
      <Frame n="01" title="Trigger" sub="Right-click combatant"
        hint="Right-click on initiative card. Hold to bring up the radial; release to apply selection. Single-tap on touch.">
        <RadialMenu state="closed" />
      </Frame>
      <Frame n="02" title="Hub" sub="6 categories revealed"
        hint="Center confirms target. 6 wedges sized equally; counts show how many items in each. Recent shrinks from 'I just used these' history.">
        <RadialMenu state="hub" />
      </Frame>
      <Frame n="03" title="Sub-arc" sub="Hover Conditions → fan out"
        hint="Hold on a wedge for 180ms — sub-arc fans out concentric. Items arranged by frequency in PF2e play. Already-applied conditions show a rim pip.">
        <RadialMenu state="subarc" />
      </Frame>
      <Frame n="04" title="Scrub value" sub="Drag along arc → set 1–4"
        hint="Once a value-bearing condition is selected, drag along the outer arc to scrub the value. Release to commit. Continues to feel like one fluid gesture.">
        <RadialMenu state="scrub" />
      </Frame>
    </div>
  );
}

window.RadialStatesMockup = RadialStatesMockup;
