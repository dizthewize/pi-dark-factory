/**
 * GitHub issue source for dark-factory queue.
 * Fetches issues with a specific label and converts them to FactoryTasks.
 */
import { FactoryTask } from "../types.js";
export interface GitHubIssue {
    number: number;
    title: string;
    body: string;
    labels: Array<{
        name: string;
    }>;
    html_url: string;
}
export interface GitHubSourceConfig {
    repo: string;
    label: string;
    token?: string;
}
export declare function fetchFactoryIssues(config: GitHubSourceConfig): Promise<GitHubIssue[]>;
export declare function issueToTask(issue: GitHubIssue): FactoryTask;
export declare function pollGitHubIssues(config: GitHubSourceConfig, knownIds: Set<string>): Promise<FactoryTask[]>;
//# sourceMappingURL=github-source.d.ts.map