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

export interface PublicCommitEvidenceFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  previousPath: string | null;
}

export interface PublicCommitEvidence {
  schemaVersion: 1;
  source: "github_public_commit_api";
  repository: string;
  revision: string;
  shortRevision: string;
  parentRevisions: string[];
  summary: string;
  author: string;
  committedAt: string;
  htmlUrl: string;

  stats: {
    additions: number;
    deletions: number;
    total: number;
  };

  fileCount: number;
  filesTruncated: boolean;
  files: PublicCommitEvidenceFile[];
  evidenceDigest: string;
}

export interface PublicCommitEvidenceResponse {
  schemaVersion: 1;
  fetchedAt: string;
  evidence: PublicCommitEvidence;
}

function isPublicCommitEvidenceFile(
  value: unknown
): value is PublicCommitEvidenceFile {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.path === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.additions === "number" &&
    typeof candidate.deletions === "number" &&
    typeof candidate.changes === "number" &&
    (
      candidate.previousPath === null ||
      typeof candidate.previousPath === "string"
    )
  );
}

function isPublicCommitEvidence(
  value: unknown
): value is PublicCommitEvidence {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  const stats =
    candidate.stats as
      | Record<string, unknown>
      | undefined;

  return (
    candidate.schemaVersion === 1 &&
    candidate.source ===
      "github_public_commit_api" &&
    typeof candidate.repository === "string" &&
    typeof candidate.revision === "string" &&
    typeof candidate.shortRevision === "string" &&
    Array.isArray(candidate.parentRevisions) &&
    candidate.parentRevisions.every(
      (revision) =>
        typeof revision === "string"
    ) &&
    typeof candidate.summary === "string" &&
    typeof candidate.author === "string" &&
    typeof candidate.committedAt === "string" &&
    typeof candidate.htmlUrl === "string" &&
    typeof stats === "object" &&
    stats !== null &&
    typeof stats.additions === "number" &&
    typeof stats.deletions === "number" &&
    typeof stats.total === "number" &&
    typeof candidate.fileCount === "number" &&
    typeof candidate.filesTruncated === "boolean" &&
    Array.isArray(candidate.files) &&
    candidate.files.every(
      isPublicCommitEvidenceFile
    ) &&
    typeof candidate.evidenceDigest === "string"
  );
}

function isPublicCommitEvidenceResponse(
  value: unknown
): value is PublicCommitEvidenceResponse {
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
    typeof candidate.fetchedAt === "string" &&
    isPublicCommitEvidence(
      candidate.evidence
    )
  );
}

export async function loadPublicCommitEvidence(
  repository: string,
  revision: string,
  signal?: AbortSignal
): Promise<PublicCommitEvidenceResponse> {
  const query = new URLSearchParams({
    repository,
    revision
  });

  const response = await fetch(
    "/api/github/public-commit-evidence?" +
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
        : "Commit evidence could not be loaded.";

    throw new Error(message);
  }

  if (
    !isPublicCommitEvidenceResponse(
      payload
    )
  ) {
    throw new Error(
      "The commit evidence adapter returned an invalid payload."
    );
  }

  return payload;
}
