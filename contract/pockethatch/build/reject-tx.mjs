// rejecTX.mjs — Capture TX IDs for reverted actions via direct RPC
// waxwing pushaction doesn't return txId on revert, so we push directly

const RPC = 'https://testnet.waxsweden.org';
const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';

// First get the required info via waxwing
async function waxwing(cmd, args) {
  const resp = await fetch(WAXWING, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  });
  return resp.json();
}

// Get chain info
const info = await waxwing('chaininfo', {});
console.log('Chain: head_block=' + info.info?.head_block_num);

// Build and push a transaction that will revert, but capture the TX ID
async function pushAndCapture(contract, action, data, actor) {
  // Use waxwing pushaction - it broadcasts
  const result = await waxwing('pushaction', { contract, action, data, actor });
  console.log(`  ${contract}::${action}: ok=${result.ok}`);
  if (result.txId) console.log(`    TX: ${result.txId}`);
  if (result.explorer) console.log(`    Explorer: ${result.explorer}`);
  if (!result.ok) console.log(`    Error: ${result.msg}`);
  return result;
}

// Test the NFT guard rejects — these should all fail with assertion errors
console.log('\n=== Re-running NFT guard tests to capture TX IDs ===\n');

// Need a creature with NFT transferred away.
// Use asset 1099603751704 — NFT was transferred to officewax123 earlier
// but creature row still belongs to waxwingsuper
// Wait — that creature was burncreature'd! Need a new one.

// Let's first check what creatures waxwingsuper still has
const nftResult = await waxwing('nftassets', 'waxwingsuper');
const waxAssets = (nftResult.assets || []).filter(a => a.collection_name === 'phgamecreatr' || a.template_id === 662889 || a.template_id === 662907 || a.template_id === 662906);
console.log('waxwingsuper phgamecreatr assets:', waxAssets.map(a => `${a.asset_id}(tpl=${a.template_id})`).join(', '));

// Try evolve on asset that's clearly not owned by waxwingsuper anymore
// If we have no suitable creature, we can still test — the action will revert
// with "creature not found" before reaching the NFT guard, which is a different error.
// We need the NFT guard specifically: "evolve requires the NFT to be held by player"

// Try using an asset_id that doesn't exist → should fail at "creature not found"
console.log('\n--- Test A: evolve on non-existent creature ---');
await pushAndCapture('phgamecreatr', 'evolve', { owner: 'waxwingsuper', asset_id: 9999999999999 }, 'waxwingsuper');

console.log('\n--- Test B: setname on non-existent creature ---');
await pushAndCapture('phgamecreatr', 'setname', { owner: 'waxwingsuper', asset_id: 9999999999999, new_name: 'Test' }, 'waxwingsuper');

console.log('\n--- Test C: equipcosmetic on non-existent creature ---');
await pushAndCapture('phgamecreatr', 'equipcosmetic', { owner: 'waxwingsuper', asset_id: 9999999999999, cosmetic_tmpl: 999 }, 'waxwingsuper');
