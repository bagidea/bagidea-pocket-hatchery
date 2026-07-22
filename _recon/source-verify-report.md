# Source ↔ Chain Verification Report

**Date:** 2026-07-19
**CDT:** 4.1.1 (WSL)
**Source:** `contract/pockethatch/pockethatch.{hpp,cpp}` (current HEAD)
**Network:** WAX testnet

---

## Compile Result

```
CDT Version: 4.1.1
Source:      pockethatch.cpp + pockethatch.hpp
Output:      pockethatch.wasm (--abigen)
Warnings:    23 (all ricardian-contract warnings — no errors)
```

### SHA256 Comparison

| Source | SHA256 |
|---|---|
| 🔗 On-chain `phgamecreatr` (CEO verified) | `424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca` |
| 💻 Compiled from current source | `424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca` |
| **Verdict** | **✅ MATCH** |

**Source code ตรงกับ bytecode บนเชน 100% — ไม่มี drift**

---

## Patches Prepared (UN-APPLIED)

### Patch 1: `_recon/setname-namecost-enforce.patch`
- **Action:** `setname()` — line 890
- **What:** เพิ่ม `burn_hatch(owner, cfg.name_cost, "setname:...")` หลัง `_cfg()`
- **Guard:** `burn_hatch` ใช้ `from=owner → to=get_self()` → ปลอดภัยจาก "cannot transfer to self"
- **Option B (in comments):** transfer ตรงไป `fee_account` พร้อม guard `fee_account != get_self()`

### Patch 2: `_recon/unlockslot-config-cost.patch`
- **Action:** `unlockslot()` — line 989
- **What:** แทน hardcoded `500/1200/2500` ด้วย `cfg.slot_cost` เป็น base
- **Ratios preserved:** `base × 1`, `base × 12/5`, `base × 5`, `base × 5 × 2^(slot-6)`
- **Backward compatible:** เมื่อ `cfg.slot_cost == 500` → behavior เหมือนเดิมเป๊ะ

---

## Other Audit Artifacts (from earlier rounds)

| File | Description |
|---|---|
| `_recon/config-field-audit.md` | 63 config fields: 58 enforced ✅ + 5 ghost ❌ |
| `_recon/abi-configv2-to-configv3-fix.md` | ABI drift 3 จุด (configv2/v3, creatures/creatrsv2, speciescfg/spccfgv2) — on-chain correct, local stale |

---

**Status:** พร้อม deploy รอ CEO สั่ง — ทั้งสอง patch รวมกัน = ปิด ghost fields `name_cost` + `slot_cost`
