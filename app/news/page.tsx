import {loadNews} from "@/lib/newsServer";
import NewsClient from "./NewsClient";
export const dynamic="force-dynamic";
export const metadata={title:"Noticias de rugby — UAR y ESPN Scrum",description:"Titulares de rugby argentino e internacional, con fecha, fuente y enlace a la publicación original.",alternates:{canonical:"/news"}};
export default async function NewsPage(){return <NewsClient data={await loadNews()}/>;}
