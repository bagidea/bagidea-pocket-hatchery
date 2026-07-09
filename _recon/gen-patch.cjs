// Generate a real, apply-checkable unified diff for the syncowner patch.
// Preserves CRLF. Builds a/ (original) and b/ (modified) trees so `git apply -p1` works.
const fs = require('fs');
const path = require('path');

const REL = 'contract/pockethatch';
const ROOT = 'E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery';
const GEN = path.join(ROOT, '_recon/patchgen');

function readCRLF(p) { return fs.readFileSync(p, 'utf8'); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

// ---- hpp: insert syncowner decl right after the harvest action decl ----
const hppPath = path.join(ROOT, REL, 'pockethatch.hpp');
let hpp = readCRLF(hppPath);
const hppLines = hpp.split('\r\n');
const anchor = '    [[eosio::action]] void harvest(name owner);';
const ai = hppLines.indexOf(anchor);
if (ai < 0) throw new Error('hpp anchor not found');
const hppInsert = [
  '    // Admin owner reconcile: fix creatures.owner drift vs the real AtomicAssets',
  '    // owner. AA `transfer` notifies only from/to, so user<->user P2P transfers',
  '    // never reach this contract and creatures.owner goes stale; an off-chain',
  '    // watcher (or a one-shot reconcile) calls this with AA-verified asset_ids.',
  '    [[eosio::action]] void syncowner(std::vector<uint64_t> asset_ids, name new_owner);',
];
hppLines.splice(ai + 1, 0, ...hppInsert);
const hppMod = hppLines.join('\r\n');

// ---- cpp: append syncowner impl at EOF ----
const cppPath = path.join(ROOT, REL, 'pockethatch.cpp');
let cpp = readCRLF(cppPath);
if (!cpp.endsWith('\r\n')) cpp += '\r\n';
const cppBlock = [
  '',
  '// ── Admin: reconcile creatures.owner with the real AtomicAssets owner ──────────',
  '// Only rewrites the owner FIELD; never mints/burns/transfers. Caller must pass',
  '// asset_ids that off-chain verification proved belong to new_owner on AA.',
  'void pockethatch::syncowner(std::vector<uint64_t> asset_ids, name new_owner) {',
  '    require_auth(get_self());                 // admin-only (self / fee_account perm)',
  '    check(is_account(new_owner), "new_owner is not an account");',
  '    creatures_t crs(get_self(), get_self().value);',
  '    for (auto id : asset_ids) {',
  '        auto it = crs.find(id);',
  '        check(it != crs.end(), "no creature row for asset");',
  '        if (it->owner != new_owner)',
  '            crs.modify(it, same_payer, [&](auto& r){ r.owner = new_owner; });',
  '    }',
  '}',
].join('\r\n') + '\r\n';
const cppMod = cpp + cppBlock;

// ---- write a/ (orig) and b/ (mod) trees ----
for (const [side, hv, cv] of [['a', hpp, cpp], ['b', hppMod, cppMod]]) {
  const dir = path.join(GEN, side, REL);
  mkdirp(dir);
  fs.writeFileSync(path.join(dir, 'pockethatch.hpp'), hv);
  fs.writeFileSync(path.join(dir, 'pockethatch.cpp'), cv);
}
console.log('generated a/ and b/ trees under', GEN);
