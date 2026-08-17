# ⚡ PDFuck — High-Performance Desktop PDF Reader & Annotation Studio

An ultra-fast, smooth, and beautiful desktop PDF reader and editor built from scratch with **Bun**, **Tauri v2 (Rust)**, **Vite**, **React**, **TypeScript**, **PDF.js**, and **pdf-lib**.

---

## ✨ Features

### 📖 1. Silky Smooth Reading Experience
- **120Hz Smooth Scrolling & Inertial Navigation**: Native trackpad and mouse wheel navigation.
- **Multiple Reading Modes**:
  - **Continuous Scroll Mode**: Virtualized multi-page vertical scroll with intersection observer.
  - **Single Page Slide Mode**: Distraction-free presentation view with quick keyboard page turning.
  - **Two-Page Book Spread Mode**: Side-by-side reading layout.
  - **Zen / Fullscreen Focus Mode (`F`)**: Hides all UI distractions for focused reading.
- **Dynamic Zoom**: Fit to Width, Fit to Page, 40% - 300% smooth zoom presets with trackpad pinch support.
- **Sidebar Navigator**:
  - Live interactive page thumbnails preview grid.
  - Full Table of Contents (Outline) tree with 1-click jumping.
  - Comprehensive Annotations manager.
  - Document metadata inspector.
- **Full-Text Document Search (`Cmd + F`)**: Real-time keyword scanning with match counters and jump-to-result.

---

### 🌙 2. Intelligent Color Inversion & Reading Themes (`Cmd + I`)
- **Smart Color Invert**: Inverts background lightness while preserving color chrominance so diagrams and images stay natural.
- **OLED Midnight Black**: Pure `#000000` pitch black background for extreme battery saving and night reading.
- **Warm Eye-Care Sepia**: Calibrated to 5200K color temperature to eliminate blue light eye strain.
- **Nord Slate Night**: Cool Arctic slate theme for developer documentation and technical manuals.
- **Cyberpunk Matrix**: Phosphor green terminal theme.
- **Fine-Tuning Sliders**: Adjust document Brightness (60–140%) and Contrast (60–150%) on the fly for scanned or faint PDFs.

---

### 🎨 3. Highlighting & Annotation Studio
- **Freehand Highlighter Pen (`H`)**: Translucent Bezier smoothed highlighter with `multiply` blend mode that overlays naturally on text.
- **Area / Rectangle Highlighter (`R`)**: Drag-and-drop highlight boxes for charts, tables, and code snippets.
- **Freehand Pen & Ink (`P`)**: Draw arrows, underlines, and hand-written notes.
- **Text Notes (`T`)**: Click anywhere to drop custom sticky notes.
- **Color Palette**: 8 vivid neon presets (Fluo Yellow, Cyber Cyan, Neon Pink, Acid Lime, Sunset Orange, etc.) + custom hex picker.
- **Precision Stroke & Opacity**: Adjustable stroke width (1–24px) and translucent opacity slider.
- **Eraser Tool (`E`)**: Click any drawing, highlight, or note to delete.
- **Full Undo / Redo (`Cmd + Z` / `Cmd + Shift + Z`)**.

---

### 🖼️ 4. Image Attachments, Stamps & Signatures (`I`)
- **Attach Any Image**: Drag & drop PNG, JPG, SVG, or WebP files straight from your desktop onto any PDF page.
- **Interactive Transform Handles**:
  - Drag to reposition anywhere on the page.
  - Corner handle to resize with automatic aspect-ratio lock.
  - Rotate 90° button.
  - Opacity slider.
- **Preset Stamp Badges**: 1-click insertion of official stamps:
  - `APPROVED` (Emerald Green)
  - `CONFIDENTIAL` (Crimson Red)
  - `REVIEWED` (Cyan)
  - `DRAFT` (Amber Orange)
  - `URGENT` (Neon Pink)
  - `FINAL COPY` (Purple)
- **Clipboard Image Paste (`Cmd + V`)**: Copy any image or screenshot to your clipboard and paste it directly onto the current page!

---

### 💾 5. Permanent PDF Baking & Saving (`Cmd + S`)
- **Save Modified PDF**: Uses `pdf-lib` to synthesize native PDF bytecode, embedding all highlights, vector paths, notes, and attached images (converted to XObject PNGs) permanently into the PDF.
- **Save Annotations Session (.json)**: Save an editable project manifest to restore or sync your annotations later.
- **Export Page as High-Res PNG**: Snapshot the current page as an image.
- **Auto-Save**: Automatically persists your session progress in local storage so you never lose your place.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Cmd + O` | Open PDF Document (Native File Dialog) |
| `Cmd + S` | Export & Save Modified PDF |
| `Cmd + Shift + S` | Save Annotations JSON Session |
| `Cmd + I` | Toggle Color Inversion (Dark Mode) |
| `Cmd + F` | Search Text in Document |
| `H` | Select Highlighter Pen |
| `R` | Select Area / Rectangle Highlight |
| `P` | Select Freehand Pen |
| `I` | Attach Image / Stamp |
| `T` | Select Text Note Tool |
| `E` | Select Eraser Tool |
| `V` / `S` | Select / Move Tool |
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |
| `Cmd + +` / `Cmd + -` | Zoom In / Out |
| `Cmd + 0` | Reset Zoom (100%) |
| `→` / `J` / `PageDown` | Next Page |
| `←` / `K` / `PageUp` | Previous Page |
| `F` | Toggle Fullscreen Zen Mode |
| `?` | Show Shortcuts Helper |

---

## 🚀 Running with Bun & Tauri v2

### Install Dependencies
```bash
bun install
```

### Launch Desktop App (Tauri v2 + Bun)
```bash
bun run dev
```

### Launch Web Preview
```bash
bun run dev:web
```

### Build Native Desktop Binary
```bash
bun run build
```
