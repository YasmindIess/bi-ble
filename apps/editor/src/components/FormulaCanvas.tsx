import type {
  EditorDocument,
  FormulaEndpoint,
  FormulaNode,
  FormulaPort
} from "../model/document";

import {
  getPortPosition
} from "../model/document";

export type EditorTool = "select" | "connect";

interface FormulaCanvasProps {
  document: EditorDocument;
  selectedNodeId: string | null;
  tool: EditorTool;
  pendingSource: FormulaEndpoint | null;
  onSelectNode: (nodeId: string) => void;
  onBackgroundClick: () => void;
  onPortClick: (
    node: FormulaNode,
    port: FormulaPort
  ) => void;
}

function edgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  const horizontalDistance = Math.max(
    80,
    Math.abs(targetX - sourceX) * 0.5
  );

  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + horizontalDistance} ${sourceY}`,
    `${targetX - horizontalDistance} ${targetY}`,
    `${targetX} ${targetY}`
  ].join(" ");
}

export function FormulaCanvas({
  document,
  selectedNodeId,
  tool,
  pendingSource,
  onSelectNode,
  onBackgroundClick,
  onPortClick
}: FormulaCanvasProps) {
  return (
    <svg
      className="formula-canvas"
      viewBox="0 0 1200 760"
      role="img"
      aria-labelledby={
        "surface-title surface-description"
      }
      onClick={onBackgroundClick}
    >
      <title id="surface-title">
        Persistent compositional formula surface
      </title>

      <desc id="surface-description">
        Typed semantic objects and relationships are
        rendered as persistent SVG structures.
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

        <marker
          id="edge-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            className="edge-arrow"
          />
        </marker>
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

      <g className="formula-edges">
        {document.edges.map((edge) => {
          const sourceNode = document.nodes.find(
            (node) => node.id === edge.source.nodeId
          );

          const targetNode = document.nodes.find(
            (node) => node.id === edge.target.nodeId
          );

          if (
            sourceNode === undefined ||
            targetNode === undefined
          ) {
            return null;
          }

          const sourcePosition = getPortPosition(
            sourceNode,
            edge.source.portId
          );

          const targetPosition = getPortPosition(
            targetNode,
            edge.target.portId
          );

          if (
            sourcePosition === null ||
            targetPosition === null
          ) {
            return null;
          }

          const midpointX =
            (sourcePosition.x + targetPosition.x) / 2;

          const midpointY =
            (sourcePosition.y + targetPosition.y) / 2;

          return (
            <g key={edge.id} className="formula-edge">
              <path
                d={edgePath(
                  sourcePosition.x,
                  sourcePosition.y,
                  targetPosition.x,
                  targetPosition.y
                )}
                className="formula-edge-line"
                markerEnd="url(#edge-arrow)"
              />

              <rect
                x={midpointX - 54}
                y={midpointY - 11}
                width="108"
                height="20"
                rx="7"
                className="formula-edge-label-background"
              />

              <text
                x={midpointX}
                y={midpointY + 3}
                className="formula-edge-label"
              >
                {edge.dataType}
              </text>
            </g>
          );
        })}
      </g>

      {document.nodes.map((node) => {
        const isSelected =
          node.id === selectedNodeId;

        return (
          <g
            key={node.id}
            className={
              `formula-node node-${node.domain}` +
              (
                isSelected
                  ? " formula-node-selected"
                  : ""
              )
            }
            transform={`translate(${node.x} ${node.y})`}
            role="button"
            tabIndex={0}
            aria-label={
              `${node.domain} ${node.label} node`
            }
            onClick={(event) => {
              event.stopPropagation();
              onSelectNode(node.id);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                onSelectNode(node.id);
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
              y="48"
              className="formula-node-label"
            >
              {node.label}
            </text>

            <text
              x="16"
              y="68"
              className="formula-node-kind"
            >
              {node.kind}
            </text>

            {node.ports.map((port) => {
              const position = getPortPosition(
                node,
                port.id
              );

              if (position === null) {
                return null;
              }

              const localX = position.x - node.x;
              const localY = position.y - node.y;

              const isPending =
                pendingSource?.nodeId === node.id &&
                pendingSource.portId === port.id;

              return (
                <g
                  key={port.id}
                  className={
                    `formula-port port-${port.direction}` +
                    (
                      isPending
                        ? " formula-port-pending"
                        : ""
                    ) +
                    (
                      tool === "connect"
                        ? " formula-port-connectable"
                        : ""
                    )
                  }
                  transform={
                    `translate(${localX} ${localY})`
                  }
                  role="button"
                  tabIndex={tool === "connect" ? 0 : -1}
                  aria-label={
                    `${port.direction} ${port.label} ` +
                    `${port.dataType}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onPortClick(node, port);
                  }}
                  onKeyDown={(event) => {
                    if (
                      tool === "connect" &&
                      (
                        event.key === "Enter" ||
                        event.key === " "
                      )
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      onPortClick(node, port);
                    }
                  }}
                >
                  <circle
                    r="7"
                    className="formula-port-hit-area"
                  />

                  <circle
                    r="4"
                    className="formula-port-visible"
                  />

                  <text
                    x={
                      port.direction === "input"
                        ? 12
                        : -12
                    }
                    y="3"
                    className="formula-port-label"
                  >
                    {port.label}
                  </text>
                </g>
              );
            })}
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
  );
}
