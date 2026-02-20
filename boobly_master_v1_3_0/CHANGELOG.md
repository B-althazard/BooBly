# Changelog

## 1.3.0 — 2026-02-20
### Added
- Master File (Option A) as runtime contract for UI rendering and schema governance.
- Canonical Schema v1.3.0: `scene + characters[] + style + technical + notes`.
- Change tracking requirements and Review Changes screen specification.
- Multi-character scope editing (this/all/selected) for bulk-editable fields.
- Preset patch format with preview support.
- Adapter library spec for legacy/alternate formats → canonical v1.3.0.
- Migration framework for canonical upgrades.

### Changed
- “Any JSON” editing positioned as Expert/Fallback; Guided edits target canonical fields.
- Default semantics standardized: Default = keep imported value; Override = explicit value.

### Notes
- Vocabulary lists are initial scaffolding and intended to evolve via master updates.
