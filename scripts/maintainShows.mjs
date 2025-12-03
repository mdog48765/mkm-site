// scripts/maintainShows.mjs
// Usage examples:
//   node scripts/maintainShows.mjs
//   node scripts/maintainShows.mjs --dry
//   node scripts/maintainShows.mjs --force
//   node scripts/maintainShows.mjs --keep=6
//   node scripts/maintainShows.mjs --defaultHour=18
//
// Step 1: ensure every event has a valid sortDate (can recompute with --force)
// Step 2: prune past events beyond N most recent (default N = 6)
console.log("🧹 Running maintainShows.mjs (prebuild hook)...");

import fs from "fs";

const FILE = "./src/shows.json";

// ---------- CLI flags ----------
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const keepArg = args.find(a => a.startsWith("--keep="));
const KEEP = keepArg ? Math.max(0, parseInt(keepArg.split("=")[1], 10) || 6) : 6;
const defaultHourArg = args.find(a => a.startsWith("--defaultHour="));
const DEFAULT_HOUR = defaultHourArg ? Math.min(23, Math.max(0, Number(defaultHourArg.split("=")[1]) || 19)) : 19;

// ---------- Helpers ----------
const MONTHS = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};
const z = n => String(n).padStart(2, "0");
const isValidDate = d => d instanceof Date && !Number.isNaN(d.getTime());
const parseIntSafe = s => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
};
const todayStart = startOfToday();
const validIso = s => Number.isFinite(new Date(s).getTime());

const stripOrdinals = s => (s || "").replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");

// Extract first plausible time from timeText/dateText
function extractTime(dateText, timeText) {
  const pool = [timeText, dateText].filter(Boolean).join(" • ");

  // 12h with am/pm
  const time12 = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)\b/i.exec(pool);
  if (time12) {
    let hr = parseIntSafe(time12[1]);
    const min = parseIntSafe(time12[2] || "0");
    const ap = time12[3].toLowerCase().replaceAll(".", "");
    if (hr === 12 && ap === "am") hr = 0;
    else if (ap === "pm" && hr < 12) hr += 12;
    return { hour: hr, minute: min || 0 };
  }

  // 24h like 19:30
  const time24 = /(^|\b)([01]?\d|2[0-3]):([0-5]\d)($|\b)/.exec(pool);
  if (time24) return { hour: parseIntSafe(time24[2]), minute: parseIntSafe(time24[3]) || 0 };

  // Bare range "7–10" -> assume evening start
  const bareRange = /(^|\b)(\d{1,2})\s*[–-]\s*(\d{1,2})($|\b)/.exec(pool);
  if (bareRange) {
    const hr = parseIntSafe(bareRange[2]);
    return { hour: (hr >= 1 && hr <= 11) ? hr + 12 : hr, minute: 0 };
  }

  // Single bare hour -> assume evening
  const bareHour = /(^|\b)(\d{1,2})($|\b)/.exec(pool);
  if (bareHour) {
    const hr = parseIntSafe(bareHour[2]);
    return { hour: (hr >= 1 && hr <= 11) ? hr + 12 : hr, minute: 0 };
  }

  // Fallback default
  return { hour: DEFAULT_HOUR, minute: 0 };
}

function computeDate({ dateText, timeText }) {
  if (!dateText) return null;
  const clean = stripOrdinals(String(dateText)).replace(/[,]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const explicitYear = yearMatch ? parseIntSafe(yearMatch[1]) : null;

  let foundMonth = null;
  for (const key of Object.keys(MONTHS)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(clean)) {
      foundMonth = MONTHS[key];
      break;
    }
  }
  if (!foundMonth) return null;

  const dayMatch = clean.match(/\b([0-3]?\d)\b/);
  const day = dayMatch ? parseIntSafe(dayMatch[1]) : null;
  if (!day || day < 1 || day > 31) return null;

  const t = extractTime(dateText, timeText);
  const now = new Date();
  const baseYear = explicitYear ?? now.getFullYear();

  let d = new Date(baseYear, foundMonth - 1, day, t.hour, t.minute, 0, 0);

  // If no explicit year and parsed date is > ~10 months in the past, assume next year
  if (!explicitYear) {
    const tenMonthsMs = 1000 * 60 * 60 * 24 * 30 * 10;
    if (now.getTime() - d.getTime() > tenMonthsMs) {
      d = new Date(baseYear + 1, foundMonth - 1, day, t.hour, t.minute, 0, 0);
    }
  }
  return isValidDate(d) ? d : null;
}

