// BooBly v1_3_0 — master-driven Guided editor + Expert fallback, change tracking, scope editing.

const state = {
  db: null,
  prompts: null,
  master: null,

  rawJsonText: "",
  parsedJson: null,
  editableJson: null,
  importError: null,
  correctedJsonText: null,

  page: "import", // import | edit | export | settings
  lastPageBeforeSettings: "import",

  // Edit UX (master-driven)
  editMode: "guided", // guided | expert
  applyScope: "this", // this | all | selected
  activeCharacterIndex: 0,
  selectedCharacterIds: [],

  theme: "light",
  wallpaper: null,

  // Imported JSON baseline (for Default option in editor)
  originalJson: null,

  // Generic key editor
  keySearch: "",
  keyEditorExpanded: {},

  // Optimizer output composition
  addMasterPrompt: true,
  addModelPrompt: true,
  addUseCasePrompt: true,
  addJsonOutput: false,

  selectedModelPromptId: "gpt52_image_prompt_compiler_v1",
  optimizeTab: "portrait", // portrait | fashion | fitness
  createJsonExpanded: false,
  currentPresetId: null,

  // Export customization (model wrappers)
  exportPrefix: "",
  exportSuffix: "",
};

const STORAGE = {
  theme: "boobly.theme",
  wallpaper: "boobly.wallpaper",
  presets: "boobly.presets",
  db: "boobly.db",
  prompts: "boobly.prompts",
  changelog: "boobly.changelog",
  llmUrl: "boobly.llmUrl",
  openOnGen: "boobly.openOnGenerate",
  draft: "boobly.draft.v1",
  page: "boobly.page",
  master: "boobly.master",
};

const VERSION = "v1_4_0_Alpha";


/* --------------------------
   IndexedDB (for large blobs like wallpaper)
--------------------------- */
const IDB = {
  name: "boobly",
  version: 1,
  store: "kv",
};

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB.name, IDB.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB.store)) db.createObjectStore(IDB.store);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB.store, "readonly");
      const st = tx.objectStore(IDB.store);
      const r = st.get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB.store, "readwrite");
      const st = tx.objectStore(IDB.store);
      const r = (value === null || value === undefined) ? st.delete(key) : st.put(value, key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return false;
  }
}

let _wallpaperObjectUrl = null;

async function applyWallpaperBlob(blob) {
  if (_wallpaperObjectUrl) {
    URL.revokeObjectURL(_wallpaperObjectUrl);
    _wallpaperObjectUrl = null;
  }
  const appEl = document.getElementById("app");
  if (!appEl) return;

  if (!blob) {
    state.wallpaper = null;
    appEl.style.backgroundImage = "none";
    return;
  }

  _wallpaperObjectUrl = URL.createObjectURL(blob);
  state.wallpaper = _wallpaperObjectUrl;
  appEl.style.backgroundImage = `url(${_wallpaperObjectUrl})`;
}

async function dataUrlToBlob(dataUrl) {
  try {
    const resp = await fetch(dataUrl);
    return await resp.blob();
  } catch {
    return null;
  }
}

const DEFAULT_CHANGELOG = {"app": "BooBly", "schema": 1, "entries": [{"version": "1.0.0", "date": "2026-02-19", "changes": ["Initial MVP: Home/Create/Edit/Optimize/Settings navigation", "Import JSON (paste/upload), editable JSON view, basic summary table", "Key-Value database (local), prompts library (local), import/export JSON files", "PWA + offline service worker caching"]}, {"version": "1.1.0", "date": "2026-02-19", "changes": ["UI pass: glass cards, improved spacing, consistent buttons", "JSON import UX improvements + Clear button", "Master JSON template + converter (normalize to master structure)", "Prompt blocks foundation (master_prompt/model/use-case)"]}, {"version": "1.2.0", "date": "2026-02-19", "changes": ["Responsive layout improvements (mobile-first)", "Hamburger menu toggle closes Settings", "Theme toggle UI (sun/moon concept)", "Draft persistence (reduce data loss on refresh)", "Import modal: Paste from clipboard", "Expanded JSON Data summary", "Console: fixed height + internal scroll", "JSON code: line numbers + syntax highlight", "Preset images support + gallery groundwork", "Unified output option groundwork (merge JSON + prompt blocks)", "Help guide modal added"]}, {"version": "1.2.1", "date": "2026-02-20", "changes": ["Cache-clean rebuild to address service worker serving old bundles"]}, {"version": "1.2.3", "date": "2026-02-20", "changes": ["Bundled 7 provided preset images into the build", "Generated 7 default presets referencing the bundled images", "Auto-seed presets on first load if none exist", "Service worker cache/version bump to prevent stale assets"]}, {"version": "1.2.4", "date": "2026-02-20", "changes": ["Preset names + Home captions; presets diversified (scene/outfit/hair/eyes/framing)", "Create: Import Code + Upload File inline; normalized action button sizing", "Console: max height enforced + internal scroll", "Settings: Open LLM URL toggle layout fixed", "Help modal reformatted into step list"]}, {"version": "1.2.5", "date": "2026-02-20", "changes": ["Preset name editing now updates preset list (and JSON identity in sync)", "Edit: preset selector dropdown (switch presets inside Edit)", "Edit: Environment moved to DB-backed dropdown", "DB: added environment location path and values"]}, {"version": "1.2.6", "date": "2026-02-20", "changes": ["Major DB expansion for higher-fidelity generation", "Added: Scene Construction block (10\u00d720), Lighting Detail block (10\u00d720), Visual Style block (10\u00d720)", "Expanded hair styles/colors, outfits, framing, backgrounds, lighting presets", "Added camera physics effects table + photography terminology"]}, {"version": "1.2.7", "date": "2026-02-20", "changes": ["Attempted fix for segmented controls interactions (Makeup/Freckles)", "Create: Choose Preset button full-width for consistency", "Edit: ensured preset switcher present (if missing in prior builds)", "Cache/version bump"]}, {"version": "1.2.8", "date": "2026-02-20", "changes": ["Critical fix: Import no longer auto-converts JSON to Master template", "Convert \u2192 Master now only runs when explicitly pressed", "Export now outputs imported/edited JSON (no forced master merge)", "Cache/version bump"]}, {"version": "1.2.8-patch", "date": "2026-02-20", "changes": ["Changelog moved to changelog.json (single source of truth)", "Changelog modal now renders from changelog.json (maintainable)", "Export All now includes changelog; Import All restores changelog"]}, {"version": "v1_2_8_HOTFIX-1", "date": "2026-02-20", "changes": ["Service worker rewritten: safe same-origin GET caching, app-shell offline fallback, runtime cache cap, skipWaiting/clients.claim", "PWA manifest start_url set to ./ to ensure offline launch consistency; scope set to ./", "Preset thumbnails added to precache for first-run offline availability", "localStorage writes hardened with quota/blocked handling and user toast on failure", "Wallpaper storage migrated from localStorage DataURL to IndexedDB Blob with legacy migration", "Draft persistence debounced to reduce storage churn", "Import validation added for Database/Prompts/Presets/Changelog; Import All validates each section", "JSON syntax highlighting fixed by escaping quotes consistently", "Modal accessibility improved: Escape-to-close, focus trapping, and focus restore; close buttons use unified close", "Keyboard focus styles added via :focus-visible", "Basic Content-Security-Policy meta added to index.html for safer defaults", "Render error boundary added with reset option for recovery"]}]};


const toast = (m) => {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
};

const loadLS = (k, fallback = null) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const saveLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    console.warn("localStorage write failed:", k, e);
    toast("Storage is full or blocked. Some settings may not save.");
    return false;
  }
};

let _persistTimer = null;
function persistDraftNow() {
  const payload = {
    rawJsonText: state.rawJsonText,
    editableJson: state.editableJson,
    page: state.page,
    selectedModelPromptId: state.selectedModelPromptId,
    optimizeTab: state.optimizeTab,
    addMasterPrompt: state.addMasterPrompt,
    addModelPrompt: state.addModelPrompt,
    addUseCasePrompt: state.addUseCasePrompt,
    addJsonOutput: state.addJsonOutput,
    currentPresetId: state.currentPresetId,
    createJsonExpanded: state.createJsonExpanded,
    originalJson: state.originalJson,
    keySearch: state.keySearch,
    keyEditorExpanded: state.keyEditorExpanded,
  };
  saveLS(STORAGE.draft, payload);
  saveLS(STORAGE.page, state.page);
}
function persistDraft() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistDraftNow, 300);
}

const setTheme = (th) => {
  state.theme = th;
  document.documentElement.setAttribute("data-theme", th);
  saveLS(STORAGE.theme, th);
};

const setWallpaper = async (blobOrNull) => {
  // blobOrNull: Blob/File or null
  await idbSet(STORAGE.wallpaper, blobOrNull);
  await applyWallpaperBlob(blobOrNull);
};


async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Failed to load " + path);
  return await r.text();
}
async function seedPresetsIfEmpty() {
  const existing = loadLS(STORAGE.presets, []);
  if (existing && existing.length) return;
  try {
    const presetData = await fetchJson("presets.json");
    if (Array.isArray(presetData) && presetData.length) {
      saveLS(STORAGE.presets, presetData);
    }
  } catch {}
}
async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Failed to load " + path);
  return await r.json();
}

/* --------------------------
   Import validation (lightweight schema checks)
--------------------------- */
function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function validateDatabase(obj) {
  if (!isPlainObject(obj)) return { ok:false, error:"Database must be an object." };
  if (!Array.isArray(obj.entries)) return { ok:false, error:"Database.entries must be an array." };
  const bad = obj.entries.find(e =>
    !isPlainObject(e) ||
    typeof e.category !== "string" ||
    typeof e.path !== "string" ||
    typeof e.description !== "string" ||
    !Array.isArray(e.values)
  );
  if (bad) return { ok:false, error:"Database.entries contains invalid items." };
  return { ok:true };
}

function validatePrompts(obj) {
  if (!isPlainObject(obj)) return { ok:false, error:"Prompts must be an object." };
  if (!isPlainObject(obj.prompts)) return { ok:false, error:"Prompts.prompts must be an object." };
  if (typeof obj.prompts.master_prompt !== "string") return { ok:false, error:"Prompts.prompts.master_prompt must be a string." };
  if (!Array.isArray(obj.prompts.model_specific)) return { ok:false, error:"Prompts.prompts.model_specific must be an array." };
  if (!Array.isArray(obj.prompts.use_cases)) return { ok:false, error:"Prompts.prompts.use_cases must be an array." };

  const msBad = obj.prompts.model_specific.find(p => !isPlainObject(p) || typeof p.id!=="string" || typeof p.title!=="string" || typeof p.prompt!=="string");
  if (msBad) return { ok:false, error:"Prompts.prompts.model_specific contains invalid items." };

  const ucBad = obj.prompts.use_cases.find(p => !isPlainObject(p) || typeof p.id!=="string" || typeof p.title!=="string" || typeof p.prompt!=="string");
  if (ucBad) return { ok:false, error:"Prompts.prompts.use_cases contains invalid items." };

  return { ok:true };
}

