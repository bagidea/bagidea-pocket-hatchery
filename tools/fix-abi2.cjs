#!/usr/bin/env node
const DAEMON = 'http://127.0.0.1:8787';
const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';

async function go() {
  // Fetch pockethatch1's working ABI
  console.log('Fetching pockethatch1 ABI...');
  const abiRes = await fetch('https://testnet.waxsweden.org/v1/chain/get_abi', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({account_name:'pockethatch1'})
  });
  const abiData = await abiRes.json();
  if (!abiData.abi) {
    console.log('Failed:', JSON.stringify(abiData).substring(0,200));
    return;
  }

  const workingAbi = JSON.parse(abiData.abi);
  console.log('Working ABI:', workingAbi.version, '-', (workingAbi.actions||[]).length, 'actions');

  const abiText = JSON.stringify(workingAbi);
  const abiHex = Buffer.from(abiText, 'utf8').toString('hex');
  console.log('ABI text:', abiText.length, 'bytes, hex:', abiHex.length, 'chars');

  // Deploy to phgamecreatr
  console.log('\nDeploying to phgamecreatr...');
  const body = JSON.stringify({
    cmd: 'pushaction',
    args: JSON.stringify({
      network: 'wax-testnet',
      from: 'phgamecreatr',
      contract: 'eosio',
      action: 'setabi',
      data: { account: 'phgamecreatr', abi: abiHex }
    })
  });

  const res = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
  const r = await res.json();
  console.log(r.ok ? '✅ broadcast: ' + (r.txId||'').substring(0,20) : '❌ ' + (r.msg||'').substring(0,200));

  await new Promise(r => setTimeout(r, 3000));

  // Verify
  console.log('\nVerifying...');
  const vres = await fetch('https://testnet.waxsweden.org/v1/chain/get_abi', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({account_name:'phgamecreatr'})
  });
  const v = await vres.json();
  if (v.abi) {
    console.log('✅ ABI WORKS! len:', v.abi.length);
  } else {
    console.log('❌', (v.error?.what||'').substring(0, 200));
  }
}
go().catch(e => console.error('FATAL:', e.message));
