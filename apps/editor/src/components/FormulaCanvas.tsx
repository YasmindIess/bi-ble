import {
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

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

interface NodeMoveResult {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  pointerDistance: number;
}

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
  onNodeMoveCommit: (
    node: FormulaNode,
    result: NodeMoveResult
  ) => void | Promise<void>;
}

interface DragPreview {
  nodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
  x: number;
  y: number;
  pointerDistance: number;
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

function canvasScale(
  svg: SVGSVGElement
): {
  x: number;
  y: number;
} {
  const bounds = svg.getBoundingClientRect();

  return {
    x: 1200 / bounds.width,
    y: 760 / bounds.height
  };
}

function clampNodePosition(
  node: FormulaNode,
  x: number,
  y: number
): {
  x: number;
  y: number;
} {
  return {
    x: Math.max(
      0,
      Math.min(1200 - node.width, x)
    ),
    y: Math.max(
      0,
      Math.min(760 - node.height, y)
    )
  };
}

export function FormulaCanvas({
  document,
  selectedNodeId,
  tool,
  pendingSource,
  onSelectNode,
  onBackgroundClick,
  onPortClick,
  onNodeMoveCommit
}: FormulaCanvasProps) {
  const [dragPreview, setDragPreview] =
    useState<DragPreview | null>(null);

  const renderedNodes = document.nodes.map((node) =>
    dragPreview?.nodeId === node.id
      ? {
          ...node,
          x: dragPreview.x,
          y: dragPreview.y
        }
      : node
  );

  const draggedOriginalNode =
    dragPreview === null
      ? null
      : document.nodes.find(
          (node) => node.id === dragPreview.nodeId
        ) ?? null;

  const handleNodePointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    node: FormulaNode
  ) => {
    if (
      tool !== "select" ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    onSelectNode(node.id);

    setDragPreview({
      nodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      x: node.x,
      y: node.y,
      pointerDistance: 0
    });
  };

  const handleNodePointerMove = (
    event: ReactPointerEvent<SVGGElement>,
    node: FormulaNode
  ) => {
    if (
      dragPreview === null ||
      dragPreview.pointerId !== event.pointerId ||
      dragPreview.nodeId !== node.id
    ) {
      return;
    }

    const svg = event.currentTarget.ownerSVGElement;

    if (svg === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const scale = canvasScale(svg);

    const deltaClientX =
      event.clientX - dragPreview.startClientX;

    const deltaClientY =
      event.clientY - dragPreview.startClientY;

    const deltaX = deltaClientX * scale.x;
    const deltaY = deltaClientY * scale.y;

    const nextPosition = clampNodePosition(
      node,
      dragPreview.startNodeX + deltaX,
      dragPreview.startNodeY + deltaY
    );

    setDragPreview((current) =>
      current === null
        ? null
        : {
            ...current,
            x: nextPosition.x,
            y: nextPosition.y,
            pointerDistance: Math.hypot(
              deltaClientX,
              deltaClientY
            )
          }
    );
  };

  const finishNodeDrag = (
    event: ReactPointerEvent<SVGGElement>,
    node: FormulaNode
  ) => {
    if (
      dragPreview === null ||
      dragPreview.pointerId !== event.pointerId ||
      dragPreview.nodeId !== node.id
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    const committedX = Math.round(dragPreview.x);
    const committedY = Math.round(dragPreview.y);

    const result: NodeMoveResult = {
      x: committedX,
      y: committedY,
      deltaX:
        committedX - dragPreview.startNodeX,
      deltaY:
        committedY - dragPreview.startNodeY,
      pointerDistance:
        dragPreview.pointerDistance
    };

    const moved =
      Math.abs(result.deltaX) >= 0.5 ||
      Math.abs(result.deltaY) >= 0.5;

    setDragPreview(null);

    if (moved) {
      void onNodeMoveCommit(node, result);
    }
  };

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

      {dragPreview !== null &&
        draggedOriginalNode !== null && (
          <g className="drag-measurement-layer">
            <line
              x1={
                dragPreview.startNodeX +
                draggedOriginalNode.width / 2
              }
              y1={
                dragPreview.startNodeY +
                draggedOriginalNode.height / 2
              }
              x2={
                dragPreview.x +
                draggedOriginalNode.width / 2
              }
              y2={
                dragPreview.y +
                draggedOriginalNode.height / 2
              }
              className="drag-displacement-line"
            />

            <circle
              cx={
                dragPreview.startNodeX +
                draggedOriginalNode.width / 2
              }
              cy={
                dragPreview.startNodeY +
                draggedOriginalNode.height / 2
              }
              r="4"
              className="drag-origin-marker"
            />
          </g>
        )}

      <g className="formula-edges">
        {document.edges.map((edge) => {
          const sourceNode = renderedNodes.find(
            (node) => node.id === edge.source.nodeId
          );

          const targetNode = renderedNodes.find(
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

      {renderedNodes.map((node) => {
        const isSelected =
          node.id === selectedNodeId;

        const isDragging =
          dragPreview?.nodeId === node.id;

        return (
          <g
            key={node.id}
            className={
              `formula-node node-${node.domain}` +
              (
                isSelected
                  ? " formula-node-selected"
                  : ""
              ) +
              (
                isDragging
                  ? " formula-node-dragging"
                  : ""
              )
            }
            transform={`translate(${node.x} ${node.y})`}
            role="button"
            tabIndex={0}
            aria-label={
              `${node.domain} ${node.label} node`
            }
            onPointerDown={(event) =>
              handleNodePointerDown(event, node)
            }
            onPointerMove={(event) =>
              handleNodePointerMove(event, node)
            }
            onPointerUp={(event) =>
              finishNodeDrag(event, node)
            }
            onPointerCancel={(event) =>
              finishNodeDrag(event, node)
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
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
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

            {isDragging &&
              dragPreview !== null && (
                <g
                  transform={
                    `translate(${node.width / 2} ` +
                    `${node.height + 18})`
                  }
                  className="drag-readout"
                >
                  <rect
                    x="-86"
                    y="-12"
                    width="172"
                    height="38"
                    rx="9"
                    className="drag-readout-background"
                  />

                  <text
                    x="0"
                    y="2"
                    className="drag-readout-position"
                  >
                    X {Math.round(dragPreview.x)}
                    {"  "}
                    Y {Math.round(dragPreview.y)}
                  </text>

                  <text
                    x="0"
                    y="17"
                    className="drag-readout-delta"
                  >
                    ΔX{" "}
                    {Math.round(
                      dragPreview.x -
                      dragPreview.startNodeX
                    )}
                    {"  "}
                    ΔY{" "}
                    {Math.round(
                      dragPreview.y -
                      dragPreview.startNodeY
                    )}
                  </text>
                </g>
              )}
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
