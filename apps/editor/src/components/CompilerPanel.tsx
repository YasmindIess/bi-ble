import type {
  CompilationIssue,
  CompilationResult
} from "../model/compiler";

interface CompilerPanelProps {
  result: CompilationResult | null;
  isCompiling: boolean;
  nodeCount: number;
  edgeCount: number;
}

function shortDigest(value: string): string {
  return value.slice(0, 14);
}

function IssueList({
  issues,
  kind,
  limit
}: {
  issues: CompilationIssue[];
  kind: "obstruction" | "warning";
  limit: number;
}) {
  return (
    <div className="compiler-disclosure-body">
      {issues.slice(0, limit).map((issue) => (
        <div
          className={
            "compiler-issue " +
            (
              kind === "obstruction"
                ? "compiler-obstruction"
                : "compiler-warning"
            )
          }
          key={issue.id}
        >
          <strong>{issue.code}</strong>
          <span>{issue.message}</span>
        </div>
      ))}

      {issues.length > limit && (
        <small>
          +{issues.length - limit} more{" "}
          {kind === "obstruction"
            ? "obstructions"
            : "warnings"}
        </small>
      )}
    </div>
  );
}

export function CompilerPanel({
  result,
  isCompiling,
  nodeCount,
  edgeCount
}: CompilerPanelProps) {
  const state =
    isCompiling
      ? "Compiling"
      : result?.decision === "blocked"
        ? "Blocked"
        : result?.decision === "admitted"
          ? "Admitted"
          : "Idle";

  return (
    <section className="compiler-card">
      <div className="compiler-card-heading">
        <span className="eyebrow">
          Formula compiler
        </span>

        <span
          className={
            "compiler-state " +
            `compiler-state-${state.toLowerCase()}`
          }
        >
          {state}
        </span>
      </div>

      <dl className="compiler-facts">
        <div>
          <dt>Document</dt>
          <dd>{nodeCount} nodes</dd>
        </div>

        <div>
          <dt>Relationships</dt>
          <dd>{edgeCount}</dd>
        </div>

        <div>
          <dt>Formula IR</dt>
          <dd>
            {result === null
              ? "Not generated"
              : `${result.ir.nodes.length} / ` +
                `${result.ir.edges.length}`}
          </dd>
        </div>

        <div>
          <dt>Decision</dt>
          <dd>
            {result?.decision ?? "Pending"}
          </dd>
        </div>

        <div>
          <dt>Source digest</dt>
          <dd className="compiler-digest">
            {result === null
              ? "—"
              : shortDigest(
                  result.sourceDigest
                )}
          </dd>
        </div>

        <div>
          <dt>Semantic IR digest</dt>
          <dd className="compiler-digest">
            {result === null
              ? "—"
              : shortDigest(
                  result.irDigest
                )}
          </dd>
        </div>

        <div>
          <dt>Authority</dt>
          <dd>Simulation only</dd>
        </div>
      </dl>

      {result === null && !isCompiling && (
        <div className="compiler-empty-report">
          Press Compile to normalize and validate the
          current formula.
        </div>
      )}

      {result !== null &&
        result.obstructions.length > 0 && (
          <details className="compiler-disclosure">
            <summary>
              <span>Blocking obstructions</span>
              <strong>
                {result.obstructions.length}
              </strong>
            </summary>

            <IssueList
              issues={result.obstructions}
              kind="obstruction"
              limit={8}
            />
          </details>
        )}

      {result !== null &&
        result.warnings.length > 0 && (
          <details className="compiler-disclosure">
            <summary>
              <span>Warnings</span>
              <strong>
                {result.warnings.length}
              </strong>
            </summary>

            <IssueList
              issues={result.warnings}
              kind="warning"
              limit={6}
            />
          </details>
        )}

      {result?.decision === "admitted" && (
        <div className="compiler-admitted-report">
          The graph is structurally compilable. External
          execution remains unauthorized.
        </div>
      )}

      {result !== null && (
        <div className="tribunal-section">
          <span className="compiler-group-heading">
            Evaluation modes
          </span>

          <div className="tribunal-list">
            {result.tribunals.map((tribunal) => (
              <details
                className={
                  "tribunal-card " +
                  `tribunal-${tribunal.decision}`
                }
                key={tribunal.id}
              >
                <summary className="tribunal-summary">
                  <div className="tribunal-heading">
                    <div>
                      <strong>{tribunal.label}</strong>
                      <span>{tribunal.id}</span>
                    </div>

                    <span className="tribunal-decision">
                      {tribunal.decision}
                    </span>
                  </div>

                  <div className="tribunal-facts">
                    <span>
                      {tribunal.facts.nodeCount} nodes
                    </span>

                    <span>
                      {tribunal.facts.edgeCount} edges
                    </span>

                    <span>
                      {tribunal.score === null
                        ? "N/A"
                        : `${tribunal.score}%`}
                    </span>
                  </div>
                </summary>

                <div className="tribunal-detail-body">
                  {tribunal.obstructions
                    .slice(0, 5)
                    .map((issue) => (
                      <div
                        className={
                          "tribunal-issue tribunal-block"
                        }
                        key={issue.id}
                      >
                        <code>{issue.code}</code>
                        <span>{issue.message}</span>
                      </div>
                    ))}

                  {tribunal.warnings
                    .slice(0, 4)
                    .map((issue) => (
                      <div
                        className={
                          "tribunal-issue tribunal-warning"
                        }
                        key={issue.id}
                      >
                        <code>{issue.code}</code>
                        <span>{issue.message}</span>
                      </div>
                    ))}

                  {tribunal.obstructions.length === 0 &&
                    tribunal.warnings.length === 0 && (
                      <div className="tribunal-clear">
                        No tribunal-specific issues.
                      </div>
                    )}

                  {tribunal.obstructions.length > 5 && (
                    <small>
                      +{tribunal.obstructions.length - 5} more
                      obstructions
                    </small>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
