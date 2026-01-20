import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "bun";
import os from "os";
import { pathToFileURL } from "url";

export async function ensureNativeLib() {
  const homeDir = os.homedir();
  const baseDir = join(homeDir, ".eklinik-printer");
  const targetDir = join(baseDir, "node_modules", "usb");

  const gypDir = join(baseDir, "node_modules", "node-gyp-build");

  if (!existsSync(targetDir) || !existsSync(gypDir)) {
    console.log("🚀 First time setup: Extracting native drivers...");
    console.log(`📂 Destination: ${baseDir}`);
    
    try {
      const { usbBase64 } = await import("./usb-data.ts");
      
      const zipPath = join(baseDir, "usb_extract.zip");
      const buffer = Buffer.from(usbBase64, "base64");

      if (!existsSync(baseDir)) {
        mkdirSync(baseDir, { recursive: true });
      }
      
      writeFileSync(zipPath, buffer);

      if (!existsSync(join(baseDir, "node_modules"))) {
        mkdirSync(join(baseDir, "node_modules"), { recursive: true });
      }

      console.log("🤐 Unzipping drivers...");
      const extractResult = spawnSync([
        "powershell",
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${join(baseDir, "node_modules")}" -Force`,
      ]);

      if (extractResult.exitCode !== 0) {
        throw new Error("Extraction failed: " + extractResult.stderr.toString());
      }

      spawnSync(["powershell", "-NoProfile", "-Command", `Remove-Item "${zipPath}" -Force`]);
      console.log("✅ Extraction complete!");
    } catch (err) {
      console.error("❌ Failed to extract native drivers:", err);
      process.exit(1);
    }
  }

  // Load the module using pathToFileURL to handle spaces and Windows paths correctly
  try {
    const usbModulePath = join(targetDir, "dist", "index.js");
    const moduleUrl = pathToFileURL(usbModulePath).href;
    console.log("🔌 Loading USB module from:", moduleUrl);
    return await import(moduleUrl);
  } catch (err) {
    console.error("❌ Failed to load extracted USB module:", err);
    process.exit(1);
  }
}
