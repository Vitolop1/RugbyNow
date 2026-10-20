/** One rounded oval shared by the loading indicator and sponsor artwork. */
export function RugbyBallArt({shadow=true}:{shadow?:boolean}){
  return <svg viewBox="0 0 180 160" fill="none" aria-hidden="true">
    {shadow&&<ellipse className="rn-ball-shadow" cx="90" cy="143" rx="58" ry="4" fill="currentColor" opacity=".14"/>}
    <g className="rn-ball-body"><g transform="rotate(-40 90 76)">
      <ellipse cx="90" cy="79" rx="76" ry="39" fill="#ccd1d7" stroke="#222532" strokeWidth="2.6"/>
      <ellipse cx="90" cy="74" rx="75" ry="36" fill="#fafaf9" stroke="#222532" strokeWidth="2.4"/>
      <ellipse cx="90" cy="74" rx="70" ry="31" fill="#284b82" stroke="#222532" strokeWidth="1.8"/>
      <ellipse cx="90" cy="74" rx="64" ry="26" fill="#e93c52" stroke="#222532" strokeWidth="1.8"/>
      <ellipse cx="90" cy="74" rx="57" ry="20" fill="#eceeef" stroke="#222532" strokeWidth="2.2"/>
      <path d="M61 68h38M64 75h32" stroke="#222532" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="115" cy="77" rx="10" ry="7" fill="#38394e" stroke="#222532" strokeWidth="1.8"/>
      <path d="m109 82 12-10" stroke="#eceeef" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M34 64C46 53 62 48 79 46" stroke="white" strokeWidth="2.3" opacity=".6" strokeLinecap="round"/>
    </g></g>
  </svg>;
}
export default function RugbyBall({spinning=false,small=false}:{spinning?:boolean;small?:boolean}){
  return <span className={`rn-rugby-loader ${spinning?"rn-rugby-spinning":""} ${small?"rn-rugby-small":""}`} aria-hidden="true"><RugbyBallArt/></span>;
}
