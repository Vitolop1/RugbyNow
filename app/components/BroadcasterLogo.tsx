"use client";
import {useEffect,useState} from "react";
import {getBroadcastLogo} from "@/lib/broadcasts";
export default function BroadcasterLogo({id,name}:{id:string;name:string}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[id]);
  const logo=getBroadcastLogo(id);
  return logo&&!failed?<img className="rn-broadcaster-logo" src={logo} alt={name} title={name} width={58} height={24} onError={()=>setFailed(true)}/>:<span className="rn-broadcaster-name">{name}</span>;
}
