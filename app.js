// BooBly v1.2 — responsive glass UI, safer persistence, better JSON tools, preset images, unified outputs.

const state = {
  db: null,
  prompts: null,

  rawJsonText: "",
  parsedJson: null,
  editableJson: null,
  importError: null,
  correctedJsonText: null,

  page: "home", // home | create | edit | optimize | settings
  lastPageBeforeSettings: "home",

  theme: "light",
  wallpaper: null,

  // Optimizer output composition
  addMasterPrompt: true,
  addModelPrompt: true,
  addUseCasePrompt: true,
  addJsonOutput: false,

  selectedModelPromptId: "gpt52_image_prompt_compiler_v1",
  optimizeTab: "portrait", // portrait | fashion | fitness
};

const STORAGE = {
  theme: "boobly.theme",
  wallpaper: "boobly.wallpaper",
  presets: "boobly.presets",
  db: "boobly.db",
  prompts: "boobly.prompts",
  llmUrl: "boobly.llmUrl",
  openOnGen: "boobly.openOnGenerate",
  draft: "boobly.draft.v1",
  page: "boobly.page",
};

const VERSION = "1.2.0";

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
const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function persistDraft() {
  const payload = {
    rawJsonText: state.rawJsonText,
    editableJson: state.editableJson,
    page: state.page,
    ts: Date.now(),
  };
  saveLS(STORAGE.draft, payload);
  saveLS(STORAGE.page, state.page);
}

const setTheme = (th) => {
  state.theme = th;
  document.documentElement.setAttribute("data-theme", th);
  saveLS(STORAGE.theme, th);
};

const setWallpaper = (dataUrl) => {
  state.wallpaper = dataUrl;
  const app = document.getElementById("app");
  app.style.backgroundImage = dataUrl ? `url(${dataUrl})` : "none";
  saveLS(STORAGE.wallpaper, dataUrl);
};

async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Failed to load " + path);
  return await r.json();
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
    .replaceAll(">", "&gt;");
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

function presetsList() {
  return loadLS(STORAGE.presets, []);
}
function savePreset(name, jsonObj) {
  const presets = presetsList();
  presets.unshift({ id: crypto.randomUUID(), name, created: Date.now(), json: jsonObj, image: null });
  saveLS(STORAGE.presets, presets);
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
    el(
      "div",
      {
        class: "tab" + (state.page === p ? " active" : ""),
        onclick: () => {
          state.page = p;
          persistDraft();
          rerender();
        },
      },
      [el("div", { class: "ico" }, ico), el("div", { class: "lbl" }, lbl)]
    );

  return el("div", { class: "tabs" }, [
    el("div", { class: "tabRow" }, [
      mk("home", "⌂", "Home"),
      mk("create", "▦", "Create"),
      mk("edit", "🗎", "Edit"),
      mk("optimize", "⚡", "Optimize"),
    ]),
  ]);
}

function card(title, bodyNodes) {
  return el("div", { class: "card" }, [el("div", { class: "cardBody" }, [el("div", { class: "cardTitle" }, title), ...bodyNodes])]);
}
function hr() { return el("div", { class: "hr" }); }

/* --------------------------
   Modals
--------------------------- */
function openModal(contentNode) {
  const back = el("div", {
    class: "modalBack",
    onclick: (e) => {
      if (e.target === back) back.remove();
    },
  }, [el("div", { class: "modal" }, [contentNode])]);
  document.body.appendChild(back);
  return back;
}

function openHelpModal() {
  const steps = [
    "1) Home: review your most recent presets.",
    "2) Create: import RAW JSON or upload a .json file.",
    "3) Use “Convert → Master” to normalize the JSON into BooBly’s master template.",
    "4) Edit: adjust fields (hair/eyes/freckles etc.). Changes are saved locally to prevent refresh loss.",
    "5) Save Preset: stores JSON + optional image (upload in Settings → Presets).",
    "6) Optimize: choose model + use-case blocks; optionally merge JSON + prompts into one output.",
    "7) Settings: import/export database, prompts, or everything; set wallpaper; set LLM URL.",
  ];
  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Help — How to use BooBly"),
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
    ]),
    hr(),
    el("div", { class: "small" }, steps.join("\n")),
  ]));
}

