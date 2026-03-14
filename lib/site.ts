import { readSiteUrl } from "@/lib/runtimeEnv";

export function getSiteUrl() {
  return readSiteUrl();
}
