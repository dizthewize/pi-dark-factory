import * as fs from "node:fs";
import * as path from "node:path";
import { FactoryTask } from "../types.js";
import { addTask } from "./queue.js";

export interface ManualQueueFile {
  append?: Array<{
    id?: string;
    title: string;
    description: string;
    priority?: "critical" | "high" | "medium" | "low";
    roleId?: string;
    source?: "github-issue" | "manual" | "mesh" | "file";
  }>;
  clearAfterRead?: boolean;
}

const MANUAL_QUEUE_FILE = "queue.manual.json";

export function getQueuePath(factoryDir: string): string {
  return path.join(factoryDir, MANUAL_QUEUE_FILE);
}

/**
 * Poll the manual queue file for new tasks.
 * Returns appended tasks (or empty array if nothing new).
 */
export function pollManualQueue(factoryDir: string): FactoryTask[] | null {
  const filePath = getQueuePath(factoryDir);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ManualQueueFile;
    if (!parsed.append?.length) return null;

    const tasks: FactoryTask[] = [];
    let counter = 0;
    for (const entry of parsed.append) {
      counter++;
      tasks.push({
        id: entry.id ?? `MAN-${Date.now().toString(36)}-${counter}`,
        source: entry.source ?? "file",
        title: entry.title,
        description: entry.description,
        priority: entry.priority ?? "medium",
        status: "pending",
        cost: 0,
        retryCount: 0,
        roleId: entry.roleId,
      });
    }

    // Clear the file after reading (preserve empty structure)
    fs.writeFileSync(filePath, JSON.stringify({ append: [], clearAfterRead: true }, null, 2), "utf-8");

    return tasks;
  } catch {
    return null;
  }
}

/**
 * Start a polling-based file watcher.
 * Returns a stop function.
 */
export function startFileWatcher(
  factoryDir: string,
  onTasks: (tasks: FactoryTask[]) => void,
  intervalMs = 5000
): { stop: () => void } {
  let timer: NodeJS.Timeout | null = null;
  let lastMtime = 0;
  const filePath = getQueuePath(factoryDir);

  const check = () => {
    try {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs <= lastMtime) return;
      lastMtime = stat.mtimeMs;
      const tasks = pollManualQueue(factoryDir);
      if (tasks && tasks.length > 0) {
        onTasks(tasks);
      }
    } catch { /* ignore */ }
  };

  timer = setInterval(check, intervalMs);
  // Immediate first check
  check();

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