function validatePresets(obj) {
  if (!Array.isArray(obj)) return { ok:false, error:"Presets must be an array." };
  const bad = obj.find(p => !isPlainObject(p) || typeof p.id!=="string" || typeof p.title!=="string" || typeof p.image!=="string");
  if (bad) return { ok:false, error:"Presets array contains invalid items." };
  return { ok:true };
}

function validateChangelog(obj) {
  if (!isPlainObject(obj) || !Array.isArray(obj.entries)) return { ok:false, error:"Changelog must have entries array." };
  const bad = obj.entries.find(e => !isPlainObject(e) || typeof e.version!=="string" || typeof e.date!=="string" || !Array.isArray(e.changes));
  if (bad) return { ok:false, error:"Changelog.entries contains invalid items." };
  return { ok:true };
}

/* --------------------------
   Master template + converter
--------------------------- */
function masterTemplate() {
  return {
    image_metadata: {
      type: "photorealistic_image",
      style: "ultra-realistic, high-resolution, professional photography",
      aspect_ratio: "2:3",
      orientation: "portrait",
      lighting: {
        type: "natural soft daylight",
        direction: "¾ front",
        intensity: "soft",
        color_temperature: "neutral",
        effects: ["soft highlights", "feathered shadows"],
      },
      environment: {
        location: "",
        time_of_day: "golden hour",
        sky: { color: "", clouds: "" },
        water: { color: "", clarity: "", surface: "", motion: "" },
        background_elements: [],
        depth_of_field: "shallow depth of field",
        background_blur: "medium bokeh",
      },
    },
    subject: {
      category: "human",
      gender_presentation: "female",
      age_range: "21",
      identity: {
        name: "",
        height_cm: 155,
      },
      body: {
        build: "athletic",
        silhouette: "curvy",
        bust: "full",
      },
      pose: {
        stance: "standing",
        body_angle: "¾ angle",
        torso: "upright",
        head: "forward",
        arms: "relaxed beside torso",
        movement: "standing",
      },
      expression: {
        emotion: "calm",
        mouth: "soft smile",
        eyes: "engaged toward camera",
      },
      hair: {
        color: "golden blonde",
        length: "long",
        style: "wavy",
        motion: "subtle hair movement",
      },
      skin: {
        tone: "fair",
        texture: "micro skin texture",
        finish: "natural",
        water_droplets: false,
        freckles: "heavy freckles",
      },
      eyes: {
        color: "bright blue",
        makeup: "subtle natural tones",
      },
      accessories: [],
    },
    clothing: {
      outfit_type: "athleisure set",
      top: {
        style: "elastic shape-adapting mini crop top",
        pattern: "solid with accents",
        colors: ["white", "pastel pink"],
        straps: "",
      },
      bottom: {
        style: "short shorts",
        cut: "high-rise",
        pattern: "matching solid with accents",
        side_straps: "",
      },
      socks: "over-the-knee socks",
      shoes: "",
      accessories: [],
      material_appearance: "stretch fabric",
    },
    composition: {
      framing: "full body",
      subject_position: "centered",
      camera_angle: "slight high angle (camera slightly above, tilted down)",
      lens_type: "portrait lens",
      focal_length_equivalent: "85mm",
      focus_point: "eyes/face",
      sharpness: "subject sharp",
    },
    effects: {
      bokeh: { background: true, size: "medium", shape: "circular" },
      color_grading: {
        contrast: "balanced",
        saturation: "natural",
        tones: "neutral grade",
      },
    },
    rendering_parameters: {
      quality: "ultra",
      detail_level: "maximum",
      realism: "photographic",
      noise: "clean",
      artifacts: "none",
      dynamic_range: "high",
      texture_detail: "high fidelity",
    },
  };
}

function deepMerge(target, src) {
  if (src == null) return target;
  if (Array.isArray(src)) return src.slice();
  if (typeof src !== "object") return src;
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
      target[k] = deepMerge(target[k] && typeof target[k] === "object" ? target[k] : {}, src[k]);
    } else {
      target[k] = src[k];
    }
  }
  return target;
}

function convertToMaster(input) {
  const t = masterTemplate();
  if (input && typeof input === "object") deepMerge(t, input);

  const flat = input && typeof input === "object" ? input : {};
  const pick = (...keys) => {
    for (const k of keys) if (flat[k] !== undefined) return flat[k];
    return undefined;
  };

  const name = pick("name", "Name");
  if (typeof name === "string") t.subject.identity.name = name;

  const hairColor = pick("hair_color", "hairColor", "Hair Color", "HairColor");
  if (typeof hairColor === "string") t.subject.hair.color = hairColor;

  const eyeColor = pick("eye_color", "eyeColor", "Eye Color", "EyeColor");
  if (typeof eyeColor === "string") t.subject.eyes.color = eyeColor;

  const freckles = pick("freckles", "Freckles");
  if (typeof freckles === "boolean") t.subject.skin.freckles = freckles ? "heavy freckles" : "none";

  const makeup = pick("makeup_level", "makeup", "Makeup");
  if (typeof makeup === "string") t.subject.eyes.makeup = makeup;

  // Gender explicitly removed (female only)
  t.subject.gender_presentation = "female";

  return t;
}

/* --------------------------
   Lenient JSON parsing
--------------------------- */
function normalizeQuotes(s) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00A0/g, " ");
}
function stripTrailingCommas(s) {
  return s.replace(/,\s*([}\]])/g, "$1");
}
function trySingleQuotesToDouble(s) {
  // conservative: only converts quoted strings, not object keys without quotes
  return s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => `"${inner.replace(/"/g, '\\"')}"`);
}
function parseJsonLenient(text) {
  const raw = (text || "").trim();
  if (!raw) return { parsed: null, error: "Empty JSON input.", corrected: null };
  try {
    return { parsed: JSON.parse(raw), error: null, corrected: null };
  } catch {}
  let c = normalizeQuotes(raw);
  c = stripTrailingCommas(c);
  try {
    return { parsed: JSON.parse(c), error: null, corrected: c };
  } catch {}
  const c2 = trySingleQuotesToDouble(c);
  try {
    return { parsed: JSON.parse(c2), error: null, corrected: c2 };
  } catch (e) {
    return { parsed: null, error: String(e.message || e), corrected: c2 };
  }
}

/* --------------------------
   Helpers
--------------------------- */
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c === null || c === undefined) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}
function iconButton(label, onClick, title = label) {
  return el("button", { class: "iconBtn", onclick: onClick, title }, label);
}
function switchPill(isOn, onToggle, title = "Toggle") {
  return el("span", { class: "switch" + (isOn ? " on" : ""), onclick: onToggle, title });
}
function copyToClipboard(txt) {
  return navigator.clipboard.writeText(txt);
}
function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* JSON syntax highlight with line numbers (lightweight) */
function highlightJsonToHtml(jsonText) {
  const esc = escapeHtml(jsonText);
  // token highlight (keys, strings, numbers, booleans, null)
  const tok = esc
    .replace(/(&quot;)(.*?)(?=&quot;\s*:)/g, '<span class="tok-key">$1$2</span>')
    .replace(/:&nbsp;?(&quot;.*?&quot;)/g, ': <span class="tok-str">$1</span>')
    .replace(/:\s*(-?\d+(\.\d+)?)/g, ': <span class="tok-num">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="tok-bool">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="tok-null">$1</span>');

  const lines = tok.split("\n");
  const htmlLines = lines
    .map((ln, i) => `<div class="codeLine"><span class="ln">${String(i + 1).padStart(2, " ")}</span><span class="codeText">${ln || " "}</span></div>`)
    .join("");
  return `<div class="codeHtml">${htmlLines}</div>`;
}

function codeBlock(jsonText, onCopy) {
  return el("div", { class: "codeCard" }, [
    el("button", { class: "codeCopy", onclick: onCopy, title: "Copy" }, "⧉"),
    el("div", { html: highlightJsonToHtml(jsonText) }),
  ]);
}

function currentPreset() {
  const pid = state.currentPresetId;
  if (!pid) return null;
  return presetsList().find(p => p.id === pid) || null;
}

function presetsList() {
  return loadLS(STORAGE.presets, []);
}
function savePreset(name, jsonObj) {
  const presets = presetsList();
  const id = crypto.randomUUID();
  presets.unshift({ id, name, created: Date.now(), json: jsonObj, image: null });
  saveLS(STORAGE.presets, presets);
  state.currentPresetId = id;
  return id;
}
function updatePresetImage(presetId, dataUrl) {
  const presets = presetsList();
  const idx = presets.findIndex((p) => p.id === presetId);
  if (idx >= 0) {
    presets[idx].image = dataUrl;
    saveLS(STORAGE.presets, presets);
  }
}

/* --------------------------
   UI: header + bottom tabs
--------------------------- */
function header(title) {
  const left = iconButton("☰", () => {
    if (state.page === "settings") {
      state.page = state.lastPageBeforeSettings || "home";
    } else {
      state.lastPageBeforeSettings = state.page;
      state.page = "settings";
    }
    persistDraft();
    rerender();
  }, "Menu");

  const t = el("div", { class: "hTitle" }, title);

  // Sun/Moon icon toggle with animation (simple swap)
  const icon = state.theme === "dark" ? "☾" : "☀";
  const right = el("button", {
    class: "iconBtn",
    title: "Toggle theme",
    onclick: () => {
      setTheme(state.theme === "dark" ? "light" : "dark");
      rerender();
    },
  }, icon);

  return el("div", { class: "header" }, [left, t, right]);
}

function tabs() {
  const mk = (p, ico, lbl) =>
    el("button",
      {
        class: "tabBtn" + (state.page === p ? " active" : ""),
        onclick: () => { state.page = p; persistDraft(); rerender(); },
      },
      [el("span", { class: "ico" }, ico), el("span", { class: "lbl" }, lbl)]
    );

  return el("div", { class: "tabs" }, [
    mk("import", "⬆️", "Import"),
    mk("edit", "✏️", "Edit"),
    mk("export", "📤", "Export"),
  ]);
}

function card(title, bodyNodes) {
  return el("div", { class: "card" }, [el("div", { class: "cardBody" }, [el("div", { class: "cardTitle" }, title), ...bodyNodes])]);
}

