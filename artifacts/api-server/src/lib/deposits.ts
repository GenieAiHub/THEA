import {
  createPublicClient,
  http,
  parseAbiItem,
  parseEventLogs,
  type Chain,
} from "viem";
import { mainnet, bsc } from "viem/chains";
import { getPlatformConfig, getPlatformConfigNumber } from "./platform-config";
import { USD_MICRO, usdToMicro } from "./wallet";

/**
 * Multi-coin custodial deposits for the real-money markets wallet.
 *
 * Four coins credit a single USD-pegged balance:
 *  - btc       native BTC, verified via mempool.space (keyless)
 *  - eth       native ETH, verified via viem on Ethereum mainnet
 *  - bsc_usdt  BEP-20 USDT on BSC (price = $1)
 *  - cg        Crypto Genie BEP-20 token on BSC (admin-set USD rate)
 *
 * Everything is resolved from `platform_configs` (admin-editable, env fallback),
 * so a coin is simply "not available" until its receiving address / RPC /
 * contract / price are configured — no code change required to go live.
 */

export type DepositCoin = "btc" | "eth" | "bsc_usdt" | "cg";
export const DEPOSIT_COINS: DepositCoin[] = ["btc", "eth", "bsc_usdt", "cg"];

type PriceKind = "coingecko" | "stable" | "manual";

interface CoinDef {
  coin: DepositCoin;
  label: string;
  chain: string; // 'bitcoin' | 'ethereum' | 'bsc'
  kind: "native" | "erc20";
  decimalsDefault: number;
  addressKey: string;
  rpcKey?: string;
  tokenKey?: string;
  decimalsKey?: string;
  minConfKey: string;
  minConfDefault: number;
  priceKind: PriceKind;
  coingeckoId?: string;
  priceKey?: string;
  defaultTokenAddress?: string;
  viemChain?: Chain;
}

const COINS: Record<DepositCoin, CoinDef> = {
  btc: {
    coin: "btc",
    label: "Bitcoin (BTC)",
    chain: "bitcoin",
    kind: "native",
    decimalsDefault: 8,
    addressKey: "btc_receiving_address",
    minConfKey: "btc_min_confirmations",
    minConfDefault: 3,
    priceKind: "coingecko",
    coingeckoId: "bitcoin",
    priceKey: "btc_price_usd",
  },
  eth: {
    coin: "eth",
    label: "Ethereum (ETH)",
    chain: "ethereum",
    kind: "native",
    decimalsDefault: 18,
    addressKey: "eth_receiving_address",
    rpcKey: "eth_rpc_url",
    minConfKey: "eth_min_confirmations",
    minConfDefault: 12,
    priceKind: "coingecko",
    coingeckoId: "ethereum",
    priceKey: "eth_price_usd",
    viemChain: mainnet,
  },
  bsc_usdt: {
    coin: "bsc_usdt",
    label: "USDT (BSC · BEP-20)",
    chain: "bsc",
    kind: "erc20",
    decimalsDefault: 18,
    addressKey: "bsc_receiving_address",
    rpcKey: "bsc_rpc_url",
    tokenKey: "bsc_usdt_address",
    decimalsKey: "bsc_usdt_decimals",
    minConfKey: "bsc_min_confirmations",
    minConfDefault: 15,
    priceKind: "stable",
    defaultTokenAddress: "0x55d398326f99059ff775485246999027b3197955",
    viemChain: bsc,
  },
  cg: {
    coin: "cg",
    label: "Crypto Genie (CG · BEP-20)",
    chain: "bsc",
    kind: "erc20",
    decimalsDefault: 18,
    addressKey: "bsc_receiving_address",
    rpcKey: "bsc_rpc_url",
    tokenKey: "cg_token_address",
    decimalsKey: "cg_token_decimals",
    minConfKey: "bsc_min_confirmations",
    minConfDefault: 15,
    priceKind: "manual",
    priceKey: "cg_price_usd",
    viemChain: bsc,
  },
};

export interface ResolvedCoin {
  coin: DepositCoin;
  label: string;
  chain: string;
  kind: "native" | "erc20";
  decimals: number;
  receivingAddress: string;
  tokenAddress: string | null;
  rpcUrl: string | null;
  minConfirmations: number;
  viemChain: Chain | null;
  priceKind: PriceKind;
  coingeckoId: string | null;
  priceKey: string | null;
}

const DECIMAL_RE = /^\d+(\.\d+)?$/;

/**
 * Resolve a coin's live config, or `null` if it isn't fully configured (and is
 * therefore unavailable for deposits).
 */
