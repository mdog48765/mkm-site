// scripts/updateSortDates.mjs
// Usage:
//   node scripts/updateSortDates.mjs --dry
//   node scripts/updateSortDates.mjs
//   node scripts/updateSortDates.mjs --force
//   node scripts/updateSortDates.mjs --defaultHour=19
//
// Behavior:
// - Looks at src/shows.json (top-level array).
// - If an item is missing sortDate OR has an invalid sortDate, it will compute one
//   from dateText + timeText.
// - If --force is provided, it will recompute even if a valid sortDate already exists.
// - If no time is found, uses defaultHour (19 = 7 PM).

import fs from "fs";

const FILE = "./src/shows.json";

// --- CLI flags ---
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const defaultHourArg = args.find(a => a.startsWith("--defaultHour="));
const DEFAULT_HOUR = defaultHourArg ? Math.min(23, Math.max(0, Number(defaultHourArg.split("=")[1]) || 19)) : 19;

// --- Helpers ---
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

function z(n) { return String(n).padStart(2, "0"); }
function isValidDate(d) { return d instanceof Date && !Number.isNaN(d.getTime()); }
function parseIntSafe(s) { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; }

// Strip ordinals (“1st”, “2nd”, “3rd”, “4th”)
function stripOrdinals(s) {
  return (s || "").replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
}

// Tries to pull first time like "7PM", "7 PM", "7:30 pm", "Doors 7 PM • Music 8 PM", "7PM–10PM"
function extractTime(dateText, timeText) {
  const pool = [timeText, dateText].filter(Boolean).join(" • ");

  // First try explicit times with am/pm
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)/i;
  const m = pool.match(timeRegex);
  if (m) {
    let hr = parseIntSafe(m[1]);
    const min = parseIntSafe(m[2] || "0");
    const ap = m[3].toLowerCase().replaceAll(".", "");
    if (hr === 12 && ap === "am") hr = 0;
    else if (ap === "pm" && hr < 12) hr += 12;
    return { hour: hr, minute: min || 0 };
  }

  // Handle 24h like "19:30"
  const time24 = /(^|\b)([01]?\d|2[0-3]):([0-5]\d)($|\b)/.exec(pool);
  if (time24) {
    return { hour: parseIntSafe(time24[2]), minute: parseIntSafe(time24[3]) || 0 };
  }

  // Handle bare hour ranges like "7–10" (assume PM window)
  const bareRange = /(^|\b)(\d{1,2})\s*[–-]\s*(\d{1,2})($|\b)/.exec(pool);
  if (bareRange) {
    const hr = parseIntSafe(bareRange[2]);
    // Assume typical show start is evening (PM)
    return { hour: (hr >= 1 && hr <= 11) ? hr + 12 : hr, minute: 0 };
  }

  // Handle single bare hour "8" (assume PM)
  const bareHour = /(^|\b)(\d{1,2})($|\b)/.exec(pool);
  if (bareHour) {
    const hr = parseIntSafe(bareHour[2]);
    return { hour: (hr >= 1 && hr <= 11) ? hr + 12 : hr, minute: 0 };
  }

  // Fallback to DEFAULT_HOUR (e.g., 19 = 7PM)
  return { hour: DEFAULT_HOUR, minute: 0 };
}

// Returns a Date for the best-guess event datetime
function computeDate({ dateText, timeText }) {
  if (!dateText) return null;

  const clean = stripOrdinals(String(dateText)).replace(/[,]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  // Capture explicit year if present
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const explicitYear = yearMatch ? parseIntSafe(yearMatch[1]) : null;

  // Find month token
  let foundMonth = null;
  for (const key of Object.keys(MONTHS)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(clean)) {
      foundMonth = MONTHS[key];
      break;
    }
  }
  if (!foundMonth) return null;

  // Find day (first 1-31 near month)
  const dayMatch = clean.match(/\b([0-3]?\d)\b/);
  const day = dayMatch ? parseIntSafe(dayMatch[1]) : null;
  if (!day || day < 1 || day > 31) return null;

  // Time
  const t = extractTime(dateText, timeText);
  const now = new Date();
  const baseYear = explicitYear ?? now.getFullYear();

  let d = new Date(baseYear, foundMonth - 1, day, t.hour, t.minute, 0, 0);

  // If no explicit year and the parsed date is > 10 months in the past, assume next year (for “Dec/Jan” turn)
  if (!explicitYear) {
    const tenMonthsMs = 1000 * 60 * 60 * 24 * 30 * 10;
    if (now.getTime() - d.getTime() > tenMonthsMs) {
      d = new Date(baseYear + 1, foundMonth - 1, day, t.hour, t.minute, 0, 0);
    }
  }

  return isValidDate(d) ? d : null;
}

function toIsoNoSeconds(d) {
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// --- Main ---
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

let updated = 0;
let skipped = 0;
let errors = 0;

const out = data.map((e, idx) => {
  const hasValid = e?.sortDate && !Number.isNaN(new Date(e.sortDate).getTime());
  if (hasValid && !FORCE) {
    skipped++;
    return e; // keep as-is
  }

  const d = computeDate({ dateText: e?.dateText, timeText: e?.timeText });
  if (!d) {
    console.warn(`⚠️  [${idx}] Unable to compute date from: dateText="${e?.dateText}" timeText="${e?.timeText}"`);
    errors++;
    return e;
  }

  const iso = toIsoNoSeconds(d);
  if (DRY) {
    console.log(`• DRY: would set sortDate for "${e?.title || e?.id || idx}" -> ${iso}`);
    return e;
  } else {
    updated++;
    return { ...e, sortDate: iso };
  }
});

if (!DRY) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(`\n✅ Wrote ${FILE}`);
  } catch (e) {
    console.error(`❌ Failed writing ${FILE}:`, e.message);
    process.exit(1);
  }
}

console.log(`\nSummary: updated=${updated}, skipped=${skipped}, errors=${errors}, defaultHour=${DEFAULT_HOUR}, force=${FORCE}, dry=${DRY}`);
