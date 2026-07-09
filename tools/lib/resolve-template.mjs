/**
 * Shared template_id resolver — query AtomicAssets templates table
 *
 * Every AA collection gets its own auto-incremented template_id counter.
 * NEVER hardcode a template_id — always resolve from chain after createtempl.
 *
 * Usage (ESM):
 *   import { resolveTemplateId } from './lib/resolve-template.mjs';
 *   const tid = await resolveTemplateId('phgamecreatr', 'https://testnet.waxsweden.org');
 */

const DEFAULT_RPC = 'https://testnet.waxsweden.org';

/**
 * Query the AA templates table and return the newest template_id for a collection.
 * @param {string} collectionName - e.g. 'phgamecreatr'
 * @param {string} [rpc] - chain RPC endpoint
 * @param {object} [opts]
 * @param {number} [opts.limit=10] - how many rows to scan (newest-first)
 * @returns {Promise<number>} the template_id
 */
export async function resolveTemplateId(collectionName, rpc = DEFAULT_RPC, opts = {}) {
  const limit = opts.limit || 10;
  const res = await fetch(`${rpc}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: 'atomicassets',
      scope: collectionName,
      table: 'templates',
      limit,
      reverse: true,   // newest first
    }),
  });
  const data = await res.json();
  const rows = data.rows || [];
  if (rows.length === 0) {
    throw new Error(`No templates found for collection "${collectionName}" — createtempl may have failed`);
  }
  return rows[0].template_id;
}

/**
 * Resolve ALL template_ids for a collection (useful when you have multiple species).
 * @param {string} collectionName
 * @param {string} [rpc]
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @returns {Promise<Array<{template_id: number, immutable_data: object}>>}
 */
export async function resolveAllTemplates(collectionName, rpc = DEFAULT_RPC, opts = {}) {
  const limit = opts.limit || 50;
  const res = await fetch(`${rpc}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      json: true,
      code: 'atomicassets',
      scope: collectionName,
      table: 'templates',
      limit,
      reverse: true,
    }),
  });
  const data = await res.json();
  return (data.rows || []).map(r => ({
    template_id: r.template_id,
    immutable_data: r.immutable_data || {},
  }));
}
