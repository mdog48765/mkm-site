// scripts/prunePastShows.mjs
// Usage:
//   node scripts/prunePastShows.mjs           # keep 6 past by default
//   node scripts/prunePastShows.mjs --keep=6  # explicit
//   node scripts/prunePastShows.mjs --dry     # preview
//
// Deletes past events beyond the N most-recent (default 6), keeps all upcoming.

import fs from "fs";

const FILE = "./src/shows.json";
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const keepArg = args.find(a => a.startsWith("--keep="));
const KEEP = keepArg ? Math.max(0, parseInt(keepArg.split("=")[1], 10) || 6) : 6;

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}
const todayStart = startOfToday();

function validDate(s) {
  const t = new Date(s).getTime();
  return Number.isFinite(t);
}

let raw;
try {
  raw = fs.readFileSync(FILE, "utf8");
} catch (e) {
  console.error(`❌ Could not read ${FILE}:`, e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`❌ ${FILE} is not valid JSON:`, e.message);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error("❌ Expected top-level array in src/shows.json");
  process.exit(1);
}

// Split upcoming vs past (only items with valid sortDate are considered past/upcoming)
const withValid = data.filter(e => e && e.sortDate && validDate(e.sortDate));
const withoutValid = data.filter(e => !(e && e.sortDate && validDate(e.sortDate))); // leave these untouched in upcoming

const upcoming = withValid.filter(e => new Date(e.sortDate) >= todayStart);
const past = withValid.filter(e => new Date(e.sortDate) < todayStart);

// Sort past newest-first
past.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

// Keep N most-recent past, drop the rest
const pastKept = past.slice(0, KEEP);
const pastDropped = past.slice(KEEP);

// New dataset = all upcoming + kept past + items without valid sortDate
const output = [...upcoming, ...pastKept, ...withoutValid];

// Preserve order a bit (optional): sort upcoming ascending, then kept past descending, then leave “withoutValid” last
const upcomingAsc = [...upcoming].sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
const pastDesc = [...pastKept].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
const finalOut = [...upcomingAsc, ...pastDesc, ...withoutValid];

if (DRY) {
  console.log(`DRY RUN — would write ${FILE}`);
  console.log(`Kept upcoming: ${upcomingAsc.length}, kept past: ${pastDesc.length}, dropped past: ${pastDropped.length}, untouched (no valid sortDate): ${withoutValid.length}`);
  pastDropped.forEach(e => console.log(`• drop: ${e.title || e.id} (${e.sortDate})`));
  process.exit(0);
}

try {
  fs.writeFileSync(FILE, JSON.stringify(finalOut, null, 2) + "\n", "utf8");
  console.log(`✅ Pruned ${pastDropped.length} past event(s). Kept ${pastDesc.length} past, ${upcomingAsc.length} upcoming, ${withoutValid.length} un-dated.`);
} catch (e) {
  console.error(`❌ Failed writing ${FILE}:`, e.message);
  process.exit(1);
}
