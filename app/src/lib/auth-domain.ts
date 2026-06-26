export function getAllowedAuthDomain(): string {
  const domain = (process.env.NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN || process.env.ALLOWED_AUTH_DOMAIN)?.trim();
  if (!domain) {
    throw new Error("ALLOWED_AUTH_DOMAIN env var is required. Set it in .env");
  }
  return domain;
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = getAllowedAuthDomain();
  return email.toLowerCase().endsWith("@" + domain.toLowerCase());
}
