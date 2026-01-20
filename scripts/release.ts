import { spawnSync } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

async function release() {
  console.log("🚀 Creating new release...");

  const cwd = process.cwd();
  const packagePath = join(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

  // Parse current version
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;

  console.log(`📦 Bumping version: ${pkg.version} → ${newVersion}`);

  // Update package.json
  pkg.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

  // Build the bundle
  console.log("🛠️  Building bundle...");
  const bundleResult = spawnSync(["bun", "run", "bundle"]);
  if (bundleResult.exitCode !== 0) {
    console.error("❌ Bundle build failed!");
    process.exit(1);
  }

  // Check if app-bundle.zip exists
  const bundlePath = join(cwd, "dist", "app-bundle.zip");
  if (!existsSync(bundlePath)) {
    console.error("❌ dist/app-bundle.zip not found!");
    process.exit(1);
  }

  // Git operations
  console.log("📝 Committing version bump...");
  spawnSync(["git", "add", "package.json"]);
  spawnSync(["git", "commit", "-m", `chore: bump version to ${newVersion}`]);
  spawnSync(["git", "tag", `v${newVersion}`]);

  console.log("⬆️  Pushing to GitHub...");
  spawnSync(["git", "push"]);
  spawnSync(["git", "push", "--tags"]);

  // Create GitHub Release using gh CLI
  console.log("🎉 Creating GitHub Release...");
  const releaseResult = spawnSync([
    "gh",
    "release",
    "create",
    `v${newVersion}`,
    bundlePath,
    "--title",
    `Release ${newVersion}`,
    "--notes",
    `Automated release ${newVersion}`,
  ]);

  if (releaseResult.exitCode !== 0) {
    console.error("❌ GitHub release failed!");
    console.error(releaseResult.stderr?.toString());
    process.exit(1);
  }

  console.log(`✅ Release v${newVersion} created successfully!`);
  console.log(`📦 Bundle uploaded to GitHub Releases`);
}

release();
