export type ClubInformation = {
  teamSlug: string;
  sourceUrl: string;
  checkedAt: string;
  stadium: string;
  capacity: string | null;
  stadiumAddress: string | null;
};

export function parseLnrClubInformation(html: string, teamSlug: string, sourceUrl: string): ClubInformation {
  const url = new URL(sourceUrl);
  if (!['prod2.lnr.fr', 'top14.lnr.fr'].includes(url.hostname) || !url.pathname.endsWith('/informations')) throw Error('Unexpected club information source');
  const block = html.split('class="club-stadium-infos club-block"')[1]?.split('page-builder-component')[0];
  if (!block) throw Error('Official stadium information missing');
  const clean = (text: string) => text.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const fields = [...block.matchAll(/class="club-info-field__label">([\s\S]*?)<\/p>[\s\S]*?class="club-info-field__content[^\"]*"[^>]*>([\s\S]*?)<\/(?:p|a)>/g)].map(m => [clean(m[1]), clean(m[2])]);
  const value = (label: string) => fields.find(([name]) => name.startsWith(label))?.[1] || null;
  const stadium = value('Nom');
  if (!stadium) throw Error('Official stadium name missing; previous information preserved');
  return {teamSlug, sourceUrl, checkedAt: new Date().toISOString(), stadium, capacity: value('Capacité'), stadiumAddress: value('Adresse du stade')};
}
