# ReactGraph Agent Rules

## Core Rules
- If a file already exists, update or fix that file instead of creating a duplicate.
- Keep changes minimal, targeted, and consistent with the existing codebase.
- Do not restructure working features unless a fix cannot be made safely in place.
- Reuse existing patterns, utilities, and naming before adding new abstractions.
- Prefer fixing the root cause over adding one-off workarounds when the scope is reasonable.

## Quality Expectations
- Preserve existing behavior unless the task explicitly asks for a behavior change.
- Validate changes with the project build and packaging commands after implementation.
- If a build or packaging command fails, fix the error and rerun the failed command.
- Avoid duplicate docs, duplicate components, and parallel versions of the same logic.
- Keep documentation updated when build steps, workflows, or agent behavior change.

## Required Command Sequence
Run these commands after completing changes:

```powershell
npm install
npm run build -- --force

cd packages/vscode
npm run package

cd "C:\Users\robin\OneDrive\Desktop\React graph\packages\core"
npm run build
npm link
```

## Build Notes
- `npm install` is optional when dependencies are already present and unchanged, but it is allowed when needed to restore a healthy workspace.
- When running commands from another directory, make sure the command executes in the intended package directory.
- If Windows, OneDrive, or file-lock issues appear, retry after fixing the underlying path, permission, or cleanup problem instead of skipping validation.

## Documentation Rule
- If a workflow, workaround, or agent-specific convention becomes important, document it in `docs/skills.md` so future runs can reuse it consistently.
