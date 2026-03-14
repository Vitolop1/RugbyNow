export type TimeZoneOption = {
  value: string;
  short: string;
  long: string;
};

export const DEFAULT_TZ = "America/New_York";

const BASE_TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { value: "America/New_York", short: "NY (ET)", long: "New York (ET)" },
  { value: "America/Chicago", short: "CHI (CT)", long: "Chicago (CT)" },
  { value: "America/Denver", short: "DEN (MT)", long: "Denver (MT)" },
  { value: "America/Los_Angeles", short: "LA (PT)", long: "Los Angeles (PT)" },
  { value: "America/Argentina/Buenos_Aires", short: "ARG", long: "Argentina (ART)" },
  { value: "Europe/London", short: "LON", long: "London (GMT)" },
];

export function isValidTimeZone(value?: string | null) {
  if (!value || !value.trim()) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function detectBrowserTimeZone() {
  if (typeof window === "undefined") return undefined;

  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(detected) ? detected : undefined;
  } catch {
    return undefined;
  }
}

function prettifyTimeZoneName(value: string) {
  const parts = value.split("/");
  const city = parts[parts.length - 1]?.replace(/_/g, " ") ?? value;

  if (city.length <= 3) return city.toUpperCase();
  if (city.length <= 12) return city;
  return city.slice(0, 12);
}

export function buildTimeZoneOptions(currentTimeZone?: string | null) {
  const options = [...BASE_TIME_ZONE_OPTIONS];

  if (currentTimeZone && isValidTimeZone(currentTimeZone) && !options.some((option) => option.value === currentTimeZone)) {
    options.unshift({
      value: currentTimeZone,
      short: prettifyTimeZoneName(currentTimeZone),
      long: currentTimeZone.replace(/_/g, " "),
    });
  }

  return options;
}
