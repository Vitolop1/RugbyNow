'use client';
import React,{type ReactNode} from 'react';
const words={es:'Destacados',en:'Ones to watch',fr:'À suivre',it:'Da seguire'};
/** Native disclosure keeps its open state through refreshes, including empty pools. */
export default function FeaturedMatchesPanel({count,lang,children}:{count:number;lang:keyof typeof words;children:ReactNode}){
 return <details className="rn-featured-panel" hidden={count===0}>
  <summary><span aria-hidden="true">★</span><h2>{words[lang]}</h2><small>{count}</small><span className="rn-featured-chevron" aria-hidden="true">⌄</span></summary>
  {children}
 </details>;
}
