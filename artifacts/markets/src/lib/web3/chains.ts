import { encodeFunctionData, numberToHex, type Abi } from "viem";
import type { Eip1193Provider } from "./providers";

export type EvmChain = "ethereum" | "bsc";

interface EvmChainMeta {
  chainIdHex: string;
  addParams: {
    chainId: string;
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  };
}

const EVM_CHAINS: Record<EvmChain, EvmChainMeta> = {
  ethereum: {
    chainIdHex: "0x1",
    addParams: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://cloudflare-eth.com"],
      blockExplorerUrls: ["https://etherscan.io"],
    },
  },
  bsc: {
    chainIdHex: "0x38",
    addParams: {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed.binance.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    },
  },
};

export function isEvmChain(chain: string): chain is EvmChain {
  return chain === "ethereum" || chain === "bsc";
}

export function chainLabel(chain: string): string {
  if (chain === "ethereum") return "Ethereum";
  if (chain === "bsc") return "BNB Smart Chain";
  if (chain === "bitcoin") return "Bitcoin";
  return chain;
}

export function explorerTxUrl(chain: string, txHash: string): string | null {
  if (chain === "ethereum") return `https://etherscan.io/tx/${txHash}`;
  if (chain === "bsc") return `https://bscscan.com/tx/${txHash}`;
  if (chain === "bitcoin") return `https://mempool.space/tx/${txHash}`;
  return null;
}

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

interface ProviderError {
  code?: number;
  message?: string;
}

export async function getChainId(provider: Eip1193Provider): Promise<string> {
  const id = (await provider.request({ method: "eth_chainId" })) as string;
  return String(id).toLowerCase();
}

/** Ensure the wallet is on the target EVM chain, adding it if unknown (4902). */
export async function ensureChain(provider: Eip1193Provider, chain: EvmChain): Promise<void> {
  const meta = EVM_CHAINS[chain];
  if ((await getChainId(provider)) === meta.chainIdHex) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: meta.chainIdHex }],
    });
  } catch (err) {
    const e = err as ProviderError;
    if (e?.code === 4902) {
      await provider.request({ method: "wallet_addEthereumChain", params: [meta.addParams] });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: meta.chainIdHex }],
      });
    } else {
      throw err;
    }
  }
}

export interface SendParams {
  provider: Eip1193Provider;
  from: string;
  chain: EvmChain;
  kind: "native" | "erc20";
  receivingAddress: string;
  tokenAddress: string | null;
  /** EXACT amount in coin base units, including the intent's dust suffix. */
  amountBaseUnits: string;
}

/**
 * Send the EXACT deposit amount from the connected wallet, returning the tx
 * hash. Re-checks the active chain immediately before dispatch — the user can
 * switch networks mid-flow, and sending the exact amount on the wrong chain
 * would send funds that never match the intent.
 */
export async function sendDeposit(params: SendParams): Promise<string> {
  const { provider, from, chain, kind, receivingAddress, tokenAddress, amountBaseUnits } = params;
  await ensureChain(provider, chain);
  if ((await getChainId(provider)) !== EVM_CHAINS[chain].chainIdHex) {
    throw new Error(`Wrong network — please switch to ${chainLabel(chain)} and try again`);
  }

  const value = BigInt(amountBaseUnits);
  let tx: Record<string, string>;
  if (kind === "native") {
    tx = { from, to: receivingAddress, value: numberToHex(value) };
  } else {
    if (!tokenAddress) throw new Error("Missing token contract address");
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [receivingAddress as `0x${string}`, value],
    });
    tx = { from, to: tokenAddress, value: "0x0", data };
  }

  return (await provider.request({ method: "eth_sendTransaction", params: [tx] })) as string;
}