function collapsibleCard(opts) {
  const { id, title, subtitle, rightBadge, defaultOpen = true, bodyNodes = [] } = (opts || {});
  state.collapsed = state.collapsed || {};
  const isOpen = (state.collapsed[id] === undefined) ? defaultOpen : !state.collapsed[id];

  const details = el("details", { class: "cCard" });
  if (isOpen) details.setAttribute("open", "");

  const sum = el("summary", { class: "cCardHead" }, [
    el("div", { class: "cCardHeadMain" }, [
      el("div", { class: "cCardTitle" }, title || ""),
      subtitle ? el("div", { class: "cCardSub" }, subtitle) : null,
    ].filter(Boolean)),
    rightBadge ? el("div", { class: "cCardBadge" }, rightBadge) : null,
  ].filter(Boolean));

  details.appendChild(sum);
  const body = el("div", { class: "cCardBody" }, bodyNodes);
  details.appendChild(body);

  details.addEventListener("toggle", () => {
    state.collapsed[id] = !details.open;
    persistDraft();
  });

  return details;
}

function toolbar(children=[]) { return el("div", { class: "toolbar" }, children); }
function chip(text, kind="neutral") { return el("span", { class: "chip " + kind }, text); }
function iconTextBtn(text, cls, onClick) {
  const b = el("button", { class: cls || "btn", onclick: (e) => { e.preventDefault(); onClick && onClick(); } }, text);
  return b;
}
function hr() { return el("div", { class: "hr" }); }

/* --------------------------
   Modals
--------------------------- */
function openModal(contentNode) {
  const previouslyFocused = document.activeElement;

  const close = () => {
    back.remove();
    document.removeEventListener("keydown", onKey);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  };

  const back = el("div", {
    class: "modalBack",
    onclick: (e) => {
      if (e.target === back) close();
    },
  }, [
    el("div", { class: "modal", role: "dialog", "aria-modal": "true", tabindex: "-1" }, [contentNode]),
  ]);

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;

    const modal = back.querySelector(".modal");
    const focusables = [...modal.querySelectorAll(
      `a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])`
    )].filter(el => el.offsetParent !== null);

    if (!focusables.length) {
      modal.focus();
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  document.body.appendChild(back);
  document.addEventListener("keydown", onKey);

  // initial focus
  setTimeout(() => {
    const modal = back.querySelector(".modal");
    const first = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])");
    (first || modal).focus();
  }, 0);

  return back;
}

function closeTopModal() {
  const back = document.querySelector(".modalBack");
  if (!back) return;
  if (typeof back._close === "function") back._close();
  else back.remove();
}

function openHelpModal() {
  const steps = [
    "Home: review your most recent presets (tap any image to open).",
    "Create: import RAW JSON or upload a .json file.",
    "Convert → Master: normalizes your JSON into BooBly’s master template.",
    "Edit: adjust fields (hair/eyes/freckles/makeup/framing/lighting/outfit).",
    "Save Preset: stores JSON + image locally (works offline).",
    "Optimize: choose model + use-case blocks; optionally merge JSON + prompts into one output.",
    "Settings: import/export database, prompts, presets; set wallpaper; set LLM URL.",
  ];
  const ol = el("ol", { style: "margin:0 0 0 18px; padding:0; line-height:1.6;" }, steps.map(s => el("li", { style:"margin:6px 0;" }, s)));
  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Help — How to use BooBly"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    ol,
  ]));
}

function openChangelogModal() {
  const cl = (state.changelog && Array.isArray(state.changelog.entries) && state.changelog.entries.length) ? state.changelog : DEFAULT_CHANGELOG;
  const list = (cl.entries || []).slice().reverse().map(e => {
    const header = el("div", { style: "font-weight:900; margin-top:12px;" }, "v" + e.version);
    const date = e.date ? el("div", { class: "small", style: "margin-top:2px; opacity:.7;" }, e.date) : null;
    const ul = el("ul", { style: "margin:8px 0 0 18px; line-height:1.55;" }, (e.changes || []).map(c => el("li", { style: "margin:6px 0;" }, c)));
    return el("div", {}, [header, date, ul].filter(Boolean));
  });
  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Changelog"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    el("div", { class: "small" }, list.length ? list : [el("div", { class:"small" }, "No changelog data.")]),
  ]));
}

function openPresetPicker() {
  const presets = presetsList();
  const grid = presets.length
    ? el("div", { class: "presetGrid" }, presets.map((p) => presetTile(p, () => {
        loadPreset(p);
        state.page = "import";
        persistDraft();
        rerender();
        document.querySelector(".modalBack")?.remove();
      })))
    : el("div", { class: "small" }, "No presets yet.");

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Select Preset"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    grid,
  ]));
}

function presetTile(p, onClick) {
  // long-press to set image (also available in Settings)
  let pressTimer = null;
  const tile = el("div", { class: "presetTile" }, [
    el("img", { src: p.image || "icons/preset.png", alt: p.name }),
    el("div", { class: "pbody" }, [
      el("div", { class: "pname" }, p.name),
      el("div", { class: "small" }, new Date(p.created).toLocaleString()),
    ]),
  ]);
  tile.addEventListener("click", onClick);
  tile.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(() => openPresetImagePicker(p.id), 600);
  });
  tile.addEventListener("pointerup", () => clearTimeout(pressTimer));
  tile.addEventListener("pointerleave", () => clearTimeout(pressTimer));
  return tile;
}

function openPresetImagePicker(presetId) {
  const input = el("input", { type: "file", accept: "image/*" });
  input.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    });
    updatePresetImage(presetId, dataUrl);
    toast("Preset image set");
    rerender();
    document.querySelector(".modalBack")?.remove();
  });

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Set Preset Image"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    input,
    el("div", { class: "small" }, "Choose an image. It will display on Home + Preset picker."),
  ]));
}

function openImportModal() {
  const ta = el("textarea", { placeholder: "Paste RAW JSON here…" }, state.rawJsonText || "");

  const pasteBtn = el("button", { class: "btn", onclick: async () => {
    try {
      const txt = await navigator.clipboard.readText();
      ta.value = txt || "";
      toast("Pasted");
    } catch {
      toast("Paste blocked");
    }
  }}, "Paste");

  const clearBtn = el("button", { class: "btn", onclick: () => { ta.value = ""; state.rawJsonText = ""; persistDraft(); toast("Cleared"); } }, "Clear");

  const setBtn = el("button", {
    class: "btn primary",
    onclick: () => {
      const { parsed, error, corrected } = parseJsonLenient(ta.value);
      state.importError = error;
      state.correctedJsonText = corrected;
      if (error) {
        toast("Parse failed");
        rerender();
        return;
      }
      state.parsedJson = parsed;
      state.editableJson = parsed;
      state.rawJsonText = JSON.stringify(parsed, null, 2);
      persistDraft();
      toast("Imported");
      document.querySelector(".modalBack")?.remove();
      rerender();
    },
  }, "Set");

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Import JSON"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    ta,
    hr(),
    el("div", { class: "row" }, [pasteBtn, clearBtn, setBtn]),
    state.importError ? el("div", { class: "consoleBox", style: "margin-top:10px" }, state.importError) : null,
  ].filter(Boolean)));
}

/* --------------------------
   Pages
--------------------------- */
function loadPreset(preset) {
  state.parsedJson = preset.json;
  state.currentPresetId = preset.id || null;
  state.editableJson = JSON.parse(JSON.stringify(preset.json));
  state.rawJsonText = JSON.stringify(preset.json, null, 2);
  state.importError = null;
  state.correctedJsonText = null;
  persistDraft();
}

function homePage() {
  const presets = presetsList().slice(0, 7);
  if (!presets.length) {
    return el("div", { class: "screen" }, [
      card("Most Recent", [el("div", { class: "small" }, "No presets yet. Use Create → Import or preset.")]),
    ]);
  }

  const tiles = presets.map((p, idx) => {
    const img = el("img", { src: p.image || "icons/preset.png", alt: p.name });
    const cap = el("div", { class: "cap" }, p.name);
    const wrap = el("div", { class: idx === 0 ? "big" : "" }, [img, cap]);
    wrap.addEventListener("click", () => { loadPreset(p); state.page = "edit"; persistDraft(); rerender(); });
    return wrap;
  });

  const gallery = el("div", { class: "homeGallery" }, tiles);

  return el("div", { class: "screen" }, [gallery]);
}

function getByPath(obj, pathArr, fallback = "") {
  let cur = obj;
  for (const k of pathArr) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = cur[k];
  }
  return cur ?? fallback;
}
function setByPath(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[pathArr[pathArr.length - 1]] = value;
  persistDraft();
}

/* --------------------------
   Master-driven path helpers
--------------------------- */
function parseMasterPath(pathStr, characterIndex = 0) {
  // Supports a limited wildcard: `characters[]`.
  // Example: characters[].face.eyes.color -> ["characters", 0, "face","eyes","color"]
  const parts = String(pathStr || "").split(".").filter(Boolean);
  const segs = [];
  for (const p of parts) {
    if (p.endsWith("[]")) {
      segs.push(p.slice(0, -2));
      segs.push(characterIndex);
    } else {
      segs.push(p);
    }
  }
  return segs;
}

function getByMasterPath(obj, pathStr, characterIndex = 0, fallback = "") {
  const segs = parseMasterPath(pathStr, characterIndex);
  return getByPath(obj, segs, fallback);
}

function setByMasterPath(obj, pathStr, value, characterIndex = 0) {
  const segs = parseMasterPath(pathStr, characterIndex);
  setByPath(obj, segs, value);
}

function deepEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
}

function ensureOriginalBaseline() {
  if (state.originalJson) return;
  try {
    state.originalJson = state.rawJsonText ? JSON.parse(state.rawJsonText) : JSON.parse(JSON.stringify(state.editableJson));
  } catch {
    state.originalJson = JSON.parse(JSON.stringify(state.editableJson));
  }
  persistDraft();
}

function currentSummaryFields() {
  const j = state.editableJson || {};
  return {
    name: getByPath(j, ["subject", "identity", "name"], ""),
    gender: "Female",
    hairColor: getByPath(j, ["subject", "hair", "color"], ""),
    hairStyle: getByPath(j, ["subject", "hair", "style"], ""),
    eyeColor: getByPath(j, ["subject", "eyes", "color"], ""),
    freckles: getByPath(j, ["subject", "skin", "freckles"], ""),
    height: getByPath(j, ["subject", "identity", "height_cm"], ""),
    framing: getByPath(j, ["composition", "framing"], ""),
    lightingType: getByPath(j, ["image_metadata", "lighting", "type"], ""),
    environment: getByPath(j, ["image_metadata", "environment", "location"], ""),
    outfit: getByPath(j, ["clothing", "outfit_type"], ""),
  };
}

