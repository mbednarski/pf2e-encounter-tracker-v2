// Direction B — Combatant card and statblock

function CombatantCardB({ c, active, onClick }) {
  const isPc = c.kind === "pc";
  const accent = active ? B_COLORS.accent : (isPc ? B_COLORS.blue : B_COLORS.red);
  const hpPct = (c.hp / c.maxHp) * 100;
  let hpColor = B_COLORS.green;
  if (hpPct < 60) hpColor = B_COLORS.amber;
  if (hpPct < 30) hpColor = B_COLORS.red;
  return (
    <div onClick={onClick} style={{
      background: active ? B_COLORS.panelHi : B_COLORS.panel,
      borderLeft: `4px solid ${accent}`,
      borderTop: `1px solid ${active ? accent : B_COLORS.rule}`,
      borderRight: `1px solid ${active ? accent : B_COLORS.rule}`,
      borderBottom: `1px solid ${active ? accent : B_COLORS.rule}`,
      padding: "12px 14px",
      display: "grid",
      gridTemplateColumns: "56px 1fr 92px 76px 20px",
      gap: 14,
      alignItems: "center",
      cursor: "pointer",
      borderRadius: 3,
      boxShadow: active ? `0 0 0 1px ${accent}33` : "none",
    }}>
      {/* Initiative — large */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        borderRight: `1px solid ${B_COLORS.rule}`, paddingRight: 10,
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: 1.2, color: B_COLORS.textMute,
        }}>INIT</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700,
          color: active ? B_COLORS.accent : B_COLORS.text, lineHeight: 1,
        }}>{c.init}</div>
      </div>

      {/* Name + class + conditions */}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 17, fontWeight: 700,
            color: B_COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            letterSpacing: -0.2,
          }}>{c.name}</div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
            letterSpacing: 1, color: isPc ? B_COLORS.blue : B_COLORS.red,
            border: `1px solid ${isPc ? B_COLORS.blue : B_COLORS.red}`,
            padding: "1px 5px", borderRadius: 2, flex: "0 0 auto",
          }}>{isPc ? "PC" : "NPC"}</span>
        </div>
        <div style={{
          fontFamily: "Inter, sans-serif", fontSize: 11, color: B_COLORS.textMute,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{c.pcClass || c.creatureType}</div>
        {(c.conditions.length > 0 || c.persistent.length > 0) && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
            {c.conditions.map((cond, i) => (
              <ConditionTagB key={i} name={cond.name} value={cond.value} />
            ))}
            {c.persistent.map((p, i) => (
              <div key={i} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
                color: B_COLORS.red, border: `1px solid ${B_COLORS.red}`,
                padding: "1px 5px", borderRadius: 2, letterSpacing: 0.4, textTransform: "uppercase",
                background: `${B_COLORS.red}1A`,
              }}>● {p.value} {p.type}</div>
            ))}
          </div>
        )}
      </div>

      {/* HP — big and prominent */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        padding: "6px 8px", background: B_COLORS.panel2,
        border: `1px solid ${B_COLORS.rule}`, borderRadius: 3,
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: 1.2, color: B_COLORS.textMute, textAlign: "center",
        }}>HP{c.tempHp ? <span style={{ color: B_COLORS.blue }}> +{c.tempHp}</span> : null}</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700,
          color: hpColor, lineHeight: 1, textAlign: "center",
        }}>
          {c.hp}<span style={{ color: B_COLORS.textMute, fontSize: 12 }}>/{c.maxHp}</span>
        </div>
        <div style={{
          height: 5, background: B_COLORS.bg, borderRadius: 1, overflow: "hidden",
        }}>
          <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor }} />
        </div>
      </div>

      {/* AC — big and prominent */}
      <div style={{
        textAlign: "center",
        padding: "6px 8px", background: B_COLORS.panel2,
        border: `1px solid ${B_COLORS.rule}`, borderRadius: 3,
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: 1.2, color: B_COLORS.textMute,
        }}>AC</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700,
          color: B_COLORS.text, lineHeight: 1, marginTop: 2,
        }}>{c.ac}</div>
      </div>

      {/* Drag handle */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4, color: B_COLORS.textMute,
        alignItems: "center",
      }}>
        <div style={{ fontSize: 9 }}>▲</div>
        <div style={{ fontSize: 9 }}>▼</div>
      </div>
    </div>
  );
}

