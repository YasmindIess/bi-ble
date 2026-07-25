import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  loadPublicRepositories,
  type PublicRepository
} from "../integrations/github";

interface RepositorySelectorProps {
  value: string;

  onChange: (
    value: string
  ) => void;
}

type LoadingState =
  | "loading"
  | "ready"
  | "error";

function repositoryLabel(
  repository: PublicRepository
): string {
  const markers = [
    repository.archived
      ? "archived"
      : null,

    repository.fork
      ? "fork"
      : null
  ].filter(
    (
      marker
    ): marker is string =>
      marker !== null
  );

  return markers.length === 0
    ? repository.fullName
    : `${repository.fullName} (${markers.join(", ")})`;
}

export function RepositorySelector({
  value,
  onChange
}: RepositorySelectorProps) {
  const [
    repositories,
    setRepositories
  ] = useState<PublicRepository[]>([]);

  const [
    owner,
    setOwner
  ] = useState("");

  const [
    loadingState,
    setLoadingState
  ] = useState<LoadingState>(
    "loading"
  );

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const request =
    useRef<AbortController | null>(
      null
    );

  const refresh =
    useCallback(
      async () => {
        request.current?.abort();

        const controller =
          new AbortController();

        request.current =
          controller;

        setLoadingState(
          "loading"
        );

        setErrorMessage("");

        try {
          const response =
            await loadPublicRepositories(
              controller.signal
            );

          if (
            controller.signal.aborted
          ) {
            return;
          }

          setOwner(response.owner);

          setRepositories(
            response.repositories
          );

          setLoadingState(
            "ready"
          );
        } catch (error) {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          setLoadingState(
            "error"
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Repository discovery failed."
          );
        }
      },
      []
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
    !repositories.some(
      (repository) =>
        repository.fullName === value
    );

  return (
    <div className="repository-selector">
      <div className="repository-selector-heading">
        <span>Repository</span>

        <button
          type="button"
          disabled={
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
          loadingState === "loading" &&
          repositories.length === 0
        }
        onChange={(event) => {
          onChange(
            event.target.value
          );
        }}
      >
        <option value="">
          Select a public repository
        </option>

        {currentValueMissing && (
          <option value={value}>
            {value} — current value
          </option>
        )}

        {repositories.map(
          (repository) => (
            <option
              key={repository.id}
              value={
                repository.fullName
              }
            >
              {repositoryLabel(
                repository
              )}
            </option>
          )
        )}
      </select>

      <div
        className={
          "repository-selector-status " +
          `repository-selector-${loadingState}`
        }
      >
        {loadingState === "loading" && (
          <span>
            Detecting the connected
            GitHub owner…
          </span>
        )}

        {loadingState === "ready" && (
          <span>
            {repositories.length} public{" "}
            {repositories.length === 1
              ? "repository"
              : "repositories"}{" "}
            available from @{owner}.
          </span>
        )}

        {loadingState === "error" && (
          <span>{errorMessage}</span>
        )}
      </div>
    </div>
  );
}
