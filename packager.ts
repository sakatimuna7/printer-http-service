import { spawnSync } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

async function packageUsb() {
  console.log("📦 Packaging native USB module and dependencies...");

  const cwd = process.cwd();
  const tempDir = join(cwd, "temp_package");
  const tempNodeModules = join(tempDir, "node_modules");
  const zipPath = join(cwd, "usb_temp.zip");

  // Modules to include
  const modules = ["usb", "node-gyp-build", "node-addon-api"];

  try {
    if (existsSync(tempDir)) {
      spawnSync(["powershell", "-Command", `Remove-Item "${tempDir}" -Recurse -Force`]);
    }
    mkdirSync(tempNodeModules, { recursive: true });

    for (const mod of modules) {
      const modPath = join(cwd, "node_modules", mod);
      if (!existsSync(modPath)) {
        console.error(`❌ node_modules/${mod} not found! Run bun install first.`);
        process.exit(1);
      }
      console.log(`🚚 Copying ${mod}...`);
      spawnSync([
        "powershell",
        "-NoProfile",
        "-Command",
        `Copy-Item -Path "${modPath}" -Destination "${join(tempNodeModules, mod)}" -Recurse -Force`,
      ]);
    }

    console.log("🤐 Compressing...");
    // Zip the CONTENTS of temp_package/node_modules
    const zipResult = spawnSync([
      "powershell",
      "-NoProfile",
      "-Command",
      `Get-ChildItem -Path "${tempNodeModules}" | Compress-Archive -DestinationPath "${zipPath}" -Force`,
    ]);

    if (zipResult.exitCode !== 0) {
      console.error("❌ Compression failed:", zipResult.stderr.toString());
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
    if (existsSync(zipPath)) spawnSync(["powershell", "-Command", `Remove-Item "${zipPath}" -Force`]);
    if (existsSync(tempDir)) spawnSync(["powershell", "-Command", `Remove-Item "${tempDir}" -Recurse -Force`]);
  }
}

packageUsb();
