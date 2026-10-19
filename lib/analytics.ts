type ProductEvent = "match_open" | "watch_options_open" | "watch_provider_click";

// Use the existing GA4 setup. Do not collect emails, free text or full URLs.
export function trackProductEvent(name: ProductEvent, properties: Record<string, string | number>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...properties, language: document.documentElement.lang });
}
