// Condition picker / editor UX mockup — three states side by side
// Uses Direction A (parchment) palette so it slots in cleanly.

function ConditionPicker({ mode = "add", anchor = "Frightened" }) {
  const A = {
    bg: "#FBF7EC", panel: "#F5EFE2", panel2: "#F1E9D5",
    ink: "#1F1A14", inkSoft: "#5C5345", inkMute: "#8C8270",
    rule: "#D9CFB6", ruleStrong: "#B5A887",
    red: "#9B2D20", green: "#3F6B3A", amber: "#A57A1F", blue: "#2F5773",
  };

  const COMMON = [
    "Off-Guard", "Frightened", "Sickened", "Stunned", "Slowed",
    "Prone", "Wounded", "Dying", "Concentrating", "Quickened",
    "Clumsy", "Enfeebled", "Drained", "Stupefied",
  ];
  const RECENT = ["Off-Guard", "Frightened", "Stunned"];

  const Label = ({ children, color = A.inkMute }) => (
    <div style={{
      fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
      letterSpacing: 1.4, textTransform: "uppercase", color,
    }}>{children}</div>
  );

  return (
    <div style={{
      width: 340, background: A.bg, border: `1px solid ${A.ink}`,
      boxShadow: "4px 6px 0 rgba(31,26,20,0.18), 0 0 0 1px rgba(31,26,20,0.06)",
      fontFamily: "Inter, sans-serif", color: A.ink,
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", background: A.panel2,
        borderBottom: `1px solid ${A.rule}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <Label>{mode === "add" ? "Add condition to" : "Editing"}</Label>
          <div style={{
            fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, fontWeight: 600,
            marginTop: 1,
          }}>
            {mode === "add" ? "Cult Brute" : `${anchor} on Cult Brute`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
            color: A.inkMute, border: `1px solid ${A.rule}`, padding: "1px 5px",
          }}>ESC</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
            color: A.inkMute, border: `1px solid ${A.rule}`, padding: "1px 5px",
          }}>↵</span>
        </div>
      </div>

      {mode === "add" && (
        <>
          {/* Search */}
          <div style={{ padding: "12px 14px 8px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              border: `1px solid ${A.ink}`, padding: "7px 10px", background: A.bg,
            }}>
              <span style={{ color: A.inkMute, fontSize: 13 }}>⌕</span>
              <span style={{ fontSize: 13, color: A.ink, fontWeight: 500 }}>fri</span>
              <span style={{ width: 2, height: 14, background: A.ink, animation: "blink 1s infinite" }} />
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: A.inkMute }}>1 match</span>
            </div>
          </div>

          {/* Recent row */}
          <div style={{ padding: "0 14px 8px" }}>
            <Label>Recent</Label>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {RECENT.map(name => (
                <span key={name} style={{
                  fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
                  color: A.ink, border: `1px solid ${A.rule}`, padding: "3px 8px",
                  background: A.panel,
                }}>{name}</span>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${A.rule}` }}>
            <Label>Common</Label>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 6,
            }}>
              {COMMON.map((name, i) => {
                const matched = name === "Frightened";
                const applied = name === "Stunned"; // already on this combatant
                return (
                  <div key={name} style={{
                    padding: "6px 9px", display: "flex", justifyContent: "space-between",
                    alignItems: "center", fontSize: 12,
                    background: matched ? A.ink : (applied ? A.panel2 : "transparent"),
                    color: matched ? A.bg : (applied ? A.inkMute : A.ink),
                    border: `1px solid ${matched ? A.ink : A.rule}`,
                    fontWeight: matched ? 600 : 500,
                  }}>
                    <span>{name}</span>
                    {applied && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6 }}>✓ APPLIED</span>}
                    {matched && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6 }}>↵ APPLY</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hint footer */}
          <div style={{
            padding: "8px 14px", borderTop: `1px solid ${A.rule}`,
            background: A.panel, fontSize: 10, color: A.inkMute,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>↑↓ navigate · ↵ apply · drag → other combatant</span>
            <span style={{ color: A.blue, fontWeight: 600 }}>+ Custom…</span>
          </div>
        </>
      )}

      {mode === "edit" && (
        <>
          {/* Value stepper */}
          <div style={{ padding: "14px 14px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label>Value</Label>
              <span style={{ fontSize: 10, color: A.inkSoft, fontStyle: "italic" }}>
                Decrement to 0 = remove
              </span>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "32px 1fr 32px", gap: 8,
              alignItems: "center", marginTop: 8,
            }}>
              <button style={{
                height: 36, border: `1px solid ${A.ink}`, background: A.bg,
                fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 600,
                cursor: "pointer", color: A.ink,
              }}>−</button>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {[1, 2, 3, 4].map(v => (
                  <div key={v} style={{
                    height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                    background: v === 2 ? A.ink : "transparent",
                    color: v === 2 ? A.bg : A.ink,
                    border: `1px solid ${v === 2 ? A.ink : A.rule}`,
                    fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 600,
                  }}>{v}</div>
                ))}
              </div>
              <button style={{
                height: 36, border: `1px solid ${A.ink}`, background: A.bg,
                fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 600,
                cursor: "pointer", color: A.ink,
              }}>+</button>
            </div>
            <div style={{
              marginTop: 8, padding: "6px 10px", background: A.panel,
              border: `1px dashed ${A.rule}`,
              fontSize: 11, color: A.inkSoft, lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: A.amber }}>Frightened 2:</span> −2 status to all checks and DCs. Decreases by 1 at end of turn.
            </div>
          </div>

          {/* Duration */}
          <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${A.rule}`, paddingTop: 12 }}>
            <Label>Duration</Label>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {[
                { t: "End of turn", active: true },
                { t: "1 round", active: false },
                { t: "10 min", active: false },
                { t: "Until removed", active: false },
                { t: "Sustained", active: false },
              ].map((d, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "3px 8px", border: `1px solid ${d.active ? A.ink : A.rule}`,
                  background: d.active ? A.ink : "transparent",
                  color: d.active ? A.bg : A.ink,
                }}>{d.t}</span>
              ))}
            </div>
            <div style={{
              marginTop: 8, fontSize: 11, color: A.inkSoft,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>Source: <span style={{ color: A.blue, fontWeight: 600 }}>Goblin Pyro's Demoralize</span> · DC 19 Will</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: A.inkMute }}>↗ jump</span>
            </div>
          </div>

          {/* History */}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${A.rule}`, background: A.panel }}>
            <Label>History</Label>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: A.inkSoft, lineHeight: 1.7 }}>
              <div>R2 t1 · <span style={{ color: A.amber }}>↑ applied at 3</span> by Goblin Pyro</div>
              <div>R2 t3 · <span style={{ color: A.green }}>↓ ticked to 2</span> auto end-of-turn</div>
              <div>R3 t2 · <span style={{ color: A.ink, fontWeight: 700 }}>● editing now</span></div>
            </div>
          </div>

          {/* Footer actions */}
          <div style={{
            padding: "10px 14px", borderTop: `1px solid ${A.rule}`,
            display: "flex", justifyContent: "space-between", gap: 8, background: A.panel2,
          }}>
            <button style={{
              padding: "6px 12px", border: `1px solid ${A.red}`, background: "transparent",
              color: A.red, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer",
            }}>End now</button>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{
                padding: "6px 12px", border: `1px solid ${A.rule}`, background: "transparent",
                color: A.inkSoft, fontSize: 11, fontWeight: 600, letterSpacing: 1,
                textTransform: "uppercase", cursor: "pointer",
              }}>Cancel</button>
              <button style={{
                padding: "6px 14px", border: `1px solid ${A.ink}`, background: A.ink,
                color: A.bg, fontSize: 11, fontWeight: 700, letterSpacing: 1,
                textTransform: "uppercase", cursor: "pointer",
              }}>Save ↵</button>
            </div>
          </div>
        </>
      )}

      {mode === "menu" && (
        <div style={{ width: 240, padding: "4px 0" }}>
          {[
            { ic: "+", t: "Increase value", k: "↑" , primary: true },
            { ic: "−", t: "Decrease value", k: "↓" },
            { ic: "↻", t: "Refresh duration", k: "R" },
            { ic: "→", t: "Transfer to…", k: "T" },
            { divider: true },
            { ic: "✎", t: "Edit details…", k: "E" },
            { ic: "✕", t: "Remove condition", k: "Del", danger: true },
          ].map((item, i) => item.divider ? (
            <div key={i} style={{ height: 1, background: A.rule, margin: "4px 0" }} />
          ) : (
            <div key={i} style={{
              padding: "7px 14px", display: "grid",
              gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
              background: item.primary ? A.panel2 : "transparent",
              cursor: "pointer", color: item.danger ? A.red : A.ink,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
                textAlign: "center", color: item.danger ? A.red : (item.primary ? A.ink : A.inkSoft),
              }}>{item.ic}</span>
              <span style={{ fontSize: 13, fontWeight: item.primary ? 600 : 500 }}>{item.t}</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: A.inkMute,
                border: `1px solid ${A.rule}`, padding: "1px 5px",
              }}>{item.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionStatesMockup() {
  const A = { bg: "#F5EFE2", panel: "#FBF7EC", ink: "#1F1A14", inkMute: "#8C8270", rule: "#D9CFB6" };
  const Frame = ({ title, sub, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          letterSpacing: 1.4, textTransform: "uppercase", color: A.inkMute,
        }}>{title}</div>
        <div style={{
          fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 600,
          color: A.ink, marginTop: 2,
        }}>{sub}</div>
      </div>
      <div style={{
        background: A.bg, border: `1px solid ${A.rule}`, padding: 36,
        flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center",
      }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{
      width: 1440, height: 720, background: A.panel, padding: 32,
      fontFamily: "Inter, sans-serif", color: A.ink,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24,
    }}>
      <Frame title="State 1" sub="Add — search + grid">
        <ConditionPicker mode="add" />
      </Frame>
      <Frame title="State 2" sub="Edit — stepper + history">
        <ConditionPicker mode="edit" anchor="Frightened" />
      </Frame>
      <Frame title="State 3" sub="Right-click — quick menu">
        <ConditionPicker mode="menu" />
      </Frame>
    </div>
  );
}

window.ConditionStatesMockup = ConditionStatesMockup;
