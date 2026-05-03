// Direction A — "Reference Sheet"
// Warm parchment palette, Source Serif headings + Inter UI, generous spacing,
// reads like a clean rulebook page. Optimized for readability.

const A_COLORS = {
  bg: "#F5EFE2",            // parchment
  panel: "#FBF7EC",         // brighter parchment
  panel2: "#F1E9D5",
  ink: "#1F1A14",           // near-black warm
  inkSoft: "#5C5345",
  inkMute: "#8C8270",
  rule: "#D9CFB6",
  ruleStrong: "#B5A887",
  red: "#9B2D20",           // ink-red accent (HP, damage)
  redSoft: "#C4685C",
  green: "#3F6B3A",         // healthy
  amber: "#A57A1F",         // wounded / temp
  blue: "#2F5773",          // PC accent
  hpBg: "#E8DFC8",
};

function ConditionGlyphA({ name, value, size = 22 }) {
  // simple inked diamond/circle/triangle by category
  const map = {
    "Frightened": { shape: "tri", color: A_COLORS.amber },
    "Stunned": { shape: "x", color: A_COLORS.red },
    "Slowed": { shape: "tri", color: A_COLORS.amber },
    "Sickened": { shape: "circle", color: A_COLORS.amber },
    "Wounded": { shape: "circle", color: A_COLORS.red },
    "Dying": { shape: "x", color: A_COLORS.red },
    "Prone": { shape: "bar", color: A_COLORS.inkSoft },
    "Off-Guard": { shape: "diamond", color: A_COLORS.inkSoft },
    "Concentrating": { shape: "ring", color: A_COLORS.blue },
    "Quickened": { shape: "tri-up", color: A_COLORS.green },
  };
  const def = map[name] || { shape: "circle", color: A_COLORS.inkSoft };
  const s = size;
  return (
    <div title={name} style={{
      width: s, height: s, position: "relative",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flex: "0 0 auto",
    }}>
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ display: "block" }}>
        {def.shape === "circle" && <circle cx="12" cy="12" r="9" fill="none" stroke={def.color} strokeWidth="1.8" />}
        {def.shape === "ring" && <circle cx="12" cy="12" r="8" fill="none" stroke={def.color} strokeWidth="2.5" />}
        {def.shape === "diamond" && <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" fill="none" stroke={def.color} strokeWidth="1.8" />}
        {def.shape === "tri" && <polygon points="12,3 21,20 3,20" fill="none" stroke={def.color} strokeWidth="1.8" />}
        {def.shape === "tri-up" && <polygon points="12,3 21,20 3,20" fill={def.color} stroke={def.color} strokeWidth="1.5" />}
        {def.shape === "x" && <g stroke={def.color} strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></g>}
        {def.shape === "bar" && <rect x="3" y="10" width="18" height="4" fill={def.color} />}
      </svg>
      {value != null && (
        <div style={{
          position: "absolute", right: -4, bottom: -4,
          background: A_COLORS.ink, color: A_COLORS.panel,
          fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
          width: 14, height: 14, borderRadius: 7,
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}>{value}</div>
      )}
    </div>
  );
}

function HpBarA({ hp, max, temp }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const tempPct = temp ? Math.min(20, (temp / max) * 100) : 0;
  let color = A_COLORS.green;
  if (pct < 60) color = A_COLORS.amber;
  if (pct < 30) color = A_COLORS.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{
        position: "relative", height: 10, background: A_COLORS.hpBg,
        border: `1px solid ${A_COLORS.ruleStrong}`, borderRadius: 1, overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: color }} />
        {temp > 0 && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: `${tempPct}%`,
            background: `repeating-linear-gradient(45deg, ${A_COLORS.blue}, ${A_COLORS.blue} 3px, ${A_COLORS.panel} 3px, ${A_COLORS.panel} 5px)`,
          }} />
        )}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11, color: A_COLORS.inkSoft, display: "flex", justifyContent: "space-between",
      }}>
        <span><span style={{ color: A_COLORS.ink, fontWeight: 600 }}>{hp}</span> / {max} HP</span>
        {temp > 0 && <span style={{ color: A_COLORS.blue }}>+{temp} temp</span>}
      </div>
    </div>
  );
}

