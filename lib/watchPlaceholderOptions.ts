export type WatchPlaceholderOption = {
  id: string;
  name: string;
  placeholderHref: string;
};

export const WATCH_PLACEHOLDER_OPTIONS: WatchPlaceholderOption[] = [
  {
    id: "viprow-rugby",
    name: "VIPRow · Rugby",
    placeholderHref: "https://viprow.im/sports/rugby/",
  },
  {
    id: "rugbybox",
    name: "RugbyBox",
    placeholderHref: "https://rugbybox.me/rugby-union-streams",
  },
  {
    id: "vipleague-rugby",
    name: "VIPLeague · Streamiz",
    placeholderHref: "https://streamiz.lol/vipleaguetv/",
  },
];
