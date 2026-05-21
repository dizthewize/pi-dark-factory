import { FactoryTask } from "../types.js";
export declare function pickNextTask(queue: FactoryTask[]): FactoryTask | null;
export declare function addTask(queue: FactoryTask[], task: Omit<FactoryTask, "cost" | "retryCount" | "status">): FactoryTask;
export declare function removeTask(queue: FactoryTask[], taskId: string): boolean;
//# sourceMappingURL=queue.d.ts.map