function trKV(key, value, hasSwitch = false, switchOn = false, onToggle = null) {
  const valCell = el("td", { class: "kvVal" }, hasSwitch ? "" : String(value || "—"));
  if (hasSwitch) valCell.appendChild(switchPill(!!switchOn, onToggle));
  return el("tr", {}, [el("td", { class: "kvKey" }, key), valCell]);
}

function importPage() {
  const presetsBtn = el("button", { class: "btn primary full", onclick: () => openPresetPicker() }, "Choose Preset");
  const importCodeBtn = el("button", { class: "btn soft", onclick: () => openImportModal() }, "{}  Import Code");

  const upload = el("input", {
    type: "file",
    accept: ".json,application/json",
    style: "display:none",
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      state.rawJsonText = await f.text();
      const { parsed, error, corrected } = parseJsonLenient(state.rawJsonText);
      state.importError = error;
      state.correctedJsonText = corrected;
      if (error) {
        toast("Import failed");
        persistDraft();
        rerender();
        return;
      }
      state.parsedJson = parsed;
      state.editableJson = parsed;
      state.rawJsonText = JSON.stringify(parsed, null, 2);
      persistDraft();
      toast("Imported");
      rerender();
    },
  });
  const uploadBtn = el("button", { class: "btn soft", onclick: () => upload.click() }, "☁  Upload File");

  const topCards = el("div", { class: "stackCol" }, [
    el("div", { class: "card" }, [
      el("div", { class: "cardBody" }, [
        el("div", { class: "small" }, "Select Preset"),
        hr(),
        el("div", { style: "font-weight:900;font-size:18px;margin-bottom:6px" }, "Choose from pre-made characters"),
        presetsBtn,
      ]),
    ]),
    el("div", { class: "card" }, [
      el("div", { class: "cardBody" }, [
        el("div", { class: "small" }, "Import JSON"),
        hr(),
        el("div", { style: "font-weight:900;font-size:18px;margin-bottom:6px" }, "Import JSON code or upload a file."),
        el("div", { class: "inlineRow" }, [importCodeBtn, uploadBtn]),
        upload,
      ]),
    ]),
  ]);

  const view = currentSummaryFields();
  const jsonTable = el("table", { class: "kvTable" }, [
    trKV("Name", view.name),
    trKV("Gender", view.gender),
    trKV("Height (cm)", view.height),
    trKV("Hair Color", view.hairColor),
    trKV("Hair Style", view.hairStyle),
    trKV("Eye Color", view.eyeColor),
    trKV("Freckles", view.freckles),
    trKV("Framing", (view.framing || "").replace("full body","Full-body").replace("full body shot","Full-body shot") || view.framing),
    trKV("Lighting", view.lightingType),
    trKV("Environment", view.environment),
    trKV("Outfit", view.outfit),
  ]);

  const code = state.editableJson ? JSON.stringify(state.editableJson, null, 2) : (state.rawJsonText || "{\n}\n");
  const codeCard = codeBlock(code, async () => { await copyToClipboard(code); toast("Copied JSON"); });

  const actions = el("div", { class: "btnRowTop" }, [
    el("button", { class: "btn", onclick: () => { state.rawJsonText = ""; state.parsedJson = null; state.editableJson = null; state.importError = null; state.correctedJsonText = null; persistDraft(); toast("Cleared"); rerender(); } }, "Clear"),
    el("button", { class: "btn", onclick: () => { state.editableJson = masterTemplate(); state.rawJsonText = JSON.stringify(state.editableJson, null, 2); persistDraft(); toast("Master template created"); rerender(); } }, "Create Master Template"),
    el("button", { class: "btn primary", onclick: () => {
      if (!state.rawJsonText.trim()) { toast("No JSON to convert"); return; }
      const { parsed, error } = parseJsonLenient(state.rawJsonText);
      if (error) { state.importError = error; toast("Fix JSON first"); persistDraft(); rerender(); return; }
      state.editableJson = convertToMaster(parsed);
      state.rawJsonText = JSON.stringify(state.editableJson, null, 2);
      persistDraft();
      toast("Converted to master");
      rerender();
    } }, "Convert → Master"),
  ]);

  const consoleNode = state.importError ? card("Console", [
    el("div", { class: "consoleBox" }, state.importError + (state.correctedJsonText ? "\n\nAuto-correct attempt prepared." : "")),
  ]) : null;

  return el("div", { class: "screen" }, [
    topCards,
    card("JSON Data", [
      el("div", { class: "row" }, [
        el("button", { class: "btn", onclick: () => { state.createJsonExpanded = !state.createJsonExpanded; persistDraft(); rerender(); } }, state.createJsonExpanded ? "Collapse" : "Expand"),
      ]),
      hr(),
      el("div", { class: "kvWrap" }, [
        el("div", { class: "kvHost" + (state.createJsonExpanded ? "" : " kvCollapsed") }, [jsonTable]),
        state.createJsonExpanded ? null : el("div", { class: "kvFade" }, ""),
      ].filter(Boolean)),
    ]),
    card("JSON Code", [
      el("div", { class: "small" }, "Master template format (line numbers + highlight)."),
      hr(),
      actions,
      hr(),
      codeCard,
    ]),
    consoleNode,
  ].filter(Boolean));
}

function labelField(label, fieldNode) {
  return el("div", { style: "margin-bottom:12px" }, [
    el("div", { class: "small", style: "font-weight:900;margin-bottom:6px;color:var(--muted)" }, label),
    fieldNode,
  ]);
}
function inputText(value, onChange) {
  const i = el("input", { type: "text", value: value || "" });
  i.addEventListener("input", (e) => onChange(e.target.value));
  return i;
}

/* --------------------------
   DB Index (fast path lookup)
--------------------------- */
let _dbEntryByPath = null;
function rebuildDbIndex() {
  _dbEntryByPath = new Map();
  const entries = state.db?.entries || [];
  for (const e of entries) {
    if (e?.path) _dbEntryByPath.set(e.path, e);
  }
}
function dbEntryForPath(path) {
  if (!_dbEntryByPath) rebuildDbIndex();
  return _dbEntryByPath.get(path) || null;
}

function selectFromDb(path, value, onChange) {
  const entry = dbEntryForPath(path);
  const opts = entry?.values || [];
  if (!opts.length) return inputText(value, onChange);
  const s = el("select", {});
  for (const o of opts) s.appendChild(el("option", { value: o }, o));
  s.value = value || opts[0];
  s.addEventListener("change", (e) => onChange(e.target.value));
  return s;
}


/* --------------------------
   Generic Key Editor (works with any imported JSON)
--------------------------- */
function isScalar(v) {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
function valueType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function canonicalizePath(p) {
  // Convert people[0].eyeColor -> people[].eyeColor (for DB lookups + grouping)
  return String(p || "").replace(/\[\d+\]/g, "[]");
}

function getAtSegments(obj, segs) {
  let cur = obj;
  for (const s of segs) {
    if (cur == null) return undefined;
    cur = cur[s];
  }
  return cur;
}
function setAtSegments(obj, segs, val) {
  if (!segs.length) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (cur[s] === undefined || cur[s] === null) {
      // create container based on next seg type
      cur[s] = (typeof segs[i + 1] === "number") ? [] : {};
    }
    cur = cur[s];
  }
  cur[segs[segs.length - 1]] = val;
}

function parseSmartValue(text) {
  const t = String(text ?? "").trim();
  if (!t) return { ok: true, value: "" };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    // Fallback: treat as a raw string for convenience (e.g. user types Green)
    return { ok: true, value: t };
  }
}

function openAdvancedValueEditor(opts) {
  // opts: { title, currentValue, onSave(value) }
  const ta = el("textarea", { style: "min-height:220px" }, (typeof opts.currentValue === "string" ? JSON.stringify(opts.currentValue) : JSON.stringify(opts.currentValue, null, 2)));
  const hint = el("div", { class: "small" }, "Tip: You can paste full JSON (object/array) or type a scalar (e.g. Green). Strings can be typed without quotes.");
  const saveBtn = el("button", { class: "btn primary" }, "Save");
  saveBtn.addEventListener("click", () => {
    const parsed = parseSmartValue(ta.value);
    if (!parsed.ok) {
      toast("Invalid value");
      return;
    }
    try {
      opts.onSave(parsed.value);
      closeTopModal();
      toast("Updated");
      rerender();
    } catch (e) {
      toast("Update failed: " + (e?.message || ""));
    }
  });

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, opts.title || "Advanced Editor"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    hint,
    hr(),
    ta,
    hr(),
    el("div", { class: "row" }, [
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Cancel"),
      saveBtn,
    ]),
  ]));
}

function buildKeyInventory(root) {
  const out = [];
  const walk = (node, segs, pathStr) => {
    const t = valueType(node);
    if (isScalar(node)) {
      out.push({ path: pathStr, canonical: canonicalizePath(pathStr), segs: [...segs], type: t, value: node });
      return;
    }
    if (Array.isArray(node)) {
      // if empty, still allow editing array as a whole
      if (node.length === 0) {
        out.push({ path: pathStr, canonical: canonicalizePath(pathStr), segs: [...segs], type: "array", value: node });
        return;
      }
      for (let i = 0; i < node.length; i++) {
        const p2 = pathStr ? `${pathStr}[${i}]` : `[${i}]`;
        walk(node[i], [...segs, i], p2);
      }
      return;
    }
    if (node && typeof node === "object") {
      const keys = Object.keys(node);
      if (keys.length === 0) {
        out.push({ path: pathStr, canonical: canonicalizePath(pathStr), segs: [...segs], type: "object", value: node });
        return;
      }
      for (const k of keys) {
        const p2 = pathStr ? `${pathStr}.${k}` : k;
        walk(node[k], [...segs, k], p2);
      }
      return;
    }
    // fallback
    out.push({ path: pathStr, canonical: canonicalizePath(pathStr), segs: [...segs], type: t, value: node });
  };
  walk(root, [], "");
  return out.filter((x) => x.path); // drop root empty
}

