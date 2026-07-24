# The Stable — deployment runbook

Two environments: local (anvil) and **Stable Chain mainnet (988)**.

Stable Chain facts:

- Chain id **988**, native gas token USDT0. The tradable quote asset is the
  **canonical ERC20 USDT0** `0x779Ded0c9e1022225f8E0630b35a9b54bE713736`
  (**6 decimals** — it mirrors the native balance; there is no wrap/unwrap).
- Genuine Uniswap v3 factory: `0x88F0a512eF09175D456bc9547f914f48C013E4aA`
  (byte-identical to the Ethereum deployment; only the NoDelegateCall
  self-address immutable differs).
- RPC `https://rpc.stable.xyz` (override: `NEXT_PUBLIC_STABLE_RPC_URL`).
  Cloudflare rate-limits aggressively; `eth_getLogs` is capped at 500 blocks
  (the indexer chunks at 450, tune with `EVM_INDEXER_CHUNK`).
- Explorer `https://stablescan.xyz`

## Architecture (v3-direct)

There is no separate bonding curve and no migration. `launchToken` deploys the
coin (CREATE2, `…5b1e` vanity), creates + initializes its Uniswap v3 pool
(1% tier) at a ~$4,000 starting market cap, mints the entire 1B supply as a
single-sided position, and locks the position in **StableLocker** forever.
"Graduation" (`graduationStatus`) is cosmetic at **$12,000** of USDT0 raised
on the curve. Pool fees are collected permissionlessly via
`locker.collect(token)`, the coin-side fees are auto-sold to USDT0 inside the
call, and the proceeds split 50/50 creator/platform — payouts are pure USDT0.
On Stable the ERC20 USDT0 mirrors the native balance (no wrapper exists), so
claimed fees are immediately spendable dollars; there is nothing to unwrap.

Contracts: `StableLaunchpad`, `StableLaunchToken`, `StableLocker`,
`StableRouter` (thin USDT0-side swap helper).

## Chain switch

`NEXT_PUBLIC_EVM_CHAIN` is the ONLY switch: `stable` or `local`. Addresses and
the indexer start block are baked into `lib/evm/chains.ts` (DEPLOYMENTS map)
per chain; the indexer wipes and re-syncs its database automatically whenever
the chain or launchpad changes. Do NOT set `NEXT_PUBLIC_LAUNCHPAD_ADDRESS` /
`NEXT_PUBLIC_ROUTER_ADDRESS` / `NEXT_PUBLIC_USDT0_ADDRESS` /
`EVM_INDEXER_START_BLOCK` in production — those env overrides are for local
anvil runs only.

## Current deployments

| Env | Contract | Address |
| --- | --- | --- |
| Stable mainnet (988) | StableLaunchpad **v2** (Standard-only) | `0xb44a8a84257a56398465D717ca55859Ac742498a` |
| | StableLocker v2 | `0x0eDb35147181786EEDC31E8d810dE5665A5dF87D` |
| | StableRouter | `0x1CcB2F4c6dA5EB448c2ef84EF235919f7270C646` |
| | StableLaunchpad v1 (legacy, retired) | `0xB63a05e220E6a6D4BE8bE23b84E2a506537B8633` |
| | StableLocker v1 (legacy) | `0xB69ce2958E93B99b01f69d81AF29Ca8cDf9445Ae` |

v2 deployed 2026-07-25 at block 32984191: `launchToken` now enforces
`flavor == Standard` at the contract level, so no direct call can mint a
taxed token. v1 (block 32955608) is retired but its tokens stay indexed via
`legacyLaunchpads` in `lib/evm/chains.ts` — the indexer watches every listed
launchpad and records each token's origin (`curve_tokens.launchpad`); fee
collects go to the token's own locker (tokens store it as an immutable).
Owner/deployer `0x52592d4598bF309dd7E6Fc1900749E3e206c0D8B`, fee recipient
(treasury) `0xB76219577848009daF528ff21088aaf01C931156`.

> Gotcha that bricked the very first attempt: foundry auto-loads `evm/.env`,
> and a stale Robinhood-era `UNIV3_FACTORY` there overrode the script
> default. Keep `evm/.env` free of address overrides; pass them explicitly
> per command, and check `launchContext()` after every deploy.

## 1. Local dev (three terminals)

```bash
# 1 — chain
anvil --block-time 1

# 2 — full stack (USDT0 mock + vendored Uniswap v3 factory + launchpad + router;
#     mints $1M mock USDT0 to all ten anvil accounts)
cd evm
FEE_RECIPIENT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 \
  --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# prints NEXT_PUBLIC_LAUNCHPAD_ADDRESS / NEXT_PUBLIC_ROUTER_ADDRESS / NEXT_PUBLIC_USDT0_ADDRESS

# 3 — app (paste the printed addresses into .env.local, then)
npm run dev
```

