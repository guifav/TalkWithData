import { getFirebasePublicConfig } from "@/lib/firebase/runtime-config";

export function getAllowedAuthDomain(): string {
  if (typeof window !== "undefined") {
    return getFirebasePublicConfig().allowedAuthDomain;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-placeholder.invalid";
  }

  const domain = process.env.ALLOWED_AUTH_DOMAIN?.trim();
  if (!domain) {
    throw new Error("ALLOWED_AUTH_DOMAIN env var is required. Set it in .env");
  }
  return domain;
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = getAllowedAuthDomain();
  return email.toLowerCase().endsWith("@" + domain.toLowerCase());
}
