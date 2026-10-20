export default function RugbyBall({spinning=false,small=false}:{spinning?:boolean;small?:boolean}){
  return <span className={`rn-rugby-loader ${spinning?"rn-rugby-spinning":""} ${small?"rn-rugby-small":""}`} aria-hidden="true">
    <svg viewBox="0 0 160 170" width={small?24:94} height={small?26:100} fill="none">
      <ellipse className="rn-ball-shadow" cx="80" cy="151" rx="48" ry="7" fill="currentColor" opacity=".14"/>
      <g className="rn-ball-body" transform="rotate(35 80 77)">
        <ellipse cx="80" cy="77" rx="43" ry="68" fill="#f4f5f4" stroke="#202833" strokeWidth="4"/>
        <path d="M55 22C30 61 30 95 56 132C40 130 31 102 37 64C40 44 46 30 55 22Z" fill="#244878"/>
        <path d="M64 12C40 55 43 103 65 140L55 137C30 95 32 54 54 19Z" fill="#e73c51" stroke="#202833" strokeWidth="2"/>
        <path d="M99 14C125 61 123 103 99 140L108 132C133 91 128 49 108 23Z" fill="#244878"/>
        <path d="M92 11C119 57 118 102 92 143L102 139C127 94 126 53 103 17Z" fill="#e73c51" stroke="#202833" strokeWidth="2"/>
        <path d="M72 43V105M86 48V100" stroke="#202833" strokeWidth="4" strokeLinecap="round"/>
        <path d="M67 56H91M67 68H91M67 80H91M67 92H91" stroke="#202833" strokeWidth="3" strokeLinecap="round"/>
        <path d="M54 30C41 55 40 81 46 98" stroke="white" strokeWidth="5" opacity=".45" strokeLinecap="round"/>
      </g>
    </svg>
  </span>;
}
