/**
 * Mesh inbox trigger for dark-factory.
 * Reads mesh inbox messages that contain task directives.
 */
const TASK_PREFIX = /^(TASK|FACTORY):\s*/i;
/**
 * Parse a mesh message body for task directives.
 * Supports formats:
 *   TASK: Add OAuth login
 *   FACTORY: Review PR #123
 */
export function parseMeshTask(message) {
    const match = message.body.match(TASK_PREFIX);
    if (!match)
        return null;
    const directive = message.body.slice(match[0].length).trim();
    // First line is title, rest is description
    const lines = directive.split("\n");
    const title = lines[0].trim();
    const description = lines.slice(1).join("\n").trim() || title;
    // Infer priority from keywords
    const lower = directive.toLowerCase();
    let priority = "medium";
    if (lower.includes("critical") || lower.includes("urgent") || lower.includes("hotfix")) {
        priority = "critical";
    }
    else if (lower.includes("high") || lower.includes("important")) {
        priority = "high";
    }
    else if (lower.includes("low")) {
        priority = "low";
    }
    return {
        id: `MESH-${message.id.slice(0, 8)}`,
        source: "mesh",
        title,
        description,
        priority,
        status: "pending",
        cost: 0,
        retryCount: 0,
    };
}
/**
 * Scan mesh inbox messages for task directives.
 * Returns new tasks not in the known set.
 */
export function scanMeshInbox(messages, knownIds) {
    const tasks = [];
    for (const msg of messages) {
        if (knownIds.has(`MESH-${msg.id.slice(0, 8)}`))
            continue;
        const task = parseMeshTask(msg);
        if (task)
            tasks.push(task);
    }
    return tasks;
}
//# sourceMappingURL=mesh-inbox.js.map