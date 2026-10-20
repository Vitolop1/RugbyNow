import {withOfficialStandings} from "@/lib/standingsOverlay";
import type { Metadata } from "next";
import { buildLeagueMetadata } from "@/lib/seo";
import LeagueClient from "./CompactLeagueClient";
import type {LeagueViewPayload} from "./CompactLeagueClient";
import {getSnapshotLeagueData} from "@/lib/supabaseSnapshot";
import {isAgendaDate} from "@/lib/dailyAgenda";
export const dynamic="force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildLeagueMetadata(slug);
}

export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{date?:string;round?:string;season?:string}>}) {
  const {slug}=await params;const query=await searchParams;
  const date=isAgendaDate(query.date)?query.date:new Date().toISOString().slice(0,10);
  const round=query.round&&/^\d+$/.test(query.round)?Number(query.round):null;
  const snapshot=getSnapshotLeagueData(slug,date,round,true,query.season);
  const initialData=snapshot?withOfficialStandings({...snapshot,source:"snapshot"}) as unknown as LeagueViewPayload:null;
  return <LeagueClient key={slug} initialData={initialData}/>;
}
