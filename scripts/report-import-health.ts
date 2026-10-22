import fs from 'node:fs';
import path from 'node:path';
import {aggregateImportHealth,type ImportHealth} from '../lib/providerPolicy';

const directory=process.env.IMPORT_HEALTH_DIR??'logs/import-health';
const matrix=JSON.parse(process.env.IMPORT_MATRIX??'{"include":[]}') as {include:{urls:string}[]};
const expected=matrix.include.flatMap(group=>group.urls.split('\n').filter(Boolean).map(feed=>{
 const split=feed.indexOf('=');return split>0?feed.slice(0,split):new URL(feed).pathname.replace(/[^a-z0-9]+/gi,'-');
}));
const reports=fs.existsSync(directory)?fs.readdirSync(directory).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(directory,file),'utf8')) as ImportHealth):[];
const report={checkedAt:new Date().toISOString(),...aggregateImportHealth(reports,expected),
 exportStatus:'not_started',publicationStatus:'not_started',
 note:'Updated/inserted count match writes, not standings rows. A complete database export may contain retained older source data. Source failure remains a workflow failure.'};
fs.mkdirSync('logs/import-summary',{recursive:true});
fs.writeFileSync('logs/import-summary/sources.json',JSON.stringify(report,null,2)+'\n');
const summary=`## Source import: ${report.status}\n\nSuccessful feeds: ${report.successful}; failed: ${report.failed.join(', ')||'none'}; missing reports: ${report.missing.join(', ')||'none'}.\n\nSource rows: ${report.sourceRows}; match rows updated: ${report.updated}; match rows inserted: ${report.inserted}.\n\nExport and publication are separate steps below. Older valid source data is retained on failure.\n`;
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(summary);
