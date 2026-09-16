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

function source(rel, jsonKey, inlineKey) {
  const file = path.join(ROOT, rel);
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const val = jsonKey ? parsed[jsonKey] : parsed;
    if (Array.isArray(val)) return val;
    console.error("MALFORMED: " + rel + ' has no "' + jsonKey + '" array.');
    process.exit(1);
  }
  if (inline[inlineKey]) {
    console.log("note: " + rel + " does not exist — carrying " + inlineKey + " through from index.html unchanged.");
    return inline[inlineKey];
  }
  console.error("MISSING: " + rel + " and no " + inlineKey + " in index.html. Cannot build.");
  process.exit(1);
}

const D = {
  PROGRAMS:      source("data/programs.json",     "programs",      "PROGRAMS"),
  PROJECT_TYPES: source("data/project-types.json","project_types", "PROJECT_TYPES"),
  AUDIENCES:     source("data/audience.json",     "audiences",     "AUDIENCES"),
  STACKS:        source("data/stacks.json",       "stacks",        "STACKS")
};

// --- integrity checks: catch a bad tag before it ships silently -------------
const audienceIds = new Set(D.AUDIENCES.map(a => a.id));
const typeIds     = new Set(D.PROJECT_TYPES.map(t => t.id));
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
console.log("  " + D.STACKS.length + " capital stacks\n");
console.log("Programs per audience:");
Object.entries(counts).forEach(([name, n]) => {
  console.log("  " + String(n).padStart(3) + "  " + name + (n === 0 ? "   <-- nothing will show for this filter" : ""));
});
