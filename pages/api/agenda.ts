import type { NextApiRequest, NextApiResponse } from "next";
import { isAgendaDate } from "@/lib/dailyAgenda";
import { loadDailyAgenda } from "@/lib/dailyAgendaServer";

export default async function handler(req: NextApiRequest,res: NextApiResponse) {
  if(req.method !== "GET") {res.setHeader("Allow","GET"); return res.status(405).json({error:"Method not allowed"});}
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  if(!isAgendaDate(date)) return res.status(400).json({error:"Invalid date"});
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json(await loadDailyAgenda(date));
}
