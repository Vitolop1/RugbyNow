import {isAgendaDate} from './dailyAgenda';
import {getISODateInTimeZone} from './timeZoneDate';
export function selectedAgendaDate(date:string,today:string,followToday:boolean){return followToday?today:date;}
export function agendaDateUrl(href:string,date:string){
 if(!isAgendaDate(date))throw new Error('Invalid agenda date');
 const url=new URL(href);url.searchParams.set('date',date);url.searchParams.delete('event');url.hash='';return url.toString();
}
export function agendaToday(now:number,timeZone:string){return getISODateInTimeZone(new Date(now),timeZone);}
