export function redactArtifact(value) {
  let redacted = 0;
  const replacement = (label) => {
    redacted += 1;
    return `[REDACTED_${label}]`;
  };

  const content = value
    .replace(/eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*){2}/g, () => replacement("FIREBASE_TOKEN"))
    .replace(/(embed_token=)[A-Za-z0-9_-]{43}/g, (_match, prefix) => `${prefix}${replacement("EMBED_TOKEN")}`)
    .replace(/(Bearer\s+)[a-f0-9]{64}\b/gi, (_match, prefix) => `${prefix}${replacement("DASH_TOKEN")}`)
    .replace(/(dash_session_[^=;"\\]+[=\\"]+)[a-f0-9]{64}\b/gi, (_match, prefix) => `${prefix}${replacement("DASH_TOKEN")}`)
    .replace(/("(?:inspectionToken|credentialEnc|token)"\s*:\s*")[^"]+("?)/g, (_match, prefix, suffix) => `${prefix}${replacement("SECRET_VALUE")}${suffix}`);

  return { content, redacted };
}
