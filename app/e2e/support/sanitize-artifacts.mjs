import AdmZip from "adm-zip";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redactArtifact } from "./artifact-redaction.mjs";

const requestedRoots = process.argv.slice(2);
const roots = (requestedRoots.length > 0 ? requestedRoots : ["test-results", "playwright-report"])
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
    if (entry.isDirectory) continue;
    const data = entry.getData();
    if (!isTextArtifact(entry.entryName) && !isLikelyText(data)) continue;
    const original = data.toString("utf8");
    const sanitized = redact(original);
    if (sanitized !== original) {
      zip.updateFile(entry.entryName, Buffer.from(sanitized, "utf8"));
      changed = true;
    }
  }
  if (changed) zip.writeZip(file);
}

function sanitizeTextFile(file) {
  const data = readFileSync(file);
  if (!isTextArtifact(file) && !isLikelyText(data)) return;
  const original = data.toString("utf8");
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

function isLikelyText(data) {
  if (data.length === 0) return true;
  if (data.includes(0)) return false;
  return !data.toString("utf8").includes("\uFFFD");
}
