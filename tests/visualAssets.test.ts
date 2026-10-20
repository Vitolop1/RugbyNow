import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../data/visual-assets.json";
import {getTeamLogo,getLeagueLogo} from "../lib/assets";

test("SSR logo destinations exist locally, including missing clubs and unverified competition marks",()=>{
  assert.equal(new Set(inventory).size,inventory.length);
  for(const asset of inventory)assert.ok(fs.existsSync(path.join(process.cwd(),"public",asset)),asset);
  for(const src of [getTeamLogo("black-lion"),getTeamLogo("parabiago"),getTeamLogo("argentina"),getTeamLogo("vannes"),getLeagueLogo("eu-challenge-cup"),getLeagueLogo("svns-australia")]) {
    assert.ok(fs.existsSync(path.join(process.cwd(),"public",src)),src);
  }
  assert.notEqual(getLeagueLogo("eu-challenge-cup"),getLeagueLogo("eu-champions-cup"));
  assert.ok(!getLeagueLogo("svns-australia").includes("World_Cup"));
});
