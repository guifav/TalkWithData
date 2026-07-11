#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_VARIABLES = [
  "ALLOWED_AUTH_DOMAIN",
  "NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "STORAGE_BUCKET_NAME",
  "DATABASE_URL",
  "DASHBOARD_SESSION_SECRET",
];

export const AI_PROVIDER_VARIABLES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "KIMI_API_KEY",
  "GLM_API_KEY",
];

function parseValue(rawValue, lineNumber) {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  const quote = trimmed[0];
  if (quote === '"' || quote === "'") {
    if (trimmed.length < 2 || trimmed.at(-1) !== quote) {
      throw new Error(`line ${lineNumber}: unterminated quoted value`);
    }
    return trimmed.slice(1, -1).trim();
  }

  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function parseEnv(contents) {
  const values = new Map();
  const errors = [];

  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) {
      errors.push(`line ${lineNumber}: expected KEY=value`);
      continue;
    }

    const [, key, rawValue] = match;
    if (values.has(key)) {
      errors.push(`line ${lineNumber}: duplicate variable ${key}`);
      continue;
    }

    try {
      values.set(key, parseValue(rawValue, lineNumber));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { values, errors };
}

export function validateEnv(contents) {
  const { values, errors } = parseEnv(contents);
  const validationErrors = [...errors];

  for (const key of REQUIRED_VARIABLES) {
    if (!values.get(key)?.trim()) {
      validationErrors.push(`missing required variable ${key}`);
    }
  }

  if (!AI_PROVIDER_VARIABLES.some((key) => values.get(key)?.trim())) {
    validationErrors.push(
      `set at least one AI provider key: ${AI_PROVIDER_VARIABLES.join(", ")}`,
    );
  }

  const serverDomain = values.get("ALLOWED_AUTH_DOMAIN")?.trim();
  const publicDomain = values.get("NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN")?.trim();
  if (serverDomain && publicDomain && serverDomain !== publicDomain) {
    validationErrors.push(
      "ALLOWED_AUTH_DOMAIN and NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN must match",
    );
  }

  return validationErrors;
}

export function validateEnvFile(filePath) {
  return validateEnv(readFileSync(filePath, "utf8"));
}

function runCli() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/check-env.mjs app/.env");
    process.exitCode = 2;
    return;
  }

  let errors;
  try {
    errors = validateEnvFile(filePath);
  } catch (error) {
    console.error(
      `Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  if (errors.length > 0) {
    console.error(`Environment validation failed for ${filePath}:`);
    for (const error of errors) console.error(`- ${error}`);
    console.error("Copy app/.env.example to app/.env and fill in the missing values.");
    process.exitCode = 1;
    return;
  }

  console.log(`Environment contract is complete: ${filePath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) runCli();
