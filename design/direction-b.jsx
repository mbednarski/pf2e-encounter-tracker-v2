// Direction B — Library, Combat Log, Main shell

function BestiaryB() {
  const { BESTIARY, PARTY } = window.PF2E_DATA;
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: B_COLORS.text, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "16px 16px 12px", borderBottom: `1px solid ${B_COLORS.rule}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>Library</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: 1, color: B_COLORS.textMute, cursor: "pointer",
        }}>« HIDE</div>
      </div>

      <div style={{
        padding: "10px 16px 6px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
        letterSpacing: 1.4, color: B_COLORS.textMute,
      }}>PARTY</div>
      <div style={{ padding: "0 8px" }}>
        {PARTY.map((p, i) => (
          <div key={i} style={{
            padding: "8px 8px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderRadius: 3,
            borderBottom: i < PARTY.length - 1 ? `1px solid ${B_COLORS.rule}` : "none",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: B_COLORS.textMute, fontFamily: "'JetBrains Mono', monospace" }}>{p.pcClass}</div>
            </div>
            <button style={ADD_BTN_B}>+</button>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${B_COLORS.rule}`, marginTop: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: B_COLORS.panel2, border: `1px solid ${B_COLORS.rule}`, borderRadius: 3,
          padding: "6px 10px",
        }}>
          <span style={{ color: B_COLORS.textMute, fontSize: 12 }}>⌕</span>
          <input placeholder="Search bestiary…" style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: "Inter, sans-serif", fontSize: 13, color: B_COLORS.text,
          }} />
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { t: "LVL 1-3", active: false }, { t: "LVL 4-6", active: true },
            { t: "BOSS", active: false }, { t: "HUMANOID", active: false },
          ].map((f, i) => (
            <span key={i} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
              letterSpacing: 0.6, color: f.active ? B_COLORS.bg : B_COLORS.textSoft,
              background: f.active ? B_COLORS.accent : "transparent",
              border: `1px solid ${f.active ? B_COLORS.accent : B_COLORS.ruleHi}`,
              padding: "2px 6px", borderRadius: 2, cursor: "pointer",
            }}>{f.t}</span>
          ))}
        </div>
      </div>

      <div style={{ overflow: "auto", flex: 1, padding: "0 8px 12px" }}>
        {BESTIARY.map((cr, i) => (
          <div key={i} style={{
            padding: "8px 8px", display: "grid",
            gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "center",
            borderBottom: i < BESTIARY.length - 1 ? `1px solid ${B_COLORS.rule}` : "none",
            cursor: "grab",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700,
              textAlign: "center", color: B_COLORS.text,
              border: `1px solid ${B_COLORS.ruleHi}`, padding: "2px 0", borderRadius: 2,
            }}>{cr.lvl}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cr.name}</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
                letterSpacing: 0.6, color: B_COLORS.textMute,
              }}>{cr.traits.join(" · ").toUpperCase()}</div>
            </div>
            <button style={ADD_BTN_B}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const ADD_BTN_B = {
  width: 24, height: 24, border: `1px solid ${B_COLORS.accent}`,
  background: "transparent", color: B_COLORS.accent, fontSize: 14, fontWeight: 600,
  cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", borderRadius: 2,
};

