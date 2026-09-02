const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.v20260818-32.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'app-catalog.json'),'utf8'));

test('料金特別調整を指定URLで請求・会計の先頭へ固定する',()=>{
  const item=catalog.apps.find(value=>value.id==='billing-special-adjustment');
  assert.equal(item.productionUrl,'https://script.google.com/macros/s/AKfycbxzkE1tQRyB_Ca4bfPKYWIkpTukIVPMWKf2ETE7yN7qROJk0VyOlvxaJ9GGI5p-6pGb/exec?page=adjustments');
  assert.match(app,/value\.orders\.billing\.unshift\(REQUIRED_BILLING_ADJUSTMENT_APP\.id\)/);
  assert.match(app,/value\.customApps\.unshift\(Object\.assign\(\{\},REQUIRED_BILLING_ADJUSTMENT_APP\)\)/);
  assert.match(app,/state\.favorites=\[REQUIRED_BILLING_ADJUSTMENT_APP\.id,/);
  assert.match(app,/isBillingAdjustment&&billingAdjustmentAdded/);
  assert.match(app,/cardUrl\.textContent=app\.url/);
  assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/class="card-url" hidden/);
});
