import assert from "node:assert/strict";
import test from "node:test";
import {NEWS_SOURCES,parseNewsFeed,articlePreviewImage,safeNewsImage} from "../lib/news";
const now=new Date("2026-10-19T12:00:00Z");
const rss=(link:string,date="Sun, 18 Oct 2026 10:00:00 GMT")=>`<rss><channel><item><title><![CDATA[<b>Rugby</b> &amp; clubes]]></title><link>${link}</link><pubDate>${date}</pubDate><description>Never republish full article</description></item></channel></rss>`;
test("RSS keeps headline/date/source, not article content, and removes tracking",()=>{const items=parseNewsFeed(rss("https://uar.com.ar/noticia/?utm_source=feed"),NEWS_SOURCES[0],now);assert.equal(items.length,1);assert.equal(items[0].title,"Rugby & clubes");assert.equal(items[0].href,"https://uar.com.ar/noticia/");assert.equal("description" in items[0],false);});
test("RSS rejects offsite, script, future and invalid feeds",()=>{for(const link of ["javascript:alert(1)","https://uar.com.ar.evil.test/path","http://uar.com.ar/test"]){assert.deepEqual(parseNewsFeed(rss(link),NEWS_SOURCES[0],now),[]);}assert.deepEqual(parseNewsFeed(rss("https://uar.com.ar/test","Mon, 19 Oct 2027 10:00:00 GMT"),NEWS_SOURCES[0],now),[]);assert.throws(()=>parseNewsFeed("<html>not rss</html>",NEWS_SOURCES[0],now));assert.throws(()=>parseNewsFeed('<!DOCTYPE rss [<!ENTITY a "x">]><rss/>',NEWS_SOURCES[0],now));});

test("news preview images accept only publisher image hosts",()=>{assert.equal(articlePreviewImage('<meta property="og:image" content="https://uar.com.ar/photo.jpg">'),"https://uar.com.ar/photo.jpg");assert.equal(safeNewsImage("https://uar.com.ar.evil.test/a.jpg"),undefined);assert.equal(safeNewsImage("http://uar.com.ar/a.jpg"),undefined);});
