# Reproducible Build — Pocket Hatchery Contract

**Date:** 2026-07-19 23:35 ICT  
**Purpose:** Prove current source (`contract/pockethatch/pockethatch.{hpp,cpp}`) compiles to the same bytecode as `phgamecreatr` on WAX testnet.  
**Status:** ✅ MATCH — `424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca`

---

## Environment

| Item | Value |
|---|---|
| **OS** | Windows 11 + WSL 2 |
| **Distro** | Ubuntu (WSL) |
| **CDT** | 4.1.1 |
| **CDT binary** | `/home/bagidea/cdt/bin/cdt-cpp` |
| **CDT includes** | `/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts` + `…/core` |

---

## Source Fingerprints (before compile)

```
md5sum pockethatch.cpp → 6c0482510e6d7762f5b776c39bc8d531
md5sum pockethatch.hpp → 7a76e93d0c5e7307e6f4a5f9379c4f53
```

Source location (Windows):  
`E:\Projects\bagidea-ai-agents-office\workspace\projects\Pocket Hatchery\contract\pockethatch\`

Source location (WSL):  
`/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/`

---

## Build Command (copy-paste reproducible)

Open WSL terminal (`wsl` from PowerShell), then:

```bash
/home/bagidea/cdt/bin/cdt-cpp \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core \
  -I "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch" \
  -o "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/_recon/verify/pockethatch.wasm" \
  "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/pockethatch.cpp" \
  --abigen
```

Or one-liner (copy-paste whole line):

```bash
/home/bagidea/cdt/bin/cdt-cpp -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core -I "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch" -o "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/_recon/verify/pockethatch.wasm" "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/pockethatch.cpp" --abigen
```

**Flags:** `-I` (3 include dirs), `-o` (output .wasm), `--abigen` (generate .abi alongside)

**Note:** CDT 4.1.1 `--abigen` emits ABI alongside the .wasm in the same output directory. The generated `.abi` is missing `[[eosio::table]]` structs (tables / player_row / creature_row / rewardpool_row) — this is a known CDT 4.1.1 quirk. The `.wasm` is unaffected; only the ABI needs post-processing (merge tables section from a hand-maintained ABI stub) before `setabi`.

---

## Warnings

23 ricardian-contract warnings (all 22 actions + `firsthatch` emit a "does not have a ricardian contract" warning). **Zero errors.** These warnings are pre-existing and irrelevant to bytecode — they are about missing markdown documentation, not code.

---

## SHA256 Output (raw)

```
424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca  pockethatch.wasm
```

## Artifacts

| File | Path | Size |
|---|---|---|
| WASM | `_recon/verify/pockethatch.wasm` | 144,355 bytes |
| BUILD.md | `_recon/verify/BUILD.md` | (this file) |

---

## Chain Verification

```
ON-CHAIN code_hash (get_raw_abi):  424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca
COMPILED sha256 (this build):      424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca
VERDICT:                           ✅ MATCH — byte-for-byte identical
```

To independently verify the on-chain code_hash:
```bash
curl -s -X POST "https://testnet.waxsweden.org/v1/chain/get_raw_abi" \
  -H "content-type: application/json" \
  -d '{"account_name":"phgamecreatr"}' | grep -o '"code_hash":"[^"]*"'
```
