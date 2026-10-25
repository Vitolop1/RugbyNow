import type {MetadataRoute} from 'next';
import snapshot from '@/data/supabase-snapshot.json';
import {getSiteUrl} from '@/lib/site';
import {searchPaths} from '@/lib/searchIndex';

export default function sitemap():MetadataRoute.Sitemap {
  return searchPaths(snapshot).map(path=>({url:`${getSiteUrl()}${path}`}));
}
