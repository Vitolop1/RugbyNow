import {XMLParser,XMLValidator} from "fast-xml-parser";
export type NewsSource={id:string;name:string;url:string;feed:string;language:string;hosts:string[]};
export type NewsItem={id:string;title:string;href:string;publishedAt:string;sourceId:string;sourceName:string;language:string;image?:string};
export type NewsFeedState={sourceId:string;ok:boolean;checkedAt:string;count:number};
export type NewsData={generatedAt:string;items:NewsItem[];feeds:NewsFeedState[]};
export const NEWS_SOURCES:NewsSource[]=[
 {id:"uar",name:"Unión Argentina de Rugby",url:"https://uar.com.ar/",feed:"https://uar.com.ar/feed/",language:"es",hosts:["uar.com.ar"]},
 {id:"espn",name:"ESPN Scrum",url:"https://www.espn.com.ar/rugby/",feed:"https://www.espn.com/espn/rss/rugby/news",language:"en",hosts:["espn.com","espn.com.ar","espn.co.uk","espn.in","espn.com.au"]},
];
function plain(value:unknown){return typeof value==="string"?value.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'" ).replace(/\s+/g," ").trim():"";}
export function safeNewsImage(value:unknown):string|undefined{
 if(typeof value!=="string")return;
 try{const url=new URL(value.replace(/&amp;/g,"&"));if(url.protocol!=="https:"||url.username||url.password)return;
 if(!["uar.com.ar","espncdn.com"].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))return;
 return url.toString();}catch{return;}
}
export function articlePreviewImage(html:string){
 for(const tag of html.slice(0,300_000).match(/<meta\b[^>]*>/gi)||[]){
  const attrs:Record<string,string>={};for(const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))attrs[match[1].toLowerCase()]=match[2];
  if(attrs.property==="og:image"||attrs.name==="og:image")return safeNewsImage(attrs.content);
 }
}
export async function enrichNewsImages(items:NewsItem[]){
 const result=[...items];let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<result.length){const index=cursor++;const item=result[index];if(item.image)continue;
  try{const response=await fetch(item.href,{signal:AbortSignal.timeout(6000),redirect:"error"});if(!response.ok)continue;const image=articlePreviewImage(await response.text());if(image)result[index]={...item,image};}catch{/* Keep a neutral preview if the source fails. */}
 }}));return result;
}
export function parseNewsFeed(xml:string,source:NewsSource,now=new Date()):NewsItem[]{
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error("Invalid RSS feed");
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:true,trimValues:true}).parse(xml);
 if(!parsed?.rss?.channel)throw Error("RSS channel missing");
 const raw=parsed.rss.channel.item; const rows=Array.isArray(raw)?raw:raw?[raw]:[];
 const seen=new Set<string>();const items:NewsItem[]=[];
 for(const row of rows){const title=plain(row.title);const date=new Date(row.pubDate);let url:URL;
  try{url=new URL(plain(row.link));}catch{continue;}
  if(url.protocol!=="https:"||url.username||url.password||!source.hosts.some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`))||!title||title.length>300||!Number.isFinite(date.getTime())||date.getTime()>now.getTime()+300_000)continue;
  // Only source-provided preview images; no article body is republished.
  if(now.getTime()-date.getTime()>30*86400000)continue;
  url.hash="";for(const key of [...url.searchParams.keys()])if(key.startsWith("utm_"))url.searchParams.delete(key);
  const href=url.toString();if(seen.has(href))continue;seen.add(href);
  const media=row["media:content"]||row["media:thumbnail"]||row.enclosure;
  const image=safeNewsImage((Array.isArray(media)?media[0]:media)?.["@_url"]);
  items.push({id:`${source.id}:${href}`,title,href,publishedAt:date.toISOString(),sourceId:source.id,sourceName:source.name,language:source.language,...(image?{image}:{})});
 }
 return items.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,12);
}
export async function fetchNewsSource(source:NewsSource):Promise<NewsItem[]>{
 const response=await fetch(source.feed,{signal:AbortSignal.timeout(6000),headers:{Accept:"application/rss+xml, application/xml, text/xml"},redirect:"error"});
 if(!response.ok)throw Error(`RSS ${source.id}: ${response.status}`);
 if(Number(response.headers.get("content-length"))>2_000_000)throw Error("RSS too large");
 return parseNewsFeed(await response.text(),source);
}
