const fs = require("fs");
const path = require("path");

// Reads the four editable data files. These are exactly what the CMS at
// /admin edits — this script has no other data source, so "publish in the
// CMS" and "what's on the live site" can never drift apart as long as the
// GitHub Action (.github/workflows/deploy.yml) runs on every push.
const DATA_DIR = path.join(__dirname, "..", "data");
const PROGRAMS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "programs.json"))).programs;
const PROJECT_TYPES = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "project-types.json"))).project_types;
const AUDIENCES = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "audiences.json"))).audiences;
const STACKS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "stacks.json"))).stacks;
const SETTINGS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "settings.json")));

const DATA = JSON.stringify({ PROGRAMS, PROJECT_TYPES, AUDIENCES, STACKS });

// ---- radial web geometry --------------------------------------------------
// The diagram groups one-off funders so it stays at the scale Ryan already
// describes in the intro copy ("thirteen agencies, three utilities") rather
// than growing a spoke per program source. Program cards below still show
// the real, specific agency — this grouping is display-only.
const DIAGRAM_GROUP = {
  "PepsiCo (private)": "Private & Philanthropic Funders",
  "LISC / Foot Locker Foundation (private)": "Private & Philanthropic Funders",
  "Midland States Bank Foundation (private)": "Private & Philanthropic Funders",
  "T-Mobile (private)": "Private & Philanthropic Funders",
  "Forefront (nonprofit)": "Private & Philanthropic Funders",
  "Walmart (private)": "Private & Philanthropic Funders",
  "USDA": "Federal (other)",
  "ICCB": "Federal (other)",
  "US EPA": "Federal (other)",
  "US DOT": "Federal (other)",
  "US Small Business Administration": "Federal (other)",
};
const GROUP_AGENCIES = {
  "Private & Philanthropic Funders": ["PepsiCo (private)","LISC / Foot Locker Foundation (private)","Midland States Bank Foundation (private)","T-Mobile (private)","Forefront (nonprofit)","Walmart (private)"],
  "Federal (other)": ["USDA","ICCB","US EPA","US DOT","US Small Business Administration"],
};
const agencies = [];
PROGRAMS.forEach(p => {
  const g = DIAGRAM_GROUP[p.agency] || p.agency;
  if (agencies.indexOf(g) === -1) agencies.push(g);
});

const CX = 590, CY = 340, RX = 395, RY = 252;
const SHORT = { "IFA Climate Bank":"IFA / Climate Bank", "Illinois Commerce Commission":"Illinois Commerce Comm.", "All ICC-regulated utilities":"Utilities \u2014 VPP", "Private & Philanthropic Funders":"Private & Philanthropic" };
function agencyCount(g) {
  const raw = GROUP_AGENCIES[g];
  if (raw) return PROGRAMS.filter(p => raw.indexOf(p.agency) !== -1).length;
  return PROGRAMS.filter(p => p.agency === g).length;
}
function agencyFilterList(g) {
  return GROUP_AGENCIES[g] || [g];
}
const nodes = agencies.map((a, i) => {
  const ang = (-Math.PI / 2) + (i * 2 * Math.PI / agencies.length);
  return {
    agency: a,
    x: CX + RX * Math.cos(ang),
    y: CY + RY * Math.sin(ang),
    count: agencyCount(a),
    right: Math.cos(ang) > -0.15,
  };
});

const spokes = nodes.map(n =>
  `<line class="spoke" data-agency="${esc(n.agency)}" x1="${CX}" y1="${CY}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}"/>`
).join("\n");

const nodeMarkup = nodes.map(n => {
  const anchor = n.right ? "start" : "end";
  const dx = n.right ? 16 : -16;
  return `<g class="node" data-agency="${esc(n.agency)}" tabindex="0" role="button" aria-label="${esc(n.agency)}, ${n.count} programs">
    <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="9"/>
    <text x="${(n.x + dx).toFixed(1)}" y="${(n.y - 1).toFixed(1)}" text-anchor="${anchor}">${esc(SHORT[n.agency] || n.agency)}</text>
    <text class="cnt" x="${(n.x + dx).toFixed(1)}" y="${(n.y + 13).toFixed(1)}" text-anchor="${anchor}">${n.count} program${n.count === 1 ? "" : "s"}</text>
  </g>`;
}).join("\n");

// ---- start-here pathway geometry (audience <-> hub <-> project type) -----
// Box widths are measured per-label (not a fixed size) so text is never
// clipped or overhanging its box, however long the audience or project
// type name runs.
const PW_FONT = 16;
function estWidth(text) {
  // Franklin Gothic Book is moderately condensed; 0.56em/char with a small
  // reserve is a safe upper estimate across the character mix we use.
  return Math.ceil(text.length * PW_FONT * 0.56);
}
const PAD_X = 18, BOX_H = 38;
const leftLabels = AUDIENCES.map(a => a.name);
const rightLabels = PROJECT_TYPES.map(t => t.code + " \u2014 " + t.name);
const maxLeftW = Math.max.apply(null, leftLabels.map(function(t){ return estWidth(t); })) + PAD_X * 2;
const maxRightW = Math.max.apply(null, rightLabels.map(function(t){ return estWidth(t); })) + PAD_X * 2;

