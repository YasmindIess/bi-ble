import "./App.css";
import { paletteGroups } from "./domain/palette";

function App() {
  const objectCount = paletteGroups.reduce(
    (total, group) => total + group.items.length,
    0
  );

  return (
    <div className="editor-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            β
          </div>

          <div>
            <strong>Bi-BLE Formula Surface</strong>
            <span>Vectorized compositional editor</span>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-pill status-safe">Simulation only</span>
          <span className="status-pill">Untitled formula</span>
        </div>

        <div className="topbar-actions">
          <button type="button" disabled>
            Save
          </button>

          <button type="button" className="primary-action" disabled>
            Compile
          </button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="panel palette-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Semantic objects</span>
              <h2>Palette</h2>
            </div>

            <span className="panel-count">{objectCount}</span>
          </div>

          <p className="panel-description">
            Objects will become typed formula nodes, not decorative SVG shapes.
          </p>

          <div className="palette-groups">
            {paletteGroups.map((group) => (
              <section className="palette-group" key={group.id}>
                <h3>{group.label}</h3>

                <div className="palette-items">
                  {group.items.map((item) => (
                    <button
                      className={`palette-item palette-${group.id}`}
                      key={item.id}
                      type="button"
                      disabled
                    >
                      <span className="palette-dot" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className="surface-column">
          <div className="surface-toolbar">
            <div className="tool-cluster">
              <button type="button" className="tool-button active" disabled>
                Select
              </button>

              <button type="button" className="tool-button" disabled>
                Connect
              </button>

              <button type="button" className="tool-button" disabled>
                Pan
              </button>
            </div>

            <div className="surface-readout">
              <span>X 0</span>
              <span>Y 0</span>
              <span>100%</span>
            </div>
          </div>

          <div className="canvas-stage">
            <svg
              className="formula-canvas"
              viewBox="0 0 1200 760"
              role="img"
              aria-labelledby="surface-title surface-description"
            >
              <title id="surface-title">
                Empty compositional formula surface
              </title>

              <desc id="surface-description">
                The SVG editing surface is ready, but no semantic formula
                objects have been created.
              </desc>

              <defs>
                <pattern
                  id="dot-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" className="grid-dot" />
                </pattern>
              </defs>

              <rect width="1200" height="760" className="canvas-background" />
              <rect width="1200" height="760" fill="url(#dot-grid)" />

              <g transform="translate(600 335)" className="empty-state">
                <rect
                  x="-190"
                  y="-84"
                  width="380"
                  height="168"
                  rx="24"
                  className="empty-state-boundary"
                />

                <circle cx="0" cy="-24" r="20" className="empty-state-icon" />

                <path
                  d="M -7 -24 H 7 M 0 -31 V -17"
                  className="empty-state-plus"
                />

                <text x="0" y="24" className="empty-state-title">
                  Formula surface ready
                </text>

                <text x="0" y="50" className="empty-state-copy">
                  Typed compositional objects will be authored here.
                </text>
              </g>

              <g transform="translate(40 700)" className="boundary-note">
                <rect width="360" height="34" rx="10" />
                <text x="16" y="22">
                  external_execution_authorized = false
                </text>
              </g>
            </svg>
          </div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Current selection</span>
              <h2>Inspector</h2>
            </div>
          </div>

          <div className="empty-panel-state">
            <div className="empty-panel-symbol">◇</div>
            <strong>No object selected</strong>
            <span>Geometry and semantic properties will appear here.</span>
          </div>

          <section className="compiler-card">
            <div className="compiler-card-heading">
              <span className="eyebrow">Formula compiler</span>
              <span className="compiler-state">Idle</span>
            </div>

            <dl className="compiler-facts">
              <div>
                <dt>Document</dt>
                <dd>Empty</dd>
              </div>

              <div>
                <dt>Formula IR</dt>
                <dd>Not generated</dd>
              </div>

              <div>
                <dt>Obstructions</dt>
                <dd>0</dd>
              </div>

              <div>
                <dt>Authority</dt>
                <dd>Simulation only</dd>
              </div>
            </dl>
          </section>
        </aside>

        <section className="bottom-dock">
          <article className="dock-panel">
            <div className="dock-heading">
              <div>
                <span className="eyebrow">Nondestructive record</span>
                <h2>History</h2>
              </div>

              <span className="panel-count">0</span>
            </div>

            <div className="dock-empty">
              The first committed operation will create the history root.
            </div>
          </article>

          <article className="dock-panel">
            <div className="dock-heading">
              <div>
                <span className="eyebrow">Operational evidence</span>
                <h2>Audit</h2>
              </div>

              <span className="panel-count">0</span>
            </div>

            <div className="dock-empty">
              Interaction and compilation receipts will appear here.
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
