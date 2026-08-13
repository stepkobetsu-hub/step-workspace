const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../core.js');

test('custom cards with unique IDs remain visible even when their URLs match',()=>{
  const cards=[
    {id:'broken-a',displayName:'リンク切れ A',productionUrl:'https://example.com/rebuild-workspace.html#broken-a',status:'active'},
    {id:'broken-b',displayName:'リンク切れ B',productionUrl:'https://example.com/rebuild-workspace.html#broken-b',status:'active'}
  ];
  assert.equal(core.buildApps(cards).length,1);
  assert.deepEqual(core.buildApps(cards,{allowDuplicateUrls:true}).map(card=>card.id),['broken-a','broken-b']);
});
