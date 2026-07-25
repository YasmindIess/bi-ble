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
