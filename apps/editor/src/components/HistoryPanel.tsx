import type {
  HistoryState,
  OperationRecord
} from "../model/history";

interface HistoryPanelProps {
  history: HistoryState;
}

function shortDigest(value: string): string {
  return value.slice(0, 12);
}

function operationKind(
  record: OperationRecord
): string {
  return record.forward.type;
}

export function HistoryPanel({
  history
}: HistoryPanelProps) {
  const visibleEntries = history.entries
    .map((entry, index) => ({
      entry,
      index
    }))
    .reverse()
    .slice(0, 7);

  return (
    <article className="dock-panel history-panel">
      <div className="dock-heading">
        <div>
          <span className="eyebrow">
            Nondestructive record
          </span>
          <h2>History</h2>
        </div>

        <span className="panel-count">
          {history.cursor}/{history.entries.length}
        </span>
      </div>

      {history.entries.length === 0 ? (
        <div className="dock-empty">
          The current composition is the history root.
          New operations will appear here.
        </div>
      ) : (
        <div className="history-list">
          {visibleEntries.map(({ entry, index }) => {
            const isApplied = index < history.cursor;

            return (
              <div
                className={
                  "history-entry" +
                  (
                    isApplied
                      ? " history-entry-applied"
                      : " history-entry-undone"
                  )
                }
                key={entry.id}
              >
                <div className="history-entry-marker">
                  {isApplied ? "●" : "○"}
                </div>

                <div className="history-entry-content">
                  <strong>{entry.label}</strong>

                  <span>
                    {operationKind(entry)}
                  </span>

                  <code>
                    {shortDigest(entry.beforeDigest)}
                    {" → "}
                    {shortDigest(entry.afterDigest)}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
