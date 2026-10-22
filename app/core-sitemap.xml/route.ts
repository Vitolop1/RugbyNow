import {NextResponse} from 'next/server';
import {getSiteUrl} from '@/lib/site';
import {SEARCH_CORE_PATHS} from '@/lib/searchIndex';
// Retain the submitted URL without inventing a new lastmod per request.
export function GET(){
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SEARCH_CORE_PATHS.map(path=>`<url><loc>${getSiteUrl()}${path}</loc></url>`).join('\n')}\n</urlset>`;
  return new NextResponse(body,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=3600'}});
}
