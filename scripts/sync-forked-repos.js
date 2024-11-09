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
    .reduce((acc, val) => ({ [val.id]: val, ...acc }), {});

    // Get upstreams for forked repos
    const upstreamGitUrls = (await Promise.all(
        Object.values(forkedRepoData).map(async repoData => await octokit.request(
            'GET /repos/{owner}/{repo}', {
                owner: login,
                repo: repoData.name,
                headers: commonHeaders,
            }
        ))
    ))
    .map(repoData => ({
        id: repoData['data']['id'],
        upstream: repoData['data']['parent']['full_name'],
        default_upstream_branch: repoData['data']['parent']['default_branch'],
    }))
    .reduce((acc, val) => ({ [val.id]: val, ...acc }), {})

    // Merge data about upstream origin to their forks 
    const mergedGitData = []
    for (const id of Object.keys(forkedRepoData)) {
        if (id in upstreamGitUrls) {
            mergedGitData.push({
                ...forkedRepoData[id],
                ...upstreamGitUrls[id],
            })
        }
    }

    // Fetch commits behind upstream for each forked repos
    const commitsBehindUpstream = await Promise.all(
        mergedGitData.map(async forkedRepoData => await octokit.paginate(
            'GET /repos/{owner}/{repo}/compare/{basehead}', {
                owner: login,
                repo: forkedRepoData.full_name.split('/')[1],
                basehead: `${forkedRepoData.default_fork_branch}...${forkedRepoData.upstream.replace('/', ':')}:${forkedRepoData.default_upstream_branch}`
            })
        )
    )

    // List out commits and perform sync 
    for (const rawCommitData of commitsBehindUpstream) {
        const commitData = rawCommitData[0]
        const commitMessages = commitData['commits'].map(i => i['commit']['message'].split('\n')[0])
        const forkedRepoUrl = commitData['html_url'].split('/compare/')[0]
        const forkedRepoName = commitData['html_url'].split('/compare/')[0].split('/').at(-1)
        const forkedRepoBranch = commitData['html_url'].split('/compare/')[1].split('...')[0]
        console.log(`✅ ${forkedRepoUrl}`)
        console.group()
        for (const [index, commitMesage] of commitMessages.entries()) {
            console.log(`${index+1}. ${commitMesage}`)
        }
        console.groupEnd()

        console.log()
        try {
           console.log(`[INFO] Synchronizing ${forkedRepoUrl}...`)
           await octokit.request(
            'POST /repos/{owner}/{repo}/merge-upstream', {
                owner: login,
                repo: forkedRepoName,
                branch: forkedRepoBranch,
                headers: commonHeaders,
            }
           );
            console.log(`[INFO] ✅ Done synchronizing upstream to ${forkedRepoUrl}`)
        } catch (e) {
            console.log(`[ERROR] ❌ Error synchronizing upstream to ${forkedRepoUrl}: ${e}`)
            throw e;
        }
    }
})();