function openChangelogModal() {
  const text =
`BooBly Changelog

v1.0.0
- Initial MVP: Create/Edit/Optimize/Settings
- KV database + prompts import/export
- PWA + offline cache

v1.1.0
- Glass UI update
- Clear button + JSON import improvements
- Master JSON template + converter
- Basic prompt blocks

v1.2.0
- Responsive layout improvements
- Menu toggle closes Settings
- Sun/Moon theme toggle
- Draft persistence to prevent refresh data loss
- Import modal: Paste from clipboard
- Expanded JSON Data summary
- Fixed-height console with scroll
- JSON code: line numbers + syntax highlight
- Preset images (upload in Settings → Presets)
- Unified output option (merge JSON + prompts)
- Help guide added`;
  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Changelog"),
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
    ]),
    hr(),
    el("div", { class: "small", style: "white-space:pre-wrap;" }, text),
  ]));
}

function openPresetPicker() {
  const presets = presetsList();
  const grid = presets.length
    ? el("div", { class: "presetGrid" }, presets.map((p) => presetTile(p, () => {
        loadPreset(p);
        state.page = "create";
        persistDraft();
        rerender();
        document.querySelector(".modalBack")?.remove();
      })))
    : el("div", { class: "small" }, "No presets yet.");

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Select Preset"),
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
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
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
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
      state.editableJson = convertToMaster(parsed);
      state.rawJsonText = JSON.stringify(state.editableJson, null, 2);
      persistDraft();
      toast("Imported + converted");
      document.querySelector(".modalBack")?.remove();
      rerender();
    },
  }, "Set");

  openModal(el("div", {}, [
    el("div", { class: "modalHeader" }, [
      el("div", { class: "modalTitle" }, "Import JSON"),
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
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
  state.editableJson = JSON.parse(JSON.stringify(preset.json));
  state.rawJsonText = JSON.stringify(preset.json, null, 2);
  state.importError = null;
  state.correctedJsonText = null;
  persistDraft();
}

function homePage() {
  const presets = presetsList().slice(0, 4);
  const grid = presets.length
    ? el("div", { class: "presetGrid" }, presets.map((p) => presetTile(p, () => { loadPreset(p); state.page = "edit"; persistDraft(); rerender(); })))
    : el("div", { class: "small" }, "No presets yet. Create one from Create → Save Preset.");

  return el("div", { class: "screen" }, [
    el("div", { class: "card" }, [
      el("div", { class: "cardBody" }, [
        el("div", { class: "small" }, "Most Recent"),
        hr(),
        grid,
        hr(),
        el("button", { class: "btn", onclick: () => { state.page = "create"; persistDraft(); rerender(); } }, "Create New"),
      ]),
    ]),
  ]);
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

function createPage() {
  const presetsBtn = el("button", { class: "btn primary", onclick: () => openPresetPicker() }, "Choose Preset");
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
      state.editableJson = convertToMaster(parsed);
      state.rawJsonText = JSON.stringify(state.editableJson, null, 2);
      persistDraft();
      toast("Imported + converted");
      rerender();
    },
  });
  const uploadBtn = el("button", { class: "btn soft", onclick: () => upload.click() }, "☁  Upload File");

  const topCards = el("div", { class: "row" }, [
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
        importCodeBtn,
        el("div", { style: "height:10px" }, ""),
        uploadBtn,
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
    trKV("Framing", view.framing),
    trKV("Lighting", view.lightingType),
    trKV("Environment", view.environment),
    trKV("Outfit", view.outfit),
  ]);

  const code = state.editableJson ? JSON.stringify(state.editableJson, null, 2) : (state.rawJsonText || "{\n}\n");
  const codeCard = codeBlock(code, async () => { await copyToClipboard(code); toast("Copied JSON"); });

  const actions = el("div", { class: "row" }, [
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
    card("JSON Data", [jsonTable]),
    card("JSON Code", [
      el("div", { class: "small" }, "Master template format (line numbers + highlight)."),
      hr(),
      codeCard,
      hr(),
      actions,
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
function selectFromDb(path, value, onChange) {
  const entry = (state.db?.entries || []).find((e) => e.path === path);
  const opts = entry?.values || [];
  if (!opts.length) return inputText(value, onChange);
  const s = el("select", {});
  for (const o of opts) s.appendChild(el("option", { value: o }, o));
  s.value = value || opts[0];
  s.addEventListener("change", (e) => onChange(e.target.value));
  return s;
}

function editPage() {
  if (!state.editableJson) {
    return el("div", { class: "screen" }, [card("Edit", [el("div", { class: "small" }, "No JSON loaded. Use Create → Import or preset.")])]);
  }

  const previewImg = (() => {
    const presets = presetsList();
    const name = getByPath(state.editableJson, ["subject","identity","name"], "");
    const p = presets.find((x) => x.name === name) || presets[0];
    return p?.image || "icons/preset.png";
  })();

  const view = currentSummaryFields();

  const content = el("div", { class: "card" }, [
    el("div", { class: "cardBody" }, [
      el("img", { src: previewImg, alt: "Preview", style: "width:100%;height:220px;object-fit:cover;border-radius:18px;display:block;" }),
      hr(),
      labelField("Name", inputText(view.name, (v) => { setByPath(state.editableJson, ["subject", "identity", "name"], v); rerender(); })),
      labelField("Gender", el("input", { type:"text", value:"Female", disabled:"true" })),
      labelField("Height (cm)", inputText(String(view.height || 155), (v) => { const n = Number(v); if (!Number.isNaN(n)) setByPath(state.editableJson, ["subject","identity","height_cm"], n); })),
      labelField("Hair Color", selectFromDb("subject.hair.color", getByPath(state.editableJson, ["subject","hair","color"], ""), (v) => { setByPath(state.editableJson, ["subject","hair","color"], v); })),
      labelField("Hair Style", selectFromDb("subject.hair.style", getByPath(state.editableJson, ["subject","hair","style"], ""), (v) => { setByPath(state.editableJson, ["subject","hair","style"], v); })),
      labelField("Eye Color", selectFromDb("subject.eyes.color", getByPath(state.editableJson, ["subject","eyes","color"], ""), (v) => { setByPath(state.editableJson, ["subject","eyes","color"], v); })),
      labelField("Freckles", el("div", { class: "row" }, [
        el("button", { class: "btn" + ((getByPath(state.editableJson, ["subject","skin","freckles"], "")).includes("heavy") ? " primary" : ""), onclick: () => { setByPath(state.editableJson, ["subject","skin","freckles"], "heavy freckles"); rerender(); } }, "Heavy"),
        el("button", { class: "btn" + ((getByPath(state.editableJson, ["subject","skin","freckles"], "")).includes("light") ? " primary" : ""), onclick: () => { setByPath(state.editableJson, ["subject","skin","freckles"], "light freckles"); rerender(); } }, "Light"),
        el("button", { class: "btn" + (/^none/i.test(getByPath(state.editableJson, ["subject","skin","freckles"], "")) ? " primary" : ""), onclick: () => { setByPath(state.editableJson, ["subject","skin","freckles"], "none"); rerender(); } }, "None"),
      ])),
      hr(),
      el("div", { class: "row" }, [
        el("button", { class: "btn", onclick: async () => { await copyToClipboard(JSON.stringify(state.editableJson, null, 2)); toast("Copied JSON"); } }, "Copy JSON"),
        el("button", { class: "btn primary", onclick: () => {
          const name = prompt("Preset name?") || (getByPath(state.editableJson, ["subject","identity","name"], "") || `Preset ${new Date().toLocaleString()}`);
          savePreset(name, state.editableJson);
          toast("Saved preset");
          rerender();
        } }, "Save Preset"),
      ]),
    ]),
  ]);

  return el("div", { class: "screen" }, [content]);
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

function optimizePage() {
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

  const toggles = el("div", { class: "row" }, [
    el("div", {}, [el("div", { class: "small" }, "JSON"), switchPill(state.addJsonOutput, () => { state.addJsonOutput = !state.addJsonOutput; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "Master"), switchPill(state.addMasterPrompt, () => { state.addMasterPrompt = !state.addMasterPrompt; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "Model"), switchPill(state.addModelPrompt, () => { state.addModelPrompt = !state.addModelPrompt; persistDraft(); rerender(); })]),
    el("div", {}, [el("div", { class: "small" }, "Use-case"), switchPill(state.addUseCasePrompt, () => { state.addUseCasePrompt = !state.addUseCasePrompt; persistDraft(); rerender(); })]),
  ]);

  const copyBtn = el("button", { class: "btn primary", onclick: async () => { await copyToClipboard(output); toast("Copied output"); } }, "Copy Output");

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
      copyBtn,
      hr(),
      el("textarea", { readonly: true }, output),
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
      el("button", { class: "btn", onclick: () => document.querySelector(".modalBack")?.remove() }, "Close"),
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
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      setWallpaper(dataUrl);
      toast("Wallpaper set");
      rerender();
    },
  });
  const clearWp = el("button", { class: "btn", onclick: () => { setWallpaper(null); toast("Wallpaper cleared"); rerender(); } }, "Clear Wallpaper");

  const exportDb = el("button", { class: "btn primary", onclick: () => downloadJson("boobly-database.json", state.db) }, "Export Database");
  const exportPrompts = el("button", { class: "btn", onclick: () => downloadJson("boobly-prompts.json", state.prompts) }, "Export Prompts");
  const exportAll = el("button", {
    class: "btn primary",
    onclick: () => {
      const payload = { version: VERSION, exported_at: Date.now(), database: state.db, prompts: state.prompts, presets: presetsList() };
      downloadJson("boobly-export-all.json", payload);
    },
  }, "Export All");

  const importDb = fileImportButton("Import Database", async (txt) => {
    try { const j = JSON.parse(txt); state.db = j; saveLS(STORAGE.db, j); toast("Imported DB"); rerender(); }
    catch { toast("DB import failed"); }
  });

  const importPrompts = fileImportButton("Import Prompts", async (txt) => {
    try { const j = JSON.parse(txt); state.prompts = j; saveLS(STORAGE.prompts, j); toast("Imported Prompts"); rerender(); }
    catch { toast("Prompts import failed"); }
  });

  const importAll = fileImportButton("Import All", async (txt) => {
    try {
      const j = JSON.parse(txt);
      if (j.database) { state.db = j.database; saveLS(STORAGE.db, j.database); }
      if (j.prompts) { state.prompts = j.prompts; saveLS(STORAGE.prompts, j.prompts); }
      if (j.presets) saveLS(STORAGE.presets, j.presets);
      toast("Imported ALL");
      rerender();
    } catch {
      toast("Import ALL failed");
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
      el("div", { class: "row" }, [wpInput, clearWp]),
      hr(),
      el("div", { class: "small", style: "font-weight:900" }, "LLM Integration"),
      llmUrl,
      el("div", { class: "row" }, [el("div", { class: "small" }, "Open LLM URL on Generate"), el("div", { style: "flex:0" }, openToggle)]),
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
  if (state.page === "home") return "Home";
  if (state.page === "create") return "Create";
  if (state.page === "edit") return "Edit";
  if (state.page === "optimize") return "Optimize";
  return "Settings";
}

function route() {
  if (state.page === "home") return homePage();
  if (state.page === "create") return createPage();
  if (state.page === "edit") return editPage();
  if (state.page === "optimize") return optimizePage();
  return settingsPage();
}

function rerender() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  const overlay = el("div", { class: "wallpaperOverlay" }, []);
  overlay.appendChild(header(pageTitle()));
  overlay.appendChild(route());
  overlay.appendChild(tabs());
  root.appendChild(overlay);
}

async function init() {
  setTheme(loadLS(STORAGE.theme, "light") || "light");
  setWallpaper(loadLS(STORAGE.wallpaper, null));

  const dbLS = loadLS(STORAGE.db, null);
  const prLS = loadLS(STORAGE.prompts, null);
  state.db = dbLS || (await fetchJson("database.json"));
  state.prompts = prLS || (await fetchJson("prompts.json"));

  // restore draft (prevents refresh data loss)
  const draft = loadLS(STORAGE.draft, null);
  if (draft?.editableJson) {
    state.editableJson = draft.editableJson;
    state.rawJsonText = draft.rawJsonText || JSON.stringify(draft.editableJson, null, 2);
  }
  const lastPage = loadLS(STORAGE.page, "home");
  if (lastPage) state.page = lastPage;

  // PWA
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); } catch {}
  }
  rerender();
}
init();
