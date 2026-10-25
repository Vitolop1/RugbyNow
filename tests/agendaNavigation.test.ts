import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaDateUrl,agendaToday,selectedAgendaDate} from '../lib/agendaNavigation';
import {shiftAgendaDate} from '../lib/dailyAgenda';
test('day arrows cross month, year and leap February without elapsed-hour arithmetic',()=>{
 for(const [date,delta,expected] of [
  ['2026-12-31',1,'2027-01-01'],['2027-01-01',-1,'2026-12-31'],
  ['2024-02-28',1,'2024-02-29'],['2024-02-29',1,'2024-03-01'],
  ['2026-02-28',1,'2026-03-01'],['2026-03-01',-1,'2026-02-28'],
  ['2026-03-08',1,'2026-03-09'],['2026-11-01',-1,'2026-10-31'],
 ] as const)assert.equal(shiftAgendaDate(date,delta),expected);
});
test('today uses the selected timezone, including midnight and daylight saving changes',()=>{
 const now=Date.parse('2026-10-21T01:00:00Z');
 assert.equal(agendaToday(now,'America/New_York'),'2026-10-20');
 assert.equal(agendaToday(now,'Asia/Tokyo'),'2026-10-21');
 assert.equal(agendaToday(Date.parse('2026-03-08T06:59:00Z'),'America/New_York'),'2026-03-08');
 assert.equal(agendaToday(Date.parse('2026-03-08T07:01:00Z'),'America/New_York'),'2026-03-08');
 assert.equal(agendaToday(Date.parse('2026-11-01T05:59:00Z'),'America/New_York'),'2026-11-01');
 assert.equal(agendaToday(Date.parse('2026-11-01T06:01:00Z'),'America/New_York'),'2026-11-01');
});
test('follow today tracks local midnight while an explicit civil date remains selected',()=>{
 assert.equal(selectedAgendaDate('2026-10-20','2026-10-21',true),'2026-10-21');
 assert.equal(selectedAgendaDate('2026-12-31','2026-10-21',false),'2026-12-31');
});
test('date URL updates preserve other parameters and reject invalid manual dates',()=>{
 const next=new URL(agendaDateUrl('https://rugby-now.com/?date=2026-10-20&event=match-1&utm_source=club&league=urba#match-1','2026-12-31'));
 assert.equal(next.searchParams.get('date'),'2026-12-31');assert.equal(next.searchParams.get('utm_source'),'club');assert.equal(next.searchParams.get('league'),'urba');
 assert.equal(next.searchParams.has('event'),false);assert.equal(next.hash,'');
 assert.throws(()=>agendaDateUrl('https://rugby-now.com/','2026-02-29'));
 assert.throws(()=>agendaDateUrl('https://rugby-now.com/',''));
});
