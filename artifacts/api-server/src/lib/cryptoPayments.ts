import {
  createPublicClient,
  http,
  parseAbiItem,
  parseEventLogs,
  formatUnits,
  type Chain,
} from "viem";
import { polygon, mainnet, bsc } from "viem/chains";

/**
 * On-chain USDT (ERC-20) payment verification for Web3 crypto checkout.
 *
 * There is no trusted callback for a wallet-to-wallet transfer, so a customer
 * pays a unique dust-suffixed amount to a THEA receiving wallet and submits the
 * transaction hash. We then verify the transfer directly against the chain.
 *
 * Everything is env-configurable so the chain can change without code edits;
 * Polygon PoS is the default (low fees, USDT = 6 decimals).
 */

const CHAINS: Record<string, Chain> = {
  polygon,
  ethereum: mainnet,
  mainnet,
  bsc,
};

const DEFAULT_USDT: Record<string, string> = {
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  mainnet: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  bsc: "0x55d398326f99059fF775485246999027B3197955",
};

export interface CryptoConfig {
  chain: string;
  viemChain: Chain;
  rpcUrl: string;
  /** ERC-20 USDT contract address (lowercased). */
  tokenAddress: string;
  /** THEA receiving wallet address (lowercased). */
  receivingAddress: string;
  decimals: number;
  minConfirmations: number;
  intentTtlMinutes: number;
}

export function getCryptoConfig(): CryptoConfig | null {
  const chain = (process.env.CRYPTO_CHAIN || "polygon").toLowerCase();
  const viemChain = CHAINS[chain];
  const rpcUrl = process.env.CRYPTO_RPC_URL || process.env.POLYGON_RPC_URL || "";
  const receivingAddress = (process.env.CRYPTO_RECEIVING_ADDRESS || "").toLowerCase();
  const tokenAddress = (process.env.CRYPTO_USDT_ADDRESS || DEFAULT_USDT[chain] || "").toLowerCase();
  const decimals = Number(process.env.CRYPTO_USDT_DECIMALS || "6");
  const minConfirmations = Number(process.env.CRYPTO_MIN_CONFIRMATIONS || "30");
  const intentTtlMinutes = Number(process.env.CRYPTO_INTENT_TTL_MIN || "1440");

  if (!viemChain || !rpcUrl || !receivingAddress || !tokenAddress) return null;

  return {
    chain,
    viemChain,
    rpcUrl,
    tokenAddress,
    receivingAddress,
    decimals,
    minConfirmations,
    intentTtlMinutes,
  };
}

export function formatUsdt(baseUnits: bigint, decimals: number): string {
  return formatUnits(baseUnits, decimals);
}

export interface VerifyArgs {
  /** Already lowercase-normalized 0x… hash. */
  txHash: string;
  expectedBaseUnits: bigint;
  createdAt: Date;
}

export type VerifyResult = { ok: true; valueBaseUnits: string } | { ok: false; reason: string };

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/**
 * Verify that `txHash` contains a confirmed USDT Transfer of at least
 * `expectedBaseUnits` to our receiving address, mined after the intent was
 * created. Each check closes a specific attack:
 *  - status === success           → not a reverted tx
 *  - >= minConfirmations          → not a re-org-able / unmined tx
 *  - log.address === USDT token   → not a spoofed fake-token transfer
 *  - to === receivingAddress      → funds actually reached us
 *  - value >= expected (dust)     → correct amount, bound to this intent
 *  - block time >= intent created → not a replayed old transaction
 */
export async function verifyUsdtPayment(cfg: CryptoConfig, args: VerifyArgs): Promise<VerifyResult> {
  const client = createPublicClient({ chain: cfg.viemChain, transport: http(cfg.rpcUrl) });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: args.txHash as `0x${string}` });
  } catch {
    return { ok: false, reason: "Transaction not found yet — it may still be pending" };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "Transaction failed on-chain" };
  }

  const currentBlock = await client.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1n;
  if (confirmations < BigInt(cfg.minConfirmations)) {
    return {
      ok: false,
      reason: `Waiting for confirmations (${confirmations.toString()}/${cfg.minConfirmations})`,
    };
  }

  const events = parseEventLogs({ abi: [TRANSFER_EVENT], logs: receipt.logs, eventName: "Transfer" });
  const match = events.find(
    (e) =>
      e.address.toLowerCase() === cfg.tokenAddress &&
      (e.args.to as string).toLowerCase() === cfg.receivingAddress &&
      (e.args.value as bigint) >= args.expectedBaseUnits,
  );
  if (!match) {
    return {
      ok: false,
      reason: "No matching USDT transfer of the required amount to the receiving address was found",
    };
  }

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const txMs = Number(block.timestamp) * 1000;
  // Allow small clock skew; the transfer must not predate the payment request.
  if (txMs < args.createdAt.getTime() - 15 * 60 * 1000) {
    return { ok: false, reason: "Transaction predates this payment request" };
  }

  return { ok: true, valueBaseUnits: (match.args.value as bigint).toString() };
}
