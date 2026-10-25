export function canonicalRequestUrl(input:string):string|null {
  const url=new URL(input);
  if(!['rugby-now.com','www.rugby-now.com'].includes(url.hostname))return null;
  if(url.protocol==='https:'&&url.hostname==='rugby-now.com')return null;
  url.protocol='https:';url.hostname='rugby-now.com';url.port='';
  return url.toString();
}
