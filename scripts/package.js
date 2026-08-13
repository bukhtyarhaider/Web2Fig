"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const zipName = "web2fig-v1.0.0.zip";
const zipPath = path.join(distDir, zipName);

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const filesToInclude = [
  "manifest.json",
  "background.js",
  "capture.js",
  "toolbar.js",
  "assets/icon-16.png",
  "assets/icon-32.png",
  "assets/icon-48.png",
  "assets/icon-128.png",
  "README.md"
];

console.log("Packaging Web2Fig v1.0.0 release archive...");

try {
  const cmd = `zip -q "${zipPath}" ${filesToInclude.map((f) => `"${f}"`).join(" ")}`;
  execSync(cmd, { cwd: rootDir });
  const stats = fs.statSync(zipPath);
  console.log(`Created release package: ${zipPath} (${Math.round(stats.size / 1024)} KB)`);
} catch (error) {
  console.error("Packaging failed:", error.message);
  process.exit(1);
}
