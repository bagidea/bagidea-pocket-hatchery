# WAX Cloud Wallet in Pocket Hatchery

**TL;DR:** MyCloudWallet (the new WAX Cloud Wallet) supports **both WAX mainnet and WAX testnet** through WharfKit as of January 2026, so Pocket Hatchery can keep using WCW on testnet. However, the live game contract `phgamecreatr` is currently **testnet-only**; real players via WCW require a full mainnet redeploy.

---

## 1. MyCloudWallet testnet support

MyCloudWallet is **not mainnet-only**. The official WharfKit plugin lists WAX testnet in its default `supportedChains`:

| Chain | Chain ID |
|-------|----------|
| WAX Mainnet | `1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4` |
| WAX Testnet | `f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12` |

Source: `@wharfkit/wallet-plugin-cloudwallet` `src/index.ts`, default `supportedChains` array [1].

The change landed in PR #17, *"Updates for new Cloud Wallet"*, merged 2026-01-06 [2]. The plugin uses the same origin for both networks:

- Login: `https://www.mycloudwallet.com/cloud-wallet/login`
- Signing: `https://www.mycloudwallet.com/cloud-wallet/signing/`

Network selection is passed by WharfKit `SessionKit` through the login context, not by subdomain [1].

> **Note on conflicting docs:** The WAX WharfKit React tutorial still gates `WalletPluginCloudWallet` behind `VITE_CHAIN === 'mainnet'` [3]. This appears outdated relative to the plugin source, which is the authoritative integration point.

---

## 2. Pocket Hatchery integration

The web frontend uses WharfKit with the official Cloud Wallet and Anchor plugins. The default build targets **WAX Testnet** (`VITE_CHAIN=testnet` in `web/.env`) [4].

**Dependencies (`web/package.json`) [4]:**

```json
"@wharfkit/session": "^1.6.1",
"@wharfkit/wallet-plugin-anchor": "^1.6.1",
"@wharfkit/wallet-plugin-cloudwallet": "^1.6.5",
"@wharfkit/web-renderer": "^1.4.3"
```

**Wallet setup (`web/src/wallet.ts`) [5]:**

```ts
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'

const walletPlugins = [new WalletPluginCloudWallet(), new WalletPluginAnchor()]
```

**Active chain (`web/src/network.ts`) [6]:**

```ts
'wax-testnet': {
  chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
  rpc: ['https://wax-testnet.eosphere.io', 'https://testnet.waxsweden.org'],
  contract: 'phgamecreatr',
},
'wax-mainnet': {
  chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  rpc: ['https://wax.greymass.com'],
  contract: '', // not deployed yet
},
```

Transactions are signed through `session.transact()` in `web/src/contract.ts` [7]. For local development, the UI also supports an internal **waxwing** signer daemon at `http://127.0.0.1:8787` (`web/src/waxwing.ts`) so devs can test without a real WCW account [4].

The live game contract `phgamecreatr` on testnet exposes player actions such as `initplayer`, `firsthatch`, `hatch`, `feed`, `evolve`, `harvest`, `breed`, `accelerate`, `claimreward`, `burncreature`, `setname`, and admin actions such as `setconfig`, `setspecies`, `fundpool` [8]. Key tables include `configv3`, `players`, `creatrsv2`, `claims`, and `rewardpool` [8].

---

## 3. Mainnet migration checklist

The contract `phgamecreatr` exists on WAX testnet (last code update 2026-07-15) and **does not exist on mainnet** [8][9]. To let real players log in via WCW on mainnet, redeploy:

1. Register a new 12-character WAX mainnet account for the game contract.
2. Deploy the compiled `pockethatch` WASM + ABI to that account.
3. Run `setconfig` with mainnet values (token contract, AtomicAssets collection, fee account, RNG oracle).
4. Seed all species via `setspecies`.
5. Create the mainnet AtomicAssets collection + schema + templates and authorize the contract.
6. Deploy/use the mainnet HATCH token and fund the reward pool.
7. Update `web/src/network.ts` (`wax-mainnet.contract`) and deploy scripts to the new mainnet account.

---

## References

[1] WharfKit `wallet-plugin-cloudwallet` source, `src/index.ts` (`supportedChains` includes WAX testnet). https://github.com/wharfkit/wallet-plugin-cloudwallet/blob/master/src/index.ts  
[2] GitHub PR #17, "Updates for new Cloud Wallet", merged 2026-01-06. https://github.com/wharfkit/wallet-plugin-cloudwallet/pull/17  
[3] WAX docs — WharfKit React tutorial (shows mainnet-gated CloudWallet). https://docs.wax.io/build/tutorials/wharfkit/howto_react  
[4] Pocket Hatchery `web/package.json`.  
[5] Pocket Hatchery `web/src/wallet.ts`.  
[6] Pocket Hatchery `web/src/network.ts`.  
[7] Pocket Hatchery `web/src/contract.ts`.  
[8] Pocket Hatchery `docs/REFERENCE.md` — contract action/table reference for `phgamecreatr`.  
[9] WAX testnet RPC `get_account phgamecreatr` — account exists, `last_code_update` 2026-07-15. Endpoint: `https://testnet.waxsweden.org`.  
[10] WAX mainnet RPC `get_account phgamecreatr` — `account_query_exception` (account not found). Endpoints: `https://api.waxsweden.org`, `https://wax.greymass.com`.

---

**Verdict:** WAX Cloud Wallet / MyCloudWallet is **not mainnet-only** — it supports WAX testnet through the WharfKit plugin since January 2026. The blocker for real players is not the wallet; it is that the Pocket Hatchery contract `phgamecreatr` is currently deployed only on testnet.
