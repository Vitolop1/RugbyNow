import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../data/visual-assets.json";
import {getTeamLogo,getLeagueLogo} from "../lib/assets";
import official from "../data/official-standings.json";
import snapshot from "../data/supabase-snapshot.json";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import TeamCrest from "../app/components/TeamCrest";

test("SSR logo destinations exist locally, including missing clubs and unverified competition marks",()=>{
  assert.equal(new Set(inventory).size,inventory.length);
  for(const asset of inventory)assert.ok(fs.existsSync(path.join(process.cwd(),"public",asset)),asset);
  for(const src of [getTeamLogo("black-lion"),getTeamLogo("parabiago"),getTeamLogo("argentina"),getTeamLogo("vannes"),getLeagueLogo("eu-challenge-cup"),getLeagueLogo("svns-australia")]) {
    assert.ok(fs.existsSync(path.join(process.cwd(),"public",src)),src);
  }
  assert.notEqual(getLeagueLogo("eu-challenge-cup"),getLeagueLogo("eu-champions-cup"));
  assert.ok(!getLeagueLogo("svns-australia").includes("World_Cup"));
});

test("every official standings identity resolves to an existing, case-exact club asset",()=>{
  for(const table of official.tables) {
    assert.equal(new Set(table.rows.map(r=>r.slug)).size,table.rows.length);
    for(const row of table.rows) {
      assert.match(row.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(snapshot.teams.filter(team=>team.slug===row.slug).length,1,row.slug);
      const src=getTeamLogo(row.slug,row.team);
      assert.ok(src.startsWith("/team-logos/"),`${table.competitionSlug}: ${row.slug}`);
      assert.ok(inventory.includes(src),src);
      const directory=path.join(process.cwd(),"public",path.dirname(src));
      assert.ok(fs.readdirSync(directory).includes(path.basename(src)),`Exact casing: ${src}`);
      const body=fs.readFileSync(path.join(process.cwd(),"public",src));
      if(src.endsWith(".png")) {
        assert.equal(body.subarray(0,8).toString("hex"),"89504e470d0a1a0a",src);
        assert.ok(body.readUInt32BE(16)>0&&body.readUInt32BE(20)>0,src);
      } else assert.match(body.toString(),/<svg\b/,src);
    }
  }
});

test("aliases preserve distinct clubs, XV/sevens identities and explicit Newcastle branding",()=>{
  assert.notEqual(getTeamLogo("old-lions"),getTeamLogo("lions"));
  assert.equal(getTeamLogo("old-lions"),getTeamLogo("old-lions-rc"));
  assert.equal(getTeamLogo("toulon"),getTeamLogo("rc-toulonnais"));
  assert.equal(getTeamLogo("clermont"),getTeamLogo("asm-clermont-auvergne"));
  assert.notEqual(getTeamLogo("argentina"),getTeamLogo("argentina-7s"));
  assert.equal(getTeamLogo("newcastle-falcons"),"/team-logos/newcastle-falcons.png");
  assert.equal(getTeamLogo("newcastle-falcons","Newcastle Red Bulls"),getTeamLogo("newcastle-red-bulls"));
  assert.notEqual(getTeamLogo("newcastle-falcons"),getTeamLogo("newcastle-red-bulls"));
  assert.equal(getTeamLogo("unknown-universitario"),"/icons/rugby-ball.svg");
});

test("crest SSR has a stable frame, decorative semantics and an inline fallback without broken requests",()=>{
  const crest=renderToStaticMarkup(createElement(TeamCrest,{slug:"agen",name:"SU Agen",size:26}));
  assert.match(crest,/--crest-size:26px/);
  assert.match(crest,/aria-hidden="true"/);
  assert.match(crest,/src="\/team-logos\/agen.png"/);
  assert.match(crest,/alt=""/);
  const stormers=renderToStaticMarkup(createElement(TeamCrest,{slug:"stormers"}));
  assert.match(stormers,/data-crest-surface="dark"/);
  for(const slug of [undefined,null,"unknown-universitario"]) {
    const html=renderToStaticMarkup(createElement(TeamCrest,{slug}));
    assert.match(html,/<svg/);
    assert.doesNotMatch(html,/<img/);
  }
});
