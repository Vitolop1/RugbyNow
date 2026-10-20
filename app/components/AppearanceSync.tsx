"use client";
import {useEffect} from "react";
import {usePersonalization} from "@/lib/usePersonalization";

export default function AppearanceSync(){
  const {prefs,ready}=usePersonalization();
  useEffect(()=>{
    if(!ready)return;
    const root=document.documentElement;
    root.dataset.rnDensity=prefs.density;
    root.dataset.rnTextSize=prefs.textSize;
    root.style.setProperty("--rn-font-scale",prefs.textSize==="large"?"1.15":"1");
  },[prefs.density,prefs.textSize,ready]);
  return null;
}
