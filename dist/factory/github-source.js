/**
 * GitHub issue source for dark-factory queue.
 * Fetches issues with a specific label and converts them to FactoryTasks.
 */
export async function fetchFactoryIssues(config) {
    const token = config.token ?? process.env.GITHUB_TOKEN;
    if (!token)
        throw new Error("GITHUB_TOKEN required for GitHub issue source");
    const url = `https://api.github.com/repos/${config.repo}/issues?labels=${encodeURIComponent(config.label)}&state=open`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const issues = (await res.json());
    // Filter out pull requests (they appear in issues endpoint)
    return issues.filter((i) => !i.html_url.includes("/pull/"));
}
function inferPriority(labels) {
    const l = labels.map((x) => x.toLowerCase());
    if (l.includes("critical") || l.includes("p0"))
        return "critical";
    if (l.includes("high") || l.includes("p1"))
        return "high";
    if (l.includes("medium") || l.includes("p2"))
        return "medium";
    return "low";
}
export function issueToTask(issue) {
    const labelNames = issue.labels.map((l) => l.name);
    return {
        id: `GH-${issue.number}`,
        source: "github-issue",
        title: issue.title,
        description: issue.body ?? "",
        priority: inferPriority(labelNames),
        status: "pending",
        cost: 0,
        retryCount: 0,
    };
}
export async function pollGitHubIssues(config, knownIds) {
    const issues = await fetchFactoryIssues(config);
    return issues
        .filter((i) => !knownIds.has(`GH-${i.number}`))
        .map(issueToTask);
}
//# sourceMappingURL=github-source.js.map