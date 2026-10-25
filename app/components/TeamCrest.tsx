"use client";

import {useCallback, useState, type CSSProperties} from "react";
import {getTeamLogo} from "@/lib/assets";

/** Decorative: the adjacent team name supplies the accessible identity. */
export default function TeamCrest({slug, name, size = 26}: {
  slug?: string | null;
  name?: string;
  size?: number;
}) {
  const src = getTeamLogo(slug, name);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = src === "/icons/rugby-ball.svg" || failedSource === src;
  const checkImage = useCallback((img: HTMLImageElement | null) => {
    // A cached failure may have happened before hydration attached onError.
    if (img?.complete && img.naturalWidth === 0) setFailedSource(src);
  }, [src]);

  // The existing Stormers asset is the club's white/negative mark.
  return <span className="rn-team-crest" data-crest-surface={!failed && src === "/team-logos/stormers.png" ? "dark" : undefined} style={{"--crest-size": `${size}px`} as CSSProperties} aria-hidden="true">
    {failed ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20C0 6 6 0 20 4c4 14-2 20-16 16Zm3-3L17 7m-7 3 4 4m-2-6 4 4m-8 0 4 4"/>
    </svg> : <img key={src} ref={checkImage} src={src} alt="" width={size} height={size} onError={() => setFailedSource(src)}/>}
  </span>;
}
