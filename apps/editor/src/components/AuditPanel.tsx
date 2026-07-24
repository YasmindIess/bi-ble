import type {
  AuditReceipt,
  AuditState
} from "../model/audit";

interface AuditPanelProps {
  audit: AuditState;
}

function shortDigest(value: string): string {
  return value.slice(0, 10);
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="audit-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuditEntry({
  receipt
}: {
  receipt: AuditReceipt;
}) {
  const gesture = receipt.facts.pointerGesture;

  return (
    <div className="audit-entry">
      <div className="audit-entry-heading">
        <div>
          <strong>{receipt.operationLabel}</strong>
          <span>{receipt.operationType}</span>
        </div>

        <span className="audit-decision">
          {receipt.decision}
        </span>
      </div>

      <div className="audit-fact-boundary">
        <span className="audit-section-label">
          Facts
        </span>

        <code>
          {shortDigest(
            receipt.facts.beforeDigest
          )}
          {" → "}
          {shortDigest(
            receipt.facts.afterDigest
          )}
        </code>

        {gesture === undefined ? (
          <span className="audit-no-gesture">
            No pointer-gesture facts attached.
          </span>
        ) : (
          <div className="audit-metrics">
            <Metric
              label="Duration"
              value={`${gesture.durationMs} ms`}
            />

            <Metric
              label="Travel"
              value={`${gesture.pointerTravel}px`}
            />

            <Metric
              label="Displacement"
              value={`${gesture.finalDisplacement}px`}
            />

            <Metric
              label="Efficiency"
              value={`${Math.round(
                gesture.efficiencyRatio * 100
              )}%`}
            />
          </div>
        )}
      </div>

      {receipt.interpretations.map(
        (interpretation) => (
          <div
            className="audit-interpretation"
            key={`${receipt.id}-${interpretation.kind}`}
          >
            <span className="audit-section-label">
              Interpretation candidate
            </span>

            <p>{interpretation.statement}</p>

            <small>
              Authority: {interpretation.authority}
            </small>
          </div>
        )
      )}
    </div>
  );
}

export function AuditPanel({
  audit
}: AuditPanelProps) {
  const visibleReceipts = [...audit.receipts]
    .reverse()
    .slice(0, 5);

  return (
    <article className="dock-panel audit-panel">
      <div className="dock-heading">
        <div>
          <span className="eyebrow">
            Operational evidence
          </span>

          <h2>Audit</h2>
        </div>

        <span className="panel-count">
          {audit.receipts.length}
        </span>
      </div>

      {visibleReceipts.length === 0 ? (
        <div className="dock-empty">
          New committed operations will emit append-only
          receipts here.
        </div>
      ) : (
        <div className="audit-list">
          {visibleReceipts.map((receipt) => (
            <AuditEntry
              key={receipt.id}
              receipt={receipt}
            />
          ))}
        </div>
      )}
    </article>
  );
}