function categorizeKey(invItem) {
  // 1) DB category if known
  const e = dbEntryForPath(invItem.canonical);
  if (e?.category) return e.category;
  // 2) heuristic: first segment or token match
  const first = String(invItem.path).split(/[.\[]/)[0] || "Uncategorized";
  const p = invItem.canonical.toLowerCase();
  if (p.includes("eye")) return "Eyes";
  if (p.includes("hair")) return "Hair";
  if (p.includes("skin") || p.includes("freckle") || p.includes("makeup")) return "Skin & Makeup";
  if (p.includes("cloth") || p.includes("outfit") || p.includes("dress") || p.includes("shoe")) return "Clothing";
  if (p.includes("light") || p.includes("camera") || p.includes("lens") || p.includes("frame") || p.includes("composition")) return "Camera & Composition";
  return first || "Uncategorized";
}

function genericKeyEditorCard() {
  if (!state.editableJson) return null;

  // Ensure baseline exists for "Default"
  if (!state.originalJson) {
    try {
      state.originalJson = state.rawJsonText ? JSON.parse(state.rawJsonText) : JSON.parse(JSON.stringify(state.editableJson));
    } catch {
      state.originalJson = JSON.parse(JSON.stringify(state.editableJson));
    }
  }

  const inv = buildKeyInventory(state.editableJson);
  const items = inv.map((x) => ({ ...x, category: categorizeKey(x) }));

  // Filters
  state.expert = state.expert || { q:"", cat:"", onlyChanged:false, onlyDb:false, onlyFreeform:false, onlyObjArr:false, selectedPath:"" };
  const q = (state.expert.q || "").trim().toLowerCase();

  const filtered0 = q
    ? items.filter((x) => x.path.toLowerCase().includes(q) || x.canonical.toLowerCase().includes(q))
    : items;

  const filtered = filtered0.filter((x) => {
    const orig = getAtSegments(state.originalJson, x.segs);
    const cur = getAtSegments(state.editableJson, x.segs);
    const entry = dbEntryForPath(x.canonical);
    const isChanged = JSON.stringify(orig) !== JSON.stringify(cur);
    const isDb = !!(entry?.values && entry.values.length);
    const isScalarLeaf = isScalar(cur);
    const isFreeform = isScalarLeaf && !isDb;
    const isObjArr = !isScalarLeaf || Array.isArray(cur) || (cur && typeof cur === "object");

    if (state.expert.onlyChanged && !isChanged) return false;
    if (state.expert.onlyDb && !isDb) return false;
    if (state.expert.onlyFreeform && !isFreeform) return false;
    if (state.expert.onlyObjArr && !isObjArr) return false;
    return true;
  });

  // Group by category
  const byCat = new Map();
  for (const it of filtered) {
    const c = it.category || "Uncategorized";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(it);
  }
  const cats = [...byCat.keys()].sort((a,b)=>a.localeCompare(b));

  if (!state.expert.cat || !byCat.has(state.expert.cat)) state.expert.cat = cats[0] || "Uncategorized";

  const activeItems = (byCat.get(state.expert.cat) || []).slice().sort((a,b)=>a.path.localeCompare(b.path));

  // Selection
  if (!state.expert.selectedPath || !activeItems.find((x)=>x.path===state.expert.selectedPath)) {
    state.expert.selectedPath = activeItems[0]?.path || "";
  }
  const selected = activeItems.find((x)=>x.path===state.expert.selectedPath) || null;

  const search = el("input", { type:"text", placeholder:"Search keys…", value: state.expert.q || "" });
  search.addEventListener("input", (e)=>{ state.expert.q = e.target.value; persistDraft(); rerender(); });

  const chipToggle = (label, key) => {
    const on = !!state.expert[key];
    const b = el("button", { class: "chipBtn" + (on ? " on":""), onclick: (e)=>{ e.preventDefault(); state.expert[key]=!on; persistDraft(); rerender(); } }, label);
    return b;
  };

  const catList = el("div", { class:"catList" }, cats.map((c)=>{
    const count = (byCat.get(c)||[]).length;
    const b = el("button", { class:"catBtn" + (state.expert.cat===c?" active":""), onclick:(e)=>{ e.preventDefault(); state.expert.cat=c; persistDraft(); rerender(); } }, [
      el("span", { class:"catLbl" }, c),
      el("span", { class:"catCount" }, String(count)),
    ]);
    return b;
  }));

  const keyList = el("div", { class:"keyList" }, activeItems.map((it)=>{
    const orig = getAtSegments(state.originalJson, it.segs);
    const cur = getAtSegments(state.editableJson, it.segs);
    const changed = JSON.stringify(orig) !== JSON.stringify(cur);
    const b = el("button", { class:"keyBtn" + (state.expert.selectedPath===it.path?" active":"") + (changed?" changed":""), onclick:(e)=>{ e.preventDefault(); state.expert.selectedPath=it.path; persistDraft(); rerender(); } }, [
      el("div", { class:"keyBtnTitle" }, it.path),
      el("div", { class:"keyBtnSub" }, it.canonical),
    ]);
    return b;
  }));

  const left = el("div", { class:"expertLeft" }, [
    el("div", { class:"expertLeftHead" }, [
      el("div", { class:"small", style:"font-weight:900" }, "Search"),
      search,
      el("div", { class:"chipRow" }, [
        chipToggle("Changed","onlyChanged"),
        chipToggle("DB","onlyDb"),
        chipToggle("Freeform","onlyFreeform"),
        chipToggle("Obj/Arr","onlyObjArr"),
      ]),
    ]),
    el("div", { class:"expertLeftBody" }, [
      el("div", { class:"small", style:"font-weight:900;margin-bottom:8px" }, "Categories"),
      catList,
      el("div", { class:"small", style:"font-weight:900;margin:12px 0 8px" }, "Keys"),
      keyList,
    ])
  ]);

  const inspector = (() => {
    if (!selected) return el("div", { class:"expertRight" }, [
      el("div", { class:"small" }, "No keys match the current filters.")
    ]);

    const orig = getAtSegments(state.originalJson, selected.segs);
    const cur = getAtSegments(state.editableJson, selected.segs);
    const entry = dbEntryForPath(selected.canonical);
    const values = Array.isArray(entry?.values) ? entry.values : [];
    const scalar = isScalar(cur);

    const header = el("div", { class:"inspHead" }, [
      el("div", { class:"inspTitle" }, selected.path),
      el("div", { class:"inspMeta" }, [
        chip(selected.type, "neutral"),
        chip(selected.canonical, "neutral"),
        (JSON.stringify(orig)!==JSON.stringify(cur)) ? chip("Changed", "warn") : chip("Default", "ok"),
      ]),
      entry?.description ? el("div", { class:"small" }, entry.description) : null,
    ].filter(Boolean));

    const reset = el("button", { class:"btn", onclick:(e)=>{ e.preventDefault(); setAtSegments(state.editableJson, selected.segs, orig); persistDraft(); rerender(); } }, "↩ Reset to Default");

    const advanced = el("button", { class:"btn" }, "Advanced JSON…");
    advanced.addEventListener("click", (e)=>{
      e.preventDefault();
      openAdvancedValueEditor({
        title: `Edit: ${selected.path}`,
        currentValue: cur,
        onSave: (v)=>{ setAtSegments(state.editableJson, selected.segs, v); persistDraft(); rerender(); }
      });
    });

    const editor = (() => {
      if (!scalar) {
        const preview = el("pre", { class:"jsonPreview" }, JSON.stringify(cur, null, 2));
        return el("div", { class:"stack" }, [preview, el("div", { class:"row" }, [reset, advanced])]);
      }

      if (!values.length) {
        const i = el("input", { type:"text", value: (cur ?? "") === null ? "" : String(cur ?? "") });
        i.addEventListener("input", (e)=>{ setAtSegments(state.editableJson, selected.segs, e.target.value); persistDraft(); });
        return el("div", { class:"stack" }, [
          el("div", { class:"small" }, "Freeform value"),
          i,
          el("div", { class:"row" }, [reset, advanced]),
        ]);
      }

      const s = el("select", {});
      const defaultLabel = `Default (keep: ${isScalar(orig) ? String(orig) : valueType(orig)})`;
      s.appendChild(el("option", { value:"__DEFAULT__" }, defaultLabel));
      for (const o of values) s.appendChild(el("option", { value:o }, o));
      const sameAsOrig = JSON.stringify(cur) === JSON.stringify(orig);
      s.value = sameAsOrig ? "__DEFAULT__" : (values.includes(cur) ? cur : "__DEFAULT__");
      s.addEventListener("change", (e)=>{
        const v = e.target.value;
        if (v==="__DEFAULT__") setAtSegments(state.editableJson, selected.segs, orig);
        else setAtSegments(state.editableJson, selected.segs, v);
        persistDraft();
        rerender();
      });
      return el("div", { class:"stack" }, [
        el("div", { class:"small" }, "DB-supported values"),
        s,
        el("div", { class:"row" }, [reset, advanced]),
      ]);
    })();

    return el("div", { class:"expertRight" }, [
      header,
      hr(),
      editor,
    ]);
  })();

  const workbench = el("div", { class:"expertWorkbench" }, [left, inspector]);

  return el("div", { class:"card" }, [
    el("div", { class:"cardBody" }, [
      el("div", { class:"cardTitle" }, "Expert Mode"),
      el("div", { class:"small" }, "Fallback editor for any JSON. Search, filter, inspect, and edit one key at a time."),
      hr(),
      workbench,
    ])
  ]);
}


function editPage() {
  if (!state.editableJson) {
    return el("div", { class: "screen" }, [card("Edit", [el("div", { class: "small" }, "No JSON loaded. Use Create → Import or preset.")])]);
  }

  ensureOriginalBaseline();

  const master = state.master;
  const hasCanonical = !!(state.editableJson && (state.editableJson.characters || state.editableJson.scene || state.editableJson.schema_version));

  const convertToCanonical = () => {
    const j = state.editableJson || {};
    // Minimal legacy → canonical conversion (non-destructive: stores source in notes.unmapped)
    const out = {
      schema_version: master?.meta?.canonical_version || "1.3.0",
      scene: {},
      characters: [],
      style: {},
      technical: {},
      notes: { unmapped: {}, source_text: "", adapter_log: [] },
    };
    out.notes.unmapped._source = JSON.parse(JSON.stringify(j));
    const c0 = { id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())), name: "Character 1" };

    // common legacy paths in existing presets
    const legacyName = getByPath(j, ["subject","identity","name"], "");
    if (legacyName) c0.name = legacyName;
    const hairColor = getByPath(j, ["subject","hair","color"], "");
    if (hairColor) c0.hair = { ...(c0.hair||{}), color: hairColor };
    const hairStyle = getByPath(j, ["subject","hair","style"], "");
    if (hairStyle) c0.hair = { ...(c0.hair||{}), style: hairStyle };
    const eyeColor = getByPath(j, ["subject","eyes","color"], "");
    if (eyeColor) c0.face = { ...(c0.face||{}), eyes: { ...(c0.face?.eyes||{}), color: eyeColor } };
    const freckles = getByPath(j, ["subject","skin","freckles"], "");
    if (freckles) c0.face = { ...(c0.face||{}), freckles: !/^none/i.test(String(freckles)) };
    const makeup = getByPath(j, ["subject","eyes","makeup"], "");
    if (makeup) c0.face = { ...(c0.face||{}), makeup: { style: String(makeup) } };
    const height = getByPath(j, ["subject","identity","height_cm"], null);
    if (typeof height === "number") c0.body = { ...(c0.body||{}), height_cm: height };
    const outfit = getByPath(j, ["clothing","outfit_type"], "") || getByPath(j, ["clothing"], "");
    if (outfit) c0.outfit = { description: String(outfit) };

    // scene-ish legacy
    const env = getByPath(j, ["image_metadata","environment","location"], "");
    if (env) out.scene.location = env;
    const light = getByPath(j, ["image_metadata","lighting","type"], "");
    if (light) out.scene.lighting = { style: String(light) };
    const framing = getByPath(j, ["composition","framing"], "");
    if (framing) out.scene.camera = { ...(out.scene.camera||{}), shot: String(framing) };

    out.characters.push(c0);
    state.editableJson = out;
    state.rawJsonText = JSON.stringify(out, null, 2);
    state.originalJson = JSON.parse(JSON.stringify(out));
    persistDraft();
    toast("Converted to Canonical v1.3.0");
    rerender();
  };

  const characters = Array.isArray(state.editableJson?.characters) ? state.editableJson.characters : [];
  const characterCount = characters.length;
  const activeIdx = Math.max(0, Math.min(state.activeCharacterIndex || 0, Math.max(0, characterCount - 1)));
  state.activeCharacterIndex = activeIdx;

  const changedFields = (() => {
    if (!master?.fields || !state.originalJson) return [];
    const guidedFields = master.fields.filter((f) => (f.visibility?.modes || []).includes("guided"));
    const out = [];
    for (const f of guidedFields) {
      if (f.scope === "character") {
        const indices = characterCount ? [...Array(characterCount).keys()] : [0];
        for (const idx of indices) {
          const cur = getByMasterPath(state.editableJson, f.path, idx, null);
          const orig = getByMasterPath(state.originalJson, f.path, idx, null);
          if (!deepEqual(cur, orig)) out.push({ field: f, idx, cur, orig });
        }
      } else {
        const cur = getByMasterPath(state.editableJson, f.path, 0, null);
        const orig = getByMasterPath(state.originalJson, f.path, 0, null);
        if (!deepEqual(cur, orig)) out.push({ field: f, idx: null, cur, orig });
      }
    }
    return out;
  })();

  const openReviewChanges = () => {
    if (!changedFields.length) return toast("No changes");
    const rows = changedFields.map(({ field, idx, cur, orig }) => {
      const who = (idx === null) ? "" : ` • ${characters[idx]?.name || `Character ${idx+1}`}`;
      const left = el("div", { style: "min-width:0" }, [
        el("div", { style: "font-weight:900" }, field.label + who),
        el("div", { class: "small" }, field.id),
      ]);
      const mid = el("div", { class: "small", style: "max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, `${String(orig ?? "—")} → ${String(cur ?? "—")}`);
      const undo = el("button", { class: "btn" }, "Undo");
      undo.addEventListener("click", (e) => {
        e.preventDefault();
        if (idx === null) setByMasterPath(state.editableJson, field.path, orig, 0);
        else setByMasterPath(state.editableJson, field.path, orig, idx);
        persistDraft();
        rerender();
      });
      return el("div", { class: "settingsRow" }, [left, mid, undo]);
    });
    openModal(el("div", {}, [
      el("div", { class: "modalHeader" }, [
        el("div", { class: "modalTitle" }, `Review Changes (${changedFields.length})`),
        el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
      ]),
      hr(),
      ...rows,
    ]));
  };

  const modeSeg = el("div", { class: "seg" }, [
    el("button", { class: state.editMode === "guided" ? "active" : "", onclick: (e) => { e.preventDefault(); state.editMode = "guided"; persistDraft(); rerender(); } }, "Guided"),
    el("button", { class: state.editMode === "expert" ? "active" : "", onclick: (e) => { e.preventDefault(); state.editMode = "expert"; persistDraft(); rerender(); } }, "Expert"),
  ]);

  const scopeSelector = (() => {
    if (!characterCount) return null;
    const sel = el("select", { onchange: (e) => { state.activeCharacterIndex = Number(e.target.value)||0; persistDraft(); rerender(); } });
    characters.forEach((c, i) => sel.appendChild(el("option", { value: String(i) }, c?.name || `Character ${i+1}`)));
    sel.value = String(activeIdx);
    return el("div", { style: "display:flex;gap:8px;align-items:center" }, [
      el("div", { class: "small", style: "white-space:nowrap" }, "Character"),
      sel,
    ]);
  })();

  const applyScopeSelector = (() => {
    if (characterCount <= 1) return null;
    const s = el("select", { onchange: (e) => { state.applyScope = e.target.value; persistDraft(); rerender(); } });
    [
      ["this","This"],
      ["all","All"],
      ["selected","Selected…"],
    ].forEach(([v, t]) => s.appendChild(el("option", { value: v }, t)));
    s.value = state.applyScope;
    s.addEventListener("change", () => {
      if (state.applyScope === "selected") {
        // open a simple selector
        const checks = characters.map((c, i) => {
          const id = c?.id || String(i);
          const cb = el("input", { type:"checkbox" });
          cb.checked = state.selectedCharacterIds.includes(id);
          cb.addEventListener("change", () => {
            const set = new Set(state.selectedCharacterIds);
            if (cb.checked) set.add(id); else set.delete(id);
            state.selectedCharacterIds = [...set];
            persistDraft();
          });
          return el("div", { class:"settingsRow" }, [
            el("div", {}, c?.name || `Character ${i+1}`),
            el("div", {}, cb),
          ]);
        });
        openModal(el("div", {}, [
          el("div", { class:"modalHeader" }, [
            el("div", { class:"modalTitle" }, "Select characters"),
            el("button", { class:"btn", onclick: () => closeTopModal() }, "Done"),
          ]),
          hr(),
          ...checks,
        ]));
      }
    });
    return el("div", { style: "display:flex;gap:8px;align-items:center" }, [
      el("div", { class: "small", style: "white-space:nowrap" }, "Apply"),
      s,
    ]);
  })();

  function applyCharacterValue(field, value) {
    if (state.applyScope === "all") {
      for (let i = 0; i < characterCount; i++) setByMasterPath(state.editableJson, field.path, value, i);
      return;
    }
    if (state.applyScope === "selected") {
      const ids = new Set(state.selectedCharacterIds);
      for (let i = 0; i < characterCount; i++) {
        const id = characters[i]?.id || String(i);
        if (ids.has(id)) setByMasterPath(state.editableJson, field.path, value, i);
      }
      return;
    }
    setByMasterPath(state.editableJson, field.path, value, activeIdx);
  }

  function fieldRow(field) {
    const idx = (field.scope === "character") ? activeIdx : 0;
    const cur = getByMasterPath(state.editableJson, field.path, idx, "");
    const orig = getByMasterPath(state.originalJson, field.path, idx, "");
    const isDefault = deepEqual(cur, orig);

    const chipNode = chip(isDefault ? `Default (keep: ${String(orig ?? "—")})` : `Overridden (${String(cur ?? "—")})`, isDefault ? "ok" : "warn");

    const resetBtn = el("button", { class:"btn" }, "↩ Reset");
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (field.scope === "character") applyCharacterValue(field, orig);
      else setByMasterPath(state.editableJson, field.path, orig, 0);
      persistDraft();
      rerender();
    });

    const control = (() => {
      const c = field.control || { kind: "input" };
      if (c.kind === "readonly") return el("div", { class:"small" }, String(cur || "—"));

      if (c.kind === "segmented") {
        const opts = (typeof c.options === "string" && c.options.startsWith("vocab."))
          ? (master?.vocab?.[c.options.slice(6)] || [])
          : (Array.isArray(c.options) ? c.options : []);
        const wrap = el("div", { class:"seg" }, []);
        for (const o of opts) {
          const active = (String(cur) === String(o)) || (isDefault && String(o).toLowerCase() === "no" && cur === orig);
          const b = el("button", { class: active ? "active" : "" }, String(o));
          b.addEventListener("click", (e) => {
            e.preventDefault();
            const v = (String(o).toLowerCase() === "no") ? false : true;
            if (field.scope === "character") applyCharacterValue(field, v);
            else setByMasterPath(state.editableJson, field.path, v, 0);
            persistDraft();
            rerender();
          });
          wrap.appendChild(b);
        }
        return wrap;
      }

      if (c.kind === "select") {
        const src = c.source || "";
        const opts = (typeof src === "string" && src.startsWith("vocab."))
          ? (master?.vocab?.[src.slice(6)] || [])
          : [];
        const s = el("select", {});
        s.appendChild(el("option", { value: "__DEFAULT__" }, `Default (keep: ${String(orig ?? "—")})`));
        for (const o of opts) s.appendChild(el("option", { value: String(o) }, String(o)));
        s.value = isDefault ? "__DEFAULT__" : String(cur);
        s.addEventListener("change", (e) => {
          const v = e.target.value;
          const val = (v === "__DEFAULT__") ? orig : v;
          if (field.scope === "character") applyCharacterValue(field, val);
          else setByMasterPath(state.editableJson, field.path, val, 0);
          persistDraft();
          rerender();
        });
        return s;
      }

      if (c.kind === "slider") {
        const i = el("input", { type:"range", min:c.min ?? 0, max:c.max ?? 100, step:c.step ?? 1, value: Number(cur ?? orig ?? 0) });
        const valLab = el("div", { class:"small" }, String(cur ?? orig ?? 0) + (c.unit || ""));
        i.addEventListener("input", (e) => { valLab.textContent = String(e.target.value) + (c.unit || ""); });
        i.addEventListener("change", (e) => {
          const n = Number(e.target.value);
          if (field.scope === "character") applyCharacterValue(field, n);
          else setByMasterPath(state.editableJson, field.path, n, 0);
          persistDraft();
          rerender();
        });
        return el("div", { style:"display:flex;gap:10px;align-items:center" }, [i, valLab]);
      }

      if (c.kind === "stepper") {
        const i = el("input", { type:"number", min:c.min, max:c.max, step:c.step || 1, value: String(cur ?? orig ?? "") });
        i.addEventListener("input", (e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          if (field.scope === "character") applyCharacterValue(field, n);
          else setByMasterPath(state.editableJson, field.path, n, 0);
          persistDraft();
        });
        return i;
      }
      if (c.kind === "textarea") {
        const currentText = String(cur ?? orig ?? "");
        if (state.editMode === "guided") {
          const trimmed = currentText.trim();
          const preview = trimmed ? trimmed.slice(0, 42) + (trimmed.length > 42 ? "…" : "") : (c.placeholder || "Tap to edit");
          const btn = el("button", { class: "iosCellBtn", onclick: (e) => {
            e.preventDefault();
            const ta = el("textarea", { rows: c.rows || 8, placeholder: c.placeholder || "" }, currentText);
            ta.addEventListener("input", (ev) => {
              const v = ev.target.value;
              if (field.scope === "character") applyCharacterValue(field, v);
              else setByMasterPath(state.editableJson, field.path, v, 0);
              persistDraft();
            });
            openModal(el("div", {}, [
              el("div", { class: "modalHeader" }, [
                el("div", { class: "modalTitle" }, field.label),
                el("button", { class: "btn", onclick: () => document.querySelector('.modalBack')?.remove() }, "Done"),
              ]),
              el("div", { class: "modalBody" }, [ta]),
            ]));
          } }, [
            el("div", { class: "iosCellMain" }, [
              el("div", { class: "iosCellValue" }, preview),
            ]),
            el("div", { class: "iosChevron" }, "›"),
          ]);
          return btn;
        }

        const t = el("textarea", { rows: c.rows || 3 }, currentText);
        t.addEventListener("input", (e) => {
          const v = e.target.value;
          if (field.scope === "character") applyCharacterValue(field, v);
          else setByMasterPath(state.editableJson, field.path, v, 0);
          persistDraft();
        });
        return t;
      }


      if (c.kind === "list_editor") {
        const arr = Array.isArray(cur) ? cur : (Array.isArray(orig) ? orig : []);
        const list = el("div", {}, []);
        const render = () => {
          list.innerHTML = "";
          arr.forEach((item, ix) => {
            const inp = el("input", { type:"text", value: String(item || "") });
            inp.addEventListener("input", (e) => {
              arr[ix] = e.target.value;
              if (field.scope === "character") applyCharacterValue(field, arr);
              else setByMasterPath(state.editableJson, field.path, arr, 0);
              persistDraft();
            });
            const del = el("button", { class:"btn" }, "✕");
            del.addEventListener("click", (e) => {
              e.preventDefault();
              arr.splice(ix,1);
              if (field.scope === "character") applyCharacterValue(field, arr);
              else setByMasterPath(state.editableJson, field.path, arr, 0);
              persistDraft();
              render();
            });
            list.appendChild(el("div", { class:"row", style:"gap:8px" }, [inp, del]));
          });
        };
        render();
        const add = el("button", { class:"btn" }, c.add_label || "Add");
        add.addEventListener("click", (e) => {
          e.preventDefault();
          arr.push("");
          if (field.scope === "character") applyCharacterValue(field, arr);
          else setByMasterPath(state.editableJson, field.path, arr, 0);
          persistDraft();
          render();
        });
        return el("div", {}, [list, add]);
      }
      // default: input
      const currentVal = String(cur ?? orig ?? "");
      if (state.editMode === "guided") {
        const preview = currentVal.trim() ? currentVal.trim() : (c.placeholder || "Tap to edit");
        const btn = el("button", { class: "iosCellBtn", onclick: (e) => {
          e.preventDefault();
          const inp = el("input", { type: "text", placeholder: c.placeholder || "", value: currentVal });
          inp.addEventListener("input", (ev) => {
            const v = ev.target.value;
            if (field.scope === "character") applyCharacterValue(field, v);
            else setByMasterPath(state.editableJson, field.path, v, 0);
            persistDraft();
          });
          openModal(el("div", {}, [
            el("div", { class: "modalHeader" }, [
              el("div", { class: "modalTitle" }, field.label),
              el("button", { class: "btn", onclick: () => document.querySelector('.modalBack')?.remove() }, "Done"),
            ]),
            el("div", { class: "modalBody" }, [inp]),
          ]));
        } }, [
          el("div", { class: "iosCellMain" }, [
            el("div", { class: "iosCellValue" }, preview),
          ]),
          el("div", { class: "iosChevron" }, "›"),
        ]);
        return btn;
      }

      const i = el("input", { type:"text", placeholder: c.placeholder || "", value: currentVal });
      i.addEventListener("input", (e) => {
        const v = e.target.value;
        if (field.scope === "character") applyCharacterValue(field, v);
        else setByMasterPath(state.editableJson, field.path, v, 0);
        persistDraft();
      });
      return i;
    })();

    return el("div", { class:"fieldRow" }, [
      el("div", { class:"fieldLeft" }, [
        el("div", { class:"fieldLabel" }, field.label),
        field.help_text ? el("div", { class:"small fieldHelp" }, field.help_text) : null,
      ].filter(Boolean)),
      el("div", { class:"fieldRight" }, [
        el("div", { class:"fieldActions" }, [chipNode, resetBtn]),
        control,
      ]),
    ]);
  }

  const guidedContent = (() => {
    if (!master?.fields) {
      return card("Guided Editor", [
        el("div", { class:"small" }, "Master file not loaded. Use Expert mode."),
      ]);
    }
    if (!hasCanonical) {
      return card("Guided Editor", [
        el("div", { class:"small" }, "This JSON is not in canonical format. Convert to Canonical to use Guided mode, or use Expert mode."),
        hr(),
        el("button", { class:"btn primary", onclick: convertToCanonical }, "Convert → Canonical"),
      ]);
    }

    const guidedFields = master.fields
      .filter((f) => (f.visibility?.modes || []).includes("guided"))
      .slice()
      .sort((a,b) => (a.category||"").localeCompare(b.category||"") || (a.order||0)-(b.order||0));

    // category order from master.categories, fallback alphabetical
    const catOrder = new Map();
    (master.categories || []).forEach((c, i) => catOrder.set(c.id, c.order ?? (i*10)));

    const byCat = new Map();
    for (const f of guidedFields) {
      const c = f.category || "Advanced";
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c).push(f);
    }

    const cats = [...byCat.keys()].sort((a,b) => (catOrder.get(a) ?? 9999) - (catOrder.get(b) ?? 9999) || a.localeCompare(b));

    const sections = cats.map((c, idx) => {
      const fs = (byCat.get(c) || []).slice().sort((a,b) => (a.order||0)-(b.order||0));
      const changedInCat = changedFields.filter((x) => (x.field?.category || "Advanced") === c);
      const badge = changedInCat.length ? `Changed ${changedInCat.length}` : `${fs.length}`;
      // SiliconTitsUI 2.0: start collapsed to avoid overwhelming users.
      // Auto-open only when the category contains edits.
      const defaultOpen = !!changedInCat.length;

      return collapsibleCard({
        id: "guided:" + c,
        title: c,
        subtitle: changedInCat.length ? "Contains edits" : null,
        rightBadge: badge,
        defaultOpen,
        bodyNodes: fs.map(fieldRow),
      });
    });

    return el("div", { class: "guidedStack" }, sections);
  })();;

  const topBar = el("div", { class:"editTop" }, [
    toolbar([
      el("div", { class:"toolGroup" }, [modeSeg]),
      scopeSelector,
      applyScopeSelector,
      el("div", { style:"flex:1" }, ""),
      chip(`Changed: ${changedFields.length}`, changedFields.length ? "warn" : "ok"),
      iconTextBtn("Review", "btn", openReviewChanges),
      iconTextBtn("Export", "btn primary", () => { state.page = "export"; persistDraft(); rerender(); }),
    ].filter(Boolean)),
  ]);

  const body = (state.editMode === "expert")
    ? el("div", {}, [card("Expert Mode", [el("div", { class:"small" }, "Fallback editor for any JSON. Search, edit, reset to Default." )]), genericKeyEditorCard()].filter(Boolean))
    : guidedContent;

  return el("div", { class: "screen" }, [topBar, body].filter(Boolean));
}

