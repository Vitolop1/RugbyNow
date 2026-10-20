import type {SupabaseClient} from "@supabase/supabase-js";
import {readSourceStatusDetail} from "./sourceStatusDetail";
export function matchObservationFilter(observedAt:unknown){
 if(typeof observedAt!=="string"||!Number.isFinite(Date.parse(observedAt))||new Date(observedAt).toISOString()!==observedAt)throw Error("Valid source observation time required");
 return `updated_at.is.null,updated_at.lte.${observedAt}`;
}
export function validateMatchObservation(payload:Record<string,unknown>){
 matchObservationFilter(payload.updated_at);
 if(readSourceStatusDetail(typeof payload.source_url==="string"?payload.source_url:null)==="suspended"&&!("home_score" in payload)&&!("away_score" in payload))return;
 if(["LIVE","HT","FT"].includes(String(payload.status))&&[payload.home_score,payload.away_score].some(v=>typeof v!=="number"||!Number.isSafeInteger(v)||v<0))throw Error("Active/final source observation is missing a valid score; last valid reading preserved");
}
/** Both predicates execute in the UPDATE, not in a racy read-then-write check. */
export async function updateObservedMatch(client:SupabaseClient,id:number,payload:Record<string,unknown>){
 validateMatchObservation(payload);
 let query=client.from("matches").update(payload).eq("id",id).or(matchObservationFilter(payload.updated_at));
 if(payload.status!=="FT")query=query.neq("status","FT");
 const {data,error}=await query.select("id").abortSignal(AbortSignal.timeout(8000));
 if(error)throw Error(`Match update failed: ${error.message}`);
 return !!data?.length;
}
