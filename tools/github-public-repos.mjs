import {
  createServer
} from "node:http";

import {
  loadPublicCommitEvidence
} from "./github-commit-evidence.mjs";

import {
  execFile
} from "node:child_process";

import {
  promisify
} from "node:util";

const execFileAsync = promisify(execFile);

const host = "127.0.0.1";

const port = Number(
  process.env.BI_BLE_GITHUB_ADAPTER_PORT ??
    "8787"
);

const workspace =
  process.env.GITHUB_WORKSPACE ??
  "/workspaces/bi-ble";

const CACHE_DURATION_MS = 60_000;

let cachedResponse = null;
let cachedAt = 0;

const revisionCache = new Map();

function sendJson(
  response,
  status,
  payload
) {
  response.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Cache-Control": "no-store",

      "X-Content-Type-Options":
        "nosniff"
    }
  );

  response.end(
    JSON.stringify(payload)
  );
}

function normalizeOwner(
  candidate
) {
  if (
    typeof candidate !== "string" ||
    candidate.trim() === ""
  ) {
    return null;
  }

  const normalized =
    candidate.trim();

  return /^[A-Za-z0-9-]+$/.test(
    normalized
  )
    ? normalized
    : null;
}

function ownerFromRemote(
  remote
) {
  const match = remote
    .trim()
    .match(
      /github\.com[/:]([^/]+)\/[^/]+?(?:\.git)?$/
    );

  return match === null
    ? null
    : normalizeOwner(match[1]);
}

async function detectOwner() {
  const environmentCandidates = [
    process.env.GITHUB_REPOSITORY_OWNER,
    process.env.GITHUB_USER,

    process.env.GITHUB_REPOSITORY
      ?.split("/")[0]
  ];

  for (
    const candidate
    of environmentCandidates
  ) {
    const owner =
      normalizeOwner(candidate);

    if (owner !== null) {
      return {
        owner,
        source: "codespace-environment"
      };
    }
  }

  try {
    const {
      stdout
    } = await execFileAsync(
      "git",
      [
        "remote",
        "get-url",
        "origin"
      ],
      {
        cwd: workspace
      }
    );

    const owner =
      ownerFromRemote(stdout);

    if (owner !== null) {
      return {
        owner,
        source: "git-origin"
      };
    }
  } catch {
    // The endpoint returns a bounded error below.
  }

  throw new Error(
    "Unable to determine the GitHub owner from " +
      "the Codespace environment or git origin."
  );
}

function nextPageUrl(
  linkHeader
) {
  if (
    typeof linkHeader !== "string" ||
    linkHeader === ""
  ) {
    return null;
  }

  for (
    const part
    of linkHeader.split(",")
  ) {
    const match = part.match(
      /<([^>]+)>;\s*rel="next"/
    );

    if (match !== null) {
      return match[1];
    }
  }

  return null;
}

async function fetchPublicRepositories(
  owner
) {
  const token =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN;

  const headers = {
    "Accept":
      "application/vnd.github+json",

    "User-Agent":
      "bi-ble-formula-surface",

    "X-GitHub-Api-Version":
      "2022-11-28"
  };

  if (
    typeof token === "string" &&
    token !== ""
  ) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  let url =
    "https://api.github.com/users/" +
    `${encodeURIComponent(owner)}/repos` +
    "?per_page=100" +
    "&sort=updated" +
    "&direction=desc" +
    "&type=owner";

  const repositories = [];
  let pageCount = 0;

  while (
    url !== null &&
    pageCount < 10
  ) {
    pageCount += 1;

    const response = await fetch(
      url,
      {
        headers
      }
    );

    if (!response.ok) {
      let detail =
        `${response.status} ` +
        response.statusText;

      try {
        const body =
          await response.json();

        if (
          typeof body?.message ===
          "string"
        ) {
          detail = body.message;
        }
      } catch {
        // Keep the bounded HTTP detail.
      }

      throw new Error(
        `GitHub repository request failed: ${detail}`
      );
    }

    const page =
      await response.json();

    if (!Array.isArray(page)) {
      throw new Error(
        "GitHub returned an unexpected repository payload."
      );
    }

    for (const repository of page) {
      if (
        repository === null ||
        typeof repository !== "object" ||
        repository.private === true
      ) {
        continue;
      }

      repositories.push({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        htmlUrl: repository.html_url,
        description:
          repository.description ?? null,
        defaultBranch:
          repository.default_branch,
        archived:
          repository.archived === true,
        fork:
          repository.fork === true,
        updatedAt:
          repository.updated_at
      });
    }

    url = nextPageUrl(
      response.headers.get("link")
    );
  }

  return repositories;
}