function pickUseCasePrompt(tab) {
  const usecases = state.prompts?.prompts?.use_cases || { image_type: [], add_on_effect: [], converting: [] };
  if (tab === "portrait") return (usecases.image_type.find((p) => p.id.startsWith("image_type_hyperreal_")) || usecases.image_type[0] || { prompt: "" }).prompt;
  if (tab === "fashion") return (usecases.add_on_effect.find((p) => p.id.startsWith("addon_color_filters_")) || usecases.add_on_effect[0] || { prompt: "" }).prompt;
  return (usecases.converting.find((p) => p.id.startsWith("convert_anime_to_real_")) || usecases.converting[0] || { prompt: "" }).prompt;
}

function buildOptimizerOutput() {
  const models = state.prompts?.prompts?.model_specific || [];
  const master = state.prompts?.prompts?.master_prompt || "";
  const model = models.find((m) => m.id === state.selectedModelPromptId)?.prompt || "";
  const use = pickUseCasePrompt(state.optimizeTab);

  const blocks = [];
  if (state.addJsonOutput && state.editableJson) blocks.push(JSON.stringify(state.editableJson, null, 2));
  if (state.addMasterPrompt) blocks.push(master);
  if (state.addModelPrompt) blocks.push(model);
  if (state.addUseCasePrompt) blocks.push(use);

  return blocks.filter(Boolean).join("\n\n---\n\n");
}

