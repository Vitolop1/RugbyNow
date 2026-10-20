import type {NextApiRequest,NextApiResponse} from "next";
import {getTeamPageData} from "@/lib/teamPageData";
export default function handler(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
 const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]||"":v||"";
 try{const data=getTeamPageData(first(req.query.slug),first(req.query.discipline));return data?res.status(200).json(data):res.status(404).json({error:"Team unavailable"});}
 catch{return res.status(500).json({error:"Could not load team"});}
}
