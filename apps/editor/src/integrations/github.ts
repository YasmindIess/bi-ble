export interface PublicRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  updatedAt: string;
}

export interface PublicRepositoryResponse {
  schemaVersion: 1;
  owner: string;
  ownerSource: string;
  fetchedAt: string;
  cache: "hit" | "miss";
  repositories: PublicRepository[];
}

function isPublicRepository(
  value: unknown
): value is PublicRepository {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.fullName === "string" &&
    typeof candidate.htmlUrl === "string" &&
    (
      candidate.description === null ||
      typeof candidate.description === "string"
    ) &&
    typeof candidate.defaultBranch === "string" &&
    typeof candidate.archived === "boolean" &&
    typeof candidate.fork === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

function isPublicRepositoryResponse(
  value: unknown
): value is PublicRepositoryResponse {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.owner === "string" &&
    typeof candidate.ownerSource === "string" &&
    typeof candidate.fetchedAt === "string" &&
    (
      candidate.cache === "hit" ||
      candidate.cache === "miss"
    ) &&
    Array.isArray(candidate.repositories) &&
    candidate.repositories.every(
      isPublicRepository
    )
  );
}

export async function loadPublicRepositories(
  signal?: AbortSignal
): Promise<PublicRepositoryResponse> {
  const response = await fetch(
    "/api/github/public-repositories",
    {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      signal
    }
  );

  const payload: unknown =
    await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Public repositories could not be loaded.";

    throw new Error(message);
  }

  if (
    !isPublicRepositoryResponse(
      payload
    )
  ) {
    throw new Error(
      "The repository adapter returned an invalid payload."
    );
  }

  return payload;
}

export interface PublicRevision {
  sha: string;
  shortSha: string;
  summary: string;
  author: string;
  committedAt: string;
  htmlUrl: string;
}

export interface PublicRevisionResponse {
  schemaVersion: 1;
  repository: string;
  defaultBranch: string;
  fetchedAt: string;
  cache: "hit" | "miss";
  revisions: PublicRevision[];
}

function isPublicRevision(
  value: unknown
): value is PublicRevision {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.sha === "string" &&
    typeof candidate.shortSha === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.author === "string" &&
    typeof candidate.committedAt === "string" &&
    typeof candidate.htmlUrl === "string"
  );
}

function isPublicRevisionResponse(
  value: unknown
): value is PublicRevisionResponse {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.repository === "string" &&
    typeof candidate.defaultBranch === "string" &&
    typeof candidate.fetchedAt === "string" &&
    (
      candidate.cache === "hit" ||
      candidate.cache === "miss"
    ) &&
    Array.isArray(candidate.revisions) &&
    candidate.revisions.every(
      isPublicRevision
    )
  );
}

export async function loadPublicRevisions(
  repository: string,
  signal?: AbortSignal
): Promise<PublicRevisionResponse> {
  const query =
    new URLSearchParams({
      repository
    });

  const response = await fetch(
    "/api/github/public-revisions?" +
      query.toString(),
    {
      method: "GET",

      headers: {
        "Accept": "application/json"
      },

      signal
    }
  );

  const payload: unknown =
    await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Public revisions could not be loaded.";

    throw new Error(message);
  }

  if (
    !isPublicRevisionResponse(
      payload
    )
  ) {
    throw new Error(
      "The revision adapter returned an invalid payload."
    );
  }

  return payload;
}
