import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRequestUrl} from '../lib/canonicalRequest';
import {searchPaths} from '../lib/searchIndex';
import sitemap from '../app/sitemap';
import {leagueInsight} from '../lib/leagueInsight';
import {productEventProperties,trackProductEvent} from '../lib/analytics';

test('canonical redirect preserves date and attribution without affecting previews',()=>{
 assert.equal(canonicalRequestUrl('http://rugby-now.com/?date=2026-10-22&utm_source=club'),'https://rugby-now.com/?date=2026-10-22&utm_source=club');
 assert.equal(canonicalRequestUrl('https://www.rugby-now.com/leagues/fr-pro-d2'),'https://rugby-now.com/leagues/fr-pro-d2');
 assert.equal(canonicalRequestUrl('https://rugby-now.com/'),null);
 assert.equal(canonicalRequestUrl('http://localhost:3000/'),null);
 assert.equal(canonicalRequestUrl('https://preview.workers.dev/'),null);
});
test('discovery excludes empty entities and does not promote player directory cards',()=>{
 const paths=searchPaths({competitions:[{id:1,slug:'real'},{id:2,slug:'empty'}],seasons:[{id:1,competition_id:1}],teams:[{id:1,slug:'used'},{id:2,slug:'empty'}],matches:[{season_id:1,home_team_id:1,away_team_id:null}]});
 assert.ok(paths.includes('/leagues/real'));assert.ok(!paths.includes('/leagues/empty'));assert.ok(!paths.includes('/teams/empty'));
 assert.equal(new Set(paths).size,paths.length);
 const entries=sitemap();assert.ok(!entries.some(e=>e.url.includes('/players/')));assert.ok(entries.every(e=>!e.lastModified));
});
test('editorial summary counts real finals only, including zero, without estimating pending scores',()=>{
 assert.deepEqual(leagueInsight([{status:'FT',home_score:0,away_score:0},{status:'FT',home_score:20,away_score:10},{status:'NS',home_score:0,away_score:0},{status:'FT',home_score:null,away_score:null}]),{played:2,points:30,average:15,draws:1});
 assert.equal(leagueInsight([{status:'LIVE',home_score:10,away_score:0}]),null);
});
test('product analytics normalize competition and exclude personal or arbitrary values',()=>{
 assert.deepEqual(productEventProperties({competition:'fr-pro-d2',email:'person@example.com',match_id:42,provider_id:'https://provider.test',action:'open_email',placement:'advertise_page'}),{competition_slug:'fr-pro-d2',match_id:42,action:'open_email',placement:'advertise_page'});
});
test('product events respect consent before invoking GA',()=>{
 const calls:unknown[][]=[];
 const scope=globalThis as unknown as {window?:unknown;document?:unknown};
 const beforeWindow=scope.window,beforeDocument=scope.document;
 try{
  scope.window={rugbyAnalyticsAllowed:false,gtag:(...args:unknown[])=>calls.push(args)};scope.document={documentElement:{lang:'es'}};
  trackProductEvent('sponsor_inquiry',{action:'open_email'});assert.equal(calls.length,0);
  (scope.window as {rugbyAnalyticsAllowed:boolean}).rugbyAnalyticsAllowed=true;
  trackProductEvent('sponsor_inquiry',{action:'open_email'});assert.equal(calls.length,1);
 }finally{if(beforeWindow===undefined)delete scope.window;else scope.window=beforeWindow;if(beforeDocument===undefined)delete scope.document;else scope.document=beforeDocument;}
});
