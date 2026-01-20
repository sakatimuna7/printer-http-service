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

  console.log("\n✅ Version bumped and pushed to GitHub!");
  console.log(`📦 Tag: v${newVersion}`);
  console.log("\n📋 Next steps:");
  console.log(
    "1. Go to: https://github.com/sakatimuna7/printer-http-service/releases/new",
  );
  console.log(`2. Select tag: v${newVersion}`);
  console.log(`3. Upload: dist/app-bundle.zip`);
  console.log("4. Click 'Publish release'");
  console.log("\nOr install GitHub CLI and run: gh auth login");
}

release();
