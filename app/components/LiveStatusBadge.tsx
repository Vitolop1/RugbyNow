import React from "react";

/** Only a confirmed in-play state may receive the red badge. */
export default function LiveStatusBadge({state,label}:{state:string;label:string}){
  if(!["LIVE","HT","extra-time","shootout"].includes(state))return null;
  return <span className="rn-live-badge" data-live-status={state}><span aria-hidden="true"/>{label}</span>;
}
