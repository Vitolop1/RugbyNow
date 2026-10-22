import {getSiteUrl} from '@/lib/site';
export default function StructuredBreadcrumbs({items}:{items:{name:string;path:string}[]}){
 const data={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:`${getSiteUrl()}${item.path}`}))};
 return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>;
}