export async function resolveCoin(coin: DepositCoin): Promise<ResolvedCoin | null> {
  const def = COINS[coin];
  if (!def) return null;

  const rawAddr = (await getPlatformConfig(def.addressKey))?.trim();
  if (!rawAddr) return null;
  const isBtc = def.chain === "bitcoin";
  const receivingAddress = isBtc ? rawAddr : rawAddr.toLowerCase();

  let rpcUrl: string | null = null;
  if (def.rpcKey) {
    rpcUrl = (await getPlatformConfig(def.rpcKey))?.trim() || null;
    if (!rpcUrl) return null;
  }

  let tokenAddress: string | null = null;
  if (def.kind === "erc20") {
    tokenAddress =
      ((await getPlatformConfig(def.tokenKey!)) ?? def.defaultTokenAddress ?? "")
        .trim()
        .toLowerCase() || null;
    if (!tokenAddress) return null;
  }

  const decimals = def.decimalsKey
    ? await getPlatformConfigNumber(def.decimalsKey, def.decimalsDefault)
    : def.decimalsDefault;
  const minConfirmations = await getPlatformConfigNumber(def.minConfKey, def.minConfDefault);

  // A manual-priced coin (CG) is unavailable until its USD rate is set.
  if (def.priceKind === "manual") {
    const price = def.priceKey ? (await getPlatformConfig(def.priceKey))?.trim() : null;
    if (!price || !DECIMAL_RE.test(price)) return null;
  }

  return {
    coin,
    label: def.label,
    chain: def.chain,
    kind: def.kind,
    decimals,
    receivingAddress,
    tokenAddress,
    rpcUrl,
    minConfirmations,
    viemChain: def.viemChain ?? null,
    priceKind: def.priceKind,
    coingeckoId: def.coingeckoId ?? null,
    priceKey: def.priceKey ?? null,
  };
}

// ---- Pricing -------------------------------------------------------------

const priceCache = new Map<string, { usd: number; expiresAt: number }>();
const PRICE_TTL_MS = 60 * 1000;

async function coingeckoUsd(id: string): Promise<number | null> {
  const cached = priceCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.usd;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usd?: number }>;
    const usd = json?.[id]?.usd;
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return null;
    priceCache.set(id, { usd, expiresAt: Date.now() + PRICE_TTL_MS });
    return usd;
  } catch {
    return null;
  }
}

/**
 * Spot price as micro-USD per 1 whole coin (e.g. $3,000.50 → 3_000_500_000n).
 * An admin override config value always wins over the live market feed.
 */
export async function getSpotUsdMicro(r: ResolvedCoin): Promise<bigint | null> {
  if (r.priceKey) {
    const override = (await getPlatformConfig(r.priceKey))?.trim();
    if (override && DECIMAL_RE.test(override)) return usdToMicro(override);
  }
  if (r.priceKind === "stable") return USD_MICRO;
  if (r.priceKind === "manual") return null; // required override missing
  if (!r.coingeckoId) return null;
  const usd = await coingeckoUsd(r.coingeckoId);
  if (usd == null) return null;
  return usdToMicro(usd.toFixed(6));
}

// ---- Verification --------------------------------------------------------

export interface VerifyArgs {
  /** Normalized tx hash (lowercased; EVM incl. 0x prefix, BTC without). */
  txHash: string;
  /** EXACT expected amount in coin base units (incl. dust suffix). */
  expectedBaseUnits: bigint;
  createdAt: Date;
}

export type DepositVerifyResult =
  | { ok: true; valueBaseUnits: bigint }
  // `matched` = the chain already proves this tx pays THIS intent's exact
  // dust-unique amount to the receiving address (only finality is pending).
  // The caller may safely bind the hash to the intent once matched — nobody but
  // the real depositor can produce a tx with the unique amount.
  | { ok: false; reason: string; matched?: boolean };

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

async function verifyErc20(r: ResolvedCoin, args: VerifyArgs): Promise<DepositVerifyResult> {
  const client = createPublicClient({ chain: r.viemChain!, transport: http(r.rpcUrl!) });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: args.txHash as `0x${string}` });
  } catch {
    return { ok: false, reason: "Transaction not found yet — it may still be pending" };
  }
  if (receipt.status !== "success") return { ok: false, reason: "Transaction failed on-chain" };

  // Prove the exact-amount/address match BEFORE checking finality so a matched
  // but not-yet-final tx can be reported as `matched` (see DepositVerifyResult).
  const events = parseEventLogs({ abi: [TRANSFER_EVENT], logs: receipt.logs, eventName: "Transfer" });
  const match = events.find(
    (e) =>
      e.address.toLowerCase() === r.tokenAddress &&
      (e.args.to as string).toLowerCase() === r.receivingAddress &&
      (e.args.value as bigint) === args.expectedBaseUnits,
  );
  if (!match) {
    return {
      ok: false,
      reason: "No token transfer of the exact requested amount to the deposit address was found",
    };
  }

  const currentBlock = await client.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1n;
  if (confirmations < BigInt(r.minConfirmations)) {
    return {
      ok: false,
      matched: true,
      reason: `Waiting for confirmations (${confirmations.toString()}/${r.minConfirmations})`,
    };
  }

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (Number(block.timestamp) * 1000 < args.createdAt.getTime() - 15 * 60 * 1000) {
    return { ok: false, matched: true, reason: "Transaction predates this deposit request" };
  }
  return { ok: true, valueBaseUnits: match.args.value as bigint };
}

