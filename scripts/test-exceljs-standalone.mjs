#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repositoryRoot, "app");
const sourcePackage = path.join(appRoot, "package.json");
const standaloneRoot = path.join(appRoot, ".next", "standalone");

await verifyExcelJsInstall("source", sourcePackage);
const standalonePackage = await findStandalonePackage(standaloneRoot);
await verifyExcelJsInstall("standalone", standalonePackage);

async function verifyExcelJsInstall(label, packageFile) {
  const require = createRequire(packageFile);
  const ExcelJS = require("exceljs");
  const unzipperPackage = JSON.parse(
    await readFile(require.resolve("unzipper/package.json"), "utf8"),
  );

  assert.equal(
    unzipperPackage.version,
    "0.12.5",
    `${label} resolves an unexpected unzipper version`,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Data").addRow(["metric", 42]);
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  assert.equal(
    loaded.getWorksheet("Data").getCell("B1").value,
    42,
    `${label} ExcelJS XLSX round-trip failed`,
  );
  console.log(`${label} ExcelJS round-trip passed with unzipper 0.12.5`);
}

async function findStandalonePackage(directory) {
  if (await isStandaloneApp(directory)) {
    return path.join(directory, "package.json");
  }

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }
    const candidate = await findStandalonePackage(path.join(directory, entry.name)).catch(
      () => null,
    );
    if (candidate) return candidate;
  }

  throw new Error(`Talk With Data standalone package not found under ${directory}`);
}

async function isStandaloneApp(directory) {
  const packageFile = path.join(directory, "package.json");
  const serverFile = path.join(directory, "server.js");
  try {
    await Promise.all([access(packageFile), access(serverFile)]);
    const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
    return packageJson.name === "talk-with-data";
  } catch {
    return false;
  }
}
