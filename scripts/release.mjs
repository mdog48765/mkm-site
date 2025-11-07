// scripts/release.mjs
import { execSync } from "child_process";
import { exec } from "child_process";

const run = (cmd, label) => {
  console.log(`\n▶ ${label}\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};
const get = (cmd) => execSync(cmd).toString().trim();

try {
  // npm run release -- "your message"
  const msg = process.argv.slice(2).join(" ").trim();

  // 1) Build optimized gallery & (optionally) a local production build
  run("npm run gallery", "Building/refreshing gallery assets");
  // You can skip this next line if you don’t want a local prod build:
  run("npm run build", "Local production build (vite)");

  // 2) Commit & push only if there are changes
  const status = get("git status --porcelain");
  if (status) {
    run("git add -A", "Staging all changes");
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    const commitMsg = msg ? `Release: ${msg}` : `Release: site update (${stamp})`;
    run(`git commit -m "${commitMsg}"`, "Committing");
    const branch = get("git rev-parse --abbrev-ref HEAD");
    run(`git push -u origin ${branch}`, `Pushing to GitHub (${branch})`);
  } else {
    console.log("\n(no file changes detected — skipping commit/push)");
  }

  // 3) Deploy to Vercel production (assumes you already did `vercel login` + `vercel link`)
  run("vercel --prod", "Deploying to Vercel production");

  console.log("\n✅ Release complete.");
} catch (err) {
  console.error("\n❌ Release failed.");
  process.exit(1);
}
