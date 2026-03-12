# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ITSM Triage Wizard for Škoda SCM (Supply Chain Management) incident reporting. A step-by-step form that guides users through diagnosing IT system outages and routes them to the correct resolver group. The UI is in Czech.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run build-schema` — Compile YAML question files into `src/assets/compiled-schema.json`
- `npm run preview` — Preview production build

**Important:** Run `npm run build-schema` after any changes to YAML files in `questions/`. The app imports `compiled-schema.json` statically.

## Architecture

**Two-phase build:** YAML question schemas are compiled to JSON at build time (`build.js`), then the Svelte app consumes the JSON at runtime.

**Question schema system (`questions/`):**
- `questions/main.yaml` — Entry point defining the triage flow (area, sub-area, location, system selection)
- System-specific branches live in `questions/systems/<system_name>/` (e.g., `lkw_control/`)
- YAML files use `$include` directives to compose sub-flows; `build.js` recursively resolves these into a flat step array
- Each step has: `id`, `type` (select/boolean/info/hidden), `question`, optional `render_if` condition, optional `on_true`/`on_false` with `incident_data`

**Svelte app (`src/App.svelte`):**
- Single-component wizard that evaluates `render_if` conditions using `new Function()` against collected answers
- Steps can terminate the flow via `action: stop` or `on_true/on_false` actions, producing incident data (resolver group, defect type, backup strategy)
- Navigation uses a history stack for back/forward traversal through conditionally-rendered steps

## Adding a New System Branch

1. Create `questions/systems/<name>/<name>.yaml` with steps guarded by `render_if: "system == '<Name>'"`
2. Add `$include` in `main.yaml` under the system includes section
3. Add the system name to the `system` step's `options` list in `main.yaml`
4. Run `npm run build-schema`
