import type {
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
          <div className="compiler-issue-group">
            <span className="compiler-group-heading">
              Blocking obstructions
            </span>

            {result.obstructions
              .slice(0, 6)
              .map((issue) => (
                <div
                  className="compiler-issue compiler-obstruction"
                  key={issue.id}
                >
                  <strong>{issue.code}</strong>
                  <span>{issue.message}</span>
                </div>
              ))}

            {result.obstructions.length > 6 && (
              <small>
                +{result.obstructions.length - 6} more
                obstructions
              </small>
            )}
          </div>
        )}

      {result !== null &&
        result.warnings.length > 0 && (
          <div className="compiler-issue-group">
            <span className="compiler-group-heading">
              Warnings
            </span>

            {result.warnings
              .slice(0, 4)
              .map((issue) => (
                <div
                  className="compiler-issue compiler-warning"
                  key={issue.id}
                >
                  <strong>{issue.code}</strong>
                  <span>{issue.message}</span>
                </div>
              ))}

            {result.warnings.length > 4 && (
              <small>
                +{result.warnings.length - 4} more
                warnings
              </small>
            )}
          </div>
        )}

      {result?.decision === "admitted" && (
        <div className="compiler-admitted-report">
          The graph is structurally compilable. External
          execution remains unauthorized.
        </div>
      )}
    </section>
  );
}
