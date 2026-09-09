# AI Assistant Guide

> **Oh My Classic Cherry / my-classic-cherry (personal fork)**
>
> Personal Classic Cherry Studio build on the **v1** lineage. Not an upstream
> contribution branch.
>
> - **Never** open PRs, issues, or review requests against `CherryHQ/cherry-studio`.
> - Short-term product line: `v1` (+ `cursor/*` feature branches). Fork `main` may
>   track upstream v2 for reference only — do not treat it as the shipping line
>   unless the owner explicitly switches.
> - Keep official `appId` (`com.kangfenmao.CherryStudio`) so installs share the
>   existing data directory. Official auto-update feeds must stay disabled.
> - Focus: classic chat UX (incl. streaming fenced-code), model/provider updates on
>   the Vercel AI SDK stack, hide unwanted sidebar entries — not a general upstream
>   feature fork.
>
> `AGENTS.md` is a symlink to this file.

This file guides AI coding assistants in this repository.

## Guiding Principles (MUST FOLLOW)

- **Keep it clear**: Write code that is easy to read, maintain, and explain.
- **Match the house style**: Reuse existing patterns, naming, and conventions.
- **Search smart**: Prefer `ast-grep` for semantic queries; fall back to `rg`/`grep` when needed.
- **Log centrally**: Route all logging through `loggerService` with the right context—no `console.log`.
- **Research via subagent**: Lean on `subagent` for external docs, APIs, and references.
- **Always propose before executing**: Before making any changes, clearly explain the planned approach and wait for explicit user approval.
- **Check what you changed**: Run lint / format / tests that cover the touched area (e.g. `pnpm lint` when broad, or targeted `vitest` / `pnpm test:renderer`). Full `pnpm test` only when the change is wide or risk is unclear.
- **Write conventional commits**: Small, focused Conventional Commit messages (e.g. `feat(models):`, `fix(chat):`). Scope should be a specific kebab-case module when practical.
  - Upstream Cherry Studio additionally expects cryptographically signed commits and DCO (`git commit -S --signoff`). This personal fork only requires conventional commits; use `-S` / `--signoff` only if the owner asks.

## Pull Requests (this fork only)

- Never target `CherryHQ/cherry-studio`.
- PRs stay on `Tsudrat/cherry-studio` (or the current fork remote), base = `v1` (or the active personal long-lived branch).
- Prefer feature branches + PR over committing straight to `v1` when the change is non-trivial.

## Review Workflow

When reviewing a Pull Request, do **not** re-run `pnpm lint` / `pnpm test` / `pnpm format` locally — use CI via GitHub CLI:

- `gh pr checks <PR_NUMBER>`
- `gh pr view <PR_NUMBER>`
- `gh run view <RUN_ID> --log-failed`

Investigate failures from logs, not by blindly re-running the full suite locally.

## Issues

Do not open issues on `CherryHQ/cherry-studio`. Fork-only notes/issues are fine if wanted.

## Branch & upstream sync

- **Shipping line (near term):** `v1` + personal patches. That may change later; until then, do not productize on fork `main` / upstream `v2` without an explicit decision.
- **Upstream remote:** keep `upstream` → `CherryHQ/cherry-studio` for occasional security / critical fixes.
- **Do not blind-sync.** Prefer fetch + selective cherry-pick / careful merge of specific commits. Personalized files (this guide, OMCC workflows, app branding/version) will conflict or diverge — resolve deliberately.
- Do not push personal product changes upstream.

## Development Commands

- **Install**: `pnpm install` (Node / pnpm versions pinned in `package.json`)
- **Dev**: `pnpm dev` · **Debug**: `pnpm debug` (CDP `9222`)
- **Build**: `pnpm build` · local Mac arm64: `pnpm build:mac:arm64` · OMCC Release workflow: manual Actions only
- **Lint / format / typecheck**: `pnpm lint` · `pnpm format` · `pnpm typecheck`
- **Test**: `pnpm test` · `pnpm test:main` · `pnpm test:renderer` · `pnpm test:aicore` · `pnpm test:watch`
- **i18n**: `pnpm i18n:sync` · `pnpm i18n:check` · `pnpm i18n:translate`
- **Bundle**: `pnpm analyze:renderer` · `pnpm analyze:main`

## Project Architecture

### Electron Structure

```
src/
  main/          # Electron main (Node)
  renderer/      # React UI
  preload/       # contextBridge IPC
packages/
  aiCore/        # @cherrystudio/ai-core
  shared/        # cross-process types / IPC channels
  mcp-trace/     # OpenTelemetry for MCP
  ai-sdk-provider/
  extension-table-plus/
```

### Key Path Aliases

| Alias                   | Resolves To                      |
| ----------------------- | -------------------------------- |
| `@main`                 | `src/main/`                      |
| `@renderer`             | `src/renderer/src/`              |
| `@shared`               | `packages/shared/`               |
| `@types`                | `src/renderer/src/types/`        |
| `@logger`               | LoggerService (main or renderer) |
| `@cherrystudio/ai-core` | `packages/aiCore/src/`           |

### Main Process (`src/main/`)

Notable services: `WindowService`, `MCPService`, `KnowledgeService`, `LoggerService`, `StoreSyncService`, `BackupManager`, `ApiServerService`, `AppUpdater` (disabled for official feeds in this fork), `ShortcutService`, `ThemeService`, `SelectionService`, `CopilotService`, `PythonService`, `NodeTraceService`.

There is also an **Agents** subsystem under `src/main/services/agents/` (Drizzle / LibSQL). This personal build does not use it day-to-day; avoid expanding it unless asked. Prefer not to invest in Agents DB tooling.

