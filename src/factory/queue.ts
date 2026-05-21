import { FactoryTask } from "../types.js";

const PRIORITY_ORDER: Record<FactoryTask["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function pickNextTask(queue: FactoryTask[]): FactoryTask | null {
  const pending = queue
    .filter((t) => t.status === "pending")
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.startedAt ? new Date(a.startedAt).getTime() : 0) -
          (b.startedAt ? new Date(b.startedAt).getTime() : 0)
    );
  return pending[0] ?? null;
}

export function addTask(
  queue: FactoryTask[],
  task: Omit<FactoryTask, "cost" | "retryCount" | "status">
): FactoryTask {
  const full: FactoryTask = {
    ...task,
    status: "pending",
    cost: 0,
    retryCount: 0,
  };
  queue.push(full);
  return full;
}

export function removeTask(queue: FactoryTask[], taskId: string): boolean {
  const idx = queue.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  return true;
}
