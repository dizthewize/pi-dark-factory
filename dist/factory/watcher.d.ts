import { FactoryTask } from "../types.js";
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
export declare function getQueuePath(factoryDir: string): string;
/**
 * Poll the manual queue file for new tasks.
 * Returns appended tasks (or empty array if nothing new).
 */
export declare function pollManualQueue(factoryDir: string): FactoryTask[] | null;
/**
 * Start a polling-based file watcher.
 * Returns a stop function.
 */
export declare function startFileWatcher(factoryDir: string, onTasks: (tasks: FactoryTask[]) => void, intervalMs?: number): {
    stop: () => void;
};
//# sourceMappingURL=watcher.d.ts.map