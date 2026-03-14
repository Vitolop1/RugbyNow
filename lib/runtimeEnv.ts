const DEFAULT_SITE_URL = "https://rugby-now.com";

export function sanitizeRuntimeEnv(name: string, rawValue: string) {
  let value = rawValue.trim();
  if (!value) return undefined;

  const prefixed = `${name}=`;
  if (value.startsWith(prefixed)) {
    value = value.slice(prefixed.length).trim();
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || undefined;
}

export function readRuntimeEnv(name: string) {
  const processValue = process.env[name];
  if (typeof processValue === "string" && processValue.length > 0) {
    return sanitizeRuntimeEnv(name, processValue);
  }

  return undefined;
}

export function readSiteUrl() {
  const candidate = readRuntimeEnv("NEXT_PUBLIC_SITE_URL") ?? DEFAULT_SITE_URL;

  try {
    return new URL(candidate).toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}
