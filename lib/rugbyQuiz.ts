import {RUGBY_QUIZ} from "../data/rugby-quiz";

export type QuizLang="es"|"en"|"fr"|"it";
export type QuizText={prompt:string;options:readonly [string,string,string,string];explanation:string};
export type QuizQuestion={id:string;category:"laws"|"history";source:{url:string;label:string};correctIndex:number;text:Record<QuizLang,QuizText>};
export type QuizItem={question:QuizQuestion;optionOrder:number[]};
export type QuizProgress={version:number;day:string;questionIds:string[];answers:number[];cursor:number;finished:boolean};
export const QUIZ_VERSION=1;
export const DAILY_QUESTION_COUNT=5;

export function utcQuizDay(now:Date=new Date()):string{return now.toISOString().slice(0,10);}
export function validQuizDay(day:string):boolean{return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(`${day}T00:00:00Z`))&&new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day;}
function seedHash(value:string):number{let seed=2166136261;for(let i=0;i<value.length;i++)seed=Math.imul(seed^value.charCodeAt(i),16777619);return seed>>>0;}
function shuffled<T>(values:readonly T[],seed:string):T[]{const out=[...values];let n=seedHash(seed);const random=()=>{n+=0x6D2B79F5;let x=n;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function selectQuiz(seed:string):QuizItem[]{return shuffled(RUGBY_QUIZ,seed).slice(0,DAILY_QUESTION_COUNT).map(question=>({question,optionOrder:shuffled([0,1,2,3],`${seed}:${question.id}`)}));}
export function getDailyQuiz(day:string):QuizItem[]{if(!validQuizDay(day))throw new Error("Invalid UTC quiz date");return selectQuiz(`daily:v${QUIZ_VERSION}:${day}`);}
export function getPracticeQuiz(seed:string):QuizItem[]{return selectQuiz(`practice:v${QUIZ_VERSION}:${seed}`);}
export function quizStorageKey(day:string):string{return `rn:quiz:v${QUIZ_VERSION}:${day}`;}
export function emptyQuizProgress(day:string,items:readonly QuizItem[]):QuizProgress{return{version:QUIZ_VERSION,day,questionIds:items.map(i=>i.question.id),answers:[],cursor:0,finished:false};}
export function readQuizProgress(raw:string|null,day:string,items:readonly QuizItem[]):QuizProgress{
  const fallback=()=>emptyQuizProgress(day,items);if(!raw)return fallback();
  try{const p:unknown=JSON.parse(raw);if(!p||typeof p!=="object")return fallback();const v=p as Partial<QuizProgress>;
    if(v.version!==QUIZ_VERSION||v.day!==day||!Array.isArray(v.questionIds)||v.questionIds.length!==items.length||v.questionIds.some((id,i)=>id!==items[i].question.id))return fallback();
    if(!Array.isArray(v.answers)||v.answers.length>items.length||v.answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=items[i].question.text.en.options.length))return fallback();
    const cursor=v.cursor;
    if(typeof cursor!=="number"||!Number.isInteger(cursor)||cursor<0||cursor>=items.length||cursor>v.answers.length||cursor<v.answers.length-1||typeof v.finished!=="boolean"||(v.finished&&v.answers.length!==items.length))return fallback();
    return{version:QUIZ_VERSION,day,questionIds:[...v.questionIds],answers:[...v.answers],cursor,finished:v.finished};
  }catch{return fallback();}
}
export function answerQuiz(progress:QuizProgress,items:readonly QuizItem[],choice:number):QuizProgress{
  const item=items[progress.cursor];if(progress.finished||!item||progress.answers.length!==progress.cursor||!Number.isInteger(choice)||choice<0||choice>=item.question.text.en.options.length)return progress;
  return{...progress,answers:[...progress.answers,choice]};
}
export function advanceQuiz(progress:QuizProgress,items:readonly QuizItem[]):QuizProgress{if(progress.finished||progress.answers.length<=progress.cursor)return progress;return progress.cursor===items.length-1?{...progress,finished:true}:{...progress,cursor:progress.cursor+1};}
export function scoreQuiz(progress:QuizProgress,items:readonly QuizItem[]):number{return progress.answers.reduce((score,answer,i)=>score+(answer===items[i]?.question.correctIndex?1:0),0);}
