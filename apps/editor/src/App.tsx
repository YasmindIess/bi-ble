import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import "./App.css";
import "./persistence.css";
import "./connections.css";
import "./history.css";
import "./interaction.css";
import "./audit.css";
import "./compiler.css";
import "./workspace.css";
import "./properties.css";
import "./evidence.css";
import "./layout-responsibility.css";

import {
  FormulaCanvas,
  type EditorTool
} from "./components/FormulaCanvas";

import {
  HistoryPanel
} from "./components/HistoryPanel";

import {
  AuditPanel
} from "./components/AuditPanel";

import {
  CompilerPanel
} from "./components/CompilerPanel";

import {
  NodePropertyEditor
} from "./components/NodePropertyEditor";

import {
  CommitEvidencePanel
} from "./components/CommitEvidencePanel";

import {
  paletteGroups,
  type PaletteItem
} from "./domain/palette";

import type {
  FormulaProperties
} from "./domain/properties";

import {
  createEditorDocument,
  createFormulaEdge,
  createFormulaNode,
  type FormulaEndpoint,
  type FormulaNode,
  type FormulaPort
} from "./model/document";

import {
  validateConnection
} from "./model/connections";

import {
  loadEditorSession,
  saveEditorSession
} from "./model/storage";

import {
  canRedo,
  canUndo,
  commitEditorOperation,
  createHistoryState,
  redoEditorSession,
  undoEditorSession,
  type EditorSession
} from "./model/history";

import type {
  EditorOperation
} from "./model/operations";

import {
  createAuditState,
  type OperationAuditContext
} from "./model/audit";

import {
  compileFormula,
  type CompilationResult
} from "./model/compiler";

import type {
  PublicCommitEvidence
} from "./integrations/github";

interface ConnectionFeedback {
  kind: "ready" | "admitted" | "blocked";
  message: string;
}

