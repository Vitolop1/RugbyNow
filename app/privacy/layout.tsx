import type {ReactNode} from "react";
import {buildStaticMetadata} from "@/lib/seo";
export const metadata=buildStaticMetadata({title:"Privacy",description:"RugbyNOW privacy information and contact details.",path:"/privacy"});
export default function PrivacyLayout({children}:{children:ReactNode}){return children;}