function CombatantCardA({ c, active, onClick }) {
  const isPc = c.kind === "pc";
  const hpPct = (c.hp / c.maxHp) * 100;
  let hpColor = A_COLORS.green;
  if (hpPct < 60) hpColor = A_COLORS.amber;
  if (hpPct < 30) hpColor = A_COLORS.red;
  return (
    <div onClick={onClick} style={{
      background: active ? A_COLORS.panel : A_COLORS.panel2,
      border: `1px solid ${active ? A_COLORS.ink : A_COLORS.rule}`,
      borderLeft: `3px solid ${active ? A_COLORS.ink : (isPc ? A_COLORS.blue : A_COLORS.red)}`,
      padding: "6px 10px",
      display: "grid",
      gridTemplateColumns: "36px 1fr 56px 38px 110px",
      gap: 10,
      alignItems: "center",
      cursor: "pointer",
      minHeight: 50,
    }}>
      {/* Init */}
      <div style={{
        textAlign: "center", borderRight: `1px solid ${A_COLORS.rule}`, paddingRight: 6,
      }}>
        <div style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 22, fontWeight: 600, lineHeight: 1, color: A_COLORS.ink,
        }}>{c.init}</div>
      </div>

      {/* Name + conditions */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 15, fontWeight: 600, color: A_COLORS.ink, lineHeight: 1.2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{c.name}</div>
          {isPc && <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 8, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", color: A_COLORS.blue,
            border: `1px solid ${A_COLORS.blue}`, padding: "0 4px", flex: "0 0 auto",
          }}>PC</span>}
        </div>
        {(c.conditions.length > 0 || c.persistent.length > 0) && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 3 }}>
            {c.conditions.map((cond, i) => (
              <ConditionGlyphA key={i} name={cond.name} value={cond.value} size={16} />
            ))}
            {c.persistent.map((p, i) => (
              <div key={i} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                color: A_COLORS.red, border: `1px solid ${A_COLORS.red}`,
                padding: "0 4px", letterSpacing: 0.4, textTransform: "uppercase",
              }}>{p.value} {p.type}</div>
            ))}
          </div>
        )}
      </div>

      {/* HP */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600,
          color: hpColor, lineHeight: 1,
        }}>
          {c.hp}<span style={{ color: A_COLORS.inkMute, fontSize: 11 }}>/{c.maxHp}</span>
        </div>
        <div style={{ marginTop: 3, height: 4, background: A_COLORS.hpBg, border: `1px solid ${A_COLORS.rule}` }}>
          <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor }} />
        </div>
        {c.tempHp > 0 && (
          <div style={{ fontSize: 9, color: A_COLORS.blue, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>+{c.tempHp}t</div>
        )}
      </div>

      {/* AC */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "Inter, sans-serif", fontSize: 8, fontWeight: 700,
          letterSpacing: 1.2, textTransform: "uppercase", color: A_COLORS.inkMute,
        }}>AC</div>
        <div style={{
          fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, fontWeight: 600,
          color: A_COLORS.ink, lineHeight: 1,
        }}>{c.ac}</div>
      </div>

      {/* Saves */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, textAlign: "center",
      }}>
        {[
          { l: "Fort", v: c.saves.fort }, { l: "Ref", v: c.saves.ref }, { l: "Will", v: c.saves.will },
        ].map((s, i) => (
          <div key={i}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
              letterSpacing: 0.6, textTransform: "uppercase", color: A_COLORS.inkMute,
            }}>{s.l}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
              color: A_COLORS.ink, lineHeight: 1.1,
            }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ARROW_BTN = {
  width: 22, height: 18, border: `1px solid ${A_COLORS.rule}`, background: "transparent",
  color: A_COLORS.inkMute, fontSize: 10, cursor: "pointer", padding: 0,
  fontFamily: "Inter, sans-serif",
};

