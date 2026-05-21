# pi-dark-factory Trigger Integrations

## 1. Cron / Systemd Timer (One-Shot Mode)

### GitHub Actions

```yaml
# .github/workflows/dark-factory.yml
name: Dark Factory
on:
  schedule:
    - cron: '0 */4 * * *'   # Every 4 hours
  workflow_dispatch:         # Manual trigger

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Setup Pi
        run: |
          # Install pi CLI
          curl -fsSL https://install.pi.sh | sh
      - name: Run one-shot factory
        run: |
          pi -p --no-session --no-tools \
            "pi_factory({ action: 'oneshot', maxCycles: 5, costLimit: 20 })"
        env:
          PI_API_KEY: ${{ secrets.PI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Systemd Timer (Linux)

```ini
# ~/.config/systemd/user/pi-factory.service
[Unit]
Description=Dark Factory One-Shot Runner
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pi -p --no-session "pi_factory({ action: 'oneshot', maxCycles: 5 })"
WorkingDirectory=%h/projects/my-app
Environment="PI_API_KEY=%h/.config/pi/api-key"
Environment="GITHUB_TOKEN=%h/.config/pi/github-token"
```

```ini
# ~/.config/systemd/user/pi-factory.timer
[Unit]
Description=Dark Factory Schedule

[Timer]
OnCalendar=*-*-* */4:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Setup commands
systemctl --user daemon-reload
systemctl --user enable pi-factory.timer
systemctl --user start pi-factory.timer
systemctl --user list-timers --all  # Verify
```

### Cron Tab (Universal)

```bash
# crontab -e
# Every 4 hours, run up to 5 cycles with $20 cost cap
0 */4 * * * cd ~/projects/my-app && pi -p --no-session "pi_factory({ action: 'oneshot', maxCycles: 5, costLimit: 20 })" >> ~/.pi/agent/factory/cron.log 2>&1
```

---

## 2. File Watcher Trigger

### How It Works

While `/factory start` is running (continuous mode), a polling file watcher monitors `~/.pi/agent/factory/queue.manual.json`.

Any process can append tasks:

```bash
# From a deploy script
jq -n '{ append: [{ title: "Update auth", description: "Migrate to OAuth 2.0", priority: "high" }] }' > ~/.pi/agent/factory/queue.manual.json
```

```typescript
// From another Pi session
// Just write JSON to the file — no tool call needed
fs.writeFileSync(
  path.join(os.homedir(), ".pi", "agent", "factory", "queue.manual.json"),
  JSON.stringify({
    append: [
      { title: "Fix bug", description: "Issue #123", priority: "critical", roleId: "bug-reproducer" }
    ]
  })
);
```

### Queue File Format

```json
{
  "append": [
    {
      "id": "optional-custom-id",
      "title": "Task title",
      "description": "What to do",
      "priority": "critical|high|medium|low",
      "roleId": "optional-role-for-execution"
    }
  ]
}
```

The factory reads the file, clears it, and processes the tasks.

---

## 3. GitHub Issue Source

### Configuration

Create `~/.pi/agent/factory/github-config.json`:

```json
{
  "repo": "my-org/my-project",
  "label": "pi-factory",
  "token": "ghp_..."
}
```

Or set `GITHUB_TOKEN` env variable and omit the token field.

### How It Works

During every cycle, the factory polls GitHub for open issues with the configured label. Each new issue becomes a factory task.

**Issue formatting:**
- Title → `FactoryTask.title`
- Body → `FactoryTask.description`
- Labels → priority inference (`critical`, `high`, `medium`, `low`)

**Label priority mapping:**
- `critical` or `p0` → critical
- `high` or `p1` → high
- `medium` or `p2` → medium
- default → low

### Example Issue

```markdown
Feature: Add dark mode

## Description
Add system-level dark mode toggle to the settings page.

## Acceptance Criteria
- Toggle in /settings/appearance
- CSS variables update correctly
- Persist preference in localStorage
```

With label `pi-factory` → automatically queued as `GH-42`.

---

## 4. Mesh Inbox Trigger

### How It Works

Any mesh agent can send a task to the factory:

```typescript
pi_mesh({
  action: "send",
  to: "dark-factory",  // or use the factory agent's mesh name
  message: "TASK: Add OAuth login\n\nWe need Google and GitHub OAuth for the new landing page."
});
```

The factory scans inbox messages every cycle. Messages starting with `TASK:` or `FACTORY:` are parsed into tasks.

**Priority inference from message keywords:**
- `critical`, `urgent`, `hotfix` → critical
- `high`, `important` → high
- `low` → low
- default → medium

### Mesh Task Format

```
TASK: Brief title
Description on second line and beyond.
```

---

## Trigger Priority

When multiple triggers fire simultaneously, tasks are processed in this order:

1. **File watcher** (highest — direct user intent)
2. **GitHub issues** (medium — external work tracking)
3. **Mesh inbox** (medium — peer agent requests)
4. **Manual queue_add** (lowest — already in state)

All tasks are added to the queue before cycle execution. Priority sorting in `pickNextTask()` determines which runs first.
