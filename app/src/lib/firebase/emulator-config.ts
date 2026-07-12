export interface FirebaseEmulatorConfig {
  authUrl?: string;
  firestore?: { host: string; port: number };
}

export function parseFirebaseEmulatorConfig(input: {
  authHost?: string;
  firestoreHost?: string;
}): FirebaseEmulatorConfig | null {
  const auth = parseLocalEndpoint(input.authHost, "Auth");
  const firestore = parseLocalEndpoint(input.firestoreHost, "Firestore");

  if (!auth && !firestore) return null;

  return {
    ...(auth ? { authUrl: auth.url } : {}),
    ...(firestore
      ? { firestore: { host: firestore.hostname, port: firestore.port } }
      : {}),
  };
}

function parseLocalEndpoint(
  raw: string | undefined,
  service: string,
): { url: string; hostname: string; port: number } | null {
  if (!raw?.trim()) return null;
  if (raw.includes("://")) {
    throw new Error(`${service} emulator endpoint must be a local host and port`);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`http://${raw.trim()}`);
  } catch {
    throw new Error(`${service} emulator endpoint is invalid`);
  }

  const hostname = endpoint.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error(`${service} emulator must use a loopback host`);
  }

  const port = Number(endpoint.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${service} emulator port is invalid`);
  }

  return { url: `http://${raw.trim()}`, hostname, port };
}
