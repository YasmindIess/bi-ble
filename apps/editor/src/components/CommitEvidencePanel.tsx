import {
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  EditorDocument,
  FormulaNode
} from "../model/document";

import {
  loadPublicCommitEvidence,
  type PublicCommitEvidence
} from "../integrations/github";

interface CommitEvidencePanelProps {
  sourceNode: FormulaNode;
  document: EditorDocument;

  onMaterialize: (
    sourceNode: FormulaNode,
    evidenceNode: FormulaNode,
    evidence: PublicCommitEvidence
  ) => Promise<void>;
}

function stringProperty(
  node: FormulaNode,
  key: string
): string {
  const value = node.properties?.[key];

  return typeof value === "string"
    ? value
    : "";
}

export function CommitEvidencePanel({
  sourceNode,
  document,
  onMaterialize
}: CommitEvidencePanelProps) {
  const repository = stringProperty(
    sourceNode,
    "repository"
  );

  const revision = stringProperty(
    sourceNode,
    "revision"
  );

  const connectedEvidenceNode = useMemo(
    () => {
      for (const edge of document.edges) {
        if (
          edge.source.nodeId !== sourceNode.id ||
          edge.dataType !== "ael:event"
        ) {
          continue;
        }

        const candidate = document.nodes.find(
          (node) =>
            node.id === edge.target.nodeId
        );

        if (
          candidate?.domain === "ael" &&
          candidate.kind === "evidence"
        ) {
          return candidate;
        }
      }

      return null;
    },
    [
      document.edges,
      document.nodes,
      sourceNode.id
    ]
  );

  const [candidate, setCandidate] =
    useState<PublicCommitEvidence | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(null);

  const [isInspecting, setIsInspecting] =
    useState(false);

  const [
    isMaterializing,
    setIsMaterializing
  ] = useState(false);

  useEffect(() => {
    setCandidate(null);
    setError(null);
  }, [repository, revision]);

  const selectionIsComplete =
    repository.length > 0 &&
    /^[0-9a-f]{40}$/i.test(revision);

  const handleInspect = async () => {
    if (
      !selectionIsComplete ||
      isInspecting
    ) {
      return;
    }

    setIsInspecting(true);
    setError(null);

    try {
      const response =
        await loadPublicCommitEvidence(
          repository,
          revision
        );

      setCandidate(response.evidence);
    } catch (inspectionError) {
      setCandidate(null);

      setError(
        inspectionError instanceof Error
          ? inspectionError.message
          : "Commit evidence could not be inspected."
      );
    } finally {
      setIsInspecting(false);
    }
  };

  const handleMaterialize = async () => {
    if (
      candidate === null ||
      connectedEvidenceNode === null ||
      isMaterializing
    ) {
      return;
    }

    setIsMaterializing(true);
    setError(null);

    try {
      await onMaterialize(
        sourceNode,
        connectedEvidenceNode,
        candidate
      );
    } catch (materializationError) {
      setError(
        materializationError instanceof Error
          ? materializationError.message
          : "Commit evidence could not be materialized."
      );
    } finally {
      setIsMaterializing(false);
    }
  };

  return (
    <section className="commit-evidence-panel">
      <div className="commit-evidence-heading">
        <div>
          <span className="eyebrow">
            Deterministic evidence
          </span>

          <strong>Public commit inspection</strong>
        </div>

        <span className="commit-evidence-scope">
          Metadata only
        </span>
      </div>

      <p>
        Inspect the selected immutable revision
        without retrieving patch bodies or invoking
        a model.
      </p>

      <dl className="commit-evidence-selection">
        <div>
          <dt>Repository</dt>
          <dd>{repository || "Not selected"}</dd>
        </div>

        <div>
          <dt>Revision</dt>
          <dd className="mono-value">
            {revision || "Not selected"}
          </dd>
        </div>

        <div>
          <dt>Evidence target</dt>
          <dd>
            {connectedEvidenceNode?.label ??
              "Connect an Evidence node first"}
          </dd>
        </div>
      </dl>

      <div className="commit-evidence-actions">
        <button
          type="button"
          disabled={
            !selectionIsComplete ||
            isInspecting
          }
          onClick={() => {
            void handleInspect();
          }}
        >
          {isInspecting
            ? "Inspecting…"
            : "Inspect revision"}
        </button>
      </div>

      {error !== null && (
        <div
          className="commit-evidence-message evidence-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {candidate !== null && (
        <div className="commit-evidence-candidate">
          <div className="commit-evidence-candidate-title">
            <div>
              <strong>
                {candidate.shortRevision}
              </strong>

              <span>{candidate.summary}</span>
            </div>

            <span className="evidence-candidate-status">
              Candidate
            </span>
          </div>

          <dl className="commit-evidence-facts">
            <div>
              <dt>Parents</dt>
              <dd>
                {candidate.parentRevisions.length}
              </dd>
            </div>

            <div>
              <dt>Paths</dt>
              <dd>{candidate.fileCount}</dd>
            </div>

            <div>
              <dt>Additions</dt>
              <dd>{candidate.stats.additions}</dd>
            </div>

            <div>
              <dt>Deletions</dt>
              <dd>{candidate.stats.deletions}</dd>
            </div>
          </dl>

          <div className="commit-evidence-paths">
            {candidate.files
              .slice(0, 12)
              .map((file) => (
                <div key={file.path}>
                  <span>{file.status}</span>
                  <code>{file.path}</code>
                </div>
              ))}

            {candidate.fileCount > 12 && (
              <small>
                +{candidate.fileCount - 12} more
                changed paths
              </small>
            )}
          </div>

          <div className="commit-evidence-digest">
            <span>Evidence digest</span>
            <code>{candidate.evidenceDigest}</code>
          </div>

          <button
            type="button"
            className="property-apply"
            disabled={
              connectedEvidenceNode === null ||
              isMaterializing
            }
            onClick={() => {
              void handleMaterialize();
            }}
          >
            {isMaterializing
              ? "Materializing…"
              : "Materialize as Evidence"}
          </button>
        </div>
      )}
    </section>
  );
}
