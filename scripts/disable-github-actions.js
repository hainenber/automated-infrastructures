import { Octokit } from 'octokit';

// Repos blacklisted from upstream synchronization due to diversion
const blacklisted = [
    603697162, // prometheus/procfs
    592268321, // VictoriaMetrics/ansible-victoriametrics
];

(async () => {
    // Setup Octokit (GH) client
    const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
    const commonHeaders = {  'X-GitHub-Api-Version': '2022-11-28' };

    // Login
    const { data: { login }} = await octokit.rest.users.getAuthenticated();

    // Get all personal repos
    const forkedRepoData = (await octokit.paginate('GET /users/{username}/repos', {
        username: login,
        headers: commonHeaders,
    }))
    .filter(repoData => repoData['fork'] === true && !blacklisted.includes(repoData['id']))
    .map(repoData => ({
        id: repoData['id'],
        name: String(repoData['name']),
        full_name: String(repoData['full_name']),
        default_fork_branch: String(repoData['default_branch']),
    }))

    // Disable GH action for forked repos 
    for (const repoData of forkedRepoData) {
        try {
            await octokit.request('PUT /repos/{owner}/{repo}/actions/permissions', {
                owner: login,
                repo: repoData.name,
                enabled: false,
                headers: commonHeaders,
            });
            console.log(`[INFO] ✅ Disable GitHub Actions runner for ${repoData.full_name}`)
        } catch (e) {
            console.log(`[ERROR] ❌ Error disabling GitHub Actions runner for ${repoData.full_name}: ${e}`)
        }
    }
})();