function StatBlockA({ c }) {
  const Sec = ({ children }) => (
    <div style={{ borderTop: `1px solid ${A_COLORS.rule}`, padding: "12px 16px" }}>{children}</div>
  );
  const Label = ({ children }) => (
    <span style={{
      fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
      letterSpacing: 1.4, textTransform: "uppercase", color: A_COLORS.inkMute,
      marginRight: 8,
    }}>{children}</span>
  );
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: A_COLORS.ink, fontSize: 13, lineHeight: 1.55 }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 14px", background: A_COLORS.panel2 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{
            margin: 0, fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 26, fontWeight: 600, color: A_COLORS.ink, letterSpacing: -0.2,
          }}>{c.name}</h2>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: A_COLORS.inkMute,
            textTransform: "uppercase", letterSpacing: 1.2,
          }}>{c.kind === "pc" ? "Player Character" : "Creature"}</div>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: A_COLORS.inkSoft, fontStyle: "italic" }}>
          {c.pcClass || c.creatureType}
        </div>
      </div>

      {/* Defensive block — AC, HP, saves, immunities/resistances/weaknesses together */}
      <Sec>
        <Label>Defenses</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 8 }}>
          <Stat label="AC" value={c.ac} />
          <Stat label="HP" value={`${c.hp} / ${c.maxHp}`} />
          <Stat label="Perception" value={c.perception} />
          <Stat label="Speed" value={c.speeds} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
          <Stat label="Fortitude" value={c.saves.fort} small />
          <Stat label="Reflex" value={c.saves.ref} small />
          <Stat label="Will" value={c.saves.will} small />
        </div>
        {(c.immunities.length + c.resistances.length + c.weaknesses.length) > 0 && (
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${A_COLORS.rule}`,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {c.immunities.length > 0 && <div><Label>Immunities</Label>{c.immunities.join(", ")}</div>}
            {c.resistances.length > 0 && (
              <div><Label>Resistances</Label>{c.resistances.map(r => `${r.type} ${r.value}`).join(", ")}</div>
            )}
            {c.weaknesses.length > 0 && (
              <div><Label>Weaknesses</Label>{c.weaknesses.map(r => `${r.type} ${r.value}`).join(", ")}</div>
            )}
          </div>
        )}
      </Sec>

      <Sec>
        <Label>Skills</Label> <span>{c.skills}</span>
      </Sec>

      <Sec>
        <Label>Strikes</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {c.strikes.map((s, i) => {
            const isAgile = /agile/i.test(s.traits || "");
            const map2 = parseInt(s.bonus, 10) - (isAgile ? 4 : 5);
            const map3 = parseInt(s.bonus, 10) - (isAgile ? 8 : 10);
            const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 600, color: A_COLORS.ink }}>{s.name}</div>
                  <div style={{
                    display: "flex", gap: 6,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                  }}>
                    <span style={{
                      color: A_COLORS.red,
                      borderBottom: `2px solid ${A_COLORS.red}`,
                      padding: "0 4px",
                    }}>{s.bonus}</span>
                    <span style={{ color: A_COLORS.inkSoft, padding: "0 4px" }}>{fmt(map2)}</span>
                    <span style={{ color: A_COLORS.inkMute, padding: "0 4px" }}>{fmt(map3)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 1 }}>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, textTransform: "uppercase", color: A_COLORS.inkMute,
                    width: 38, textAlign: "center",
                  }}>1st</span>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, textTransform: "uppercase", color: A_COLORS.inkMute,
                    width: 38, textAlign: "center",
                  }}>{isAgile ? "MAP −4" : "MAP −5"}</span>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, textTransform: "uppercase", color: A_COLORS.inkMute,
                    width: 38, textAlign: "center",
                  }}>{isAgile ? "MAP −8" : "MAP −10"}</span>
                </div>
                <div style={{ fontSize: 12, color: A_COLORS.inkSoft, marginTop: 4 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.dmg}</span>
                  {" · "}<span style={{ fontStyle: "italic" }}>{s.traits}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Sec>

      {c.spellSlots && (
        <Sec>
          <Label>Spell Slots</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {Object.entries(c.spellSlots).sort((a, b) => b[0] - a[0]).map(([rank, info]) => (
              <div key={rank} style={{ display: "grid", gridTemplateColumns: "60px 80px 1fr", gap: 12, alignItems: "baseline" }}>
                <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600 }}>
                  Rank {rank}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: info.max }).map((_, i) => (
                    <div key={i} style={{
                      width: 14, height: 14, border: `1.5px solid ${A_COLORS.ink}`,
                      background: i < info.used ? A_COLORS.ink : "transparent",
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: A_COLORS.inkSoft }}>{info.prepared.join(" · ")}</div>
              </div>
            ))}
          </div>
        </Sec>
      )}

      <Sec>
        <Label>Conditions</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {c.conditions.length === 0 && c.persistent.length === 0 && (
            <div style={{ color: A_COLORS.inkMute, fontStyle: "italic" }}>None</div>
          )}
          {c.conditions.map((cond, i) => {
            const ref = window.PF2E_DATA.CONDITIONS_REF[cond.name];
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10,
                alignItems: "center", padding: "6px 0",
                borderBottom: i < c.conditions.length - 1 ? `1px dashed ${A_COLORS.rule}` : "none",
              }}>
                <ConditionGlyphA name={cond.name} value={cond.value} size={18} />
                <div>
                  <div style={{ fontWeight: 600 }}>{cond.name}{cond.value != null ? ` ${cond.value}` : ""}</div>
                  <div style={{ fontSize: 11, color: A_COLORS.inkSoft }}>{ref?.text}</div>
                </div>
                <div style={{ fontSize: 11, color: A_COLORS.inkMute, fontStyle: "italic" }}>{cond.duration}</div>
                <button style={{
                  width: 22, height: 22, border: `1px solid ${A_COLORS.rule}`, background: "transparent",
                  color: A_COLORS.inkMute, cursor: "pointer", fontSize: 12,
                }}>×</button>
              </div>
            );
          })}
        </div>
        <button style={{
          marginTop: 10, padding: "6px 10px", border: `1px dashed ${A_COLORS.ruleStrong}`,
          background: "transparent", color: A_COLORS.inkSoft, fontSize: 11,
          fontFamily: "Inter, sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
        }}>+ Add condition</button>
      </Sec>

      {c.notes && (
        <Sec>
          <Label>GM Notes</Label>
          <div style={{ marginTop: 6, fontStyle: "italic", color: A_COLORS.inkSoft }}>{c.notes}</div>
        </Sec>
      )}
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
        letterSpacing: 1.4, textTransform: "uppercase", color: A_COLORS.inkMute,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: small ? 18 : 22, fontWeight: 600, color: A_COLORS.ink,
        marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

function CombatLogA() {
  const log = window.PF2E_DATA.COMBAT_LOG;
  const kindColor = {
    hit: A_COLORS.ink, crit: A_COLORS.red, miss: A_COLORS.inkMute,
    spell: A_COLORS.blue, condition: A_COLORS.amber, action: A_COLORS.green, system: A_COLORS.inkMute,
  };
  let lastRound = null;
  return (
    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: A_COLORS.ink }}>
      {log.map((entry, i) => {
        const showRound = entry.round !== lastRound;
        lastRound = entry.round;
        return (
          <React.Fragment key={i}>
            {showRound && (
              <div style={{
                padding: "10px 16px 6px",
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: 13, fontWeight: 600, color: A_COLORS.inkMute,
                letterSpacing: 0.5, borderTop: i > 0 ? `1px solid ${A_COLORS.rule}` : "none",
              }}>Round {entry.round}</div>
            )}
            <div style={{
              padding: "6px 16px",
              display: "grid", gridTemplateColumns: "auto 1fr",
              gap: 10, alignItems: "baseline",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                color: A_COLORS.inkMute, whiteSpace: "nowrap",
              }}>{entry.actor}</div>
              <div style={{ color: kindColor[entry.kind] || A_COLORS.ink }}>
                {entry.kind === "crit" && <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
                  letterSpacing: 1, textTransform: "uppercase",
                  background: A_COLORS.red, color: A_COLORS.panel,
                  padding: "1px 5px", marginRight: 6,
                }}>Crit</span>}
                {entry.text}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function BestiaryA() {
  const { BESTIARY, PARTY } = window.PF2E_DATA;
  const SearchInput = (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${A_COLORS.rule}` }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        border: `1px solid ${A_COLORS.ruleStrong}`, padding: "6px 10px",
        background: A_COLORS.panel,
      }}>
        <span style={{ color: A_COLORS.inkMute, fontSize: 12 }}>⌕</span>
        <input placeholder="Search bestiary…" style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "Inter, sans-serif", fontSize: 13, color: A_COLORS.ink,
        }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {["Lvl 1-3", "Lvl 4-6", "Boss", "Humanoid", "Undead"].map(t => (
          <span key={t} style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600,
            letterSpacing: 0.6, textTransform: "uppercase", color: A_COLORS.inkSoft,
            border: `1px solid ${A_COLORS.rule}`, padding: "2px 7px",
          }}>{t}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: A_COLORS.ink, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "14px 14px 10px",
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 18, fontWeight: 600, color: A_COLORS.ink,
        borderBottom: `1px solid ${A_COLORS.rule}`,
      }}>Library</div>

      <div style={{
        padding: "10px 14px 6px",
        fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
        letterSpacing: 1.4, textTransform: "uppercase", color: A_COLORS.inkMute,
      }}>Party</div>
      <div>
        {PARTY.map((p, i) => (
          <div key={i} style={{
            padding: "8px 14px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderBottom: `1px dashed ${A_COLORS.rule}`,
            fontSize: 13,
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: A_COLORS.inkMute }}>{p.pcClass}</div>
            </div>
            <button style={ADD_BTN_A}>+</button>
          </div>
        ))}
      </div>

      {SearchInput}

      <div style={{ overflow: "auto", flex: 1 }}>
        {BESTIARY.map((cr, i) => (
          <div key={i} style={{
            padding: "10px 14px", display: "grid",
            gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center",
            borderBottom: `1px dashed ${A_COLORS.rule}`,
          }}>
            <div style={{
              fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600,
              width: 28, textAlign: "center", color: A_COLORS.ink,
            }}>{cr.lvl}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{cr.name}</div>
              <div style={{ fontSize: 10, color: A_COLORS.inkMute, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {cr.traits.join(" · ")}
              </div>
            </div>
            <button style={ADD_BTN_A}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const ADD_BTN_A = {
  width: 26, height: 26, border: `1px solid ${A_COLORS.ink}`, background: "transparent",
  color: A_COLORS.ink, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0,
  fontFamily: "Inter, sans-serif",
};

function DirectionA() {
  const combatants = window.PF2E_DATA.COMBATANTS;
  const [activeId, setActiveId] = React.useState("kael");
  const [logOpen, setLogOpen] = React.useState(true);
  const active = combatants.find(c => c.id === activeId);

  return (
    <div style={{
      width: 1440, height: 1000, background: A_COLORS.bg,
      color: A_COLORS.ink, fontFamily: "Inter, sans-serif",
      display: "grid",
      gridTemplateColumns: "260px 540px 1fr",
      gridTemplateRows: `1fr ${logOpen ? "240px" : "40px"}`,
      gridTemplateAreas: `
        "lib track details"
        "log log    log"
      `,
      borderTop: `1px solid ${A_COLORS.rule}`,
    }}>
      {/* Library */}
      <aside style={{
        gridArea: "lib",
        background: A_COLORS.panel, borderRight: `1px solid ${A_COLORS.ruleStrong}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <BestiaryA />
      </aside>

      {/* Initiative tracker */}
      <main style={{ gridArea: "track", overflow: "hidden", display: "flex", flexDirection: "column", background: A_COLORS.bg }}>
        <header style={{
          padding: "16px 20px", borderBottom: `1px solid ${A_COLORS.ruleStrong}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: A_COLORS.panel,
        }}>
          <div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: 1.6, textTransform: "uppercase", color: A_COLORS.inkMute,
            }}>Encounter</div>
            <div style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 22, fontWeight: 600, marginTop: 2,
            }}>The Crypt of Vorn</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: 1.6, textTransform: "uppercase", color: A_COLORS.inkMute,
            }}>Round</div>
            <div style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 2,
              color: A_COLORS.red,
            }}>3</div>
          </div>
        </header>

        <div style={{
          padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: A_COLORS.panel2, borderBottom: `1px solid ${A_COLORS.rule}`,
          fontSize: 12, color: A_COLORS.inkSoft,
        }}>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: A_COLORS.ink, fontWeight: 600 }}>Kael Ironhand</span>
            {" "}is up · 3 actions · 1 reaction
          </div>
          <button style={{
            border: `1px solid ${A_COLORS.ink}`, background: A_COLORS.ink, color: A_COLORS.panel,
            padding: "5px 14px", fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
            letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer",
          }}>Next turn ▸</button>
        </div>

        <div style={{
          padding: "8px 12px 6px 12px",
          display: "grid", gridTemplateColumns: "36px 1fr 56px 38px 110px",
          gap: 10, alignItems: "center",
          fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
          letterSpacing: 1.2, textTransform: "uppercase", color: A_COLORS.inkMute,
          borderBottom: `1px solid ${A_COLORS.rule}`,
        }}>
          <div style={{ textAlign: "center" }}>Init</div>
          <div>Combatant</div>
          <div style={{ textAlign: "center" }}>HP</div>
          <div style={{ textAlign: "center" }}>AC</div>
          <div style={{ textAlign: "center" }}>Fort · Ref · Will</div>
        </div>
        <div style={{ overflow: "auto", padding: "6px 12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {combatants.map(c => (
            <CombatantCardA key={c.id} c={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
          ))}
        </div>
      </main>

      {/* Details (right) */}
      <aside style={{
        gridArea: "details",
        background: A_COLORS.panel, borderLeft: `1px solid ${A_COLORS.ruleStrong}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${A_COLORS.ruleStrong}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: A_COLORS.panel2,
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: 1.4, textTransform: "uppercase", color: A_COLORS.ink,
          }}>Combatant Details</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: A_COLORS.inkMute,
          }}>{combatants.findIndex(x => x.id === activeId) + 1} / {combatants.length}</div>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <StatBlockA c={active} />
        </div>
      </aside>

      {/* Combat log — bottom hideable */}
      <section style={{
        gridArea: "log",
        background: A_COLORS.panel,
        borderTop: `1px solid ${A_COLORS.ruleStrong}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <button onClick={() => setLogOpen(o => !o)} style={{
          padding: "0 18px", height: 40,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: A_COLORS.panel2, border: "none",
          borderBottom: logOpen ? `1px solid ${A_COLORS.rule}` : "none",
          cursor: "pointer", color: A_COLORS.ink, textAlign: "left", width: "100%",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: 1.4, textTransform: "uppercase", color: A_COLORS.ink,
            }}>{logOpen ? "▼" : "▲"} Combat Log</span>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 11,
              color: A_COLORS.inkMute,
            }}>{window.PF2E_DATA.COMBAT_LOG.length} entries · Round 3</span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600,
              letterSpacing: 1.2, textTransform: "uppercase", color: A_COLORS.inkSoft,
            }}>Filter: All</span>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600,
              letterSpacing: 1.2, textTransform: "uppercase", color: A_COLORS.inkMute,
            }}>Export ↗</span>
          </div>
        </button>
        {logOpen && (
          <div style={{ overflow: "auto", flex: 1 }}>
            <CombatLogA />
          </div>
        )}
      </section>
    </div>
  );
}

window.DirectionA = DirectionA;
