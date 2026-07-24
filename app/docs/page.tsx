import Link from "next/link";

export const metadata = {
  title: "docs — qorb",
};

/** Left-nav docs: user guide + builder integration reference. Plain anchor
 * navigation; sections carry scroll-mt so the sticky topbar never covers a
 * heading. */

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: "start here",
    items: [
      { id: "overview", label: "what is qorb" },
      { id: "launching", label: "launching a coin" },
      { id: "pool", label: "the bonding curve" },
      { id: "graduation", label: "graduation" },
    ],
  },
  {
    group: "coins",
    items: [
      { id: "token-types", label: "token types" },
      { id: "fees", label: "fees" },
      { id: "trading-tips", label: "trading tips" },
    ],
  },
  {
    group: "for builders",
    items: [
      { id: "contracts", label: "contracts & addresses" },
      { id: "build-launchpad", label: "launchpad integration" },
      { id: "build-trading", label: "trading integration" },
      { id: "http-api", label: "http api" },
      { id: "events", label: "on-chain events" },
    ],
  },
  {
    group: "legal",
    items: [{ id: "risk", label: "risk" }],
  },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-stbl-800 bg-stbl-950 p-4 font-mono text-[11px] leading-relaxed text-stbl-shell/85">
      {children}
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-stbl-700 bg-stbl-900/40 p-6">
      <h2 className="font-display text-lg font-extrabold lowercase text-stbl-shell">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-stbl-shell/75">
        {children}
      </div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="grid items-start gap-8 pb-10 lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* left nav */}
      <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-stbl-700 bg-stbl-900/50 p-4 lg:block">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4 last:mb-0">
            <p className="mb-1.5 font-mono text-[10px] font-bold lowercase tracking-wider text-stbl-yolk">
              {"/// "}
              {g.group}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.id}>
                  <a
                    href={`#${i.id}`}
                    className="block rounded-lg px-2 py-1.5 text-xs lowercase text-stbl-shell/65 transition hover:bg-stbl-800 hover:text-stbl-shell"
                  >
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* content */}
      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-stbl-yolk/30 bg-stbl-900/60 p-6">
          <h1 className="font-display text-2xl font-extrabold lowercase text-stbl-shell">
            docs
          </h1>
          <p className="mt-1 text-sm lowercase text-stbl-shell/60">
            everything about launching, trading, and building on qorb —
            the launchpad on stable chain, where gas is the dollar and every
            coin lives in a real uniswap v3 pool from block one.
          </p>
        </div>

        <Section id="overview" title="what is qorb">
          <p>
            qorb is a coin launchpad on{" "}
            <strong className="text-stbl-shell">stable chain</strong> — the chain
            whose native gas token is the dollar. every pool pairs against the
            canonical erc20 usdt0 (6 decimals), so every price, raise, and fee
            on this platform is an exact dollar amount.
          </p>
          <p>
            anyone can launch a coin for free. the entire supply mints straight
            into a{" "}
            <strong className="text-stbl-shell">
              genuine uniswap v3 pool, permanently locked
            </strong>{" "}
            — no presale, no team allocation, no migration step, no rug lever.
            because the pools are real uniswap v3 pairs against usdt0, coins
            show up on dexscreener and every other terminal that indexes
            uniswap.
          </p>
        </Section>

        <Section id="launching" title="launching a coin">
          <p>
            pick a name, ticker, and image, and confirm one transaction.
            launching is free — you only pay network gas. that single
            transaction deploys the coin with a fixed{" "}
            <strong className="text-stbl-shell">1,000,000,000 supply</strong>,
            creates its uniswap v3 pool at a ~$4,000 starting market cap, mints
            the whole supply into the pool as a single-sided position, and
            locks that position in the locker contract forever.
          </p>
          <p>
            you can optionally make a <strong className="text-stbl-shell">dev buy</strong>{" "}
            in the same transaction: your usdt0 buys the very first coins
            atomically, before any sniper bot can front-run the launch. dev
            buys are pulled via erc20 transfer, so the launchpad needs a
            one-time usdt0 approval first — the app handles both steps.
          </p>
          <p>
            supply is fixed — no minting, no owner, no blacklist — and the coin
            address always ends in <code className="font-mono text-stbl-yolk">…5b1e</code>.
          </p>
        </Section>

        <Section id="pool" title="the bonding curve">
          <p>
            the bonding curve IS the pool. the launch position covers the price
            range from the ~$4,000 starting market cap all the way up, with all
            1b coins on the token side — exactly the shape of a bonding curve.
            buys pay usdt0 into the pool and walk the price up the curve; sells
            walk it back down. it&apos;s uniswap v3 doing the math, in a
            position nobody can ever pull.
          </p>
          <p>
            anti-snipe: buys in the launch block are blocked outright, and for
            the first 2 minutes each wallet can hold at most 2% of supply (the
            creator&apos;s atomic dev buy is exempt). sells are never
            restricted.
          </p>
        </Section>

        <Section id="graduation" title="graduation">
          <p>
            when the bonding curve has raised{" "}
            <strong className="text-stbl-shell">$12,000</strong> of usdt0, the
            coin <strong className="text-stbl-shell">graduates</strong>. nothing
            migrates and trading never pauses — the same pool keeps trading
            before and after. the badge tells you the coin cleared the bar; the
            liquidity was locked from block one either way.
          </p>
        </Section>

        <Section id="token-types" title="token types">
          <p>
            <strong className="text-stbl-shell">clean coin</strong> — the launch
            option live today. a fully clean erc20: no transfer tax, no owner,
            no tricks, ever. only the pool&apos;s standard 1% swap fee applies.
          </p>
          <p>
            the contracts also support two lp-growing flavors —{" "}
            <strong className="text-stbl-shell">lp grow</strong> (the
            platform&apos;s share of pool fees compounds back into the locked
            position) and <strong className="text-stbl-shell">super lp</strong>{" "}
            (a 5% buy tax that swap-and-liquifies into the locked position).
            they&apos;re hidden from the launch flow for now and will roll out
            later; everything below applies to all three.
          </p>
        </Section>

        <Section id="fees" title="fees">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stbl-700 font-mono text-[10px] lowercase tracking-wide text-stbl-shell/50">
                  <th className="py-2 pr-4 font-semibold">action</th>
                  <th className="py-2 pr-4 font-semibold">fee</th>
                  <th className="py-2 font-semibold">goes to</th>
                </tr>
              </thead>
              <tbody className="text-stbl-shell/75">
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">launching a coin</td>
                  <td className="py-2 pr-4 font-mono">free</td>
                  <td className="py-2">— (gas only)</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">every swap</td>
                  <td className="py-2 pr-4 font-mono">1%</td>
                  <td className="py-2">
                    the locked position — collected as 50% creator, 50% platform
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">graduation</td>
                  <td className="py-2 pr-4 font-mono">$0</td>
                  <td className="py-2">— (nothing migrates)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            the 1% is the uniswap v3 fee tier of every launch pool. it accrues
            to the locked position and{" "}
            <code className="font-mono">collect()</code> on the locker is
            permissionless — anyone can trigger it. the coin-side fees are
            auto-sold into the pool by the locker itself (price-impact capped),
            so both shares arrive as{" "}
            <strong className="text-stbl-shell">pure usdt0</strong> and the
            creator&apos;s wallet never shows up as a seller. nothing is
            custodied and there is no claim deadline; creators collect from
            their coin&apos;s page.
          </p>
        </Section>

        <Section id="trading-tips" title="trading tips">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              quotes are estimates computed from the pool&apos;s live price and
              liquidity — the router enforces your min-received on-chain, so
              set slippage to taste.
            </li>
            <li>
              your first buy needs a one-time usdt0 approval for the router
              (buys pull erc20 usdt0, not native gas). the trade widget walks
              you through it: first tap approves, second executes.
            </li>
            <li>
              in the first 2 minutes after a launch, a wallet can hold at most
              2% of supply — oversized early buys revert.
            </li>
          </ul>
        </Section>

        <Section id="contracts" title="contracts & addresses">
          <p>the stack is four of our contracts on top of genuine uniswap v3:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="font-mono text-stbl-yolk">StableLaunchpad</code> —
              deploys the coin, creates + seeds the pool, executes dev buys,
              reports graduation
            </li>
            <li>
              <code className="font-mono text-stbl-yolk">StableLaunchToken</code> —
              the fixed-supply erc20 (anti-snipe window, optional flavor tax)
            </li>
            <li>
              <code className="font-mono text-stbl-yolk">StableLocker</code> —
              holds every launch position forever; permissionless fee
              collection with the 50/50 split
            </li>
            <li>
              <code className="font-mono text-stbl-yolk">StableRouter</code> —
              thin usdt0-side swap helper (approve + single call, no wrapping)
            </li>
          </ul>
          <p>external, on stable mainnet:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="font-mono">UniswapV3Factory</code> —{" "}
              <code className="font-mono text-stbl-yolk">0x88F0a512eF09175D456bc9547f914f48C013E4aA</code>{" "}
              (byte-identical to the ethereum deployment)
            </li>
            <li>
              <code className="font-mono">USDT0 (erc20, 6 decimals)</code> —{" "}
              <code className="font-mono text-stbl-yolk">0x779Ded0c9e1022225f8E0630b35a9b54bE713736</code>
            </li>
          </ul>
          <p>
            our mainnet addresses are published here and in the app config the
            moment we deploy — currently running final verification. every
            contract is source-verified on{" "}
            <a href="https://stablescan.xyz" target="_blank" rel="noreferrer" className="text-stbl-orange underline">
              stablescan
            </a>{" "}
            at deploy time.
          </p>
        </Section>

        <Section id="build-launchpad" title="launchpad integration">
          <p>the surface you need for launches and progress tracking:</p>
          <Code>{`interface IStableLaunchpad {
  enum Flavor { Standard, LPGrow, SuperLP }

  // one tx: deploy (CREATE2) + pool + lock + optional dev buy.
  // devBuyUsd is 6-decimal USDT0, pulled via transferFrom —
  // approve(launchpad, devBuyUsd) first.
  function launchToken(
    string name, string symbol, string metadataURI,
    Flavor flavor, bytes32 salt,
    uint256 devBuyUsd, uint256 minDevBuyTokens
  ) external returns (address token);

  // deterministic address for a salt (vanity mining); creator must
  // be the wallet that will call launchToken.
  function predictTokenAddress(
    string name, string symbol, string metadataURI,
    Flavor flavor, bytes32 salt, address creator
  ) external view returns (address);

  // graduation progress: USDT0 raised on the bonding curve
  function graduationStatus(address token) external view returns (
    uint256 usdPrincipal, uint256 threshold, bool graduated
  );

  function launches(address token) external view returns (
    address creator, address pool, uint8 flavor,
    uint40 createdAt, bool isToken0
  );
  function locker() external view returns (address);
  function usdt0() external view returns (address);
}`}</Code>
          <p>launching with viem:</p>
          <Code>{`await wallet.writeContract({
  address: USDT0, abi: erc20Abi, functionName: "approve",
  args: [LAUNCHPAD, 500_000000n],              // $500, 6 decimals
});
await wallet.writeContract({
  address: LAUNCHPAD, abi, functionName: "launchToken",
  args: ["Steed Coin", "STEED", "ipfs://…", 0, salt,
         500_000000n, minTokensOut],
});`}</Code>
        </Section>

        <Section id="build-trading" title="trading integration">
          <p>
            coins trade on their uniswap v3 pool from the first block. our
            router is the simplest path — usdt0 on one side, the coin on the
            other, one hop, no wrapping:
          </p>
          <Code>{`interface IStableRouter {
  // pulls usdIn (6-dec USDT0) via transferFrom, sends coins to recipient
  function buyExactUsd(address token, uint24 fee, uint256 usdIn,
    uint256 minTokensOut, address recipient)
    external returns (uint256 tokensOut);

  // pulls amountIn coins via transferFrom, sends USDT0 to recipient
  function sellExactTokens(address token, uint24 fee, uint256 amountIn,
    uint256 minUsdOut, address recipient)
    external returns (uint256 usdOut);
}`}</Code>
          <p>
            <code className="font-mono">fee</code> is always{" "}
            <code className="font-mono">10000</code> (the 1% tier). both calls
            need a one-time erc20 approval for the input side. any standard
            uniswap v3 integration works too — find the pool with{" "}
            <code className="font-mono">factory.getPool(token, USDT0, 10000)</code>{" "}
            or <code className="font-mono">launchpad.launches(token)</code>, and
            remember the decimal gap: the coin has 18 decimals, usdt0 has 6, so
            usd-per-coin = raw v3 price × 1e12 (token side = token0) or its
            inverse × 1e12.
          </p>
        </Section>

        <Section id="http-api" title="http api">
          <p>
            the app&apos;s indexer exposes read-only json endpoints — free to
            integrate, no key needed. raw dollar fields (
            <code className="font-mono">usdWei</code>) are 6-decimal usdt0
            strings; <code className="font-mono">…Usd</code> fields are plain
            floats.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stbl-700 font-mono text-[10px] lowercase tracking-wide text-stbl-shell/50">
                  <th className="py-2 pr-4 font-semibold">endpoint</th>
                  <th className="py-2 font-semibold">returns</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs text-stbl-shell/75">
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/tokens?status=all|live|graduated&sort=activity|new|gainers|marketcap|volume|progress&limit=60</td>
                  <td className="py-2">coin list + lead coin</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/trending</td>
                  <td className="py-2">top coins by 5-minute volume</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/tokens/:address</td>
                  <td className="py-2">one coin + top holders</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/tokens/:address/trades?limit=40</td>
                  <td className="py-2">trade feed</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/tokens/:address/candles?res=60</td>
                  <td className="py-2">ohlcv candles (res in seconds: 1…86400)</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/trades?limit=12</td>
                  <td className="py-2">global live trades + platform stats</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/search?q=…</td>
                  <td className="py-2">search by name, ticker, or address</td>
                </tr>
                <tr className="border-b border-stbl-800">
                  <td className="py-2 pr-4">GET /api/curve/portfolio/:address</td>
                  <td className="py-2">holdings + created coins for a wallet</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">GET /api/curve/analytics?period=24h|7d|30d|all</td>
                  <td className="py-2">platform volume, launches, revenue</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            coin objects carry: <code className="font-mono">address, name, symbol,
            flavor (standard|lpGrow|superLp), phase (trading|graduated),
            priceUsd, marketCapUsd, progress, raisedUsd, volumeUsd, change24h,
            pair (the v3 pool), imageUrl</code> and social links.
          </p>
        </Section>

        <Section id="events" title="on-chain events">
          <p>running your own indexer? watch these:</p>
          <Code>{`// StableLaunchpad — one per launch; strings live on the token
event TokenLaunched(address indexed token, address indexed creator,
  address pool, uint8 flavor, uint256 devBuyUsd, uint256 devBuyTokens);

// UniswapV3Pool (each coin's pool) — the standard v3 swap event
event Swap(address indexed sender, address indexed recipient,
  int256 amount0, int256 amount1, uint160 sqrtPriceX96,
  uint128 liquidity, int24 tick);

// StableLocker — fee collections and Super LP tax compounds
event FeesCollected(address indexed token,
  uint256 collected0, uint256 collected1,
  uint256 reinvested0, uint256 reinvested1, uint128 liquidityAdded);
event TaxCompounded(address indexed token,
  uint256 tokensAdded, uint256 pairAdded, uint128 liquidityAdded);`}</Code>
          <p>
            price from a swap: <code className="font-mono">p = (sqrtPriceX96 / 2^96)^2</code>{" "}
            is token1-per-token0 in raw units; usd per whole coin is{" "}
            <code className="font-mono">p × 1e12</code> when the coin is token0,
            else <code className="font-mono">(1/p) × 1e12</code>. the usdt0 leg
            of <code className="font-mono">amount0/amount1</code> tells you buy
            (usdt0 in, positive) vs sell.
          </p>
        </Section>

        <Section id="risk" title="risk, plainly">
          <p>
            coins launched here are speculative and most will lose value. smart
            contracts can contain bugs; the platform&apos;s contracts have not
            undergone a formal third-party audit. blockchain transactions are
            irreversible. never trade more than you can afford to lose — see
            the{" "}
            <Link href="/terms" className="text-stbl-orange underline">
              terms of service
            </Link>{" "}
            for the full risk disclosure.
          </p>
        </Section>
      </div>
    </div>
  );
}
