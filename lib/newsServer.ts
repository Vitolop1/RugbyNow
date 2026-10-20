import {unstable_cache} from "next/cache";
import snapshot from "@/data/news-snapshot.json";
import {NEWS_SOURCES,fetchNewsSource,type NewsData,type NewsItem} from "./news";
export const loadNews=unstable_cache(async():Promise<NewsData>=>{
 const checkedAt=new Date().toISOString();const results=await Promise.allSettled(NEWS_SOURCES.map(fetchNewsSource));
 const items:NewsItem[]=[];const feeds=results.map((result,index)=>{const source=NEWS_SOURCES[index];const fresh=result.status==="fulfilled"&&result.value.length>0;const rows=fresh?result.value:snapshot.items.filter(i=>i.sourceId===source.id) as NewsItem[];items.push(...rows);return {sourceId:source.id,ok:fresh,checkedAt,count:fresh?result.value.length:0};});
 return {generatedAt:checkedAt,items:items.filter(i=>Date.now()-Date.parse(i.publishedAt)<30*86400000).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),feeds};
},["rugby-news-v1"],{revalidate:900});
