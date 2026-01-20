import { spawnSync } from "bun";
import { existsSync, mkdirSync, rmSync, cpSync, renameSync } from "fs";
import { join } from "path";
import os from "os";

async function buildBundle() {
  console.log("🛠️  Building Thin Client Bundle...");

  const cwd = process.cwd();
  const distDir = join(cwd, "dist_bundle");
  const outputDir = join(cwd, "dist");
  const zipPath = join(outputDir, "app-bundle.zip");
  const isWindows = os.platform() === "win32";

  // Ensure dist directory exists
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  try {
    // 1. Clean and create dist directory
    if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });

    // 2. Build minified JS (no compile, just bundle)
    console.log("📦 Bundling JS...");
    const buildResult = spawnSync([
      "bun",
      "build",
      "./src/index.ts",
      "--minify",
      "--target=bun",
      "--external",
      "usb",
      "--outfile",
      join(distDir, "index.js"),
    ]);

    if (buildResult.exitCode !== 0) {
      console.error("❌ JS Bundle failed:", buildResult.stderr.toString());
      process.exit(1);
    }

    // 3. Copy and prune node_modules/usb
    console.log("🚚 Copying native modules...");
    const targetModules = join(distDir, "node_modules");
    mkdirSync(targetModules, { recursive: true });

    const modules = ["usb", "node-gyp-build", "node-addon-api"];
    for (const mod of modules) {
      const src = join(cwd, "node_modules", mod);
      const dest = join(targetModules, mod);
      cpSync(src, dest, {
        recursive: true,
        force: true,
        filter: (path) => {
          const skip = [
            "libusb",
            "src",
            "test",
            "tests",
            "doc",
            "docs",
            "examples",
            ".git",
            ".github",
          ];
          return !skip.some((s) => path.includes(join(mod, s)));
        },
      });
    }

    // 4. Zip it
    console.log("🤐 Zipping bundle...");
    if (existsSync(zipPath)) rmSync(zipPath, { force: true });

    let zipResult;
    if (isWindows) {
      zipResult = spawnSync([
        "powershell",
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path "${distDir}/*" -DestinationPath "${zipPath}" -Force`,
      ]);
    } else {
      zipResult = spawnSync(["zip", "-r", zipPath, "."], {
        cwd: distDir,
      });
    }

    if (zipResult.exitCode !== 0) {
      console.error("❌ Compression failed:", zipResult.stderr?.toString());
      process.exit(1);
    }

    console.log(`✅ Bundle created: ${zipPath}`);
  } finally {
    // Cleanup distDir but keep the zip
    if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  }
}

buildBundle();