async function publicRepositoryPayload() {
  const now = Date.now();

  if (
    cachedResponse !== null &&
    now - cachedAt <
      CACHE_DURATION_MS
  ) {
    return {
      ...cachedResponse,
      cache: "hit"
    };
  }

  const {
    owner,
    source
  } = await detectOwner();

  const repositories =
    await fetchPublicRepositories(
      owner
    );

  cachedResponse = {
    schemaVersion: 1,
    owner,
    ownerSource: source,
    fetchedAt:
      new Date().toISOString(),
    repositories
  };

  cachedAt = now;

  return {
    ...cachedResponse,
    cache: "miss"
  };
}


function parseRepositoryFullName(
  candidate
) {
  if (
    typeof candidate !== "string"
  ) {
    return null;
  }

  const match = candidate
    .trim()
    .match(
      /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/
    );

  if (match === null) {
    return null;
  }

  return {
    owner: match[1],
    name: match[2],
    fullName: `${match[1]}/${match[2]}`
  };
}

function githubRequestHeaders() {
  const token =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN;

  const headers = {
    "Accept":
      "application/vnd.github+json",

    "User-Agent":
      "bi-ble-formula-surface",

    "X-GitHub-Api-Version":
      "2022-11-28"
  };

  if (
    typeof token === "string" &&
    token !== ""
  ) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  return headers;
}

async function readGitHubJson(
  url
) {
  const response = await fetch(
    url,
    {
      headers:
        githubRequestHeaders()
    }
  );

  if (!response.ok) {
    let detail =
      `${response.status} ` +
      response.statusText;

    try {
      const body =
        await response.json();

      if (
        typeof body?.message ===
        "string"
      ) {
        detail = body.message;
      }
    } catch {
      // Retain the bounded HTTP detail.
    }

    throw new Error(
      `GitHub request failed: ${detail}`
    );
  }

  return response.json();
}

function firstMessageLine(
  message
) {
  if (
    typeof message !== "string"
  ) {
    return "(no commit message)";
  }

  const firstLine =
    message.split(/\r?\n/, 1)[0].trim();

  return firstLine === ""
    ? "(no commit message)"
    : firstLine;
}

