# UI Redesign v2 - Dashboard Layout

## Overview

The ITSM Triage Wizard was redesigned from a sequential step-by-step form into a dashboard-style interface. The new layout presents information spatially (left-to-right) rather than temporally (step-by-step), allowing users to see context and make selections more efficiently.

## Architecture Changes

### Phase Model

The app now operates in three distinct phases:

| Phase | Name | Layout | Purpose |
|-------|------|--------|---------|
| 1 | `location` | Left (1/3) + Right (2/3) | Area, subarea, location, warehouse selection |
| 2 | `system` | Left (1/3) + Right (2/3) | System selection + diagnostic questions |
| 3 | `finished` | Centered card | Result display |

### YAML Schema Changes

The `main.yaml` was restructured. The following steps were **removed from the schema** and are now handled directly by the dashboard UI:

- `oblast` (Area) - now UI tabs
- `podoblast` (Sub-area) - now UI pill buttons
- `lokalita` (Location) - now UI grid panels
- `hala` (Warehouse/Hall) - now UI grid buttons

The schema now starts with `user_id` (hidden) and `system` (select), followed by system-specific branches. The `system` step is still in the schema for data reference (its `options` array populates the system cards), but the schema navigation engine skips it since the UI handles selection directly.

### New Mock System: HOD

A second system branch `questions/systems/hod/hod.yaml` was added with mock questions:
- Use case selection (Příjem zboží, Vyskladnění, Inventura)
- Device type (Ruční terminál, Tablet, PC stanice)
- Symptom selection (App crash, Scan error, Connection loss, Wrong data)
- Diagnostic boolean questions with resolver group routing

## Frontend Implementation

### Technology

- **Svelte 5** with runes (`$state`, `$derived`, `$derived.by`)
- All in a single `App.svelte` component
- CSS Grid and Flexbox for layout (no external CSS libraries)
- Smooth fade-in animations on panel transitions

### State Management

```
phase: 'location' | 'system' | 'finished'
selectedArea, selectedSubarea, selectedLocation, selectedWarehouse
selectedSystem, answers, currentStepIndex, history
```

All state uses `$state()` runes. Computed values (breadcrumb, current step, can-proceed flags) use `$derived`.

### Phase 1: Location Dashboard

**Left panel (33% width):**
- **Area tabs**: "Logistika" (active) and "Výroba" (disabled, labeled "Připravujeme")
- **Subarea pills**: Inhouse, Inbound, Outbound (chip-style toggle buttons)
- **Location grid**: 2-column grid of 80px-tall panels. MB, KV, VR, Teplice in first group; EDL MB, EDL KV in second group, separated by a visual divider

**Right panel (67% width, appears on location selection):**
- Warehouse grid (4 columns) populated from `warehouseMap` mock data
- Optional text input for office/workplace identification
- "Pokračovat" button (disabled until warehouse selected)

### Phase 2: System Selection & Questions

**Left panel:**
- System cards in 2-column grid, each showing an SVG logo and system name
- Logo path: `/logos/{system_key}.svg` (system name lowercased, spaces replaced with underscores)
- "Zpět na výběr lokality" back button

**Right panel (appears on system selection):**
- Breadcrumb trail: Area > Subarea > Location > Warehouse > System > Current Question
- Dynamic question rendering (select, boolean, info types)
- Back/Next navigation. Back can traverse: question history -> system selection -> location phase

### Phase 3: Result

- Centered card with resolver group, actual defect, backup strategy
- "Začít znovu" button reloads the page

### Schema Navigation Engine

The core logic from v1 is preserved:
- `evaluateCondition()` uses `new Function()` to evaluate `render_if` strings
- `advanceToNextValidStep()` scans forward through schema steps, skipping those whose conditions don't match
- `history` array enables exact back-navigation through the user's path
- `on_true`/`on_false` with `action: stop` terminate the flow with incident data

The key adaptation: the engine now skips the `system` step (id === 'system') since it's handled by the UI cards, and starts evaluating from the step after it.

## Mock Data

### Warehouse Data (per location)

| Location | Warehouses |
|----------|-----------|
| MB | M1, M2, M3, M4, M5, M6, M7, M8 |
| KV | K1, K2, K3, K4, K5, K6 |
| VR | V1, V2, V3 |
| Teplice | T1, T2 |
| EDL MB | EM1, EM2, EM3 |
| EDL KV | EK1, EK2 |

### System Logos

Placeholder SVG files in `public/logos/`: `lkw_control.svg`, `hod.svg`, `itls.svg`, `logis.svg`, `ineas.svg`, `sap.svg`

## Visual Design

- **Brand color**: Škoda green `#4ba82e`
- **Dark header**: `#1a202c`
- **Background**: `#f0f2f5`
- **Cards**: White with `border-radius: 12px`, subtle box-shadow
- **Selected state**: Green border + light green background (`#f0faf0`)
- **Disabled state**: `opacity: 0.5`, `cursor: not-allowed`

## File Changes Summary

| File | Change |
|------|--------|
| `src/App.svelte` | Complete rewrite - dashboard layout |
| `src/app.css` | Simplified for full-width dashboard |
| `questions/main.yaml` | Removed area/subarea/location/hall steps |
| `questions/systems/hod/hod.yaml` | New mock system branch |
| `public/logos/*.svg` | New placeholder system logos |
| `documentation/ui-redesign-v2.md` | This file |
