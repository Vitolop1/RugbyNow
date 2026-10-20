import type { Metadata } from "next";
import { buildTeamMetadata } from "@/lib/seo";
import TeamClient,{type TeamPayload} from "./TeamClient";
import {getTeamPageData} from "@/lib/teamPageData";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildTeamMetadata(slug);
}

export default async function TeamPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{discipline?:string}>}){
 const {slug}=await params;const query=await searchParams;const data=getTeamPageData(slug,query.discipline);
 if(!data)notFound();
 return <TeamClient slug={slug} initialData={data as unknown as TeamPayload}/>;
}
