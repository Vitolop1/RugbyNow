import assert from 'node:assert/strict';
import test from 'node:test';
import {buildDailyEntries,matchesForAgendaDate,shiftAgendaDate,type AgendaMatchRow} from '../lib/dailyAgenda';
import {agendaDateUrl,agendaToday,selectedAgendaDate} from '../lib/agendaNavigation';

test('the full agenda retains every match across competitions rather than a preview',()=>{
 const rows:AgendaMatchRow[]=Array.from({length:36},(_,i)=>({id:i+1,match_date:'2026-10-17',kickoff_time:'18:00:00',
  status:i===0?'LIVE':i===1?'HT':i===2?'FT':'NS',minute:i===0?12:null,home_score:i<3?0:null,away_score:i<3?0:null,
  home_team:{name:`Home ${i}`,slug:`home-${i}`},away_team:{name:`Away ${i}`,slug:`away-${i}`},
  season:{competition:{name:`Competition ${i%3}`,slug:`competition-${i%3}`}}}));
 const entries=buildDailyEntries(rows,[]),selected=matchesForAgendaDate(entries,'2026-10-17','America/Argentina/Buenos_Aires');
 assert.equal(selected.length,36);assert.equal(new Set(selected.map(m=>m.id)).size,36);
 assert.equal(new Set(selected.map(m=>m.competitionSlug)).size,3);
 assert.equal(selected.find(m=>m.matchId===1)?.status,'LIVE');assert.equal(selected.find(m=>m.matchId===1)?.minute,12);
 assert.equal(selected.find(m=>m.matchId===2)?.status,'HT');assert.equal(selected.find(m=>m.matchId===3)?.homeScore,0);
 assert.equal(matchesForAgendaDate(entries,'2026-10-18','UTC').length,0);
});

test('today follows the chosen zone, while an explicit calendar date stays selected',()=>{
 const now=Date.parse('2026-12-31T23:30:00Z');
 const argentina=agendaToday(now,'America/Argentina/Buenos_Aires'),auckland=agendaToday(now,'Pacific/Auckland');
 assert.equal(argentina,'2026-12-31');assert.equal(auckland,'2027-01-01');
 assert.equal(selectedAgendaDate('2026-10-17',auckland,true),'2027-01-01');
 assert.equal(selectedAgendaDate('2026-10-17',auckland,false),'2026-10-17');
 for(const zone of ['America/New_York','Europe/Paris'])assert.equal(agendaToday(Date.parse('2026-03-08T12:00:00Z'),zone),'2026-03-08');
 assert.equal(shiftAgendaDate('2028-03-01',-1),'2028-02-29');
 assert.equal(shiftAgendaDate('2026-12-31',1),'2027-01-01');
 const url=new URL(agendaDateUrl('https://rugby-now.com/?date=2026-10-17&event=old&campaign=test#old','2026-10-18'));
 assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('date'),'2026-10-18');assert.equal(url.searchParams.get('campaign'),'test');
 assert.equal(url.searchParams.has('event'),false);assert.equal(url.hash,'');
 assert.equal(new URL(agendaDateUrl('https://rugby-now.com/agenda','2026-10-18')).pathname,'/agenda');
 assert.throws(()=>agendaDateUrl('https://rugby-now.com/','2026-02-30'));
});

test('midnight UTC belongs to the actual local day without fabricating an unknown kickoff',()=>{
 const entry=buildDailyEntries([{id:1,match_date:'2026-10-18',kickoff_time:'00:30:00',status:'NS',minute:null,home_score:null,away_score:null,
  home_team:{name:'Home',slug:null},away_team:{name:'Away',slug:null},season:{competition:{name:'League',slug:'league'}}}],[])[0];
 assert.equal(matchesForAgendaDate([entry],'2026-10-17','America/Argentina/Buenos_Aires').length,1);
 assert.equal(matchesForAgendaDate([entry],'2026-10-18','Europe/Paris').length,1);
 const undated={...entry,startsAt:null};
 assert.equal(matchesForAgendaDate([undated],'2026-10-18','America/Argentina/Buenos_Aires').length,1);
});
