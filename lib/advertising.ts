// Public publisher/unit IDs recovered from this project's existing configuration.
// These identify ad units; account approval and delivery are checked in AdSense.
export const AD_PUBLISHER=process.env.NEXT_PUBLIC_ADSENSE_CLIENT||"ca-pub-4088690490762441";
export const AD_UNITS={
  rail:process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_RAIL||"1910183004",
  leaderboard:process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BANNER||"6970937995",
};
