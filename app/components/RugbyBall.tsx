/** Shared illustration: rounded oval, wraparound panels and two fine seams. */
export function RugbyBallArt({shadow=true}:{shadow?:boolean}){
  return <svg viewBox="0 0 180 160" fill="none" aria-hidden="true">
    {shadow&&<ellipse className="rn-ball-shadow" cx="90" cy="147" rx="63" ry="4" fill="currentColor" opacity=".14"/>}
    <g className="rn-ball-body"><g transform="rotate(40 90 76)">
      <ellipse cx="90" cy="76" rx="43" ry="72" fill="#d0d5db" stroke="#202330" strokeWidth="2.4"/>
      <ellipse cx="87" cy="73" rx="39" ry="70" fill="#fafbf9" stroke="#202330" strokeWidth="2"/>
      <path d="M87 3C48 28 42 97 66 133C38 99 42 35 72 9Z" fill="#26477f" stroke="#202330" strokeWidth="1.8"/>
      <path d="M91 4C57 30 50 100 71 138C43 111 48 38 79 6Z" fill="#ea3c53" stroke="#202330" strokeWidth="1.8"/>
      <path d="M92 4C127 29 131 101 103 141C128 127 141 56 113 17Z" fill="#26477f" stroke="#202330" strokeWidth="1.8"/>
      <path d="M92 4C123 31 126 100 99 143L108 137C134 98 129 36 105 10Z" fill="#ea3c53" stroke="#202330" strokeWidth="1.8"/>
      <path d="M83 39v55m9-48v44" stroke="#202330" strokeWidth="2.8" strokeLinecap="round"/>
      <ellipse cx="87" cy="113" rx="9" ry="16" fill="#35374b" stroke="#202330" strokeWidth="2"/>
      <path d="m82 124 10-23" stroke="#eef0f2" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M63 32C52 53 50 74 54 92" stroke="white" strokeWidth="3" opacity=".6" strokeLinecap="round"/>
    </g></g>
  </svg>;
}
export default function RugbyBall({spinning=false,small=false}:{spinning?:boolean;small?:boolean}){
  return <span className={`rn-rugby-loader ${spinning?"rn-rugby-spinning":""} ${small?"rn-rugby-small":""}`} aria-hidden="true"><RugbyBallArt/></span>;
}
