import AdmZip from "adm-zip";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redactArtifact } from "./artifact-redaction.mjs";

const roots = ["test-results", "playwright-report"]
  .map((directory) => path.resolve(process.cwd(), directory))
  .filter(existsSync);

let redacted = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    if (file.endsWith(".zip")) {
      sanitizeZip(file);
    } else if (isTextArtifact(file)) {
      sanitizeTextFile(file);
    }
  }
}

if (redacted > 0) {
  console.log(`Sanitized ${redacted} sensitive Playwright artifact value(s).`);
}

function sanitizeZip(file) {
  const zip = new AdmZip(file);
  let changed = false;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !isTextArtifact(entry.entryName)) continue;
    const original = entry.getData().toString("utf8");
    const sanitized = redact(original);
    if (sanitized !== original) {
      zip.updateFile(entry.entryName, Buffer.from(sanitized, "utf8"));
      changed = true;
    }
  }
  if (changed) zip.writeZip(file);
}

function sanitizeTextFile(file) {
  const original = readFileSync(file, "utf8");
  const sanitized = redact(original);
  if (sanitized !== original) writeFileSync(file, sanitized, "utf8");
}

function redact(value) {
  const result = redactArtifact(value);
  redacted += result.redacted;
  return result.content;
}

function walk(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const target = path.join(root, entry);
    if (statSync(target).isDirectory()) files.push(...walk(target));
    else files.push(target);
  }
  return files;
}

function isTextArtifact(file) {
  return /(?:\.trace|\.network|\.stacks|\.json|\.txt|\.md|\.html)$/i.test(file);
}
