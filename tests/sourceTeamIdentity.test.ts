import test from "node:test";
import assert from "node:assert/strict";
import {resolveExactSourceTeam,sourceTeamName} from "../lib/sourceTeamIdentity";

test("Lions never resolves to Old Lions RC or British and Irish Lions",()=>{
  const teams=new Map([["old lions rc",200],["british and irish lions",5]]);
  assert.equal(resolveExactSourceTeam("Lions",teams),null);
  teams.set("lions",222);
  assert.equal(resolveExactSourceTeam("Lions",teams),222);
  assert.equal(resolveExactSourceTeam("Old Lions RC",teams),200);
});
test("explicit source aliases remain valid across case, accents and whitespace",()=>{
  const teams=new Map([[sourceTeamName("Hindú"),91],[sourceTeamName("Atl. del Rosario"),94]]);
  assert.equal(resolveExactSourceTeam(" HINDU ",teams),91);
  assert.equal(resolveExactSourceTeam("Atl.  del Rosario",teams),94);
  assert.equal(resolveExactSourceTeam("Rosario",teams),null);
});
