import assert from "node:assert/strict";
import test from "node:test";
import {RUGBY_QUIZ} from "../data/rugby-quiz";
import {answerQuiz,advanceQuiz,emptyQuizProgress,getDailyQuiz,getPracticeQuiz,quizStorageKey,readQuizProgress,scoreQuiz,utcQuizDay,validQuizDay} from "../lib/rugbyQuiz";

test("daily rugby quiz is shared by UTC day and varies without duplicate questions or choices",()=>{
  const day=utcQuizDay(new Date("2026-10-19T23:30:00-04:00"));assert.equal(day,"2026-10-20");
  const quiz=getDailyQuiz(day);assert.deepEqual(quiz,getDailyQuiz("2026-10-20"));assert.equal(quiz.length,5);assert.equal(new Set(quiz.map(i=>i.question.id)).size,5);
  for(const item of quiz)assert.deepEqual([...item.optionOrder].sort(),[0,1,2,3]);
  assert.notDeepEqual(quiz.map(i=>i.question.id),getDailyQuiz("2026-10-21").map(i=>i.question.id));
  assert.notEqual(quizStorageKey(day),quizStorageKey("2026-10-21"));assert.equal(validQuizDay("2026-02-30"),false);assert.equal(validQuizDay("2028-02-29"),true);assert.throws(()=>getDailyQuiz("yesterday"));
});
test("quiz locks each submitted answer, requires an answer before advancing and scores the submitted choices",()=>{
  const items=getDailyQuiz("2026-10-20");let p=emptyQuizProgress("2026-10-20",items);assert.equal(advanceQuiz(p,items),p);assert.equal(answerQuiz(p,items,-1),p);
  p=answerQuiz(p,items,items[0].question.correctIndex);const once=p;assert.equal(answerQuiz(p,items,1),once);assert.equal(scoreQuiz(p,items),1);
  p=advanceQuiz(p,items);assert.equal(p.cursor,1);
  while(!p.finished){p=answerQuiz(p,items,items[p.cursor].question.correctIndex);p=advanceQuiz(p,items);}
  assert.equal(p.answers.length,5);assert.equal(scoreQuiz(p,items),5);assert.equal(answerQuiz(p,items,1),p);assert.deepEqual(readQuizProgress(JSON.stringify(p),p.day,items),p);
  const wrong=answerQuiz(emptyQuizProgress(p.day,items),items,(items[0].question.correctIndex+1)%4);assert.equal(scoreQuiz(wrong,items),0);
});
test("daily progress rejects malformed, different-day, future or changed-question data",()=>{
  const day="2026-10-20",items=getDailyQuiz(day),empty=emptyQuizProgress(day,items);const good=answerQuiz(empty,items,0);assert.deepEqual(readQuizProgress(JSON.stringify(good),day,items),good);
  for(const value of ["broken",JSON.stringify({...good,day:"2026-10-21"}),JSON.stringify({...good,answers:[7]}),JSON.stringify({...good,answers:[null]}),JSON.stringify({...good,cursor:4}),JSON.stringify({...good,finished:true}),JSON.stringify({...good,version:99}),JSON.stringify({...good,questionIds:["replaced"]})])assert.deepEqual(readQuizProgress(value,day,items),empty);
});
test("every library entry has four complete languages and an official source, and practice is independent",()=>{
  assert.ok(RUGBY_QUIZ.length>=20);assert.equal(new Set(RUGBY_QUIZ.map(q=>q.id)).size,RUGBY_QUIZ.length);
  for(const q of RUGBY_QUIZ){assert.ok(["passport.world.rugby","www.world.rugby","www.rugbyworldcup.com"].includes(new URL(q.source.url).hostname));for(const lang of ["es","en","fr","it"] as const){const text=q.text[lang];assert.ok(text.prompt&&text.explanation);assert.equal(text.options.length,4);assert.equal(new Set(text.options).size,4);assert.ok(text.options[q.correctIndex]);}}
  assert.deepEqual(getPracticeQuiz("same-seed"),getPracticeQuiz("same-seed"));assert.notDeepEqual(getPracticeQuiz("same-seed").map(i=>i.question.id),getDailyQuiz("2026-10-20").map(i=>i.question.id));
});
