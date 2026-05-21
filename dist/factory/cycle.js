import * as path from "node:path";
import { pickNextTask, removeTask } from "./queue.js";
import { appendLedger } from "./ledger.js";
export async function runOneCycle(deps) {
    const state = deps.stateStore.load();
    // Cost cap check
    if (state.totalCost >= state.costLimit) {
        state.status = "cost_exceeded";
        deps.stateStore.save(state);
        return { state, didWork: false };
    }
    if (state.status === "paused" || state.status === "blocked") {
        return { state, didWork: false };
    }
    // Stop requested
    if (state.status === "complete" || state.status === "failed") {
        return { state, didWork: false };
    }
    state.cycle++;
    state.status = "working";
    state.lastRunAt = new Date().toISOString();
    const task = pickNextTask(state.queue);
    if (!task) {
        state.status = state.completed.length > 0 ? "complete" : "idle";
        deps.stateStore.save(state);
        return { state, didWork: false };
    }
    state.currentTaskId = task.id;
    task.status = "planning";
    task.startedAt = new Date().toISOString();
    // PLAN
    const planResult = await runPlanner(task, deps);
    if (!planResult.ok) {
        task.status = "blocked";
        task.blockReason = `Planning failed: ${planResult.error}`;
        state.blocked.push(task);
        removeTask(state.queue, task.id);
        appendLedger(state, {
            action: "block",
            taskId: task.id,
            cost: 0,
            notes: `Planning failed: ${planResult.error}`,
        });
        deps.stateStore.save(state);
        return { state, didWork: true };
    }
    // EXECUTE
    task.status = "executing";
    deps.stateStore.save(state); // checkpoint
    const execResult = await runExecutor(task, deps);
    if (!execResult.ok) {
        // Retry logic (Q7: retry once, then with reviewer, then block)
        if (task.retryCount < 1) {
            task.retryCount++;
            task.status = "pending";
            appendLedger(state, {
                action: "retry",
                taskId: task.id,
                cost: execResult.cost ?? 0,
                notes: `Retry ${task.retryCount}: ${execResult.error}`,
            });
            deps.stateStore.save(state);
            return { state, didWork: true };
        }
        else if (task.retryCount < 2) {
            // Second retry: try with reviewer assistance (if pi-agent-roles available)
            task.retryCount++;
            if (deps.piAgentRoles?.dispatch) {
                task.status = "reviewing";
                deps.stateStore.save(state);
                const reviewRes = await deps.piAgentRoles.dispatch({
                    roleId: "code-reviewer",
                    task: `Task ${task.id} failed twice. Review the plan and suggest fixes. Plan: ${task.planPath ?? "n/a"}`,
                    mode: "blocking",
                });
                // Apply review suggestion and retry
                appendLedger(state, {
                    action: "review",
                    taskId: task.id,
                    cost: 0,
                    notes: `Reviewer suggested: ${reviewRes.output?.slice(0, 200) ?? "no output"}`,
                });
            }
            task.status = "pending";
            appendLedger(state, {
                action: "retry",
                taskId: task.id,
                cost: execResult.cost ?? 0,
                notes: `Retry ${task.retryCount} with reviewer: ${execResult.error}`,
            });
            deps.stateStore.save(state);
            return { state, didWork: true };
        }
        task.status = "failed";
        task.finishedAt = new Date().toISOString();
        state.failed.push(task);
        removeTask(state.queue, task.id);
        state.totalCost += execResult.cost ?? 0;
        appendLedger(state, {
            action: "fail",
            taskId: task.id,
            cost: execResult.cost ?? 0,
            notes: execResult.error,
        });
        deps.stateStore.save(state);
        return { state, didWork: true };
    }
    // SUCCESS
    task.status = "complete";
    task.finishedAt = new Date().toISOString();
    task.cost = execResult.cost ?? 0;
    state.totalCost += task.cost;
    state.completed.push(task);
    removeTask(state.queue, task.id);
    appendLedger(state, {
        action: "complete",
        taskId: task.id,
        cost: task.cost,
        notes: `Completed via ${task.planPath ? "plan" : "direct tasks"}`,
    });
    // Publish project state to mesh
    if (deps.piMesh?.setProjectState) {
        await deps.piMesh
            .setProjectState({
            ext: "pi-dark-factory",
            data: {
                cycle: state.cycle,
                totalCost: state.totalCost,
                completedCount: state.completed.length,
                currentTask: task.id,
            },
        })
            .catch(() => { }); // best effort
    }
    state.currentTaskId = undefined;
    state.status = state.queue.length > 0 ? "working" : "complete";
    deps.stateStore.save(state);
    return { state, didWork: true };
}
async function runPlanner(task, deps) {
    const specPath = path.join(deps.factoryDir, `${task.id}-spec.md`);
    // If task has a plan file source, read and validate
    if (task.description.endsWith(".md") && task.source === "file") {
        task.planPath = task.description;
        return { ok: true };
    }
    // If pi-workflows plan available, use it
    if (deps.piWorkflows?.plan) {
        try {
            const prdPath = path.join(deps.factoryDir, `${task.id}-prd.md`);
            // Write PRD to file for plan_workflow input
            const fs = await import("node:fs");
            fs.writeFileSync(prdPath, `# ${task.title}\n\n${task.description}`, "utf-8");
            await deps.piWorkflows.plan({
                input: prdPath,
                output: specPath,
                name: task.title,
            });
            task.planPath = specPath;
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    }
    // If pi-agent-roles planner available, use it
    if (deps.piAgentRoles?.dispatch) {
        try {
            const res = await deps.piAgentRoles.dispatch({
                roleId: "planner",
                task: `Create a TASK-XX spec for: ${task.title}\n\n${task.description}`,
                mode: "blocking",
            });
            const fs = await import("node:fs");
            fs.writeFileSync(specPath, res.output ?? "", "utf-8");
            task.planPath = specPath;
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    }
    // Fallback: generate minimal Task[] directly
    const fs = await import("node:fs");
    fs.writeFileSync(specPath, `# ${task.title}\n\n## TASK-01: ${task.title}\nPriority: P1\nFiles: \nDepends on: none\nAcceptance: ${task.description}\n`, "utf-8");
    task.planPath = specPath;
    return { ok: true };
}
async function runExecutor(task, deps) {
    if (!deps.piWorkflows?.execute) {
        return { ok: false, error: "pi-workflows not available" };
    }
    try {
        const result = (await deps.piWorkflows.execute({
            name: task.id,
            plan: task.planPath,
            options: {
                maxParallel: 4,
                maxCost: Math.max(5, (deps.stateStore.load().costLimit - deps.stateStore.load().totalCost) / 2),
                meshPublish: true,
                failFast: false,
            },
        }));
        if (result.status === "failed" || result.status === "aborted") {
            return { ok: false, error: `Workflow returned ${result.status}`, cost: result.cost?.total };
        }
        return { ok: true, cost: result.cost?.total };
    }
    catch (err) {
        return { ok: false, error: String(err) };
    }
}
//# sourceMappingURL=cycle.js.map