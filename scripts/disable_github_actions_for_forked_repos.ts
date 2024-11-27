import { Octokit } from "octokit";

// Setup Octokit (GH) client
const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
const commonHeaders = { "X-GitHub-Api-Version": "2022-11-28" };

// Login
const {
  data: { login },
} = await octokit.rest.users.getAuthenticated();

// Get all personal repos
const forkedRepoData = (
  await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    username: login,
    headers: commonHeaders,
  })
)
  .filter(({ fork, default_branch }) => fork && default_branch)
  .map((repoData) => ({
    id: repoData.id.toString(),
    name: repoData.name,
    full_name: repoData.full_name,
    default_fork_branch: repoData.default_branch,
  }));

console.log(forkedRepoData);

// Disable GH action for forked repos
for (const repoData of forkedRepoData) {
  try {
    console.log(
      `[INFO] Disabling GitHub Actions runner for ${repoData.full_name}...`,
    );
    await octokit.request("PUT /repos/{owner}/{repo}/actions/permissions", {
      owner: login,
      repo: repoData.name,
      enabled: false,
      headers: commonHeaders,
    });
    console.log(
      `[INFO] ✅ Disable GitHub Actions runner for ${repoData.full_name}`,
    );
    console.log();
  } catch (e) {
    console.log(
      `[ERROR] ❌ Error disabling GitHub Actions runner for ${repoData.full_name}: ${e}`,
    );
    console.log();
  }
}