function StatBlockB({ c }) {
  const Label = ({ children, color = B_COLORS.textMute }) => (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
      letterSpacing: 1.2, textTransform: "uppercase", color,
    }}>{children}</span>
  );
  const Sec = ({ children }) => (
    <div style={{ borderTop: `1px solid ${B_COLORS.rule}`, padding: "14px 18px" }}>{children}</div>
  );
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: B_COLORS.text, fontSize: 13, lineHeight: 1.55 }}>
      {/* Header */}
      <div style={{
        padding: "18px 18px 14px", background: B_COLORS.panel2,
        borderBottom: `1px solid ${B_COLORS.rule}`,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{
            margin: 0, fontFamily: "Inter, sans-serif",
            fontSize: 22, fontWeight: 700, color: B_COLORS.text, letterSpacing: -0.2,
          }}>{c.name}</h2>
          <Label color={c.kind === "pc" ? B_COLORS.blue : B_COLORS.red}>
            {c.kind === "pc" ? "Player Character" : "Creature"}
          </Label>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: B_COLORS.textSoft, fontFamily: "'JetBrains Mono', monospace" }}>
          {c.pcClass || c.creatureType}
        </div>
      </div>

      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatB label="AC" value={c.ac} />
        <StatB label="HP" value={`${c.hp}/${c.maxHp}`} />
        <StatB label="PERC" value={c.perception} />
        <StatB label="SPEED" value={c.speeds} />
      </div>

      <Sec>
        <Label>Saves</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
          <StatB label="FORT" value={c.saves.fort} small />
          <StatB label="REF" value={c.saves.ref} small />
          <StatB label="WILL" value={c.saves.will} small />
        </div>
      </Sec>

      <Sec>
        <Label>Skills</Label>
        <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: B_COLORS.textSoft, lineHeight: 1.7 }}>
          {c.skills}
        </div>
      </Sec>

      {(c.resistances.length + c.weaknesses.length + c.immunities.length) > 0 && (
        <Sec>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {c.resistances.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <Label color={B_COLORS.green}>Resist</Label>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  {c.resistances.map(r => `${r.type} ${r.value}`).join(", ")}
                </span>
              </div>
            )}
            {c.weaknesses.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <Label color={B_COLORS.red}>Weak</Label>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  {c.weaknesses.map(r => `${r.type} ${r.value}`).join(", ")}
                </span>
              </div>
            )}
          </div>
        </Sec>
      )}

      <Sec>
        <Label>Strikes</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {c.strikes.map((s, i) => {
            const isAgile = /agile/i.test(s.traits || "");
            const map2 = parseInt(s.bonus, 10) - (isAgile ? 4 : 5);
            const map3 = parseInt(s.bonus, 10) - (isAgile ? 8 : 10);
            const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
            return (
              <div key={i} style={{
                padding: "10px 12px", background: B_COLORS.panel2,
                border: `1px solid ${B_COLORS.rule}`, borderRadius: 3,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{
                    display: "flex", gap: 4,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13,
                  }}>
                    <span style={{
                      color: B_COLORS.accent, padding: "0 6px",
                      background: `${B_COLORS.accent}22`, borderRadius: 2,
                    }}>{s.bonus}</span>
                    <span style={{ color: B_COLORS.amber, padding: "0 6px" }}>{fmt(map2)}</span>
                    <span style={{ color: B_COLORS.textMute, padding: "0 6px" }}>{fmt(map3)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, color: B_COLORS.textMute, width: 44, textAlign: "center",
                  }}>1ST</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, color: B_COLORS.textMute, width: 44, textAlign: "center",
                  }}>{isAgile ? "MAP −4" : "MAP −5"}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700,
                    letterSpacing: 1, color: B_COLORS.textMute, width: 44, textAlign: "center",
                  }}>{isAgile ? "MAP −8" : "MAP −10"}</span>
                </div>
                <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: B_COLORS.textSoft }}>
                  {s.dmg}
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: B_COLORS.textMute, fontStyle: "italic" }}>
                  {s.traits}
                </div>
              </div>
            );
          })}
        </div>
      </Sec>

      {c.spellSlots && (
        <Sec>
          <Label>Spell Slots</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {Object.entries(c.spellSlots).sort((a, b) => b[0] - a[0]).map(([rank, info]) => (
              <div key={rank} style={{ display: "grid", gridTemplateColumns: "60px 80px 1fr", gap: 12, alignItems: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: B_COLORS.violet }}>
                  RANK {rank}
                </div>
                <PipsB used={info.used} max={info.max} color={B_COLORS.violet} />
                <div style={{ fontSize: 11, color: B_COLORS.textSoft }}>{info.prepared.join(" · ")}</div>
              </div>
            ))}
          </div>
        </Sec>
      )}

      <Sec>
        <Label>Conditions</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {c.conditions.length === 0 && c.persistent.length === 0 && (
            <div style={{ color: B_COLORS.textMute, fontStyle: "italic" }}>None</div>
          )}
          {c.conditions.map((cond, i) => {
            const ref = window.PF2E_DATA.CONDITIONS_REF[cond.name];
            return (
              <div key={i} style={{
                padding: "8px 10px", background: B_COLORS.panel2,
                border: `1px solid ${B_COLORS.rule}`, borderRadius: 3,
                display: "grid", gridTemplateColumns: "1fr auto", gap: 10,
              }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ConditionTagB name={cond.name} value={cond.value} />
                    <span style={{ fontSize: 10, color: B_COLORS.textMute, fontStyle: "italic" }}>
                      {cond.duration}
                    </span>
                  </div>
                  {ref && <div style={{ marginTop: 6, fontSize: 11, color: B_COLORS.textSoft, lineHeight: 1.5 }}>{ref.text}</div>}
                </div>
                <button style={{
                  width: 22, height: 22, border: `1px solid ${B_COLORS.rule}`, background: "transparent",
                  color: B_COLORS.textMute, cursor: "pointer", fontSize: 12, borderRadius: 2,
                }}>×</button>
              </div>
            );
          })}
        </div>
        <button style={{
          marginTop: 10, padding: "6px 10px", border: `1px dashed ${B_COLORS.ruleHi}`,
          background: "transparent", color: B_COLORS.textSoft, fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
          borderRadius: 2,
        }}>+ ADD CONDITION</button>
      </Sec>
    </div>
  );
}

function StatB({ label, value, small }) {
  return (
    <div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
        letterSpacing: 1.2, color: B_COLORS.textMute,
      }}>{label}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: small ? 18 : 22, fontWeight: 700, color: B_COLORS.text, marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

window.CombatantCardB = CombatantCardB;
window.StatBlockB = StatBlockB;