const PW_GAP = 90; // clearance between hub and the nearest box edge
const PH = 640, PHUB_Y = PH / 2;
const LEFT_ANCHOR_X = maxLeftW + 40;
const PHUB_X = LEFT_ANCHOR_X + PW_GAP + 58;
const RIGHT_ANCHOR_X = PHUB_X + 58 + PW_GAP;
const PW = RIGHT_ANCHOR_X + maxRightW + 40;

const leftN = AUDIENCES.map((a, i) => ({
  ...a, x: LEFT_ANCHOR_X, y: 55 + i * ((PH - 110) / (AUDIENCES.length - 1)),
  w: estWidth(a.name) + PAD_X * 2,
}));
const rightN = PROJECT_TYPES.map((t, i) => ({
  ...t, x: RIGHT_ANCHOR_X, y: 28 + i * ((PH - 56) / (PROJECT_TYPES.length - 1)),
  w: estWidth(t.code + " \u2014 " + t.name) + PAD_X * 2,
}));
const pwSpokesL = leftN.map(n =>
  `<line class="pwspoke pwL" data-id="${esc(n.id)}" x1="${n.x}" y1="${n.y.toFixed(1)}" x2="${PHUB_X}" y2="${PHUB_Y}"/>`
).join("\n");
const pwSpokesR = rightN.map(n =>
  `<line class="pwspoke pwR" data-id="${esc(n.id)}" x1="${PHUB_X}" y1="${PHUB_Y}" x2="${n.x}" y2="${n.y.toFixed(1)}"/>`
).join("\n");
const pwLeftMarkup = leftN.map(n => `<g class="pwnode pwL" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.name)}">
    <rect x="${(n.x - n.w).toFixed(1)}" y="${(n.y - BOX_H/2).toFixed(1)}" width="${n.w}" height="${BOX_H}" rx="8"/>
    <text x="${(n.x - PAD_X).toFixed(1)}" y="${(n.y + 5.5).toFixed(1)}" text-anchor="end">${esc(n.name)}</text>
  </g>`).join("\n");