function App() {
  const [session, setSession] = useState<EditorSession>(
    () =>
      loadEditorSession() ?? {
        document: createEditorDocument(),
        history: createHistoryState(),
        audit: createAuditState()
      }
  );

  const {
    document,
    history,
    audit
  } = session;

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);

  const [tool, setTool] =
    useState<EditorTool>("select");

  const [pendingSource, setPendingSource] =
    useState<FormulaEndpoint | null>(null);

  const [connectionFeedback, setConnectionFeedback] =
    useState<ConnectionFeedback | null>(null);

  const [compilation, setCompilation] =
    useState<CompilationResult | null>(null);

  const [isCompiling, setIsCompiling] =
    useState(false);

  useEffect(() => {
    saveEditorSession(session);
  }, [session]);

  useEffect(() => {
    setCompilation(null);
  }, [document.updatedAt]);

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

  const commitOperation = useCallback(
    async (
      operation: EditorOperation,
      label: string,
      auditContext?: OperationAuditContext
    ) => {
      const nextSession = await commitEditorOperation(
        session,
        operation,
        label,
        auditContext
      );

      setSession(nextSession);
    },
    [session]
  );

  const handleCreateNode = async (
    item: PaletteItem
  ) => {
    const node = createFormulaNode(
      item,
      document.nodes.length
    );

    await commitOperation(
      {
        type: "node.add",
        node,
        index: document.nodes.length
      },
      `Create ${item.domain} ${item.label}`
    );

    setSelectedNodeId(node.id);
  };

  const handleNodeMoveCommit = async (
    node: FormulaNode,
    result: {
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
      pointerDistance: number;
      durationMs: number;
      fromX: number;
      fromY: number;
    }
  ) => {
    await commitOperation(
      {
        type: "node.move",
        nodeId: node.id,
        from: {
          x: result.fromX,
          y: result.fromY
        },
        to: {
          x: result.x,
          y: result.y
        }
      },
      `Move ${node.domain} ${node.label}`,
      {
        pointerGesture: {
          kind: "pointer_drag",
          durationMs: result.durationMs,
          pointerTravel: result.pointerDistance,
          finalDisplacement: Math.hypot(
            result.deltaX,
            result.deltaY
          ),
          deltaX: result.deltaX,
          deltaY: result.deltaY
        }
      }
    );

    setSelectedNodeId(node.id);

    setConnectionFeedback({
      kind: "admitted",
      message:
        `Moved ${node.label}: ` +
        `ΔX ${Math.round(result.deltaX)}, ` +
        `ΔY ${Math.round(result.deltaY)}.`
    });
  };

  const handleToolChange = (nextTool: EditorTool) => {
    setTool(nextTool);
    setPendingSource(null);

    setConnectionFeedback(
      nextTool === "connect"
        ? {
            kind: "ready",
            message:
              "Choose an output port, then a compatible input."
          }
        : null
    );
  };

  const handlePortClick = async (
    node: FormulaNode,
    port: FormulaPort
  ) => {
    setSelectedNodeId(node.id);

    if (tool !== "connect") {
      return;
    }

    const endpoint: FormulaEndpoint = {
      nodeId: node.id,
      portId: port.id
    };

    if (port.direction === "output") {
      setPendingSource(endpoint);

      setConnectionFeedback({
        kind: "ready",
        message:
          `${node.label}.${port.label} selected. ` +
          "Choose a compatible input."
      });

      return;
    }

    if (pendingSource === null) {
      setConnectionFeedback({
        kind: "blocked",
        message:
          "Choose an output port before choosing an input."
      });

      return;
    }

    const decision = validateConnection(
      document,
      pendingSource,
      endpoint
    );

    if (!decision.admitted) {
      setConnectionFeedback({
        kind: "blocked",
        message: decision.reason
      });

      return;
    }

    const edge = createFormulaEdge(
      pendingSource,
      endpoint,
      decision.dataType
    );

    await commitOperation(
      {
        type: "edge.add",
        edge,
        index: document.edges.length
      },
      `Connect ${decision.dataType}`
    );

    setPendingSource(null);

    setConnectionFeedback({
      kind: "admitted",
      message:
        `Persistent relationship admitted: ` +
        `${decision.dataType}.`
    });
  };

  const handleBackgroundClick = () => {
    setSelectedNodeId(null);

    if (tool === "connect") {
      setPendingSource(null);

      setConnectionFeedback({
        kind: "ready",
        message:
          "Connection selection cleared. Choose an output."
      });
    }
  };

  const handleNodePropertiesCommit = async (
    node: FormulaNode,
    properties: FormulaProperties
  ) => {
    await commitOperation(
      {
        type: "node.properties.update",
        nodeId: node.id,
        from: {
          ...(node.properties ?? {})
        },
        to: {
          ...properties
        }
      },
      `Update ${node.domain} ${node.label} properties`
    );

    setSelectedNodeId(node.id);

    setConnectionFeedback({
      kind: "admitted",
      message:
        `Updated semantic properties for ` +
        `${node.label}.`
    });
  };


  const handleMaterializeCommitEvidence = async (
    sourceNode: FormulaNode,
    evidenceNode: FormulaNode,
    evidence: PublicCommitEvidence
  ) => {
    const previousProperties = {
      ...(evidenceNode.properties ?? {})
    };

    const fileSummary = JSON.stringify(
      evidence.files.map((file) => ({
        path: file.path,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        previousPath: file.previousPath
      })),
      null,
      2
    );

    const nextProperties: FormulaProperties = {
      ...previousProperties,
      evidenceType: "diff",

      sourceRef:
        `github:${evidence.repository}` +
        `@${evidence.revision}`,

      verified: true,
      repository: evidence.repository,
      revision: evidence.revision,

      parentRevisions:
        evidence.parentRevisions.join("\n"),

      commitSummary: evidence.summary,
      author: evidence.author,
      committedAt: evidence.committedAt,
      commitUrl: evidence.htmlUrl,
      changedPathCount: evidence.fileCount,
      additions: evidence.stats.additions,
      deletions: evidence.stats.deletions,

      changedPaths:
        evidence.files
          .map((file) => file.path)
          .join("\n"),

      fileSummary,
      evidenceDigest: evidence.evidenceDigest,
      filesTruncated: evidence.filesTruncated,

      verificationScope:
        "public_github_api_commit_metadata"
    };

    await commitOperation(
      {
        type: "node.properties.update",
        nodeId: evidenceNode.id,
        from: previousProperties,
        to: nextProperties
      },

      `Materialize commit evidence ` +
        `${evidence.shortRevision}`,

      {
        commitEvidence: {
          sourceNodeId: sourceNode.id,
          evidenceNodeId: evidenceNode.id,
          repository: evidence.repository,
          revision: evidence.revision,
          evidenceDigest:
            evidence.evidenceDigest,

          parentRevisions:
            evidence.parentRevisions,

          changedPathCount:
            evidence.fileCount,

          additions:
            evidence.stats.additions,

          deletions:
            evidence.stats.deletions,

          filesTruncated:
            evidence.filesTruncated
        }
      }
    );

    setSelectedNodeId(evidenceNode.id);

    setConnectionFeedback({
      kind: "admitted",

      message:
        `Materialized ${evidence.fileCount} ` +
        `changed path${
          evidence.fileCount === 1 ? "" : "s"
        } as deterministic evidence.`
    });
  };

  const handleDeleteSelected = useCallback(
    async () => {
    if (selectedNode === null) {
      return;
    }

    const nodeIndex = document.nodes.findIndex(
      (node) => node.id === selectedNode.id
    );

    if (nodeIndex < 0) {
      return;
    }

    const connectedEdges = document.edges.flatMap(
      (edge, index) =>
        edge.source.nodeId === selectedNode.id ||
        edge.target.nodeId === selectedNode.id
          ? [
              {
                edge,
                index
              }
            ]
          : []
    );

    await commitOperation(
      {
        type: "node.remove",
        node: selectedNode,
        index: nodeIndex,
        connectedEdges
      },
      `Delete ${selectedNode.domain} ` +
        `${selectedNode.label}`
    );

    setSelectedNodeId(null);
    setPendingSource(null);

    setConnectionFeedback({
      kind: "admitted",

      message:
        `Deleted ${selectedNode.label}` +
        (
          connectedEdges.length === 0
            ? "."
            : ` and ${connectedEdges.length} connected ` +
              `relationship${
                connectedEdges.length === 1
                  ? ""
                  : "s"
              }.`
        )
    });
    },
    [
      selectedNode,
      document.nodes,
      document.edges,
      commitOperation
    ]
  );

  useEffect(() => {
    const handleDeleteKey = (
      event: KeyboardEvent
    ) => {
      if (
        event.key !== "Delete" &&
        event.key !== "Backspace"
      ) {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLElement) {
        const isTextEntry =
          target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT";

        if (isTextEntry) {
          return;
        }
      }

      event.preventDefault();
      void handleDeleteSelected();
    };

    window.addEventListener(
      "keydown",
      handleDeleteKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleDeleteKey
      );
    };
  }, [handleDeleteSelected]);

  const handleCompile = async () => {
    setIsCompiling(true);

    try {
      const result = await compileFormula(document);
      setCompilation(result);

      setConnectionFeedback({
        kind:
          result.decision === "admitted"
            ? "admitted"
            : "blocked",

        message:
          result.decision === "admitted"
            ? "Formula IR admitted structurally."
            : `Formula IR blocked by ` +
              `${result.obstructions.length} ` +
              `obstruction${
                result.obstructions.length === 1
                  ? ""
                  : "s"
              }.`
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const selectedConnectionCount =
    selectedNode === null
      ? 0
      : document.edges.filter(
          (edge) =>
            edge.source.nodeId === selectedNode.id ||
            edge.target.nodeId === selectedNode.id
        ).length;

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
            {document.nodes.length} nodes ·{" "}
            {document.edges.length} edges
          </span>

          <span className="status-pill status-persisted">
            Persisted locally
          </span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            disabled={!canUndo(history)}
            onClick={() => {
              setSession((current) =>
                undoEditorSession(current)
              );
              setSelectedNodeId(null);
            }}
          >
            Undo
          </button>

          <button
            type="button"
            disabled={!canRedo(history)}
            onClick={() => {
              setSession((current) =>
                redoEditorSession(current)
              );
              setSelectedNodeId(null);
            }}
          >
            Redo
          </button>

          <button
            type="button"
            onClick={() => saveEditorSession(session)}
          >
            Save
          </button>

          <button
            type="button"
            className="primary-action"
            disabled={
              document.nodes.length === 0 ||
              isCompiling
            }
            onClick={() => {
              void handleCompile();
            }}
          >
            {isCompiling ? "Compiling…" : "Compile"}
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
                      onClick={() => {
                        void handleCreateNode(item);
                      }}
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
                className={
                  `tool-button` +
                  (
                    tool === "select"
                      ? " active"
                      : ""
                  )
                }
                aria-pressed={tool === "select"}
                onClick={() => handleToolChange("select")}
              >
                Select
              </button>

              <button
                type="button"
                className={
                  `tool-button` +
                  (
                    tool === "connect"
                      ? " active"
                      : ""
                  )
                }
                aria-pressed={tool === "connect"}
                onClick={() => handleToolChange("connect")}
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

              <button
                type="button"
                className="tool-button danger-tool"
                disabled={selectedNode === null}
                title="Delete selected node"
                onClick={() => {
                  void handleDeleteSelected();
                }}
              >
                Delete
              </button>
            </div>

            <div className="surface-readout">
              <span>
                X {Math.round(selectedNode?.x ?? 0)}
              </span>
              <span>
                Y {Math.round(selectedNode?.y ?? 0)}
              </span>
              <span>
                {Math.round(
                  document.viewport.zoom * 100
                )}
                %
              </span>
            </div>
          </div>

          {connectionFeedback !== null && (
            <div
              className={
                `connection-feedback ` +
                `feedback-${connectionFeedback.kind}`
              }
              role="status"
            >
              {connectionFeedback.message}
            </div>
          )}

          <div className="canvas-stage">
            <FormulaCanvas
              document={document}
              selectedNodeId={selectedNodeId}
              tool={tool}
              pendingSource={pendingSource}
              onSelectNode={setSelectedNodeId}
              onBackgroundClick={handleBackgroundClick}
              onPortClick={handlePortClick}
              onNodeMoveCommit={handleNodeMoveCommit}
            />
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
                Select an object to inspect its identity,
                ports, and relationships.
              </span>
            </div>
          ) : (
            <section className="node-inspector">
              <div
                className={
                  `inspector-domain ` +
                  `inspector-${selectedNode.domain}`
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
                    {Math.round(selectedNode.x)},{" "}
                    {Math.round(selectedNode.y)}
                  </dd>
                </div>

                <div>
                  <dt>Ports</dt>
                  <dd>{selectedNode.ports.length}</dd>
                </div>

                <div>
                  <dt>Relationships</dt>
                  <dd>{selectedConnectionCount}</dd>
                </div>
              </dl>

              <NodePropertyEditor
                node={selectedNode}
                onCommit={handleNodePropertiesCommit}
              />


              {selectedNode.domain === "ael" &&
                selectedNode.kind ===
                  "repository-event" && (
                  <CommitEvidencePanel
                    sourceNode={selectedNode}
                    document={document}
                    onMaterialize={
                      handleMaterializeCommitEvidence
                    }
                  />
                )}

              <div className="inspector-port-list">
                {selectedNode.ports.map((port) => (
                  <div
                    className="inspector-port"
                    key={port.id}
                  >
                    <span
                      className={
                        `inspector-port-direction ` +
                        `direction-${port.direction}`
                      }
                    >
                      {port.direction}
                    </span>

                    <span>{port.label}</span>

                    <code>{port.dataType}</code>
                  </div>
                ))}
              </div>
            </section>
          )}

          <CompilerPanel
            result={compilation}
            isCompiling={isCompiling}
            nodeCount={document.nodes.length}
            edgeCount={document.edges.length}
          />
        </aside>

        <section className="bottom-dock">
          <HistoryPanel history={history} />

          <AuditPanel audit={audit} />
        </section>
      </main>
    </div>
  );
}

export default App;
