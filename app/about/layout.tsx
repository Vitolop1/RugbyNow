import type {ReactNode} from "react";
import {buildStaticMetadata} from "@/lib/seo";
export const metadata=buildStaticMetadata({title:"About RugbyNOW",description:"RugbyNOW's rugby agenda, data sources and contact information.",path:"/about"});
export default function AboutLayout({children}:{children:ReactNode}){return children;}
