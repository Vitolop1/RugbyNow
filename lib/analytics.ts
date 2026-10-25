type ProductEvent = "match_open" | "watch_options_open" | "watch_provider_click" | "agenda_favorite" | "agenda_calendar_export" | "sponsor_contact_click" | "sponsor_inquiry" | "share" | "league_follow" | "club_follow";

const allowed=new Set(['match_id','event_id','competition_slug','provider_id','link_type','saved','placement','action','method','club_slug']);
export function productEventProperties(properties:Record<string,string|number>){
  const result:Record<string,string|number>={};
  for(const [raw,value] of Object.entries(properties)){
    const key=raw==='competition'?'competition_slug':raw;
    if(!allowed.has(key))continue;
    // Only controlled identifiers, never full URLs, email addresses or free text.
    if(typeof value==='number'){if(Number.isFinite(value))result[key]=value;}
    else if(/^[a-zA-Z0-9_:/.-]{1,100}$/.test(value)&&!value.includes('://'))result[key]=value;
  }
  return result;
}

// Use the existing GA4 setup. Do not collect emails, free text or full URLs.
export function trackProductEvent(name: ProductEvent, properties: Record<string, string | number>) {
  if (typeof window === "undefined" || !window.rugbyAnalyticsAllowed || typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...productEventProperties(properties), language: document.documentElement.lang });
}
