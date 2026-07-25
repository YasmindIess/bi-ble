import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  loadPublicRevisions,
  type PublicRevision
} from "../integrations/github";

interface RevisionSelectorProps {
  repository: string;
  value: string;

  onChange: (
    value: string
  ) => void;
}

type RevisionLoadingState =
  | "idle"
  | "loading"
  | "ready"
  | "error";

function revisionLabel(
  revision: PublicRevision
): string {
  return (
    `${revision.shortSha} — ` +
    revision.summary
  );
}

export function RevisionSelector({
  repository,
  value,
  onChange
}: RevisionSelectorProps) {
  const [
    revisions,
    setRevisions
  ] = useState<PublicRevision[]>([]);

  const [
    defaultBranch,
    setDefaultBranch
  ] = useState("");

  const [
    loadingState,
    setLoadingState
  ] = useState<RevisionLoadingState>(
    repository === ""
      ? "idle"
      : "loading"
  );

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const request =
    useRef<AbortController | null>(
      null
    );

  const refresh = useCallback(
    async () => {
      request.current?.abort();

      if (repository === "") {
        setRevisions([]);
        setDefaultBranch("");
        setErrorMessage("");
        setLoadingState("idle");
        return;
      }

      const controller =
        new AbortController();

      request.current =
        controller;

      setLoadingState("loading");
      setErrorMessage("");

      try {
        const response =
          await loadPublicRevisions(
            repository,
            controller.signal
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setRevisions(
          response.revisions
        );

        setDefaultBranch(
          response.defaultBranch
        );

        setLoadingState("ready");
      } catch (error) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        setRevisions([]);
        setDefaultBranch("");
        setLoadingState("error");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Revision discovery failed."
        );
      }
    },
    [repository]
  );

  useEffect(
    () => {
      void refresh();

      return () => {
        request.current?.abort();
      };
    },
    [refresh]
  );

  const currentValueMissing =
    value !== "" &&
    !revisions.some(
      (revision) =>
        revision.sha === value
    );

  return (
    <div className="revision-selector">
      <div className="revision-selector-heading">
        <span>Commit or revision</span>

        <button
          type="button"
          disabled={
            repository === "" ||
            loadingState === "loading"
          }
          onClick={() => {
            void refresh();
          }}
        >
          {loadingState === "loading"
            ? "Loading…"
            : "Refresh"}
        </button>
      </div>

      <select
        value={value}
        disabled={
          repository === "" ||
          (
            loadingState === "loading" &&
            revisions.length === 0
          )
        }
        onChange={(event) => {
          onChange(
            event.target.value
          );
        }}
      >
        <option value="">
          {repository === ""
            ? "Select a repository first"
            : "Select a public revision"}
        </option>

        {currentValueMissing && (
          <option value={value}>
            {value.slice(0, 12)} — current value
          </option>
        )}

        {revisions.map(
          (revision) => (
            <option
              key={revision.sha}
              value={revision.sha}
            >
              {revisionLabel(revision)}
            </option>
          )
        )}
      </select>

      <div
        className={
          "revision-selector-status " +
          `revision-selector-${loadingState}`
        }
      >
        {loadingState === "idle" && (
          <span>
            Choose a repository to load its
            public revisions.
          </span>
        )}

        {loadingState === "loading" && (
          <span>
            Loading recent public revisions…
          </span>
        )}

        {loadingState === "ready" && (
          <span>
            {revisions.length} recent{" "}
            {revisions.length === 1
              ? "revision"
              : "revisions"}{" "}
            from {defaultBranch}.
          </span>
        )}

        {loadingState === "error" && (
          <span>{errorMessage}</span>
        )}
      </div>
    </div>
  );
}