async function verifyNativeEvm(r: ResolvedCoin, args: VerifyArgs): Promise<DepositVerifyResult> {
  const client = createPublicClient({ chain: r.viemChain!, transport: http(r.rpcUrl!) });
  let tx, receipt;
  try {
    tx = await client.getTransaction({ hash: args.txHash as `0x${string}` });
    receipt = await client.getTransactionReceipt({ hash: args.txHash as `0x${string}` });
  } catch {
    return { ok: false, reason: "Transaction not found yet — it may still be pending" };
  }
  if (receipt.status !== "success") return { ok: false, reason: "Transaction failed on-chain" };

  // Prove the exact-amount/address match BEFORE checking finality so a matched
  // but not-yet-final tx can be reported as `matched` (see DepositVerifyResult).
  if (!tx.to || tx.to.toLowerCase() !== r.receivingAddress) {
    return { ok: false, reason: "Transaction was not sent to the deposit address" };
  }
  if (tx.value !== args.expectedBaseUnits) {
    return {
      ok: false,
      reason: "No transfer of the exact requested amount to the deposit address was found",
    };
  }

  const currentBlock = await client.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1n;
  if (confirmations < BigInt(r.minConfirmations)) {
    return {
      ok: false,
      matched: true,
      reason: `Waiting for confirmations (${confirmations.toString()}/${r.minConfirmations})`,
    };
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (Number(block.timestamp) * 1000 < args.createdAt.getTime() - 15 * 60 * 1000) {
    return { ok: false, matched: true, reason: "Transaction predates this deposit request" };
  }
  return { ok: true, valueBaseUnits: tx.value };
}

interface MempoolVout {
  scriptpubkey_address?: string;
  value?: number;
}
interface MempoolTx {
  vout?: MempoolVout[];
  status?: { confirmed?: boolean; block_height?: number; block_time?: number };
}

async function verifyBtc(r: ResolvedCoin, args: VerifyArgs): Promise<DepositVerifyResult> {
  const base = "https://mempool.space/api";
  let tx: MempoolTx;
  try {
    const res = await fetch(`${base}/tx/${args.txHash}`, { headers: { accept: "application/json" } });
    if (res.status === 404) {
      return { ok: false, reason: "Transaction not found yet — it may still be pending" };
    }
    if (!res.ok) return { ok: false, reason: "Could not reach the Bitcoin network — please retry" };
    tx = (await res.json()) as MempoolTx;
  } catch {
    return { ok: false, reason: "Could not reach the Bitcoin network — please retry" };
  }

  const total = (tx.vout ?? [])
    .filter((v) => (v.scriptpubkey_address ?? "") === r.receivingAddress)
    .reduce((sum, v) => sum + BigInt(v.value ?? 0), 0n);
  if (total !== args.expectedBaseUnits) {
    return {
      ok: false,
      reason: "No payment of the exact requested amount to the deposit address was found",
    };
  }
  if (!tx.status?.confirmed) {
    return {
      ok: false,
      matched: true,
      reason: "Waiting for the transaction to be confirmed in a block",
    };
  }

  let tipHeight = NaN;
  try {
    tipHeight = parseInt(await (await fetch(`${base}/blocks/tip/height`)).text(), 10);
  } catch {
    /* fall through — treat as 0 confirmations */
  }
  const blockHeight = tx.status.block_height ?? 0;
  const confirmations =
    Number.isFinite(tipHeight) && blockHeight ? tipHeight - blockHeight + 1 : 0;
  if (confirmations < r.minConfirmations) {
    return {
      ok: false,
      matched: true,
      reason: `Waiting for confirmations (${Math.max(0, confirmations)}/${r.minConfirmations})`,
    };
  }
  const blockMs = (tx.status.block_time ?? 0) * 1000;
  if (blockMs && blockMs < args.createdAt.getTime() - 15 * 60 * 1000) {
    return { ok: false, matched: true, reason: "Transaction predates this deposit request" };
  }
  return { ok: true, valueBaseUnits: total };
}

/** Dispatch to the right on-chain verifier for a coin. */
export async function verifyDeposit(
  r: ResolvedCoin,
  args: VerifyArgs,
): Promise<DepositVerifyResult> {
  if (r.chain === "bitcoin") return verifyBtc(r, args);
  if (r.kind === "native") return verifyNativeEvm(r, args);
  return verifyErc20(r, args);
}
