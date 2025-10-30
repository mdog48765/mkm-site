// scripts/release.mjs
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: "inherit", cwd: path.join(ROOT, ".."), ...opts });
};

const runGet = (cmd) => {
  return execSync(cmd, { cwd: path.join(ROOT, "..") }).toString().trim();
};

try {
  // 1) Build/refresh gallery
  run("node scripts/build-gallery.mjs");

  // 2) Git add/commit/push if there are changes
  const status = runGet("git status --porcelain");
  if (status.length > 0) {
    run("git add -A");
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    run(`git commit -m "Release: gallery build + deploy (${stamp})"`);
    // Determine current branch and push
    const branch = runGet("git rev-parse --abbrev-ref HEAD");
    run(`git push -u origin ${branch}`);
  } else {
    console.log("\n(no changes detected — skipping commit/push)");
  }

  // 3) Vercel production deploy (assumes `vercel login` + `vercel link` already done)
  run("vercel --prod --confirm");

  console.log("\n✅ Release completed.");
} catch (e) {
  console.error("\n❌ Release failed.");
  process.exit(1);
}
