import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import FeaturedMatchesPanel from '../app/components/FeaturedMatchesPanel';
import {selectFeaturedMatches} from '../lib/featuredMatches';
import type {DailyEntry} from '../lib/dailyAgenda';
const now=Date.parse('2026-10-23T12:00:00Z');
const prefs={leagues:[] as string[],clubs:[] as string[],hidden:[] as string[]};
const game=(id:string,slug:string,start='2026-10-23T19:00:00Z',extra:Partial<DailyEntry>={}):DailyEntry=>({id,competitionSlug:slug,competition:slug,home:id,away:'Opponent',kind:'match',date:start.slice(0,10),startsAt:start,status:'NS',minute:null,homeScore:null,awayScore:null,region:'international',providers:[],transmissionPending:true,...extra});
const choose=(entries:DailyEntry[],preferences=prefs)=>selectFeaturedMatches(entries,'2026-10-23','UTC',now,preferences);
test('featured balances Argentina and international coverage without a fixed French bonus',()=>{
 const rows=[game('fr1','fr-pro-d2'),game('fr2','fr-pro-d2'),game('urba','ar-urba-top14'),game('pumas','int-world-cup',undefined,{homeSlug:'argentina'})];
 assert.deepEqual(choose(rows).map(e=>e.id),['pumas','urba']);
 assert.equal(choose([game('seven','svns-hong-kong',undefined,{homeSlug:'argentina-7s'}),game('fr','fr-pro-d2')])[0].id,'seven');
 assert.equal(choose(rows,{...prefs,clubs:['provence']}).length,2);
 assert.equal(choose([game('pumas','int-world-cup',undefined,{homeSlug:'argentina'}),game('club','fr-pro-d2',undefined,{homeSlug:'provence'})],{...prefs,clubs:['provence']})[0].id,'club');
});
test('confirmed source-live wins while elapsed scheduled matches are excluded',()=>{
 const rows=[game('elapsed','ar-urba-top14','2026-10-23T10:00:00Z'),game('pumas','int-world-cup',undefined,{homeSlug:'argentina'}),game('live','fr-top14','2026-10-23T11:30:00Z',{status:'LIVE',homeScore:0,awayScore:0})];
 assert.deepEqual(choose(rows).map(e=>e.id),['live','pumas']);
});
test('followed leagues count, hidden leagues stay hidden, and diversity is a soft preference',()=>{
 const rows=[game('fr1','fr-pro-d2'),game('fr2','fr-pro-d2'),game('top','fr-top14')];
 assert.deepEqual(choose(rows).map(e=>e.id),['fr1','top']);
 assert.deepEqual(choose([game('urc1','int-united-rugby-championship'),game('urc2','int-united-rugby-championship'),game('pro','fr-pro-d2')]).map(e=>e.id),['urc1','pro']);
 assert.deepEqual(choose(rows,{...prefs,leagues:['fr-pro-d2']}).map(e=>e.id),['fr1','fr2']);
 assert.deepEqual(choose(rows,{...prefs,hidden:['fr-pro-d2']}).map(e=>e.id),['top']);
});
test('today stays before the weekend and a lone today match can be joined by a nearby weekend fixture',()=>{
 const today=game('today','fr-top14');const saturday=game('sat','ar-urba-top14','2026-10-24T19:00:00Z');const distant=game('distant','int-world-cup','2026-10-30T19:00:00Z',{homeSlug:'argentina'});
 assert.deepEqual(choose([distant,saturday,today]).map(e=>e.id),['today','sat']);
 assert.deepEqual(choose([game('today2','fr-pro-d2'),today,distant,saturday]).map(e=>e.id),['today','today2']);
});
test('dates use selected timezone, including Sunday night across UTC midnight',()=>{
 const sunday=game('sun','fr-pro-d2','2026-10-26T01:00:00Z');const monday=game('mon','int-world-cup','2026-10-26T13:00:00Z',{homeSlug:'argentina'});
 assert.equal(selectFeaturedMatches([monday,sunday],'2026-10-25','America/Argentina/Buenos_Aires',Date.parse('2026-10-25T12:00:00Z'),prefs)[0].id,'sun');
 assert.equal(selectFeaturedMatches([sunday],'2026-10-26','Asia/Tokyo',Date.parse('2026-10-25T12:00:00Z'),prefs).length,1);
});
test('empty/small selections, duplicate identities and newer finals do not fabricate extra fixtures',()=>{
 const row=game('one','fr-pro-d2',undefined,{matchId:1});
 assert.deepEqual(choose([]),[]);assert.equal(choose([row]).length,1);assert.equal(choose([row,{...row,id:'alias'}]).length,1);
 assert.equal(choose([row,{...row,id:'other',status:'FT',updatedAt:'2026-10-23T13:00:00Z'}]).length,0);
 assert.equal(choose([game('far','fr-pro-d2','2026-11-10T19:00:00Z')]).length,0);
});
test('native featured disclosure starts closed in every language and stays mounted for an empty pool',()=>{
 for(const lang of ['es','en','fr','it'] as const){const html=renderToStaticMarkup(createElement(FeaturedMatchesPanel,{count:2,lang,children:'rows'}));assert.match(html,/<summary>/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:=|\s|>)/);assert.match(html,/aria-hidden="true"/);}
 assert.match(renderToStaticMarkup(createElement(FeaturedMatchesPanel,{count:0,lang:'es',children:null})),/<details[^>]*hidden/);
});
