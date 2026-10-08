#!/usr/bin/env node
/*
 * build.js — pushes data/*.json into index.html.
 *
 * WHY THIS EXISTS
 * index.html does not fetch the JSON files at runtime. It carries a single
 * inline `var D = {...};` line holding a copy of the data. The CMS writes to
 * data/*.json. Without this step the two drift apart, and they already have:
 * data/programs.json carries a `regions` field that the copy inside
 * index.html does not.
 *
 * Run this after ANY edit to data/, including edits made through the CMS,
 * then commit both the data file and index.html together.
 *
 * Usage, from the repo root:
 *     node scripts/build.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = path.join(ROOT, "index.html");

// The current inline blob is the fallback source for anything that does not
// yet live in data/. project-types and stacks are structural and may never have
// been split out into their own files; if so, they are carried through
// untouched rather than lost.
const htmlSrc = fs.readFileSync(HTML, "utf8");
const inlineMatch = htmlSrc.match(/var D = (\{[\s\S]*?\});/);
const inline = inlineMatch ? JSON.parse(inlineMatch[1]) : {};

// Each entry lists the filenames this data has gone by. Singular vs plural has
// bitten us once already; accept either rather than failing on a naming choice.
function source(candidates, jsonKeys, inlineKey) {
  for (const rel of candidates) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error("INVALID JSON in " + rel + ":\n  " + e.message);
      process.exit(1);
    }
    for (const key of jsonKeys) {
      if (Array.isArray(parsed[key])) {
        console.log("read " + rel + " (" + parsed[key].length + " entries)");
        return parsed[key];
      }
    }
    if (Array.isArray(parsed)) { console.log("read " + rel); return parsed; }
    console.error("MALFORMED: " + rel + " has none of these arrays: " + jsonKeys.join(", "));
    process.exit(1);
  }
  if (inline[inlineKey]) {
    console.log("note: none of [" + candidates.join(", ") + "] exist — carrying " +
                inlineKey + " through from index.html unchanged.");
    return inline[inlineKey];
  }
  console.error("MISSING: none of [" + candidates.join(", ") + "] exist and there is no " +
                inlineKey + " in index.html. Cannot build.");
  process.exit(1);
}

const D = {
  PROGRAMS:      source(["data/programs.json"],
                        ["programs"], "PROGRAMS"),
  PROJECT_TYPES: source(["data/project-types.json", "data/project_types.json", "data/projecttypes.json", "data/types.json"],
                        ["project_types", "projectTypes", "types"], "PROJECT_TYPES"),
  AUDIENCES:     source(["data/audiences.json", "data/audience.json"],
                        ["audiences", "audience"], "AUDIENCES"),
  STACKS:        source(["data/stacks.json", "data/stack.json"],
                        ["stacks", "stack"], "STACKS"),
  REGIONS:       source(["data/regions.json", "data/region.json"],
                        ["regions", "region"], "REGIONS"),
  SETTINGS:      JSON.parse(fs.readFileSync(path.join(ROOT, "data/settings.json"), "utf8"))
};

// Draft stacks stay in data/stacks.json for review but never ship.
const draftStacks = D.STACKS.filter(s => s.draft);
D.STACKS = D.STACKS.filter(s => !s.draft);
if (!D.STACKS.length) { console.error("No published stacks — at least one stack must not be marked draft."); process.exit(1); }

// --- staleness: anything carried forward or verified more than 90 days ago --
const STALE_DAYS = 90;
const today = new Date();
let staleCount = 0;
D.PROGRAMS.forEach(p => {
  let stale = true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.v || "")) {
    const age = (today - new Date(p.v + "T00:00:00")) / 86400000;
    stale = age > STALE_DAYS;
  }
  p.stale = stale;
  if (stale) staleCount++;
});

// --- integrity checks: catch a bad tag before it ships silently -------------
const audienceIds = new Set(D.AUDIENCES.map(a => a.id));
const typeIds     = new Set(D.PROJECT_TYPES.map(t => t.id));
const regionIds   = new Set(D.REGIONS.map(r => r.id));
const problems    = [];

D.PROGRAMS.forEach(p => {
  (p.serves || []).forEach(s => {
    if (!audienceIds.has(s)) problems.push(p.id + ": unknown audience \"" + s + "\"");
  });
  (p.funds || []).forEach(f => {
    if (!typeIds.has(f)) problems.push(p.id + ": unknown project type \"" + f + "\"");
  });
  if (!p.serves || !p.serves.length) problems.push(p.id + ": no audience — it will never appear in results");
  if (!p.funds  || !p.funds.length)  problems.push(p.id + ": no project type — it will never appear in results");
  (p.regions || []).forEach(r => {
    if (!regionIds.has(r)) problems.push(p.id + ": unknown region \"" + r + "\"");
  });
  if (!p.regions || !p.regions.length) problems.push(p.id + ": no region — add \"statewide\" unless it is region-specific");

  if (!p.links || !p.links.hub || !p.links.hub.url) {
    problems.push(p.id + ": no links.hub.url — this is the fallback link and is required");
  }
  ((p.links && p.links.audience) || []).forEach(a => {
    (a.tags || []).forEach(t => {
      if (!audienceIds.has(t)) problems.push(p.id + ": links.audience tag \"" + t + "\" is not a known audience");
    });
    if (!a.tags || !a.tags.length) problems.push(p.id + ": an audience-specific link has no tags — it will never be shown");
    if (!a.url) problems.push(p.id + ": an audience-specific link has no url");
  });
});

const STATUSES = new Set(["open", "rolling", "forthcoming", "paused", "closed", "unverified"]);
const KINDS = new Set(["Grant", "Loan", "Incentive/Rebate", "Tax", "Technical assistance", "Tool", "Credential", "Philanthropic"]);
const COSTS = new Set(["capital", "soft", "operating"]);
D.PROGRAMS.forEach(p => {
  if (!STATUSES.has(p.status)) problems.push(p.id + ": status \"" + p.status + "\" must be one of " + [...STATUSES].join(", "));
  if (!Array.isArray(p.kind) || !p.kind.length) problems.push(p.id + ": kind must be a list with at least one value");
  else p.kind.forEach(k => { if (!KINDS.has(k)) problems.push(p.id + ": kind \"" + k + "\" must be one of " + [...KINDS].join(", ")); });
  (p.costTypes || []).forEach(c => { if (!COSTS.has(c)) problems.push(p.id + ": cost type \"" + c + "\" is not capital, soft or operating"); });
  const a = p.award || {};
  ["min", "max"].forEach(k => {
    if (a[k] !== null && a[k] !== undefined && typeof a[k] !== "number") problems.push(p.id + ": award." + k + " must be a number or empty");
  });
  if (typeof a.min === "number" && typeof a.max === "number" && a.min > a.max) problems.push(p.id + ": award.min is larger than award.max");
});

const seen = new Set();
D.PROGRAMS.forEach(p => {
  if (seen.has(p.id)) problems.push("duplicate id: " + p.id);
  seen.add(p.id);
});

if (problems.length) {
  console.error("BUILD FAILED — fix these first:\n");
  problems.forEach(m => console.error("  " + m));
  process.exit(1);
}

// --- write the inline blob --------------------------------------------------
let html = htmlSrc;
const line = "var D = " + JSON.stringify(D) + ";";
const pattern = /var D = \{[\s\S]*?\};/;

if (!pattern.test(html)) {
  console.error("Could not find the `var D = {...};` line in index.html. Did the file change?");
  process.exit(1);
}

html = html.replace(pattern, () => line);
fs.writeFileSync(HTML, html);

// --- report -----------------------------------------------------------------
const counts = {};
D.AUDIENCES.forEach(a => {
  counts[a.name] = D.PROGRAMS.filter(p => (p.serves || []).includes(a.id)).length;
});

console.log("Built index.html from data/\n");
console.log("  " + D.PROGRAMS.length + " programs");
console.log("  " + D.AUDIENCES.length + " audiences");
console.log("  " + D.PROJECT_TYPES.length + " project types");
console.log("  " + D.STACKS.length + " capital stacks" + (draftStacks.length ? " (+" + draftStacks.length + " draft, not published)" : "") + "\n");
console.log("Status:");
const st = {};
D.PROGRAMS.forEach(p => { st[p.status] = (st[p.status] || 0) + 1; });
Object.entries(st).forEach(([k, n]) => console.log("  " + String(n).padStart(3) + "  " + k));
console.log("\n" + staleCount + " programs carried forward or not verified in the last " + STALE_DAYS + " days (flagged on their cards):");
D.PROGRAMS.filter(p => p.stale).forEach(p => console.log("       " + p.id + "  (" + p.v + ")"));
console.log("");
console.log("Programs per project type:");
D.PROJECT_TYPES.forEach(t => {
  const n = D.PROGRAMS.filter(p => (p.funds || []).includes(t.id)).length;
  console.log("  " + String(n).padStart(3) + "  " + t.name + (n === 0 ? "   <-- nothing will show for this filter" : ""));
});
console.log("");
const regionCounts = {};
D.REGIONS.forEach(r => {
  regionCounts[r.name] = D.PROGRAMS.filter(p => (p.regions || []).includes(r.id)).length;
});

console.log("Programs per audience:");
Object.entries(counts).forEach(([name, n]) => {
  console.log("  " + String(n).padStart(3) + "  " + name + (n === 0 ? "   <-- nothing will show for this filter" : ""));
});
console.log("\nPrograms tagged to each region (statewide programs always match):");
Object.entries(regionCounts).forEach(([name, n]) => {
  console.log("  " + String(n).padStart(3) + "  " + name);
});
