# Adapter Specification (External → Canonical v1.3.0)

## Adapter lifecycle
1. Detect format
2. Map into canonical targets using `field_id`s
3. Resolve conflicts deterministically
4. Preserve unmapped input under `notes.unmapped`
5. Append audit entries to `notes.adapter_log`

## Detection strategies
- `any_top_level_keys`: any exists at root → match
- `path_exists`: existence check (e.g., `characters[0]`)
- `content_types`: used for text/markdown inputs
- `fallback`: last resort adapter

## Conflict strategies
- `canonical_passthrough`: treat input as canonical
- `prefer_nested_subject`: nested subject overrides duplicates
- `prefer_specific`: more specific subtree wins
- Always recommended: store overwritten values to `notes.unmapped._conflicts`

## Concrete mapping tables

### adapter.legacy_subject_bundle
Matches keys: `subject`, `pose`, `setting`, `camera`, `lighting`

Mappings:
- `setting.location` → `scene.location`
- `setting.time_of_day` → `scene.time_of_day`
- `lighting` → `scene.lighting.style`
- `camera.shot` → `scene.camera.shot`
- `camera.focal_length` → `scene.camera.focal_length`
- `pose` → `characters[0].pose`
- `subject.name` → `characters[0].name`
- `subject.gender` → `characters[0].gender`
- `subject.hair.color/length/style` → `characters[0].hair.*`
- `subject.face.eyes.color` → `characters[0].face.eyes.color`
- `subject.face.freckles` → `characters[0].face.freckles`
- `subject.face.makeup` → `characters[0].face.makeup.style`
- `clothing` → `characters[0].outfit.description`
- `jewelry` → `characters[0].accessories`

Normalization:
- If `jewelry` is a string: split on commas into array.
- If `freckles` is "Yes"/"No": normalize to boolean.

### adapter.image_metadata_schema
Matches keys: `image_metadata`, `composition`, `effects`

Mappings:
- `image_metadata.location` → `scene.location`
- `image_metadata.time_of_day` → `scene.time_of_day`
- `composition` → `scene.composition.description`
- `effects` → `scene.effects.description`
- Preserve `subject` to `notes.unmapped.subject` if not canonical

### adapter.characters_array_schema
Matches: `characters` exists and `characters[0]` exists

Mappings:
- `scene` → `scene`
- `characters` → `characters`
- `style` → `style`
- `technical` → `technical`

### adapter.text_or_markdown
Matches: text/markdown (or fallback)

Mappings:
- `$RAW_TEXT` → `notes.source_text`