Optional: `node scripts/e2e-local.mjs` (edit the addresses at the top) runs a
full launch → trade → graduation flow against the local stack.

`KEEPER_PRIVATE_KEY` lets the indexer crank `locker.collect()` for Super LP
tokens when accumulated buy tax crosses `KEEPER_MIN_TAX_TOKENS` (default 1M
tokens). Collection is permissionless on-chain either way. Without
`DATABASE_URL` the indexer uses embedded PGlite under `.data/` — nothing to
install.

## 2. Mainnet deploy

```bash
cd evm
STABLE_RPC_URL=https://rpc.stable.xyz \
FEE_RECIPIENT=0x<treasury> \
forge script script/Deploy.s.sol --rpc-url $STABLE_RPC_URL --broadcast \
  --private-key $DEPLOYER_KEY
```

`Deploy.s.sol` defaults to the real v3 factory and canonical USDT0 above
(override with `UNIV3_FACTORY` / `USDT0` envs). It deploys the launchpad
(which deploys its locker) and the router.

Then:

1. Record every printed address + deploy block in `lib/evm/chains.ts`
   (`DEPLOYMENTS.stable`: launchpad, router, usdt0, startBlock) and in the
   table above. Push — Railway redeploys from main.
2. Rebuild ABIs if contracts changed: `npm run evm:abi`.
3. Verify the four contracts on stablescan (Etherscan V2 API, chainid 988):

   ```bash
   forge verify-contract <LAUNCHPAD> src/StableLaunchpad.sol:StableLaunchpad \
     --verifier-url "https://api.etherscan.io/v2/api?chainid=988" \
     --etherscan-api-key $ETHERSCAN_API_KEY \
     --constructor-args $(cast abi-encode "c(address,address,address)" <FACTORY> <USDT0> <FEE_RECIPIENT>)
   # repeat for StableLocker (args: launchpad), StableRouter (args: factory, usdt0)
   ```

   Launched tokens verify themselves automatically (lib/server/tokenVerifier.ts).
4. Set Railway env (Variables tab):
   - `NEXT_PUBLIC_EVM_CHAIN=stable`
   - `DATABASE_URL` (add Railway's Postgres plugin; PGlite fallback is dev-only)
   - `PINATA_JWT`, `PINATA_GATEWAY` (from local `.env` — gitignored, never committed)
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (cloud.walletconnect.com project)
   - `NEXT_PUBLIC_SITE_URL=https://qorb.fun`
   - `ETHERSCAN_API_KEY` (auto-verification of launched tokens)
   - optional `KEEPER_PRIVATE_KEY` (funded wallet; cranks Super LP collects)

## 3. Post-deploy smoke test

1. Launch a token with a small dev buy (approve USDT0 to the launchpad first;
   address must end `…5b1e`; pool visible on the factory immediately).
2. Buy + sell from a second wallet through `/` and `/swap` (first buy needs a
   USDT0 approval for the router).
3. Verify anti-snipe: >2% of supply bought by a non-creator wallet inside
   2 minutes reverts (surfaces as `TF` from the pool).
4. `locker.collect(token)` pays out straight to the creator and fee-recipient
   wallets, all in USDT0 — the coin-side fees are auto-sold by the locker
   in the same transaction (the sale is attributed to the locker contract).
5. Push a test coin past $12,000 → `graduationStatus` flips → the coin page
   shows the graduated badge and keeps trading in the same pool.
6. Confirm the pool shows up on DEXScreener (USDT0-quoted Uniswap v3 pair).

## Ops notes

- Indexer runs inside the Next server process (instrumentation.ts). Disable
  with `EVM_INDEXER_DISABLED=1`. Heartbeat lines (`[curve-indexer] alive`)
  appear every 30s in logs.
- Health check: `/api/curve/tokens` (Railway config in railway.json).
- Fee recipient is updatable with `setFeeRecipient` (launchpad owner). The
  locker's split is fixed 50/50 in code.
- Fee model: every launch pool is the Uniswap v3 1% tier. Standard: collect
  splits 50/50 creator/platform. LP Grow: 70% of collected fees reinvest into
  the locked position, the remainder splits 50/50. Super LP additionally has
  a 5% buy tax on the token that swap-and-liquifies into the locked position
  on collect. (Only Standard is exposed in the launch UI right now.)
