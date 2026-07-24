# The Stable — contracts

Foundry project for The Stable's bonding-curve launchpad on Stable Chain
(chain 988, native gas token USDT0 — every native amount is dollars).

## Contracts

- `src/StableLaunchpad.sol` — the launchpad. Deploys fixed-supply tokens via
  CREATE2 (vanity suffix `…5b1e`), trades them on a constant-product curve
  with virtual reserves (4,000 virtual USDT0 / 1.073B virtual tokens), 1%
  trade fee split 0.5% platform / 0.5% creator, anti-snipe window (2% per
  wallet for 120s), and a $12,000 raise target. At the target the token
  **bonds**: trading freezes and the raise waits inside the contract for
  migration into The Stable's AMM. `migrate(token)` is permissionless once
  the owner wires in the AMM's `IStableMigrator`.
- `src/tokens/StableLaunchToken.sol` — clean fixed-supply ERC20; transfers
  restricted to the launchpad until migration (no parallel markets).
- `src/amm/` — The Stable's own AMM: `StableSwapFactory` + `StableSwapPair`
  (x*y=k, 1% input fee; launch pairs extract a creator/platform share of the
  fee, the rest compounds in reserves), `StableSwapRouter` (swaps + liquidity,
  native USDT0 legs via `WUSDT0.sol`).
- `src/StableMigrator.sol` — receives a bonded token's raise + inventory from
  the launchpad, seeds the launch pair, and mints the LP to the dead address:
  the migrated liquidity is locked forever. Fee split per flavor: Standard
  0.5%-pool / 0.25%-creator / 0.25%-platform; LP-Growing 0.7% / 0.15% / 0.15%.

## Commands

```bash
forge build
forge test
```

Deploy: see `script/Deploy.s.sol` and the repo-root `DEPLOY.md`.
