import {test} from "node:test";
import assert from "node:assert/strict";
import {
  parsePrivateWindowsQaWave as parse,
  matchingPrivateWindowsQaWave as matches,
} from "./bostan-private-windows-qa-wave.mjs";

test("B0xx and B1xx three-digit QA checkouts are both admitted",()=>{
  for(const wave of ["B086","B099","B100","B101","B999"]){
    assert.equal(parse("Bostan-"+wave+"-qa","qa"),wave);
    assert.equal(parse("Bostan-"+wave+"-temp","temp"),wave);
    assert.equal(matches("Bostan-"+wave+"-qa","Bostan-"+wave+"-temp"),true);
  }
});
test("checkout and temporary names must belong to the exact same wave",()=>{
  for(const [qa,temp] of [
    ["Bostan-B099-qa","Bostan-B100-temp"],
    ["Bostan-B100-qa","Bostan-B099-temp"],
    ["Bostan-B100-qa","Bostan-B101-temp"],
    ["Bostan-B100-temp","Bostan-B100-qa"],
  ]){
    assert.equal(matches(qa,temp),false,qa+" vs "+temp);
  }
});
test("reject traversal, extensions, prefixes, unicode and broad QA directory names",()=>{
  for(const name of [
    "Bostan-B100-qa-extra","prefix-Bostan-B100-qa",
    "Bostan-B100-qa/../qa","Bostan-B100-qa\\other",
    "Bostan-B100-qa.", "Bostan-B1000-qa", "Bostan-B10-qa",
    "Bostan-B1O0-qa", "Bostan-B100-temp","Bostan-B100-qa\n",
    "",null,undefined,100,
  ]) assert.equal(parse(name,"qa"),null,String(name));
});
test("legacy B087 checkout matches B087 temp without widening roles",()=>{
  assert.equal(matches("Bostan-B087-qa","Bostan-B087-temp"),true);
  assert.equal(parse("Bostan-B100-qa","temp"),null);
  assert.equal(parse("Bostan-B100-temp","qa"),null);
  assert.equal(parse("Bostan-B100-qa","release"),null);
});
test("case-insensitive Windows names keep identical normalized wave",()=>{
  assert.equal(parse("bostan-b100-QA","qa"),"B100");
  assert.equal(matches("bOsTaN-b100-qA","BOSTAN-B100-TeMp"),true);
});
