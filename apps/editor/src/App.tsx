import {
  useEffect,
  useMemo,
  useState
} from "react";

import "./App.css";
import "./persistence.css";

import {
  paletteGroups,
  type PaletteItem
} from "./domain/palette";

import {
  createEditorDocument,
  createFormulaNode,
  type EditorDocument
} from "./model/document";

import {
  loadEditorDocument,
  saveEditorDocument
} from "./model/storage";

function App() {
  const [document, setDocument] = useState<EditorDocument>(
    () => loadEditorDocument() ?? createEditorDocument()
  );

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);

  useEffect(() => {
    saveEditorDocument(document);
  }, [document]);

  const selectedNode = useMemo(
    () =>
      document.nodes.find(
        (node) => node.id === selectedNodeId
      ) ?? null,
    [document.nodes, selectedNodeId]
  );

  const paletteObjectCount = paletteGroups.reduce(
    (total, group) => total + group.items.length,
    0
  );

  const handleCreateNode = (item: PaletteItem) => {
    const node = createFormulaNode(
      item,
      document.nodes.length
    );

    setDocument((currentDocument) => ({
      ...currentDocument,
      nodes: [...currentDocument.nodes, node],
      updatedAt: new Date().toISOString()
    }));

    setSelectedNodeId(node.id);
  };

  const handleSave = () => {
    saveEditorDocument(document);
  };

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
          <span className="status-pill status-safe">
            Simulation only
          </span>

          <span className="status-pill">
            {document.nodes.length === 0
              ? document.title
              : `${document.nodes.length} semantic ${
                  document.nodes.length === 1
                    ? "object"
                    : "objects"
                }`}
          </span>

          <span className="status-pill status-persisted">
            Persisted locally
          </span>
        </div>

        <div className="topbar-actions">
          <button type="button" onClick={handleSave}>
            Save
          </button>

          <button
            type="button"
            className="primary-action"
            disabled
          >
            Compile
          </button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="panel palette-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Semantic objects
              </span>
              <h2>Palette</h2>
            </div>

            <span className="panel-count">
              {paletteObjectCount}
            </span>
          </div>

          <p className="panel-description">
            Click an object to create a typed and
            persistent formula node.
          </p>

          <div className="palette-groups">
            {paletteGroups.map((group) => (
              <section
                className="palette-group"
                key={group.id}
              >
                <h3>{group.label}</h3>

                <div className="palette-items">
                  {group.items.map((item) => (
                    <button
                      className={
                        `palette-item palette-${group.id}`
                      }
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleCreateNode(item)
                      }
                    >
                      <span
                        className="palette-dot"
                        aria-hidden="true"
                      />
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
              <button
                type="button"
                className="tool-button active"
                disabled
              >
                Select
              </button>

              <button
                type="button"
                className="tool-button"
                disabled
              >
                Connect
              </button>

              <button
                type="button"
                className="tool-button"
                disabled
              >
                Pan
              </button>
            </div>

            <div className="surface-readout">
              <span>
                X {selectedNode?.x ?? 0}
              </span>
              <span>
                Y {selectedNode?.y ?? 0}
              </span>
              <span>
                {Math.round(
                  document.viewport.zoom * 100
                )}
                %
              </span>
            </div>
          </div>

          <div className="canvas-stage">
            <svg
              className="formula-canvas"
              viewBox="0 0 1200 760"
              role="img"
              aria-labelledby={
                "surface-title surface-description"
              }
              onClick={() => setSelectedNodeId(null)}
            >
              <title id="surface-title">
                Persistent compositional formula surface
              </title>

              <desc id="surface-description">
                Typed semantic objects are rendered as
                persistent SVG nodes.
              </desc>

              <defs>
                <pattern
                  id="dot-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="1"
                    cy="1"
                    r="1"
                    className="grid-dot"
                  />
                </pattern>
              </defs>

              <rect
                width="1200"
                height="760"
                className="canvas-background"
              />

              <rect
                width="1200"
                height="760"
                fill="url(#dot-grid)"
              />

              {document.nodes.map((node) => {
                const isSelected =
                  node.id === selectedNodeId;

                return (
                  <g
                    key={node.id}
                    className={
                      `formula-node node-${node.domain}` +
                      (isSelected
                        ? " formula-node-selected"
                        : "")
                    }
                    transform={
                      `translate(${node.x} ${node.y})`
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={
                      `${node.domain} ${node.label} node`
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        setSelectedNodeId(node.id);
                      }
                    }}
                  >
                    <rect
                      width={node.width}
                      height={node.height}
                      rx="16"
                      className="formula-node-body"
                    />

                    <rect
                      width={node.width}
                      height="28"
                      rx="16"
                      className="formula-node-header"
                    />

                    <rect
                      y="14"
                      width={node.width}
                      height="14"
                      className="formula-node-header-fill"
                    />

                    <circle
                      cx="17"
                      cy="14"
                      r="4"
                      className="formula-node-domain-dot"
                    />

                    <text
                      x="29"
                      y="18"
                      className="formula-node-domain"
                    >
                      {node.domain.toUpperCase()}
                    </text>

                    <text
                      x="16"
                      y="53"
                      className="formula-node-label"
                    >
                      {node.label}
                    </text>

                    <text
                      x="16"
                      y="72"
                      className="formula-node-kind"
                    >
                      {node.kind}
                    </text>
                  </g>
                );
              })}

              {document.nodes.length === 0 && (
                <g
                  transform="translate(600 335)"
                  className="empty-state"
                >
                  <rect
                    x="-190"
                    y="-84"
                    width="380"
                    height="168"
                    rx="24"
                    className="empty-state-boundary"
                  />

                  <circle
                    cx="0"
                    cy="-24"
                    r="20"
                    className="empty-state-icon"
                  />

                  <path
                    d="M -7 -24 H 7 M 0 -31 V -17"
                    className="empty-state-plus"
                  />

                  <text
                    x="0"
                    y="24"
                    className="empty-state-title"
                  >
                    Formula surface ready
                  </text>

                  <text
                    x="0"
                    y="50"
                    className="empty-state-copy"
                  >
                    Choose a typed object from the palette.
                  </text>
                </g>
              )}

              <g
                transform="translate(40 700)"
                className="boundary-note"
              >
                <rect
                  width="360"
                  height="34"
                  rx="10"
                />

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
              <span className="eyebrow">
                Current selection
              </span>
              <h2>Inspector</h2>
            </div>
          </div>

          {selectedNode === null ? (
            <div className="empty-panel-state">
              <div className="empty-panel-symbol">
                ◇
              </div>

              <strong>No object selected</strong>

              <span>
                Select a semantic object to inspect its
                stable identity and geometry.
              </span>
            </div>
          ) : (
            <section className="node-inspector">
              <div
                className={
                  `inspector-domain inspector-${selectedNode.domain}`
                }
              >
                {selectedNode.domain}
              </div>

              <h3>{selectedNode.label}</h3>

              <dl className="inspector-facts">
                <div>
                  <dt>Stable ID</dt>
                  <dd className="mono-value">
                    {selectedNode.id}
                  </dd>
                </div>

                <div>
                  <dt>Kind</dt>
                  <dd>{selectedNode.kind}</dd>
                </div>

                <div>
                  <dt>Position</dt>
                  <dd>
                    {selectedNode.x}, {selectedNode.y}
                  </dd>
                </div>

                <div>
                  <dt>Size</dt>
                  <dd>
                    {selectedNode.width} ×{" "}
                    {selectedNode.height}
                  </dd>
                </div>

                <div>
                  <dt>Created</dt>
                  <dd>
                    {new Date(
                      selectedNode.createdAt
                    ).toLocaleTimeString()}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="compiler-card">
            <div className="compiler-card-heading">
              <span className="eyebrow">
                Formula compiler
              </span>

              <span className="compiler-state">
                Idle
              </span>
            </div>

            <dl className="compiler-facts">
              <div>
                <dt>Document</dt>
                <dd>
                  {document.nodes.length === 0
                    ? "Empty"
                    : `${document.nodes.length} nodes`}
                </dd>
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
                <span className="eyebrow">
                  Nondestructive record
                </span>
                <h2>History</h2>
              </div>

              <span className="panel-count">0</span>
            </div>

            <div className="dock-empty">
              Persistent identity exists. Operation history
              begins in Slice 4.
            </div>
          </article>

          <article className="dock-panel">
            <div className="dock-heading">
              <div>
                <span className="eyebrow">
                  Operational evidence
                </span>
                <h2>Audit</h2>
              </div>

              <span className="panel-count">0</span>
            </div>

            <div className="dock-empty">
              The document is saved locally. Audit receipts
              begin after typed operations exist.
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
