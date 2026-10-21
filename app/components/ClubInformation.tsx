"use client";
import {usePrefs} from '@/lib/usePrefs';
import type {ClubInformation as Institution} from '@/lib/clubInformation';
export type ClubStaff={sourceName:string;sourceUrl:string;checkedAt:string;members:{name:string;role:string}[]};
export default function ClubInformation({institution,staff}:{institution:Institution|null;staff:ClubStaff|null}){
 const {lang}=usePrefs();
 if(!institution&&!staff)return null;
 const c={es:['Club y cuerpo técnico','Estadio','Capacidad','Dirección del estadio','Cuerpo técnico','Consultado','Entrenador','Director deportivo'],en:['Club and coaches','Stadium','Capacity','Stadium address','Coaching staff','Checked','Coach','Director of rugby'],fr:['Club et encadrement','Stade','Capacité','Adresse du stade','Encadrement','Consulté','Entraîneur','Directeur sportif'],it:['Club e staff tecnico','Stadio','Capienza','Indirizzo dello stadio','Staff tecnico','Verificato','Allenatore','Direttore sportivo']}[lang];
 const date=(value:string)=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
 return <details className="rn-panel"><summary><strong>{c[0]}</strong><span aria-hidden="true"> ⌄</span></summary>{institution&&<><dl><dt>{c[1]}</dt><dd>{institution.stadium}</dd>{institution.capacity&&<><dt>{c[2]}</dt><dd>{institution.capacity}</dd></>}{institution.stadiumAddress&&<><dt>{c[3]}</dt><dd>{institution.stadiumAddress}</dd></>}</dl><p className="rn-table-source"><a href={institution.sourceUrl} target="_blank" rel="noopener noreferrer">LNR ↗</a> · {c[5]} {date(institution.checkedAt)}</p></>}{staff&&<><h3>{c[4]}</h3>{staff.members.map(member=><div className="rn-directory-row" key={member.name}><strong>{member.name}</strong><span>{member.role==='Entraîneur'?c[6]:member.role==='Directeur Sportif'?c[7]:member.role}</span></div>)}<p className="rn-table-source"><a href={staff.sourceUrl} target="_blank" rel="noopener noreferrer">{staff.sourceName} ↗</a> · {c[5]} {date(staff.checkedAt)}</p></>}</details>;
}
