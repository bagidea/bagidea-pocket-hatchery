#!/usr/bin/env node
/**
 * Generate deploy/args-setspecies.json with a RESOLVED template_id from chain.
 *
 * Usage:
 *   node tools/gen-args-setspecies.mjs [collection_name] [rpc]
 *   node tools/gen-args-setspecies.mjs phgamecreatr > deploy/args-setspecies.json
 *
 * Never hardcode template_id — AtomicAssets auto-increments per collection.
 */

import { resolveTemplateId } from './lib/resolve-template.mjs';

const COL = process.argv[2] || 'phgamecreatr';
const RPC = process.argv[3] || 'https://testnet.waxsweden.org';

async function main() {
  console.error(`🔍 Resolving template_id for collection "${COL}"...`);
  let templateId;
  try {
    templateId = await resolveTemplateId(COL, RPC);
    console.error(`   Resolved: template_id = ${templateId}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  const args = {
    sp: {
      template_id: templateId,
      growth_rate: 1000,
      thresh_1: 1000,
      thresh_2: 5000,
      thresh_3: 20000,
      thresh_4: 100000,
      yield_0: 100,
      yield_1: 300,
      yield_2: 600,
      yield_3: 1200,
      yield_4: 2400,
      max_stage: 5,
      egg_weight: 100,
      egg_type: 0,
      family: "Fire",
    },
  };

  // Output to stdout (redirect to file)
  console.log(JSON.stringify(args));
  console.error('✅ Done — redirect stdout to deploy/args-setspecies.json');
}

main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
