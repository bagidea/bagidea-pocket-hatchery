const fs = require('fs');
const DAEMON = 'http://127.0.0.1:8787';
const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';

async function go() {
  // Read pockethatch1 ABI from saved file
  const p1AbiRaw = fs.readFileSync('./pockethatch1-abi.json', 'utf8');
  const p1Abi = JSON.parse(p1AbiRaw);
  // The file contains {account_name, abi: {version, structs, ...}}
  const abiObj = p1Abi.abi;
  const abiText = JSON.stringify(abiObj);
  console.log('pockethatch1 ABI:', abiText.length, 'chars');

  // Use this ABI for phgamecreatr
  const abiHex = Buffer.from(abiText, 'utf8').toString('hex');
  console.log('Hex:', abiHex.length, 'chars');

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

  console.log('Payload size:', Math.round(body.length/1024), 'KB');
  const res = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
  const r = await res.json();

  if (r.ok) {
    console.log('✅ broadcast:', (r.txId||'').substring(0, 20));
    console.log('explorer:', r.explorer);
  } else {
    console.log('❌', (r.msg||'').substring(0, 300));
  }

  // Wait for block
  await new Promise(r => setTimeout(r, 4000));

  // Verify via curl approach
  console.log('\nVerifying...');
  // Use a direct fetch approach
  const vres = await fetch('https://testnet.waxsweden.org/v1/chain/get_abi', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({account_name:'phgamecreatr'})
  });
  const vtext = await vres.text();
  console.log('Response first 200:', vtext.substring(0, 200));

  try {
    const v = JSON.parse(vtext);
    if (v.abi) {
      console.log('✅ ABI works! len:', v.abi.length);
    } else if (v.error) {
      console.log('❌ Error:', v.error.what?.substring(0, 200));
    }
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}
go().catch(e => console.error('FATAL:', e.message));
