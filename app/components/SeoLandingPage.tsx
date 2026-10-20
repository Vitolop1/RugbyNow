import type {ReactNode} from "react";
import Link from "next/link";
import PortalShell from "./PortalShell";
type SeoLandingLink={href:string;label:string;description:string};
export default function SeoLandingPage({title,description,intro,bullets,primaryLink,links,children}:{title:string;description:string;intro:string;bullets:string[];primaryLink:SeoLandingLink;links:SeoLandingLink[];children?:ReactNode}){
 return <PortalShell title={title} subtitle={description}>
  {children}
  <section className="rn-panel"><p>{intro}</p><Link href={primaryLink.href}>{primaryLink.label} →</Link><ul>{bullets.map(text=><li key={text}>{text}</li>)}</ul></section>
  <section className="rn-panel"><h2>Explore RugbyNOW</h2>{links.map(link=><div className="rn-directory-row" key={link.href}><div><Link href={link.href}>{link.label} →</Link><small>{link.description}</small></div></div>)}</section>
 </PortalShell>;
}
