import type {ReactNode} from "react";
import {buildStaticMetadata} from "@/lib/seo";
export const metadata=buildStaticMetadata({title:"Terms of Use",description:"Terms of use for RugbyNOW's rugby fixtures, scores and TV guide.",path:"/terms"});
export default function TermsLayout({children}:{children:ReactNode}){return children;}