async function publicRevisionPayload(
  repositoryCandidate
) {
  const repository =
    parseRepositoryFullName(
      repositoryCandidate
    );

  if (repository === null) {
    throw new Error(
      "Repository must use the owner/name form."
    );
  }

  const detectedOwner =
    await detectOwner();

  if (
    repository.owner.toLowerCase() !==
    detectedOwner.owner.toLowerCase()
  ) {
    throw new Error(
      "Repository owner does not match the " +
        "GitHub owner attached to this Codespace."
    );
  }

  const cacheKey =
    repository.fullName.toLowerCase();

  const cached =
    revisionCache.get(cacheKey);

  const now = Date.now();

  if (
    cached !== undefined &&
    now - cached.cachedAt <
      CACHE_DURATION_MS
  ) {
    return {
      ...cached.payload,
      cache: "hit"
    };
  }

  const encodedOwner =
    encodeURIComponent(
      repository.owner
    );

  const encodedName =
    encodeURIComponent(
      repository.name
    );

  const metadata =
    await readGitHubJson(
      "https://api.github.com/repos/" +
        `${encodedOwner}/${encodedName}`
    );

  if (
    metadata === null ||
    typeof metadata !== "object" ||
    metadata.private === true
  ) {
    throw new Error(
      "The selected repository is not public."
    );
  }

  const defaultBranch =
    typeof metadata.default_branch ===
    "string"
      ? metadata.default_branch
      : "";

  if (defaultBranch === "") {
    throw new Error(
      "The repository has no detectable default branch."
    );
  }

  const commits =
    await readGitHubJson(
      "https://api.github.com/repos/" +
        `${encodedOwner}/${encodedName}` +
        "/commits" +
        `?sha=${encodeURIComponent(defaultBranch)}` +
        "&per_page=40"
    );

  if (!Array.isArray(commits)) {
    throw new Error(
      "GitHub returned an unexpected revision payload."
    );
  }

  const revisions = commits.flatMap(
    (entry) => {
      if (
        entry === null ||
        typeof entry !== "object" ||
        typeof entry.sha !== "string"
      ) {
        return [];
      }

      const commit =
        entry.commit !== null &&
        typeof entry.commit === "object"
          ? entry.commit
          : {};

      const author =
        commit.author !== null &&
        typeof commit.author === "object"
          ? commit.author
          : {};

      const committer =
        commit.committer !== null &&
        typeof commit.committer === "object"
          ? commit.committer
          : {};

      const authorName =
        typeof author.name === "string"
          ? author.name
          : (
              typeof committer.name === "string"
                ? committer.name
                : (
                    entry.author !== null &&
                    typeof entry.author === "object" &&
                    typeof entry.author.login === "string"
                      ? entry.author.login
                      : "Unknown author"
                  )
            );

      const committedAt =
        typeof committer.date === "string"
          ? committer.date
          : (
              typeof author.date === "string"
                ? author.date
                : ""
            );

      return [
        {
          sha: entry.sha,
          shortSha:
            entry.sha.slice(0, 7),

          summary: firstMessageLine(
            commit.message
          ),

          author: authorName,
          committedAt,

          htmlUrl:
            typeof entry.html_url === "string"
              ? entry.html_url
              : ""
        }
      ];
    }
  );

  const payload = {
    schemaVersion: 1,
    repository:
      repository.fullName,

    defaultBranch,
    fetchedAt:
      new Date().toISOString(),

    revisions
  };

  revisionCache.set(
    cacheKey,
    {
      cachedAt: now,
      payload
    }
  );

  return {
    ...payload,
    cache: "miss"
  };
}

const server = createServer(
  async (
    request,
    response
  ) => {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${host}:${port}`
    );

    if (
      request.method !== "GET"
    ) {
      sendJson(
        response,
        405,
        {
          error: "method_not_allowed"
        }
      );

      return;
    }

    if (
      requestUrl.pathname ===
      "/health"
    ) {
      sendJson(
        response,
        200,
        {
          status: "ok",
          service:
            "github-public-repositories",
          port
        }
      );

      return;
    }

    if (
      requestUrl.pathname ===
      "/api/github/public-repositories"
    ) {
      try {
        const payload =
          await publicRepositoryPayload();

        sendJson(
          response,
          200,
          payload
        );
      } catch (error) {
        sendJson(
          response,
          502,
          {
            error:
              "repository_discovery_failed",

            message:
              error instanceof Error
                ? error.message
                : "Repository discovery failed."
          }
        );
      }

      return;
    }

    if (
      requestUrl.pathname ===
      "/api/github/public-revisions"
    ) {
      try {
        const repository =
          requestUrl.searchParams.get(
            "repository"
          ) ?? "";

        const payload =
          await publicRevisionPayload(
            repository
          );

        sendJson(
          response,
          200,
          payload
        );
      } catch (error) {
        sendJson(
          response,
          502,
          {
            error:
              "revision_discovery_failed",

            message:
              error instanceof Error
                ? error.message
                : "Revision discovery failed."
          }
        );
      }

      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname ===
        "/api/github/public-commit-evidence"
    ) {
      const repository =
        requestUrl.searchParams.get(
          "repository"
        ) ?? "";

      const revision =
        requestUrl.searchParams.get(
          "revision"
        ) ?? "";

      try {
        const evidence =
          await loadPublicCommitEvidence({
            repository,
            revision,
            token: process.env.GITHUB_TOKEN
          });

        sendJson(
          response,
          200,
          {
            schemaVersion: 1,
            fetchedAt:
              new Date().toISOString(),
            evidence
          }
        );
      } catch (error) {
        sendJson(
          response,
          400,
          {
            schemaVersion: 1,
            message:
              error instanceof Error
                ? error.message
                : "Commit evidence could not be loaded."
          }
        );
      }

      return;
    }



    sendJson(
      response,
      404,
      {
        error: "not_found"
      }
    );
  }
);

server.listen(
  port,
  host,
  () => {
    console.log(
      `GitHub public repository adapter ` +
        `running at http://${host}:${port}`
    );
  }
);