### Renderer Process (`src/renderer/src/`)

```
aiCore/       # legacy pipeline (prefer packages/aiCore)
api/          # typed IPC wrappers
components/   # Ant Design 5 + styled-components + Tailwind v4
databases/    # Dexie (IndexedDB)
hooks/ pages/ services/ store/ types/ workers/ windows/
```

### Redux (`src/renderer/src/store/`)

Slices include `assistants`, `settings`, `llm`, `mcp`, `messageBlock`, `knowledge`, `paintings`, `memory`, `websearch`, `shortcuts`, `tabs` (redux-persist). Prefer not to add slices or reshape persisted state casually — migrations and upstream sync get harder.

### Database

- **IndexedDB (Dexie)** — topics, files, message_blocks, etc. Prefer additive, careful upgrades.
- **SQLite (agents)** — present for Agents; unused for this product focus.

### IPC

- Channels: `packages/shared/IpcChannel.ts`
- Renderer → Main: `window.api` / preload wrappers
- Main → Renderer: `webContents.send`
- Optional trace context via `tracedInvoke()`

### AI Core (`packages/aiCore/`)

Vercel AI SDK–based provider hub (`HubProvider`), middleware, plugins, runtime, options. Model capability heuristics (vision, reasoning, logos) live largely under `src/renderer/src/config/models/`.

### Multi-Window

Entry HTML: `index.html`, `miniWindow.html`, `selectionToolbar.html`, `selectionAction.html`, `traceWindow.html`.

### Logging

```typescript
import { loggerService } from "@logger";
const logger = loggerService.withContext("moduleName");
// Renderer: loggerService.initWindowSource('windowName') first
logger.info("message", CONTEXT);
logger.error("message", error);
```

Never `console.log` for app logging.

## Tech Stack (summary)

Electron · React 19 · TypeScript · Ant Design 5 · Redux Toolkit · Dexie · Vercel AI SDK (`ai` + `@cherrystudio/ai-core`) · electron-vite · Vitest · ESLint / oxlint / Biome · i18next

## Conventions

- **TypeScript**: strict; `tsgo`; `tsconfig.node.json` / `tsconfig.web.json`
- **Style**: Biome (2-space, single quotes); oxlint + ESLint; `simple-import-sort`
- **Files**: components `PascalCase.tsx`; utils/hooks `camelCase.ts`; tests `*.test.ts` / `*.spec.ts`
- **i18n**: no hardcoded UI strings; locales under `src/renderer/src/i18n/`
- **Patches**: check `patches/` before upgrading listed dependencies

## Testing

Vitest projects: main / renderer / aiCore / shared. Prefer tests that assert the contract for the change you made; skip behavior-pinning noise when editing a file. Broad new features should still get meaningful coverage when practical.

## Upstream / v2 notes

Upstream has a large v2 refactor; many files carry `@deprecated` / “V2 DATA&UI REFACTORING / BLOCKED” headers. On this fork’s **v1** line: fix bugs and ship personal product changes carefully; do not blindly apply upstream “move everything to v2” process. When cherry-picking from upstream, read those markers and prefer security / model-compat fixes over drive-by refactors.

## Security

- No Node APIs in renderer — only `contextBridge` / preload
- Validate IPC inputs in main
- Keep URL / IP sanitization patterns for API server paths

## Cursor Cloud specific instructions

For running this Electron app headlessly in a Cursor Cloud Agent VM (Ubuntu 24.04). Assumes you can fill in standard details.

- **Node**: needs `>=24.11.1` (`.nvmrc`), but the VM's default `node` is older and wins on PATH. Prepend nvm's: `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"` (install once with `nvm install 24.11.1`). pnpm 10.27.0 already matches.

- **System libs (once)**: install Electron's GUI deps + `xvfb` + native-build headers, e.g.:
  `sudo apt-get install -y xvfb imagemagick libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libgbm1 libgtk-3-0t64 libasound2t64 libxshmfence1 libxdamage1 libxrandr2 libxcomposite1 libxfixes3 libxkbcommon0 libpango-1.0-0 libcairo2 libatspi2.0-0t64 fonts-noto-cjk libxtst-dev libx11-dev libxext-dev libxi-dev libevdev-dev build-essential`
  (The `-dev` headers are required to compile the `selection-hook` native module.)

- **Install**: run a full `pnpm install` — do NOT use `--ignore-scripts` (it skips Electron's postinstall, leaving `node_modules/electron/dist/` unextracted → `pnpm dev` fails with "Electron uninstall"). In interactive pods the `prepare`/`prek` hook fails because Cursor manages `core.hooksPath`; don't unset it — just tolerate that one failure:

  ```bash
  pnpm install 2>&1 | tee /tmp/i.log; code=${PIPESTATUS[0]}
  if [ "$code" -ne 0 ] && ! grep -q "Cowardly refusing to install hooks" /tmp/i.log; then exit "$code"; fi
  test -x node_modules/electron/dist/electron
  ```

- **Run**: `cp .env.example .env` (dev uses dotenv), start a virtual display, then launch:
  ```bash
  export DISPLAY=:99 ELECTRON_DISABLE_SANDBOX=1
  DISPLAY=:99 xdpyinfo >/dev/null 2>&1 || setsid Xvfb :99 -screen 0 1600x1000x24 -ac >/tmp/xvfb.log 2>&1 &
  sleep 3; pnpm dev
  ```
  Screenshot: `DISPLAY=:99 import -window root /tmp/cherry.png`. D-Bus/GPU/MemoryService warnings on first run are benign.
