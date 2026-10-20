import fs from "node:fs";
import path from "node:path";

// Stable local inventory prevents requests for missing logos before hydration.
const folders=["team-logos","league-logos","broadcast-logos","icons"];
const paths=folders.flatMap(folder=>fs.readdirSync(path.join(process.cwd(),"public",folder),{withFileTypes:true})
  .filter(entry=>entry.isFile() && /\.(png|jpe?g|svg|webp|ico)$/i.test(entry.name))
  .map(entry=>`/${folder}/${entry.name}`)).sort();
fs.writeFileSync(path.join(process.cwd(),"data","visual-assets.json"),JSON.stringify(paths,null,2)+"\n","utf8");
console.log(`Visual asset inventory: ${paths.length} local files.`);