function CombatLogB() {
  const log = window.PF2E_DATA.COMBAT_LOG;
  let lastRound = null;
  const colors = {
    hit: B_COLORS.text, crit: B_COLORS.red, miss: B_COLORS.textMute,
    spell: B_COLORS.violet, condition: B_COLORS.amber, action: B_COLORS.green,
    system: B_COLORS.textMute,
  };
  return (
    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12 }}>
      {log.map((entry, i) => {
        const showRound = entry.round !== lastRound;
        lastRound = entry.round;
        return (
          <React.Fragment key={i}>
            {showRound && (
              <div style={{
                padding: "12px 18px 6px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
                letterSpacing: 1.6, color: B_COLORS.textMute,
                borderTop: i > 0 ? `1px solid ${B_COLORS.rule}` : "none",
              }}>── ROUND {entry.round} ──</div>
            )}
            <div style={{
              padding: "5px 18px",
              display: "grid", gridTemplateColumns: "120px 1fr",
              gap: 10, alignItems: "baseline",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
                color: B_COLORS.textSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: 0.4,
              }}>{entry.actor.toUpperCase()}</div>
              <div style={{ color: colors[entry.kind] || B_COLORS.text, lineHeight: 1.5 }}>
                {entry.kind === "crit" && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                    letterSpacing: 1.2, background: B_COLORS.red, color: B_COLORS.bg,
                    padding: "1px 5px", borderRadius: 1, marginRight: 6,
                  }}>CRIT</span>
                )}
                {entry.text}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DirectionB() {
  const combatants = window.PF2E_DATA.COMBATANTS;
  const [activeId, setActiveId] = React.useState("kael");
  const [logOpen, setLogOpen] = React.useState(true);
  const active = combatants.find(c => c.id === activeId);

  return (
    <div style={{
      width: 1440, height: 1000, background: B_COLORS.bg,
      color: B_COLORS.text, fontFamily: "Inter, sans-serif",
      display: "grid",
      gridTemplateColumns: "280px 1fr 460px",
      gridTemplateRows: `1fr ${logOpen ? "240px" : "36px"}`,
      gridTemplateAreas: `
        "lib track details"
        "log log    log"
      `,
    }}>
      {/* Library */}
      <aside style={{
        gridArea: "lib",
        background: B_COLORS.panel, borderRight: `1px solid ${B_COLORS.rule}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <BestiaryB />
      </aside>

      {/* Tracker */}
      <main style={{
        gridArea: "track",
        overflow: "hidden", display: "flex", flexDirection: "column", background: B_COLORS.bg,
      }}>
        <header style={{
          padding: "16px 20px", borderBottom: `1px solid ${B_COLORS.rule}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: B_COLORS.panel,
        }}>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
              letterSpacing: 1.6, color: B_COLORS.textMute,
            }}>ENCOUNTER</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>The Crypt of Vorn</div>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                letterSpacing: 1.6, color: B_COLORS.textMute,
              }}>ROUND</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700,
                color: B_COLORS.accent, lineHeight: 1, marginTop: 2,
              }}>03</div>
            </div>
            <button style={{
              border: `1px solid ${B_COLORS.accent}`, background: B_COLORS.accent, color: B_COLORS.bg,
              padding: "8px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: 1.2, cursor: "pointer", borderRadius: 2,
            }}>NEXT TURN ▸</button>
          </div>
        </header>

        <div style={{
          padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: B_COLORS.panel2, borderBottom: `1px solid ${B_COLORS.rule}`,
          fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: 1.2, color: B_COLORS.accent,
            }}>● ON DECK</span>
            <span style={{ fontWeight: 600 }}>Kael Ironhand</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: B_COLORS.textMute, letterSpacing: 1 }}>ACTIONS</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, border: `1px solid ${B_COLORS.accent}`,
                    background: B_COLORS.accent, transform: "rotate(45deg)",
                  }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: B_COLORS.textMute, letterSpacing: 1 }}>RXN</span>
              <div style={{
                width: 14, height: 14, borderRadius: 7, border: `1px solid ${B_COLORS.accent}`,
                background: B_COLORS.accent,
              }} />
            </div>
          </div>
        </div>

        <div style={{ overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {combatants.map(c => (
            <CombatantCardB key={c.id} c={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
          ))}
        </div>
      </main>

      {/* Details (right) */}
      <aside style={{
        gridArea: "details",
        background: B_COLORS.panel, borderLeft: `1px solid ${B_COLORS.rule}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${B_COLORS.rule}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
            letterSpacing: 1.4, color: B_COLORS.text,
          }}>COMBATANT DETAILS</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
            letterSpacing: 1.2, color: B_COLORS.textMute,
          }}>{combatants.findIndex(x => x.id === activeId) + 1} / {combatants.length}</div>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <StatBlockB c={active} />
        </div>
      </aside>

      {/* Combat log — bottom hideable */}
      <section style={{
        gridArea: "log",
        background: B_COLORS.panel,
        borderTop: `1px solid ${B_COLORS.ruleHi}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <button onClick={() => setLogOpen(o => !o)} style={{
          padding: "0 18px", height: 36,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: B_COLORS.panel2, border: "none",
          borderBottom: logOpen ? `1px solid ${B_COLORS.rule}` : "none",
          cursor: "pointer", color: B_COLORS.text, textAlign: "left", width: "100%",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: 1.4, color: B_COLORS.text,
            }}>{logOpen ? "▼" : "▲"} COMBAT LOG</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              color: B_COLORS.textMute, letterSpacing: 0.6,
            }}>{window.PF2E_DATA.COMBAT_LOG.length} entries · Round 3</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: 1, color: B_COLORS.textSoft,
            }}>FILTER: ALL</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: 1, color: B_COLORS.textMute,
            }}>EXPORT ↗</span>
          </div>
        </button>
        {logOpen && (
          <div style={{ overflow: "auto", flex: 1 }}>
            <CombatLogB />
          </div>
        )}
      </section>
    </div>
  );
}

window.DirectionB = DirectionB;