const pwRightMarkup = rightN.map(n => `<g class="pwnode pwR" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.name)}">
    <rect x="${n.x.toFixed(1)}" y="${(n.y - BOX_H/2).toFixed(1)}" width="${n.w}" height="${BOX_H}" rx="8"/>
    <text x="${(n.x + PAD_X).toFixed(1)}" y="${(n.y + 5.5).toFixed(1)}" text-anchor="start">${esc(n.code)} — ${esc(n.name)}</text>
  </g>`).join("\n");

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clean Energy Capital Stack Tool</title>
<meta name="description" content="Match a clean energy project to every Illinois program that funds it. Illinois DCEO, Office of Energy and Business Utilization.">
<style>
  :root{
    --ink:#0A2E4D; --ink2:#123C61; --green:#0D497F; --moss:#6BA3D6;
    --gold:#D9A21B; --rust:#A8462E; --paper:#FFFFFF; --soft:#EFF4F9;
    --body:#36495A; --muted:#6B7E90; --line:#D3E0EB;
    --serif:"Franklin Gothic Medium","Franklin Gothic","Arial Narrow",Arial,sans-serif;
    --sans:"Franklin Gothic Book","Franklin Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);color:var(--body);background:var(--paper);line-height:1.62;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
  a{color:var(--green)}

  header{background:var(--ink);color:#fff;padding:52px 0 44px}
  header .kick{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:700;margin:0 0 12px}
  header h1{font-family:var(--serif);font-size:clamp(30px,4.4vw,46px);line-height:1.1;margin:0 0 14px;font-weight:700}
  header p{margin:0;max-width:860px;color:#C3D6E5;font-size:20.5px}
  header .stamp{margin-top:26px;font-size:12px;color:#8AA3B8}
  .herocta{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:28px}
  .cta-primary{font:inherit;font-size:17.5px;font-weight:700;color:var(--ink);background:var(--gold);
               padding:14px 26px;border-radius:8px;text-decoration:none;display:inline-block}
  .cta-primary:hover{background:#EBB53A}
  .cta-secondary{font-size:16px;color:#BFD4E6;text-decoration:underline}
  .cta-secondary:hover{color:#fff}

  section{padding:52px 0;border-bottom:1px solid var(--line)}
  section.dark{background:var(--ink);color:#fff;border-bottom:none}
  h2{font-family:var(--serif);font-size:32px;color:var(--ink);margin:0 0 6px;font-weight:700}
  section.dark h2{color:#fff}
  .lede{margin:0 0 28px;color:var(--muted);font-size:18.5px;max-width:860px}
  section.dark .lede{color:#A9C2D8}
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:700;margin:0 0 10px}

  /* filters */
  .filters{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-bottom:30px}
  @media(max-width:760px){.filters{grid-template-columns:1fr}}
  .flabel{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);margin:0 0 10px}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font:inherit;font-size:16.5px;padding:10px 17px;border-radius:999px;border:1px solid var(--line);
        background:var(--paper);color:var(--body);cursor:pointer;transition:.13s}
  .chip:hover{border-color:var(--moss)}
  .chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}

  .resultbar{display:flex;justify-content:space-between;align-items:baseline;gap:16px;
             padding:14px 0 18px;border-top:1px solid var(--line);flex-wrap:wrap}
  .resultbar strong{font-family:var(--serif);font-size:26px;color:var(--ink)}
  .reset{font-size:15.5px;background:none;border:none;color:var(--green);cursor:pointer;text-decoration:underline;font:inherit;padding:0}

  /* program cards */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .card{border:1px solid var(--line);border-radius:8px;padding:18px 18px 16px;background:var(--paper);display:flex;flex-direction:column}
  .card .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
  .card .agency{font-size:13.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--green)}
  .card .kind{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
              padding:3px 8px;border-radius:4px;background:var(--soft);color:var(--ink);white-space:nowrap}
  .card h3{font-family:var(--serif);font-size:21px;margin:0 0 8px;line-height:1.25}
  .card h3 a{color:var(--ink);text-decoration:none;border-bottom:2px solid var(--moss)}
  .card h3 a:hover{color:var(--green);border-bottom-color:var(--gold)}
  .card p{margin:0 0 12px;font-size:16.5px;color:var(--body)}
  .card .tags{margin-top:auto;display:flex;flex-wrap:wrap;gap:5px}
  .tag{font-size:13px;padding:4px 9px;border-radius:4px;background:var(--soft);color:var(--muted)}
  .card.flag{border-color:var(--gold);background:#FBF4E6}
  .card.flag .kind{background:#F3E0B4;color:var(--rust)}
  .card .go{font-size:15px;font-weight:700;color:var(--green);text-decoration:none;margin-bottom:10px;display:inline-block}
  .card .go:hover{color:var(--gold)}
  .empty{padding:34px;border:1px dashed var(--line);border-radius:8px;text-align:center;color:var(--muted)}

  /* web */
  .webwrap{background:var(--ink);border-radius:10px;padding:8px}

  /* web */
  .webwrap{background:var(--ink);border-radius:10px;padding:8px}

  #gate{position:fixed;inset:0;background:var(--ink);z-index:9999;display:flex;
        align-items:center;justify-content:center;padding:24px}
  #gate .box{max-width:460px;width:100%;background:#0F3A63;border:1px solid #2A6098;
             border-radius:10px;padding:32px}
  #gate p.kick{color:var(--gold);font-size:12px;letter-spacing:.14em;text-transform:uppercase;
               font-weight:700;margin:0 0 10px}
  #gate h2{font-family:var(--serif);color:#fff;font-size:24px;margin:0 0 10px}
  #gate p.sub{color:#C3D6E5;font-size:16.5px;margin:0 0 20px;line-height:1.5}
  #gate input{width:100%;box-sizing:border-box;font:inherit;font-size:17px;padding:13px 15px;
              border-radius:8px;border:1px solid #2A6098;background:#0A2E4D;color:#fff}
  #gate button{margin-top:12px;width:100%;font:inherit;font-size:17px;font-weight:700;
               padding:12px 14px;border-radius:8px;border:0;background:var(--gold);
               color:var(--ink);cursor:pointer}
  #gate .err{color:#F0B4A0;font-size:14px;margin:12px 0 0;min-height:18px}
  svg.web{width:100%;height:auto;display:block}
  svg.web .spoke{stroke:#123C61;stroke-width:1.4}
  svg.web .spoke.on{stroke:var(--gold);stroke-width:2.6}
  svg.web .node circle{fill:var(--moss);stroke:var(--ink);stroke-width:3;cursor:pointer;transition:.13s}
  svg.web .node:hover circle,svg.web .node:focus circle{fill:var(--gold);r:12}
  svg.web .node text{fill:#E4EEF6;font-family:var(--sans);font-size:16px;font-weight:600;cursor:pointer}
  svg.web .node .cnt{fill:#A9C2D8;font-size:13.5px;font-weight:400}
  svg.web .hub{fill:var(--gold)}
  svg.web .hubtext{fill:var(--ink);font-family:var(--sans);font-size:16px;font-weight:700;text-anchor:middle}
  svg.web .hubsub{fill:var(--ink);font-size:12px;text-anchor:middle;opacity:.75}

  /* start-here pathway diagram — deliberately different from the agency web:
     rounded chip nodes instead of circles, two-tone (moss=who, gold=what) instead of uniform */
  .webwrap.pathway{background:var(--soft);border:1px solid var(--line);margin:26px 0 30px}
  svg.pw .pwhub{fill:var(--ink)}
  svg.pw .pwhub + text.hubtext{fill:#fff}
  svg.pw text.hubtext{fill:#fff;font-family:var(--serif);font-size:23px;font-weight:700;text-anchor:middle}
  svg.pw text.hubsub{fill:#BFD4E6;font-size:12.5px;text-anchor:middle}
  svg.pw .pwspoke{stroke:#C3D6E5;stroke-width:1.3;transition:.15s}
  svg.pw .pwspoke.on{stroke:var(--gold);stroke-width:2.6}
  svg.pw .pwnode rect{fill:#fff;stroke:var(--moss);stroke-width:1.4;cursor:pointer;transition:.13s}
  svg.pw .pwnode.pwR rect{stroke:var(--gold)}
  svg.pw .pwnode rect.sel{fill:var(--ink);stroke:var(--ink)}
  svg.pw .pwnode.pwR rect.sel{fill:var(--gold);stroke:var(--gold)}
  svg.pw .pwnode text{fill:var(--ink);font-family:var(--sans);font-size:16px;font-weight:600;cursor:pointer;pointer-events:none}
  svg.pw .pwnode text.sel{fill:#fff}
  svg.pw .pwnode.pwR text.sel{fill:var(--ink)}
  svg.pw .pwnode:hover rect{stroke-width:2.4}

  /* stacks */
  .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
  .tab{font:inherit;font-size:15.5px;padding:11px 19px;border-radius:6px;border:1px solid #123C61;
       background:transparent;color:#C3D6E5;cursor:pointer}
  .tab[aria-selected="true"]{background:var(--gold);border-color:var(--gold);color:var(--ink);font-weight:700}
  .stack{display:grid;grid-template-columns:300px 1fr;gap:28px;align-items:start}
  @media(max-width:860px){.stack{grid-template-columns:1fr}}
  .scenario{background:var(--ink2);border-radius:8px;padding:22px}
  .scenario .lbl{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--moss);font-weight:700}
  .scenario .total{font-family:var(--serif);font-size:34px;color:#fff;margin:4px 0 18px;font-weight:700}
  .scenario ul{margin:6px 0 18px;padding-left:18px;color:#BFD4E6;font-size:15px}
  .scenario li{margin-bottom:5px}
  .first{border:1px solid var(--gold);border-radius:6px;padding:14px;font-size:14.5px;color:#fff}
  .bar{display:flex;height:56px;border-radius:6px;overflow:hidden;margin-bottom:6px}
  .bar div{display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;
           border-right:2px solid var(--ink)}
  .barnote{font-size:13px;color:#8AA3B8;font-style:italic;margin:0 0 20px}
  .lrow{display:grid;grid-template-columns:22px 58px 1fr auto;gap:12px;align-items:start;
        padding:13px 0;border-top:1px solid #2B4A3E}
  .lrow .sw{width:14px;height:14px;border-radius:3px;margin-top:4px}
  .lrow .pc{font-family:var(--serif);font-size:20.5px;font-weight:700;color:#fff}
  .lrow .nm{font-size:16px;font-weight:700;color:#fff}
  .lrow .nt{font-size:13.5px;color:#A9C2D8;margin-top:3px}
  .lrow .ag{font-size:12.5px;font-weight:700;color:var(--moss);white-space:nowrap;padding-top:3px}
  @media(max-width:640px){.lrow{grid-template-columns:22px 52px 1fr}.lrow .ag{display:none}}

  /* four-layer funding framework */
  .layers{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-bottom:26px}
  .layer{border:1px solid var(--line);border-radius:8px;padding:20px;background:var(--soft)}
  .ltag{width:30px;height:30px;border-radius:7px;color:#fff;font-family:var(--serif);font-weight:700;
        font-size:15px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
  .layer h3{margin:0 0 4px;font-family:var(--serif);font-size:19.5px;color:var(--ink)}
  .layer .src{margin:0 0 10px;font-size:12.5px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.04em}
  .layer p:last-child{margin:0;font-size:15px;color:var(--body)}
  .rules{background:var(--ink);border-radius:8px;padding:24px 26px}
  .rulehead{margin:0 0 16px;font-family:var(--serif);font-size:20.5px;color:var(--gold);font-weight:700}
  .rulegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
  .rulegrid strong{display:block;color:#fff;font-size:16px;margin-bottom:6px}
  .rulegrid span{display:block;color:#C3D6E5;font-size:14.5px;line-height:1.5}

  /* clocks */
  .clocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
  .clock{background:var(--ink2);border:1px solid #123C61;border-radius:8px;padding:20px}
  .clock .d{font-family:var(--serif);font-size:25.5px;font-weight:700;margin-bottom:4px}
  .clock h4{margin:0 0 8px;font-size:15.5px;color:#fff}
  .clock p{margin:0;font-size:14.5px;color:#C3D6E5}

  footer{padding:34px 0 60px;font-size:13.5px;color:var(--muted)}
  footer p{margin:0 0 8px;max-width:900px}
  .skip{position:absolute;left:-9999px}
  .skip:focus{left:12px;top:12px;background:#fff;padding:8px;z-index:9}
</style>
</head>
<body>
<a class="skip" href="#navigator">Skip to the navigator</a>

<header>
  <div class="wrap">
    <p class="kick">Illinois DCEO · Office of Energy and Business Utilization</p>
    <h1>Clean Energy Capital Stack Tool</h1>
    <p>I have a project. Illinois' clean energy ecosystem spans many agencies, and more than one of them will pay for it.
       Tell this page who I am and what I want to build, and it shows every door — and links me straight to it.</p>
    <div class="herocta">
      <a class="cta-primary" href="#navigator">Start here</a>
      <a class="cta-secondary" href="#glance">or explore the full ecosystem</a>
    </div>
    <p class="stamp">Program links verified ${SETTINGS.verified_date}. Nothing on this page is a commitment of funds.</p>
  </div>
</header>

<section id="navigator">
  <div class="wrap">
    <p class="eyebrow">Start here</p>
    <h2>Who I am, and what I want to build</h2>
    <p class="lede">Select all that apply in either row. Leave a row empty to see everything in it.</p>

    <div class="filters">
      <div>
        <p class="flabel">I am &mdash; select all that apply</p>
        <div class="chips" id="audChips"></div>
      </div>
      <div>
        <p class="flabel">I want to build &mdash; select all that apply</p>
        <div class="chips" id="typeChips"></div>
      </div>
    </div>

    <div class="webwrap pathway">
      <svg class="web pw" viewBox="0 0 ${PW} ${PH}" role="img" aria-label="Diagram connecting client types to project types through the programs they match">
        ${pwSpokesL}
        ${pwSpokesR}
        <circle class="hub pwhub" cx="${PHUB_X}" cy="${PHUB_Y}" r="58"/>
        <text class="hubtext" id="pwcount" x="${PHUB_X}" y="${PHUB_Y - 6}">${PROGRAMS.length}</text>
        <text class="hubsub" id="pwcountlabel" x="${PHUB_X}" y="${PHUB_Y + 14}">programs match</text>
        ${pwLeftMarkup}
        ${pwRightMarkup}
      </svg>
    </div>

    <div class="resultbar">
      <strong id="count"></strong>
      <button class="reset" id="reset" type="button">Clear my selections</button>
    </div>

    <div class="grid" id="results"></div>
  </div>
</section>

<section id="glance">
  <div class="wrap">
    <p class="eyebrow">The whole picture</p>
    <h2>Network at a glance</h2>
    <p class="lede">Illinois&rsquo; clean energy ecosystem spans many agencies &mdash; this is all of them in one picture. Different from the diagram above: that one follows your pathway, this one shows the whole map. Click any agency to pull every program it funds into the results above.</p>
    <div class="webwrap">
      <svg class="web" viewBox="0 0 1180 690" role="img" aria-label="Radial diagram of Illinois clean energy funding agencies">
        ${spokes}
        <circle class="hub" cx="${CX}" cy="${CY}" r="62"/>
        <text class="hubtext" x="${CX}" y="${CY - 4}">Your client's</text>
        <text class="hubtext" x="${CX}" y="${CY + 13}">project</text>
        <text class="hubsub" x="${CX}" y="${CY + 30}">one of eleven types</text>
        ${nodeMarkup}
      </svg>
    </div>
  </div>
</section>

<section id="howmoney">
  <div class="wrap">
    <p class="eyebrow">The framework</p>
    <h2>Nothing is funded once. Everything is funded four ways.</h2>
    <p class="lede">Every clean energy project can carry four kinds of funding at once. Knowing which four is what gets it built.</p>
    <div class="layers">
      <div class="layer">
        <div class="ltag" style="background:#0D497F">1</div>
        <h3>Grant</h3>
        <p class="src">DCEO &middot; IFA federal awards &middot; USDA</p>
        <p>Never repaid. Almost always pays for the part nobody else will touch: predevelopment, engineering, community engagement, staff time.</p>
      </div>
      <div class="layer">
        <div class="ltag" style="background:#2E77B4">2</div>
        <h3>Incentive &amp; rebate</h3>
        <p class="src">IPA &middot; ComEd &middot; Ameren &middot; Nicor</p>
        <p>Paid per unit of output or savings. Illinois Shines pays fifteen years of REC value up front. Utility rebates pay on installed measures.</p>
      </div>
      <div class="layer">
        <div class="ltag" style="background:#5A7488">3</div>
        <h3>Debt</h3>
        <p class="src">IFA Climate Bank &middot; enrolled lenders &middot; ESPC</p>
        <p>Repaid, but on terms nobody gets on the open market. SSBCI buys the rate to 2%. C-PACE moves repayment onto the tax bill.</p>
      </div>
      <div class="layer">
        <div class="ltag" style="background:#D9A21B">4</div>
        <h3>Tax</h3>
        <p class="src">IRS &middot; client's CPA</p>
        <p>30% of eligible cost under Section 48E, plus depreciation. Tax-exempt owners take it as cash through elective pay.</p>
      </div>
    </div>
    <div class="rules">
      <p class="rulehead">Three rules that decide whether the stack holds</p>
      <div class="rulegrid">
        <div><strong>Grant first, debt last.</strong><span>Grant and incentive dollars are what make the debt sizeable. Size the loan after you know the grants, never before.</span></div>
        <div><strong>Two programs, one cost, one time.</strong><span>Layering is legal. Paying for the same invoice twice is not. Keep a cost-allocation line for every dollar.</span></div>
        <div><strong>Tax-exempt does not mean no tax credit.</strong><span>Elective pay turns 48E into cash for churches, nonprofits and municipalities. This is the most missed line in the state.</span></div>
      </div>
    </div>
  </div>
</section>

<section class="dark">
  <div class="wrap">
    <p class="eyebrow">Deliverable for consultants</p>
    <h2>How the money actually assembles</h2>
    <p class="lede">Three real capital stacks. Same logic every time: grant first, incentive second, tax third, debt last, equity smallest.
       Percentages are planning ratios for illustration, not quotes.</p>
    <div class="tabs" id="tabs" role="tablist"></div>
    <div id="stack"></div>
  </div>
</section>

<section class="dark" style="padding-top:0">
  <div class="wrap">
    <p class="eyebrow">Timing</p>
    <h2>Three clocks are already running</h2>
    <p class="lede">A consultant who knows these three dates is worth more than one who knows every program.</p>
    <div class="clocks">
      <div class="clock"><div class="d" style="color:#A8462E">Dec 31, 2027</div>
        <h4>Federal solar credit</h4>
        <p>The July 4, 2026 begin-construction deadline has passed. Any solar project starting now must be placed in service by this date to claim Section 48E at all. Projects that safe-harbored have until Dec 31, 2030.</p></div>
      <div class="clock"><div class="d" style="color:#D9A21B">Dec 31, 2026</div>
        <h4>Illinois EV rebate cycle</h4>
        <p>Open now. $2,000 per eligible new or used EV, plus $2,000 more for low-income applicants. Vehicle price under $80,000, apply within 180 days of purchase.</p></div>
      <div class="clock"><div class="d" style="color:#6FB894">2027 – 2030</div>
        <h4>Storage is the long runway</h4>
        <p>Standalone storage keeps its federal credit past the solar cliff, and CRGA commits Illinois to 3,000 MW by 2030 under 20-year contracts. This is where the next five years of work is.</p></div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <p><strong>How to use this.</strong> Filter, then click the program name. Every link goes to the agency's own page,
       not to a summary. If a program says it is not yet accepting applications, do not put it in a client's budget.</p>
    <p>Layering rules are program-specific. Two programs may fund one project, but never the same invoice twice.
       Confirm cost allocation in writing with each program officer before a client signs anything.</p>
    <p>Illinois Department of Commerce and Economic Opportunity · Office of Energy and Business Utilization.
       Verified ${SETTINGS.verified_date}.</p>
  </div>
</footer>

<script>

var D = ${DATA};
var selAud = [], selType = [];

function el(t, cls, txt){ var e=document.createElement(t); if(cls){e.className=cls;} if(txt!==null&&txt!==undefined){e.appendChild(document.createTextNode(txt));} return e; }
function findBy(arr, id){ for(var i=0;i<arr.length;i++){ if(arr[i].id===id) return arr[i]; } return null; }
function anyOf(arr, sel){ if(!sel || !sel.length) return true; for(var i=0;i<sel.length;i++){ if(has(arr, sel[i])) return true; } return false; }
function labels(src, sel){
  if(!sel || !sel.length) return null;
  var out=[], i, o; for(i=0;i<sel.length;i++){ o=findBy(src, sel[i]); if(o) out.push(o.name.toLowerCase()); }
  if(out.length===1) return out[0];
  if(out.length===2) return out[0]+" or "+out[1];
  return out.slice(0,-1).join(", ")+" or "+out[out.length-1];
}
function has(arr, v){ for(var i=0;i<arr.length;i++){ if(arr[i]===v) return true; } return false; }

function toggleSel(key, id){
  var cur = (key==="aud") ? selAud : selType, out = [], hit = false, k;
  for(k=0;k<cur.length;k++){ if(cur[k]===id){ hit = true; } else { out.push(cur[k]); } }
  if(!hit){ out.push(id); }
  if(key==="aud"){ selAud = out; } else { selType = out; }
  clearSpokes(); sync(); render();
}

function buildChips(host, items, key){
  var box = document.getElementById(host);
  for(var i=0;i<items.length;i++){
    (function(it){
      var b = el("button","chip",it.name);
      b.type="button"; b.setAttribute("aria-pressed","false"); b.setAttribute("data-id", it.id);
      b.onclick = function(){ toggleSel(key, it.id); };
      box.appendChild(b);
    })(items[i]);
  }
}

function wirePathwayNodes(){
  var nodes = document.querySelectorAll("svg.pw .pwnode");
  for(var i=0;i<nodes.length;i++){
    (function(n){
      var key = n.classList.contains("pwL") ? "aud" : "type";
      var id = n.getAttribute("data-id");
      function go(){ toggleSel(key, id); }
      n.onclick = go;
      n.onkeydown = function(e){ if(e.keyCode===13 || e.keyCode===32){ e.preventDefault(); go(); } };
    })(nodes[i]);
  }
}
function sync(){
  var a = document.querySelectorAll("#audChips .chip"), i;
  for(i=0;i<a.length;i++){ a[i].setAttribute("aria-pressed", has(selAud, a[i].getAttribute("data-id")) ? "true":"false"); }
  var t = document.querySelectorAll("#typeChips .chip");
  for(i=0;i<t.length;i++){ t[i].setAttribute("aria-pressed", has(selType, t[i].getAttribute("data-id")) ? "true":"false"); }

  var pn = document.querySelectorAll("svg.pw .pwnode"), on, id, key, isSel, rect, txt;
  for(i=0;i<pn.length;i++){
    on = pn[i]; id = on.getAttribute("data-id"); key = on.classList.contains("pwL") ? selAud : selType;
    isSel = has(key, id);
    rect = on.querySelector("rect"); txt = on.querySelector("text");
    if(rect){ rect.setAttribute("class", isSel ? "sel" : ""); }
    if(txt){ txt.setAttribute("class", isSel ? "sel" : ""); }
  }
  var ps = document.querySelectorAll("svg.pw .pwspoke");
  for(i=0;i<ps.length;i++){
    id = ps[i].getAttribute("data-id");
    key = ps[i].classList.contains("pwL") ? selAud : selType;
    ps[i].setAttribute("class", "pwspoke " + (ps[i].classList.contains("pwL")?"pwL":"pwR") + (has(key, id) ? " on" : ""));
  }
}
function clearSpokes(){
  var sp = document.querySelectorAll("svg.web .spoke");
  for(var i=0;i<sp.length;i++){ sp[i].setAttribute("class","spoke"); }
}

function card(p){
  var flag = (p.kind === "Not yet live" || p.kind === "Expired");
  var c = el("div","card" + (flag ? " flag" : ""));
  var top = el("div","top");
  top.appendChild(el("span","agency",p.agency));
  top.appendChild(el("span","kind",p.kind));
  c.appendChild(top);
  var h = el("h3");
  var link = el("a",null,p.name);
  link.href = p.url; link.target="_blank"; link.rel="noopener";
  h.appendChild(link); c.appendChild(h);
  c.appendChild(el("p",null,p.detail));
  var go = el("a","go","Open the program page \u2192");
  go.href = p.url; go.target="_blank"; go.rel="noopener";
  c.appendChild(go);
  var tags = el("div","tags");
  for(var i=0;i<p.funds.length;i++){
    var pt = findBy(D.PROJECT_TYPES, p.funds[i]);
    if(pt){ tags.appendChild(el("span","tag",pt.name)); }
  }
  c.appendChild(tags);
  return c;
}

function paint(list, headline){
  var out = document.getElementById("results");
  out.innerHTML = "";
  document.getElementById("count").innerHTML = "";
  document.getElementById("count").appendChild(document.createTextNode(headline));
  if(!list.length){
    out.appendChild(el("div","empty","No program in this database matches that combination. Widen one filter \u2014 or treat it as a gap worth reporting."));
    return;
  }
  for(var i=0;i<list.length;i++){ out.appendChild(card(list[i])); }
}

function render(){
  var list = [], i;
  for(i=0;i<D.PROGRAMS.length;i++){
    var p = D.PROGRAMS[i];
    if(anyOf(p.serves, selAud) && anyOf(p.funds, selType)){ list.push(p); }
  }
  var a = labels(D.AUDIENCES, selAud), t = labels(D.PROJECT_TYPES, selType);
  var head = list.length + (list.length===1 ? " program" : " programs");
  if(a && t){ head += " for " + a + " doing " + t; }
  else if(a){ head += " for " + a; }
  else if(t){ head += " for " + t; }
  paint(list, head);
  var pc = document.getElementById("pwcount"), pl = document.getElementById("pwcountlabel");
  if(pc){ pc.textContent = list.length; }
  if(pl){ pl.textContent = list.length===1 ? "program matches" : "programs match"; }
}

var GROUP_AGENCIES = {
  "Private & Philanthropic Funders": ["PepsiCo (private)","LISC / Foot Locker Foundation (private)","Midland States Bank Foundation (private)","T-Mobile (private)","Forefront (nonprofit)","Walmart (private)"],
  "Federal (other)": ["USDA","ICCB","US EPA","US DOT","US Small Business Administration"]
};
var nodesEls = document.querySelectorAll("svg.web .node");
for(var ni=0; ni<nodesEls.length; ni++){
  (function(n){
    function go(){
      var ag = n.getAttribute("data-agency"), i;
      var raw = GROUP_AGENCIES[ag] || [ag];
      selAud = []; selType = []; sync();
      var list = [];
      for(i=0;i<D.PROGRAMS.length;i++){ if(has(raw, D.PROGRAMS[i].agency)){ list.push(D.PROGRAMS[i]); } }
      paint(list, list.length + (list.length===1?" program":" programs") + " from " + ag);
      var sp = document.querySelectorAll("svg.web .spoke");
      for(i=0;i<sp.length;i++){
        sp[i].setAttribute("class", sp[i].getAttribute("data-agency") === ag ? "spoke on" : "spoke");
      }
      var target = document.getElementById("navigator");
      if(target.scrollIntoView){ target.scrollIntoView(true); }
    }
    n.onclick = go;
    n.onkeydown = function(e){ if(e.keyCode===13 || e.keyCode===32){ e.preventDefault(); go(); } };
  })(nodesEls[ni]);
}

function drawStack(id){
  var st = findBy(D.STACKS, id), i;
  var host = document.getElementById("stack");
  host.innerHTML = "";
  var wrap = el("div","stack");

  var sc = el("div","scenario");
  sc.appendChild(el("p","lbl","Total project cost"));
  sc.appendChild(el("div","total",st.total));
  sc.appendChild(el("p","lbl","The project"));
  var pr = el("p",null,st.project);
  pr.style.color="#BFD4E6"; pr.style.fontSize="13.5px"; pr.style.margin="6px 0 16px";
  sc.appendChild(pr);
  sc.appendChild(el("p","lbl","The situation"));
  var ul = el("ul");
  for(i=0;i<st.facts.length;i++){ ul.appendChild(el("li",null,st.facts[i])); }
  sc.appendChild(ul);
  sc.appendChild(el("div","first",st.first));
  wrap.appendChild(sc);

  var right = el("div");
  var bar = el("div","bar");
  for(i=0;i<st.layers.length;i++){
    var l = st.layers[i];
    var d = el("div", null, l.pct < 8 ? "" : (l.pct + "%"));
    var dark = (l.color==="D9A21B" || l.color==="B8C4BC" || l.color==="E3C97A");
    d.style.width = l.pct + "%";
    d.style.background = "#" + l.color;
    d.style.color = dark ? "#0F2E22" : "#ffffff";
    bar.appendChild(d);
  }
  right.appendChild(bar);
  right.appendChild(el("p","barnote","100% of project cost, left to right"));

  for(i=0;i<st.layers.length;i++){
    var ly = st.layers[i];
    var r = el("div","lrow");
    var sw = el("div","sw"); sw.style.background = "#" + ly.color; r.appendChild(sw);
    r.appendChild(el("div","pc", ly.pct + "%"));
    var mid = el("div");
    mid.appendChild(el("div","nm", ly.source + " \u2014 " + ly.program));
    mid.appendChild(el("div","nt", ly.note));
    r.appendChild(mid);
    r.appendChild(el("div","ag", ly.agency));
    right.appendChild(r);
  }
  wrap.appendChild(right);
  host.appendChild(wrap);
}

var tabs = document.getElementById("tabs");
for(var si=0; si<D.STACKS.length; si++){
  (function(s, idx){
    var b = el("button","tab",s.audience);
    b.type="button"; b.setAttribute("role","tab");
    b.setAttribute("aria-selected", idx===0 ? "true" : "false");
    b.onclick = function(){
      var all = document.querySelectorAll("#tabs .tab");
      for(var k=0;k<all.length;k++){ all[k].setAttribute("aria-selected","false"); }
      b.setAttribute("aria-selected","true");
      drawStack(s.id);
    };
    tabs.appendChild(b);
  })(D.STACKS[si], si);
}

document.getElementById("reset").onclick = function(){
  selAud = []; selType = []; clearSpokes(); sync(); render();
};

buildChips("audChips", D.AUDIENCES, "aud");
buildChips("typeChips", D.PROJECT_TYPES, "type");
wirePathwayNodes();
sync();
render();
drawStack(D.STACKS[0].id);
</script>
</body>
</html>
`;

const OUT = path.join(__dirname, "..", "index.html");
fs.writeFileSync(OUT, html);
console.log("index.html written:", html.length, "chars ->", OUT);
