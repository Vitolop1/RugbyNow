// .event is the empty loading container, not evidence that a match is ready.
export const FLASH_MATCH_READY_SELECTOR='[id^="g_"], .event__match, .event__row, [data-event-id]';

/** Read explicit source state/clock. Keep standalone: serialized into page.evaluate. */
export function readFlashscoreRowStatus(row:Pick<Element,"querySelector">){
  const values:string[]=[];
  for(const selector of ['.event__stageTime','[data-testid="wcl-stageTime"]','.event__time','.event__stage','.event__status']){
    const element=row.querySelector(selector) as HTMLElement|null;
    const value=String(element?.innerText??element?.textContent??"").trim();
    if(value&&!values.includes(value))values.push(value);
  }
  return values.join(" ");
}
