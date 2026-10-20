"use client";
import {useEffect,useRef,useState} from "react";
import {usePrefs,type Lang} from "@/lib/usePrefs";

function Flag({lang}:{lang:Lang}){return <svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true" className="rn-language-flag">
  {lang==="es"?<><path fill="#aa152a" d="M0 0h30v20H0z"/><path fill="#f1c447" d="M0 5h30v10H0z"/><path fill="#aa152a" d="M7 8h3v5H7z"/></>:lang==="en"?<><path fill="#153b76" d="M0 0h30v20H0z"/><path d="m0 0 30 20M30 0 0 20" stroke="white" strokeWidth="5"/><path d="m0 0 30 20M30 0 0 20" stroke="#c83b4a" strokeWidth="2"/><path d="M15 0v20M0 10h30" stroke="white" strokeWidth="8"/><path d="M15 0v20M0 10h30" stroke="#c83b4a" strokeWidth="4"/></>:<><path fill={lang==="fr"?"#254b95":"#218c57"} d="M0 0h10v20H0z"/><path fill="white" d="M10 0h10v20H10z"/><path fill="#d7444c" d="M20 0h10v20H20z"/></>}
  </svg>;}
const languages:{code:Lang;name:string}[]=[{code:"es",name:"Español"},{code:"en",name:"English"},{code:"fr",name:"Français"},{code:"it",name:"Italiano"}];
export default function LanguagePicker(){
  const {lang,setLangEverywhere}=usePrefs();const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
  const label={es:"Cambiar idioma",en:"Change language",fr:"Changer de langue",it:"Cambia lingua"}[lang];
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);root.current?.querySelector("button")?.focus();}};document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};},[open]);
  return <div ref={root} className="rn-language-picker"><button type="button" aria-label={label} aria-expanded={open} aria-controls="rn-language-options" onClick={()=>setOpen(v=>!v)}><Flag lang={lang}/><span>{lang.toUpperCase()}</span><small aria-hidden="true">⌄</small></button>
    {open&&<div id="rn-language-options" className="rn-language-options" aria-label={label}>{languages.map(language=><button type="button" key={language.code} aria-pressed={lang===language.code} lang={language.code} onClick={()=>{setLangEverywhere(language.code);setOpen(false);root.current?.querySelector("button")?.focus();}}><Flag lang={language.code}/><span>{language.name}</span>{lang===language.code&&<b aria-hidden="true">✓</b>}</button>)}</div>}
  </div>;
}
