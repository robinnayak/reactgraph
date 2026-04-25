# ReactGraph Agent Skills

## File Update Discipline
- Prefer updating an existing file over creating a second file with similar purpose.
- Before creating a new file, confirm there is not already a canonical location for that logic or documentation.

## Validation Workflow
- After making changes, use the required command sequence from `docs/agent.md`.
- If a command fails, fix the problem, rerun the command, and continue until the full validation flow is complete or an external environment issue blocks progress.

## Windows Build Stability
- Watch for `EPERM`, file-lock, and process-spawn issues in OneDrive-backed folders.
- Prefer resilient cleanup logic with retries for generated `dist` folders when Windows locks can occur.
- Keep build fixes narrowly scoped so local package builds remain reproducible without changing app behavior.

## Documentation Hygiene
- Keep agent instructions concise, actionable, and specific to this repo.
- Update `docs/agent.md` when required workflows change.
