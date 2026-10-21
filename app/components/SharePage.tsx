'use client';
import {useState} from 'react';
import {trackProductEvent} from '@/lib/analytics';
export default function SharePage({path,title,lang,competition}:{path:string;title:string;lang:'es'|'en'|'fr'|'it';competition:string}){
 const [message,setMessage]=useState('');
 const words={es:['Compartir','Enlace copiado','No se pudo compartir'],en:['Share','Link copied','Could not share'],fr:['Partager','Lien copié','Partage impossible'],it:['Condividi','Link copiato','Condivisione non riuscita']}[lang];
 async function share(){
  const url=`https://rugby-now.com${path}`;
  try{if(navigator.share){await navigator.share({title,url});trackProductEvent('share',{competition_slug:competition,method:'native'});}
   else {await navigator.clipboard.writeText(url);setMessage(words[1]);trackProductEvent('share',{competition_slug:competition,method:'copy'});}
  }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage(words[2]);}
 }
 return <span className="rn-share-page"><button type="button" onClick={share}>{words[0]} ↗</button><span role="status">{message}</span></span>;
}
