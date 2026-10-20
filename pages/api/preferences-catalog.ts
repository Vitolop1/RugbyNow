import type {NextApiRequest,NextApiResponse} from "next";
import snapshot from "@/data/supabase-snapshot.json";
export default function handler(req:NextApiRequest,res:NextApiResponse){if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).end();}res.setHeader("Cache-Control","public, max-age=300");return res.json({leagues:snapshot.competitions.map(({slug,name,country_code,region})=>({slug,name,country_code,region})),clubs:snapshot.teams.filter(t=>t.slug).map(({slug,name})=>({slug,name}))});}
