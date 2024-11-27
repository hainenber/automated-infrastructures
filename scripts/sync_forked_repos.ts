import { Octokit } from "octokit";
import type { Endpoints } from "@octokit/types";

// Repos blacklisted from upstream synchronization due to diversion
const blacklisted = [
  603697162, // prometheus/procfs
  592268321, // VictoriaMetrics/ansible-victoriametrics
];

// Types and interfaces
interface ForkedRepoData {
  id: string;
  name: string;
  full_name: string;
  default_fork_branch: string;
}

interface UpstreamRepoData {
  id: string;
  upstream?: string;
  default_upstream_branch: string;
}

type MergedRepoData = ForkedRepoData & UpstreamRepoData;
type ComparedCommitData =
  Endpoints["GET /repos/{owner}/{repo}/compare/{basehead}"]["response"][
    "data"
  ][];

// Setup Octokit (GH) client
const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
const commonHeaders = { "X-GitHub-Api-Version": "2022-11-28" };

// Login
const {
  data: { login },
} = await octokit.rest.users.getAuthenticated();

// Get all personal repos
const forkedRepoData: ForkedRepoData = (
  await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    username: login,
    headers: commonHeaders,
  })
)
  .filter(
    ({ fork, id, name }) =>
      fork && !blacklisted.includes(id) && name === "kestra",
  )
  .map((repoData) => ({
    id: repoData.id,
    name: repoData.name,
    full_name: repoData.full_name,
    default_fork_branch: repoData.default_branch,
  }))
  .reduce((acc, val) => ({ [val.id]: val, ...acc }), {} as ForkedRepoData);

// Get upstreams for forked repos
const upstreamGitUrls: UpstreamRepoData = (
  await Promise.all(
    Object.values(forkedRepoData).map(
      async (repoData) =>
        await octokit.request("GET /repos/{owner}/{repo}", {
          owner: login,
          repo: repoData.name,
          headers: commonHeaders,
        }),
    ),
  )
)
  .map((repoData) => ({
    id: repoData["data"]["id"],
    upstream: repoData.data.parent?.full_name,
    default_upstream_branch: repoData.data.parent?.default_branch,
  }))
  .reduce((acc, val) => ({ [val.id]: val, ...acc }), {} as UpstreamRepoData);

// Merge data about upstream origin to their forks
const mergedGitData: MergedRepoData[] = [];
for (const id of Object.keys(forkedRepoData)) {
  if (id in upstreamGitUrls) {
    mergedGitData.push({
      ...forkedRepoData[id],
      ...upstreamGitUrls[id],
    });
  }
}

// Fetch commits behind upstream for each forked repos
const commitsBehindUpstream: ComparedCommitData[] = await Promise.all(
  mergedGitData.map(
    async (forkedRepoData) =>
      (await octokit.paginate(octokit.rest.repos.compareCommitsWithBasehead, {
        owner: login,
        repo: forkedRepoData.full_name.split("/")[1],
        per_page: 100,
        basehead: `${forkedRepoData.default_fork_branch}...${
          forkedRepoData.upstream?.replace("/", ":")
        }:${forkedRepoData.default_upstream_branch}`,
      })) as ComparedCommitData,
  ),
);

// List out commits and perform sync
for (const rawCommitData of commitsBehindUpstream) {
  let commitMessages: string[] = [];
  let forkedRepoUrl: string = "";
  let forkedRepoName: string = "";
  let forkedRepoBranch: string = "";
  for (const commitData of rawCommitData) {
    commitMessages = commitMessages.concat(
      commitData.commits.map((i) => i.commit.message.split("\n")[0]),
    );
    forkedRepoUrl = forkedRepoUrl === ""
      ? commitData.html_url.split("/compare/")[0]
      : forkedRepoUrl;
    const proposedForkedRepoName = forkedRepoUrl.split("/");
    forkedRepoName = forkedRepoName === ""
      ? proposedForkedRepoName[proposedForkedRepoName.length - 1]
      : forkedRepoName;
    forkedRepoBranch = forkedRepoBranch === ""
      ? commitData.html_url.split("/compare/")[1].split("...")[0]
      : forkedRepoBranch;
  }
  console.log(`✅ ${forkedRepoUrl}`);
  console.group();
  for (const [index, commitMesage] of commitMessages.entries()) {
    console.log(`${index + 1}. ${commitMesage}`);
  }
  console.groupEnd();

  try {
    console.log(`[INFO] Synchronizing ${forkedRepoUrl}...`);
    await octokit.request("POST /repos/{owner}/{repo}/merge-upstream", {
      owner: login,
      repo: forkedRepoName,
      branch: forkedRepoBranch,
      headers: commonHeaders,
    });
    console.log(`[INFO] ✅ Done synchronizing upstream to ${forkedRepoUrl}`);
  } catch (e) {
    console.log(
      `[ERROR] ❌ Error synchronizing upstream to ${forkedRepoUrl}: ${e}`,
    );
    throw e;
  } finally {
    console.log();
    console.log();
  }
}
