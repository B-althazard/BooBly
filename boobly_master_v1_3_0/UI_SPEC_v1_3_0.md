# UI/UX Specification (Master-Driven) — v1.3.0

## Core requirements
- Guided mode is default.
- Expert mode is fallback, with search + filters + inspector.
- Default semantics: Default = keep imported; Override = explicit value.
- Multi-character: Names in UI; IDs in backend; scope selector for bulk edits.
- Review Changes screen is required.

## Global controls
- Mode toggle: Guided | Expert (Expert shows warning once).
- Sticky bar: Changed count, Review button, Export.
- Filters: All / Changed / Recommended / DB-supported / Freeform / Objects&Arrays.
- Undo: per field, per category, global.

## Guided mode
- Section cards by category order.
- Field row:
  - Label
  - State chip (Default/Overridden)
  - Control
  - Reset
  - Optional info (description + path) hidden by default

Control selection rules:
- enum <=4 options → segmented
- enum >4 options → select (typeahead if >12)
- number with tight range → slider; else stepper
- object/array → modal editor with validation

## Expert mode (desktop split)
Left panel:
- Scope selector (This/All/Selected)
- Search (label + path + synonyms)
- Filter chips
- Category list with counts + changed counts

Right panel (Inspector):
- Friendly label + path
- Type badge
- Help/examples
- Editor control
- Reset/Undo
- Advanced JSON modal for objects/arrays

Mobile Expert:
- Left panel becomes modal drawer; Inspector is main view.

## Review Changes
- Group by Character then Category
- Row: Field label | Original → New | Undo
- Actions: Undo all, Export

## Presets
- Preset cards
- Preview diff list before apply
- Presets respect scope (scene vs character)