const toIsoNoSeconds = d =>
  `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;

// ---------- Read JSON ----------
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

// ---------- Step 1: Update/validate sortDate ----------
let updated = 0, skipped = 0, errors = 0;
const dated = data.map((e, idx) => {
  const hasValid = e?.sortDate && validIso(e.sortDate);
  if (hasValid && !FORCE) { skipped++; return e; }

  const d = computeDate({ dateText: e?.dateText, timeText: e?.timeText });
  if (!d) {
    errors++;
    if (DRY) console.warn(`⚠️  [${idx}] Could not compute sortDate for: "${e?.title || e?.id}"`);
    return e;
  }
  const iso = toIsoNoSeconds(d);
  if (DRY) {
    console.log(`• DRY: set sortDate for "${e?.title || e?.id || idx}" -> ${iso}`);
    return e;
  } else {
    updated++;
    return { ...e, sortDate: iso };
  }
});

// ---------- Step 2: Prune past shows beyond KEEP ----------
const withValid = dated.filter(e => e && e.sortDate && validIso(e.sortDate));
const withoutValid = dated.filter(e => !(e && e.sortDate && validIso(e.sortDate)));

const upcoming = withValid.filter(e => new Date(e.sortDate) >= todayStart);
const past = withValid.filter(e => new Date(e.sortDate) < todayStart);

// Newest-first past
past.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
const pastKept = past.slice(0, KEEP);
const pastDropped = past.slice(KEEP);

// Compose final
const upcomingAsc = [...upcoming].sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
const pastDesc = [...pastKept].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
const finalOut = [...upcomingAsc, ...pastDesc, ...withoutValid];

// ---------- Write or Dry ----------
if (DRY) {
  console.log(`\nDRY RUN — would write ${FILE}`);
  console.log(`Update sortDate -> updated=${updated}, skipped=${skipped}, errors=${errors}, defaultHour=${DEFAULT_HOUR}, force=${FORCE}`);
  console.log(`Prune past -> keep=${KEEP}, kept=${pastDesc.length}, dropped=${pastDropped.length}, upcoming=${upcomingAsc.length}, noValid=${withoutValid.length}`);
  if (pastDropped.length) {
    console.log("\nWould drop:");
    pastDropped.forEach(e => console.log(`  • ${e.title || e.id} (${e.sortDate})`));
  } else {
    console.log("\nNothing to prune (fewer than", KEEP + 1, "past events).");
  }
  process.exit(0);
}

// Safety backup
try { fs.writeFileSync(FILE + ".bak", raw, "utf8"); } catch {}

try {
  fs.writeFileSync(FILE, JSON.stringify(finalOut, null, 2) + "\n", "utf8");
  console.log(`\n✅ Wrote ${FILE}`);
  console.log(`Updated sortDate: ${updated}, skipped: ${skipped}, errors: ${errors}, defaultHour=${DEFAULT_HOUR}, force=${FORCE}`);
  console.log(`Pruned past -> kept: ${pastDesc.length}, dropped: ${pastDropped.length}, keeping N=${KEEP}`);
  if (pastDropped.length) {
    console.log("Dropped:");
    pastDropped.forEach(e => console.log(`  • ${e.title || e.id} (${e.sortDate})`));
  } else {
    console.log("Nothing to prune — fewer than", KEEP + 1, "past events.");
  }
} catch (e) {
  console.error(`❌ Failed writing ${FILE}:`, e.message);
  process.exit(1);
}
