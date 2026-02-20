# BooBly Canonical Schema v1.3.0

**Date:** 2026-02-20  
**Purpose:** Single stable internal model edited by the UI. External inputs are converted into this model using adapters.

## Root
- `schema_version` *(string, required)*: `\"1.3.0\"`
- `scene` *(object)*
- `characters` *(array<object>)*
- `style` *(object)*
- `technical` *(object)*
- `notes` *(object)*:
  - `unmapped` *(object)*
  - `source_text` *(string)*
  - `adapter_log` *(array<object>)*

## Scene (recommended keys)
- `scene.location` *(string)*
- `scene.time_of_day` *(string)*
- `scene.environment` *(string)*
- `scene.lighting.style` *(string)*
- `scene.lighting.intensity` *(number 0..100)*
- `scene.camera.shot` *(string)*
- `scene.camera.focal_length` *(string)*
- `scene.camera.angle` *(string)*
- `scene.composition.description` *(string)*
- `scene.effects.description` *(string)*

## Character object (`characters[]`)
**Identity**
- `id` *(string, backend stable id)*
- `name` *(string, frontend display name)*

**Body**
- `gender` *(string)*
- `body.height_cm` *(number)*

**Pose & Action**
- `pose` *(string)*
- `action` *(string)*

**Face**
- `face.eyes.color` *(string)*
- `face.freckles` *(boolean)*
- `face.makeup.style` *(string)*

**Hair**
- `hair.color` *(string)*
- `hair.length` *(string)*
- `hair.style` *(string)*

**Outfit**
- `outfit.description` *(string)*

**Accessories**
- `accessories` *(array<string>)*

## Style
- `style.render_style` *(string)*
- `style.mood` *(string)*
- `style.negative_prompts` *(string)*

## Technical
- `technical.quality` *(string)*
- `technical.aspect_ratio` *(string)*

## Compatibility rules
- Missing keys are allowed; UI shows **Default (keep imported)** until overridden.
- Unknown data is preserved under `notes.unmapped`.
- Canonical JSON is migrated forward using `migrations` in the master file.
