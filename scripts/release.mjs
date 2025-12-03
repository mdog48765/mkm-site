// scripts/release.mjs
import { execSync } from "child_process";

function run(cmd, opts = {}) {
  const defaults = { stdio: "inherit", env: process.env };
  return execSync(cmd, { ...defaults, ...opts });
}

function runQuiet(cmd) {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

function safe(cmd) {
  try { run(cmd); } catch (e) { /* swallow */ }
}

// ---- Flags ----
const DO_DEPLOY = process.argv.includes("--deploy");

// ---- 1) Pre-build chores ----
console.log("▶ Building/refreshing gallery assets");
run("npm run gallery");

console.log("▶ Maintaining shows data");
run("npm run maintain:shows");

// ---- 2) Build ----
console.log("▶ Running production build");
run("vite build");

// ---- 3) Git add/commit/push ----
console.log("▶ Preparing Git commit");

const branch = (() => {
  try { return runQuiet("git rev-parse --abbrev-ref HEAD") || "main"; }
  catch { return "main"; }
})();

safe("git add -A");

// Anything staged?
let hasChanges = false;
try {
  // exit code 1 when there are staged changes with this command
  execSync("git diff --cached --quiet");
  hasChanges = false; // no changes staged
} catch {
  hasChanges = true; // changes staged
}

if (hasChanges) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const msg = `release: build + data update (${ts})`;
  console.log(`▶ Committing: ${msg}`);
  run(`git commit -m "${msg}"`);
  console.log(`▶ Pushing to origin/${branch}`);
  run(`git push -u origin ${branch}`);
} else {
  console.log("ℹ No changes to commit (nothing staged). Skipping push.");
}

// ---- 4) Optional: direct Vercel deploy ----
if (DO_DEPLOY) {
  console.log("▶ Deploying with Vercel CLI (--deploy flag detected)");
  // requires: `vercel login` and `vercel link` done once
  run("vercel --prod");
}

console.log("✅ Release complete.");
console.log(
  DO_DEPLOY
    ? "Pushed to GitHub and deployed to Vercel."
    : "Pushed to GitHub. (Vercel will auto-deploy from Git.)"
);
