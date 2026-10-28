<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project snapshot

- Package manager: npm; keep `package-lock.json` in sync with `package.json`.
- Runtime and language: Next.js 16.4.3, React/React DOM 19.3.0, TypeScript 5.9.x, ESLint 9.
- Routing: Next.js App Router in the root `app/` directory. The required product architecture is the adapted FSD layout below; do not treat the root `app/` as an FSD layer.
- Styling: Tailwind CSS 4 and global tokens/resets are in `app/globals.css`; create workspace presentation rules are in `src/widgets/create-workspace/ui/create-workspace.css`, imported by the global stylesheet and scoped under `.workspace-shell`. The project has a Tailwind Turbopack rule. Development uses Webpack because Turbopack fails to process the workspace stylesheet in the current environment. No component or icon library is installed.
- Current implementation has a create screen in `src/screens/create/`, a workspace widget in `src/widgets/create-workspace/`, the sketch upload scenario and its validation/dimension/formatting functions in `src/features/upload-sketch/`, and generation contracts in `src/entities/generated-model/`. Vitest/Testing Library tests cover file validation and upload/settings behavior. `app/page.tsx` is a thin route adapter.
- `app/page.tsx` and `app/layout.tsx` are Next.js Server Components by default. Keep browser APIs and interactive state in the smallest necessary Client Component boundary.

## Required adapted FSD architecture

- Root `app/` is only for Next.js App Router integration: route files, root/nested layouts, route-level loading/error files, and global styles. Keep product UI and business logic out of this directory.
- `src/app/` is for application initialization, providers, and app-wide setup only when needed.
- `src/screens/` is the architectural layer that composes screens from widgets and lower-level modules. Root `app/**/page.tsx` files are thin route adapters that import the appropriate screen module from `src/screens/`.
- Root `app/` is the only Next.js routing directory. Keep architectural screen modules in `src/screens/`; do not create `src/pages/`, because Next.js treats it as a Pages Router directory and it conflicts with root App Router routing.
- `src/widgets/` contains substantial interface blocks made from several elements or behaviors.
- `src/features/` contains user actions and independently meaningful product scenarios.
- `src/entities/` contains domain entities, their types, models, and related behavior.
- `src/shared/` contains genuinely reusable UI, utilities, configuration, and infrastructure that is not tied to one product scenario.
- This is the project's adapted FSD. Follow the layers as specified here; do not impose canonical FSD rules that conflict with them.
- Create modules only for concrete responsibilities. Do not create empty future folders, universal `lib.ts` files, or formal barrel files without a dependency-control benefit.
- Dependencies point downward from composition layers to lower-level modules. Lower layers must not import from pages, widgets, or app initialization. Avoid duplicate business logic and circular imports.
- Keep domain types with the entity or feature that owns them. Promote them to `shared/` only when there is a real cross-feature need.
- Hide module internals behind a public entry only when it usefully controls dependencies; do not add an `index.ts` to every folder by default.
- Do not confuse root `app/` (Next.js routing) with `src/app/` (application initialization). Do not add `'use client'` broadly; isolate client behavior where required.
- If existing files do not follow these rules, first describe the mismatch and a minimal migration plan. Do not make broad file moves without user approval. Do not refactor architecture as part of unrelated work.

## Commands and verification

- `npm run dev` — local development server.
- `npm run build` — production build.
- `npm run start` — serve a production build.
- `npm run lint` — ESLint.
- `npm test` — run Vitest unit and component tests.
- `npx tsc --noEmit` — direct TypeScript check.
- Do not claim a check passed unless it was run and its result observed. For new features or behavior changes, add automated tests appropriate to the behavior and run the relevant checks.

## Implementation conventions

- Preserve Next.js 16.4.3, React 19.3.0, TypeScript 5.9.x, npm, and Tailwind CSS 4. Do not reinitialize the project or upgrade the stack without a concrete requirement.
- Keep interfaces responsive from narrow mobile widths through desktop. Use semantic HTML, keyboard-operable controls, visible focus, labels, and useful alternative text. Check reduced-motion preferences if adding animation.
- Keep client JavaScript and initial rendering work small. Load expensive browser-only features such as a 3D viewer only where needed, and account for WebGL/device limitations.
- Model domain objects and service inputs/outputs with TypeScript. The current generation contract is only a type boundary; it has no HTTP implementation. A future adapter must call our own backend, not Tripo or Meshy directly. Do not add placeholder HTTP endpoints or represent local/demo behavior as real AI generation.
- Any demo generation must be clearly labeled as a demo and must not imply that an AI model or backend ran. Keep demo data and behavior separable so a real integration can replace them.
- The current UI keeps the specified 10 MiB image ceiling as a product rule. Tripo's current v3 docs allow images up to 20 MB, while its older v2 upload docs list 10 MB; reconcile the limit with the exact server-side API version before integration: <https://developers.tripo3d.ai/en/docs/files> and <https://platform.tripo3d.ai/docs/upload>.
- Validate untrusted input at runtime when the boundary or complexity warrants it; TypeScript types alone do not validate uploads or network payloads.
- Install dependencies only for a concrete current need. Use npm, update the lockfile, avoid broad upgrades, and do not bypass peer dependency checks.
- Follow the locally installed Next.js documentation for this exact version before using unfamiliar APIs or conventions.
- For a future GLB viewer, evaluate `@google/model-viewer` behind a client-only viewer module that accepts a GLB URL and accessible description. React 19 supports custom elements at runtime, but JSX-specific prop typing may need a local declaration. Check and install its current `three` peer dependency only when the viewer is implemented. Khronos glTF Sample Assets `Corset` is listed as CC0; preserve the source/license note if vendoring it.

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
