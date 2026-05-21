const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};
export function pickNextTask(queue) {
    const pending = queue
        .filter((t) => t.status === "pending")
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.startedAt ? new Date(a.startedAt).getTime() : 0) -
            (b.startedAt ? new Date(b.startedAt).getTime() : 0));
    return pending[0] ?? null;
}
export function addTask(queue, task) {
    const full = {
        ...task,
        status: "pending",
        cost: 0,
        retryCount: 0,
    };
    queue.push(full);
    return full;
}
export function removeTask(queue, taskId) {
    const idx = queue.findIndex((t) => t.id === taskId);
    if (idx === -1)
        return false;
    queue.splice(idx, 1);
    return true;
}
//# sourceMappingURL=queue.js.map