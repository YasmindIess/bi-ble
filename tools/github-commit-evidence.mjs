import {
  createHash
} from "node:crypto";

const MAX_EVIDENCE_FILES = 100;

function repositoryIsValid(repository) {
  return (
    typeof repository === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(
      repository
    )
  );
}

function revisionIsImmutable(revision) {
  return (
    typeof revision === "string" &&
    /^[0-9a-f]{40}$/i.test(revision)
  );
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "User-Agent": "bi-ble-public-evidence-adapter",
    "X-GitHub-Api-Version": "2022-11-28",

    ...(typeof token === "string" && token.length > 0
      ? {
          "Authorization": `Bearer ${token}`
        }
      : {})
  };
}

async function fetchGitHubJson(
  url,
  token
) {
  const response = await fetch(
    url,
    {
      method: "GET",
      headers: githubHeaders(token)
    }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub returned HTTP ${response.status}.`
    );
  }

  return response.json();
}

function requireObject(
  value,
  label
) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} returned an invalid payload.`
    );
  }

  return value;
}

function stringOrEmpty(value) {
  return typeof value === "string"
    ? value
    : "";
}

function numberOrZero(value) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function normalizeCommitFile(value) {
  const file = requireObject(
    value,
    "GitHub commit file"
  );

  const path = stringOrEmpty(file.filename);

  if (path.length === 0) {
    throw new Error(
      "GitHub returned a commit file without a path."
    );
  }

  return {
    path,
    status: stringOrEmpty(file.status) || "unknown",
    additions: numberOrZero(file.additions),
    deletions: numberOrZero(file.deletions),
    changes: numberOrZero(file.changes),

    previousPath:
      typeof file.previous_filename === "string"
        ? file.previous_filename
        : null
  };
}

function createEvidenceDigest(manifest) {
  return createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
}

export async function loadPublicCommitEvidence({
  repository,
  revision,
  token
}) {
  if (!repositoryIsValid(repository)) {
    throw new Error(
      "Repository must use the owner/name form."
    );
  }

  if (!revisionIsImmutable(revision)) {
    throw new Error(
      "Revision must be a complete immutable commit SHA."
    );
  }

  const encodedRepository = repository
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const repositoryPayload = requireObject(
    await fetchGitHubJson(
      `https://api.github.com/repos/${encodedRepository}`,
      token
    ),
    "GitHub repository"
  );

  if (repositoryPayload.private !== false) {
    throw new Error(
      "Only public repositories may be inspected."
    );
  }

  const canonicalRepository =
    stringOrEmpty(repositoryPayload.full_name);

  if (canonicalRepository.length === 0) {
    throw new Error(
      "GitHub did not return a canonical repository name."
    );
  }

  const commitPayload = requireObject(
    await fetchGitHubJson(
      `https://api.github.com/repos/` +
        `${encodedRepository}/commits/` +
        `${encodeURIComponent(revision)}?per_page=100`,
      token
    ),
    "GitHub commit"
  );

  const canonicalRevision =
    stringOrEmpty(commitPayload.sha);

  if (!revisionIsImmutable(canonicalRevision)) {
    throw new Error(
      "GitHub did not return an immutable commit identity."
    );
  }

  const commit =
    typeof commitPayload.commit === "object" &&
    commitPayload.commit !== null
      ? commitPayload.commit
      : {};

  const commitAuthor =
    typeof commit.author === "object" &&
    commit.author !== null
      ? commit.author
      : {};

  const commitCommitter =
    typeof commit.committer === "object" &&
    commit.committer !== null
      ? commit.committer
      : {};

  const accountAuthor =
    typeof commitPayload.author === "object" &&
    commitPayload.author !== null
      ? commitPayload.author
      : {};

  const message = stringOrEmpty(commit.message);

  const summary =
    message.split(/\r?\n/, 1)[0] ||
    "(commit without summary)";

  const parentRevisions = Array.isArray(
    commitPayload.parents
  )
    ? commitPayload.parents
        .map((parent) =>
          typeof parent === "object" &&
          parent !== null
            ? stringOrEmpty(parent.sha)
            : ""
        )
        .filter(revisionIsImmutable)
    : [];

  const allFiles = Array.isArray(
    commitPayload.files
  )
    ? commitPayload.files
        .map(normalizeCommitFile)
        .sort((left, right) =>
          left.path.localeCompare(right.path)
        )
    : [];

  const files = allFiles.slice(
    0,
    MAX_EVIDENCE_FILES
  );

  const stats =
    typeof commitPayload.stats === "object" &&
    commitPayload.stats !== null
      ? commitPayload.stats
      : {};

  const manifest = {
    schemaVersion: 1,
    source: "github_public_commit_api",
    repository: canonicalRepository,
    revision: canonicalRevision,
    parentRevisions,
    summary,

    author:
      stringOrEmpty(commitAuthor.name) ||
      stringOrEmpty(accountAuthor.login) ||
      "Unknown author",

    committedAt:
      stringOrEmpty(commitCommitter.date) ||
      stringOrEmpty(commitAuthor.date),

    htmlUrl: stringOrEmpty(commitPayload.html_url),

    stats: {
      additions: numberOrZero(stats.additions),
      deletions: numberOrZero(stats.deletions),
      total: numberOrZero(stats.total)
    },

    fileCount: allFiles.length,
    filesTruncated:
      allFiles.length > MAX_EVIDENCE_FILES,

    files
  };

  return {
    ...manifest,
    shortRevision:
      canonicalRevision.slice(0, 7),

    evidenceDigest:
      createEvidenceDigest(manifest)
  };
}
