import { spawnSync } from "bun";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
} from "fs";
import { join } from "path";
import os from "os";

async function packageUsb() {
  console.log("📦 Packaging native USB module and dependencies...");

  const cwd = process.cwd();
  const tempDir = join(cwd, "temp_package");
  const tempNodeModules = join(tempDir, "node_modules");
  const zipPath = join(cwd, "usb_temp.zip");
  const isWindows = os.platform() === "win32";

  // Modules to include
  const modules = ["usb", "node-gyp-build", "node-addon-api"];

  try {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempNodeModules, { recursive: true });

    for (const mod of modules) {
      const modPath = join(cwd, "node_modules", mod);
      if (!existsSync(modPath)) {
        console.error(
          `❌ node_modules/${mod} not found! Run bun install first.`,
        );
        process.exit(1);
      }
      console.log(`🚚 Copying ${mod}...`);
      const targetPath = join(tempNodeModules, mod);
      cpSync(modPath, targetPath, {
        recursive: true,
        force: true,
        filter: (src) => {
          // Skip unnecessary directories to save space
          const skip = [
            "libusb",
            "src",
            "test",
            "tests",
            "doc",
            "docs",
            "examples",
            "prebuilds/android-arm",
            "prebuilds/android-arm64",
            "prebuilds/linux-arm",
            "prebuilds/linux-ia32",
            "prebuilds/win32-arm64",
            "prebuilds/win32-ia32",
          ];
          return !skip.some((s) => src.includes(join(mod, s)));
        },
      });
    }

    console.log("🤐 Compressing...");

    let zipResult;
    try {
      if (isWindows) {
        zipResult = spawnSync([
          "powershell",
          "-NoProfile",
          "-Command",
          `Get-ChildItem -Path "${tempNodeModules}" | Compress-Archive -DestinationPath "${zipPath}" -Force`,
        ]);
      } else {
        // On macOS/Linux, we use the 'zip' command
        // -r for recursive, -j to junk paths (so it doesn't include the whole tempNodeModules path)
        // Actually, we want the contents of tempNodeModules to be at the root of the zip.
        zipResult = spawnSync(["zip", "-r", zipPath, "."], {
          cwd: tempNodeModules,
        });
      }

      if (zipResult.exitCode !== 0) {
        console.error(
          "❌ Compression failed:",
          zipResult.stderr?.toString() || "Unknown error",
        );
        process.exit(1);
      }
    } catch (e: any) {
      console.error("❌ Failed to execute zip command:", e.message);
      process.exit(1);
    }

    console.log("💾 Converting to Base64...");
    const zipBuffer = readFileSync(zipPath);
    const base64 = zipBuffer.toString("base64");

    const dataFileContent = `// Auto-generated file. Do not edit.
export const usbBase64 = "${base64}";
`;

    writeFileSync(join(cwd, "usb-data.ts"), dataFileContent);
    console.log("✅ usb-data.ts generated successfully!");
  } finally {
    // Cleanup
    if (existsSync(zipPath)) rmSync(zipPath, { force: true });
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  }
}

packageUsb();