function exportPage() {
  const models = state.prompts?.prompts?.model_specific || [];

  const modelSel = el("select", { onchange: (e) => { state.selectedModelPromptId = e.target.value; persistDraft(); rerender(); } });
  for (const m of models) modelSel.appendChild(el("option", { value: m.id }, m.title));
  modelSel.value = state.selectedModelPromptId;

  const seg = el("div", { class: "seg" }, [
    el("button", { class: state.optimizeTab === "portrait" ? "active" : "", onclick: () => { state.optimizeTab = "portrait"; persistDraft(); rerender(); } }, "Portrait"),
    el("button", { class: state.optimizeTab === "fashion" ? "active" : "", onclick: () => { state.optimizeTab = "fashion"; persistDraft(); rerender(); } }, "Fashion"),
    el("button", { class: state.optimizeTab === "fitness" ? "active" : "", onclick: () => { state.optimizeTab = "fitness"; persistDraft(); rerender(); } }, "Fitness"),
  ]);

  const output = buildOptimizerOutput();
  const wrappedOutput = `${state.exportPrefix || ""}${output}${state.exportSuffix || ""}`;

  const jsonOut = state.editableJson ? JSON.stringify(state.editableJson, null, 2) : "{\n}\n";

  const toggles = el("div", { class: "row" }, [
    el("div", {}, [el("div", { class: "small" }, "Master"), switchPill(state.addMasterPrompt, () => { state.addMasterPrompt = !state.addMasterPrompt; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "Model"), switchPill(state.addModelPrompt, () => { state.addModelPrompt = !state.addModelPrompt; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "Use-case"), switchPill(state.addUseCasePrompt, () => { state.addUseCasePrompt = !state.addUseCasePrompt; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "JSON"), switchPill(state.addJsonOutput, () => { state.addJsonOutput = !state.addJsonOutput; persistDraft(); rerender(); })]),
  ]);

  const copyBtn = el("button", { class: "btn primary", onclick: async () => {
    try { await copyToClipboard(wrappedOutput); toast("Copied output"); }
    catch { toast("Copy blocked"); }
  } }, "Copy Output");

  const copyJsonBtn = el("button", { class: "btn", onclick: async () => {
    try { await copyToClipboard(jsonOut); toast("Copied JSON"); }
    catch { toast("Copy blocked"); }
  } }, "Copy JSON");

  const dlJsonBtn = el("button", { class: "btn", onclick: () => {
    if (!state.editableJson) { toast("Nothing to export"); return; }
    downloadJson("boobly-export.json", state.editableJson);
  } }, "Download JSON");

  const prefix = el("textarea", { rows: 2, placeholder: "Prefix (optional) — text inserted before output" }, state.exportPrefix || "");
  prefix.addEventListener("input", (e) => { state.exportPrefix = e.target.value; persistDraft(); rerender(); });
  const suffix = el("textarea", { rows: 2, placeholder: "Suffix (optional) — text inserted after output" }, state.exportSuffix || "");
  suffix.addEventListener("input", (e) => { state.exportSuffix = e.target.value; persistDraft(); rerender(); });

  return el("div", { class: "screen" }, [
    card("Model Optimizer", [
      el("div", { class: "small" }, "Build a single output by merging JSON and prompt blocks."),
      hr(),
      el("div", { class: "small", style: "font-weight:900" }, "Select Model"),
      modelSel,
      hr(),
      el("div", { class: "small", style: "font-weight:900" }, "Merge Options"),
      toggles,
      hr(),
      el("div", { class: "btnRowTop" }, [copyBtn, copyJsonBtn, dlJsonBtn]),
      hr(),
      el("div", { class: "small", style: "font-weight:900" }, "Model Wrappers"),
      el("div", { class: "small" }, "Use these when a model requires a prefix/suffix wrapper around the compiled output."),
      el("div", { class: "stack" }, [prefix, suffix]),
      hr(),
      el("textarea", { readonly: true }, wrappedOutput),
    ]),
    card("Prompt Optimization", [
      seg,
      hr(),
      el("textarea", { readonly: true }, pickUseCasePrompt(state.optimizeTab)),
    ]),
  ]);
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Downloaded " + filename);
}

function fileImportButton(label, onText) {
  const input = el("input", { type: "file", accept: ".json,application/json", style: "display:none" });
  input.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await onText(await f.text());
  });
  const btn = el("button", { class: "btn", onclick: () => input.click() }, label);
  return el("div", {}, [btn, input]);
}

function openPresetsManager() {
  const presets = presetsList();
  const grid = presets.length
    ? el("div", { class: "presetGrid" }, presets.map((p) => presetTile(p, () => {})))
    : el("div", { class: "small" }, "No presets yet.");

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Presets (long-press image)"),
      el("button", { class: "btn", onclick: () => closeTopModal() }, "Close"),
    ]),
    hr(),
    el("div", { class: "small" }, "Long-press a preset tile to set its image."),
    hr(),
    grid,
  ]));
}

