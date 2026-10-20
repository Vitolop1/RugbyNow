import fs from "node:fs";
import {NEWS_SOURCES,fetchNewsSource,enrichNewsImages,type NewsData} from "../lib/news";
async function main(){
 const previous=JSON.parse(fs.readFileSync("data/news-snapshot.json","utf8")) as NewsData;
 const now=new Date().toISOString();const results=await Promise.allSettled(NEWS_SOURCES.map(fetchNewsSource));
 let failures=0;
 const feeds=results.map((result,index)=>{const ok=result.status==="fulfilled"&&result.value.length>0;if(!ok)failures++;console.log(`${NEWS_SOURCES[index].id}: ${ok?"OK":"failed; preserving previous headlines"}`);return {sourceId:NEWS_SOURCES[index].id,ok,checkedAt:now,count:ok?result.value.length:0};});
 const items=results.flatMap((result,index)=>result.status==="fulfilled"&&result.value.length?result.value:previous.items.filter(i=>i.sourceId===NEWS_SOURCES[index].id));
 if(failures===NEWS_SOURCES.length)throw Error("All news feeds failed; snapshot preserved");
 const illustrated=await enrichNewsImages(items.map(item=>({...item,image:item.image||previous.items.find(p=>p.href===item.href)?.image})));
 fs.writeFileSync("data/news-snapshot.json",JSON.stringify({generatedAt:now,items:illustrated,feeds},null,2)+"\n");
 console.log(`${illustrated.filter(i=>i.image).length}/${illustrated.length} source preview images`);
 if(failures)process.exitCode=1;
}
main().catch(e=>{console.error(e instanceof Error?e.message:"News update failed");process.exitCode=1;});
