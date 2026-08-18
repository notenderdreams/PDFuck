# AGENTS.md

## Project overview

PDFuck is a React 19 + TypeScript PDF reader and annotation studio packaged as a Tauri 2 desktop application. The frontend uses Vite, Tailwind CSS 4, PDF.js, and Lucide icons. Rust code and native Tauri configuration live in `src-tauri/`.

Treat this as a desktop-first Tauri project with a browser fallback. Native file dialogs, directory scanning, filesystem reads, clipboard access, and saves should go through `src/utils/tauriBridge.ts`. Always preserve a safe browser fallback when practical.

## Tooling

Always use Bun. Do not use npm, pnpm, yarn, or Node.js commands.

- Install dependencies: `bun install`
- Run the Tauri app: `bun run dev`
- Run the web frontend: `bun run dev:web`
- Type-check: `bunx tsc --noEmit`
- Build the web frontend: `bun run build:web`
- Build the desktop application: `bun run build`
- Run tests: `bun test`

Do not replace the existing Vite or Tauri setup unless explicitly requested.

## Visual language

Follow the design system defined in `src/index.css`.

- Use a soft neutral-gray canvas with elevated pale surfaces in light mode.
- Use layered charcoal surfaces—not pure black—for dark mode.
- Use blue for primary actions, selected controls, active navigation, and focus states.
- Anything displayed on a blue surface must use white text and white icons.
- Use restrained white/translucent borders, soft shadows, and subtle backdrop blur.
- Use compact 8px-radius buttons and controls. Reserve pill shapes for badges, counts, and small status chips. Cards may use moderate rounding, but PDF library cards deliberately use tighter corners.
- Keep typography compact, clear, and platform-native. Use muted gray for secondary information.
- Use Lucide icons and allow icons to inherit the current foreground color whenever possible.
- Preserve accessible contrast and visible keyboard focus in both themes.
- Avoid introducing unrelated accent colors. Amber is reserved for favorites, annotations, warnings, or status details; red is reserved for destructive actions.

The app chrome theme follows the current reading theme:

- `default` and `sepia` use light chrome.
- `invert`, `oled`, `nord`, and `matrix` use dark chrome.

Do not break the PDF page filter classes or apply app-chrome color remapping directly to rendered document content.

## Component conventions

- Reuse existing theme variables and semantic remapping before adding new hard-coded colors.
- Keep light and dark mode behavior equivalent.
- Use the shared `.btn-primary`, `.btn-secondary`, `.btn-ghost`, and `.btn-icon` styles where appropriate.
- Avoid excessive shadows, gradients, oversized rounding, and decorative blue surfaces. Hierarchy should come from spacing, typography, borders, and a small number of deliberate primary actions.
- Prefer custom styled popovers over native `<select>` elements when the control is part of the primary interface.
- Floating tools and menus should use elevated surfaces, soft shadows, and click-outside/Escape dismissal.
- PDF library cards should lazily render the first page as a cover when the native file path is available. Preserve the styled fallback for inaccessible/browser-only files.
- Sidebar page thumbnails have no outer card background. The current page is indicated by a blue outline around the page preview; page numbers remain neutral.
- Keep controls compact enough for desktop title bars and tool docks.

## React and TypeScript

- Use functional React components and typed props.
- Keep expensive PDF work lazy and cancelable. Avoid loading or rendering every document in a large library at once.
- Clean up observers, event listeners, PDF.js loading tasks, render tasks, and other async resources.
- Reuse the configured PDF.js worker from `src/utils/pdfWorker.ts`.
- Preserve existing user data and local-storage formats unless a migration is included.
- Do not add dependencies when the existing stack can handle the task.

## Tauri boundaries

- Check `isTauri()` before calling native-only functionality.
- Keep Tauri command names and TypeScript response shapes aligned with `src-tauri/src/`.
- Do not access arbitrary local paths from browser-only code.
- Use native APIs through the bridge instead of importing Tauri APIs throughout UI components.
- Test both the native path and browser fallback logic when changing file workflows.

## Verification

For frontend changes, run at minimum:

```sh
bunx tsc --noEmit
bun run build:web
git diff --check
```

For Rust or native integration changes, also run the relevant Cargo/Tauri checks and verify the desktop application with `bun run dev` when possible.

Visually inspect affected screens in both light and dark mode. For library or reader changes, check the dashboard, sidebar thumbnails, document canvas, floating toolbar, and any modified popovers or dialogs.

## Repository hygiene

- Preserve unrelated user changes in the working tree.
- Do not use destructive Git commands.
- Keep implementation changes scoped to the request.
- Use `apply_patch` for source-file edits.