function settingsPage() {
  const wpInput = el("input", {
    type: "file",
    accept: "image/*",
    style: "display:none",
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      await setWallpaper(f);
      toast("Wallpaper set");
      rerender();
    },
  });
  const wpBtn = el("button", { class: "btn", onclick: () => wpInput.click() }, "Choose Wallpaper");
  const clearWp = el("button", { class: "btn", onclick: async () => { await setWallpaper(null); toast("Wallpaper cleared"); rerender(); } }, "Clear Wallpaper");

  const exportDb = el("button", { class: "btn primary", onclick: () => downloadJson("boobly-database.json", state.db) }, "Export Database");
  const exportPrompts = el("button", { class: "btn", onclick: () => downloadJson("boobly-prompts.json", state.prompts) }, "Export Prompts");
  const exportAll = el("button", {
    class: "btn primary",
    onclick: () => {
      const payload = { version: VERSION, exported_at: Date.now(), database: state.db, prompts: state.prompts, presets: presetsList(), changelog: state.changelog };
      downloadJson("boobly-export-all.json", payload);
    },
  }, "Export All");

  const importDb = fileImportButton("Import Database", async (txt) => {
    try {
      const j = JSON.parse(txt);
      const v = validateDatabase(j);
      if (!v.ok) throw new Error(v.error);
      state.db = j;
      rebuildDbIndex();
      saveLS(STORAGE.db, j);
      toast("Imported DB");
      rerender();
    } catch (e) {
      toast("DB import failed: " + (e?.message || ""));
    }
  });

  const importPrompts = fileImportButton("Import Prompts", async (txt) => {
    try {
      const j = JSON.parse(txt);
      const v = validatePrompts(j);
      if (!v.ok) throw new Error(v.error);
      state.prompts = j;
      saveLS(STORAGE.prompts, j);
      toast("Imported Prompts");
      rerender();
    } catch (e) {
      toast("Prompts import failed: " + (e?.message || ""));
    }
  });
  const importAll = fileImportButton("Import All", async (txt) => {
    try {
      const j = JSON.parse(txt);
      if (j.database) {
        const vd = validateDatabase(j.database);
        if (!vd.ok) throw new Error("DB: " + vd.error);
        state.db = j.database;
        rebuildDbIndex();
        saveLS(STORAGE.db, j.database);
      }
      if (j.prompts) {
        const vp = validatePrompts(j.prompts);
        if (!vp.ok) throw new Error("Prompts: " + vp.error);
        state.prompts = j.prompts;
        saveLS(STORAGE.prompts, j.prompts);
      }
      if (j.presets) {
        const vps = validatePresets(j.presets);
        if (!vps.ok) throw new Error("Presets: " + vps.error);
        saveLS(STORAGE.presets, j.presets);
      }
      if (j.changelog) {
        const vc = validateChangelog(j.changelog);
        if (!vc.ok) throw new Error("Changelog: " + vc.error);
        state.changelog = j.changelog;
        saveLS(STORAGE.changelog, j.changelog);
      }
      toast("Imported ALL");
      rerender();
    } catch (e) {
      toast("Import ALL failed: " + (e?.message || ""));
    }
  });

  const llmUrl = el("input", { type: "text", placeholder: "https://chatgpt.com/", value: loadLS(STORAGE.llmUrl, "https://chatgpt.com/") || "" });
  llmUrl.addEventListener("input", (e) => saveLS(STORAGE.llmUrl, e.target.value));

  const openToggle = switchPill(loadLS(STORAGE.openOnGen, true), () => {
    const cur = loadLS(STORAGE.openOnGen, true);
    saveLS(STORAGE.openOnGen, !cur);
    rerender();
  });

  const helpBtn = el("button", { class: "btn", onclick: () => openHelpModal() }, "Help");
  const presetsBtn = el("button", { class: "btn", onclick: () => openPresetsManager() }, "Presets");
  const changelogBtn = el("button", { class: "btn", onclick: () => openChangelogModal() }, "Changelog");

  return el("div", { class: "screen" }, [
    card("Import / Export", [
      el("div", { class: "row" }, [importDb, exportDb]),
      el("div", { class: "row" }, [importPrompts, exportPrompts]),
      el("div", { class: "row" }, [importAll, exportAll]),
      hr(),
      el("div", { class: "fileRow" }, [wpBtn, clearWp, wpInput]),
      hr(),
      el("div", { class: "small", style: "font-weight:900" }, "LLM Integration"),
      llmUrl,
      el("div", { class: "settingsRow" }, [el("div", { class: "small" }, "Open LLM URL on Generate"), el("div", { style: "flex:0" }, openToggle)]),
      hr(),
      el("div", { class: "row" }, [helpBtn, presetsBtn, changelogBtn]),
      el("div", { class: "small" }, `Version ${VERSION}`),
    ]),
  ]);
}

/* --------------------------
   Render
--------------------------- */
function pageTitle() {
  if (state.page === "import") return "Import";
  if (state.page === "edit") return "Edit";
  if (state.page === "export") return "Export";
  return "Settings";
}

function route() {
  if (state.page === "import") return importPage();
  if (state.page === "edit") return editPage();
  if (state.page === "export") return exportPage();
  return settingsPage();
}

function rerender() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  const overlay = el("div", { class: "wallpaperOverlay" }, []);
  overlay.appendChild(header(pageTitle()));
  let pageNode;
  try {
    pageNode = route();
  } catch (e) {
    console.error(e);
    pageNode = card("Something went wrong", [
      el("div", { class: "small" }, String(e && (e.stack || e.message || e))),
      hr(),
      el("button", { class: "btn", onclick: () => { try { localStorage.clear(); } catch {} location.reload(); } }, "Reset app state"),
    ]);
  }
  overlay.appendChild(pageNode);
  overlay.appendChild(tabs());
  root.appendChild(overlay);
}

async function init() {
  setTheme(loadLS(STORAGE.theme, "light") || "light");
  /* Wallpaper: migrate legacy localStorage DataURL (if any) to IndexedDB */
  const legacyWp = loadLS(STORAGE.wallpaper, null);
  if (typeof legacyWp === "string" && legacyWp.startsWith("data:")) {
    const b = await dataUrlToBlob(legacyWp);
    if (b) {
      await idbSet(STORAGE.wallpaper, b);
      try { localStorage.removeItem(STORAGE.wallpaper); } catch {}
    }
  }
  const wpBlob = await idbGet(STORAGE.wallpaper);
  await applyWallpaperBlob(wpBlob);


  const dbLS = loadLS(STORAGE.db, null);
  const prLS = loadLS(STORAGE.prompts, null);
  state.db = dbLS || (await fetchJson("database.json"));
  rebuildDbIndex();
  state.prompts = prLS || (await fetchJson("prompts.json"));

  // Master file (Option A) — drives Guided/Expert editor.
  const mLS = loadLS(STORAGE.master, null);
  state.master = mLS || (await fetchJson("master_file_v1_3_0.json").catch(() => null));
  if (state.master) saveLS(STORAGE.master, state.master);

  const clLS = loadLS(STORAGE.changelog, null);
  state.changelog = clLS || (await fetchJson("changelog.json").catch(() => DEFAULT_CHANGELOG));

  // restore draft (prevents refresh data loss)
  const draft = loadLS(STORAGE.draft, null);
  if (draft?.editableJson) {
    state.editableJson = draft.editableJson;
    state.rawJsonText = draft.rawJsonText || JSON.stringify(draft.editableJson, null, 2);
    state.originalJson = draft.originalJson || null;
    state.keySearch = draft.keySearch || "";
    state.keyEditorExpanded = draft.keyEditorExpanded || {};
    // If originalJson was not persisted, reconstruct from rawJsonText if possible
    if (!state.originalJson && state.rawJsonText) {
      try { state.originalJson = JSON.parse(state.rawJsonText); } catch {}
    }
  }
  const lastPage = loadLS(STORAGE.page, "home");
  if (lastPage) state.page = lastPage;

  await seedPresetsIfEmpty();

  // PWA
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); } catch {}
  }
  rerender();
}
init();
