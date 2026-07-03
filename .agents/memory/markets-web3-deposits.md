---
name: Markets web3 wallet-picker deposits
description: How the Markets custodial crypto-deposit UI connects wallets and sends real transfers (no wagmi)
---

# Markets web3 deposit UI

Real-money custodial deposits on `artifacts/markets`. User picks a wallet, connects,
and sends a REAL on-chain transfer of the EXACT intent amount to a receiving address.

## Wallet connection — deliberately NO wagmi/RainbowKit
- Uses raw **EIP-6963** discovery (`eip6963:announceProvider` / `requestProvider`) plus a
  `window.ethereum(.providers[])` fallback. Kept dependency-light on purpose; only `viem`
  is added, and ONLY for `encodeFunctionData` (ERC20 transfer calldata) + `numberToHex`.
- **Why:** wagmi pulls a large dep tree and its own connect UX; a hand-rolled picker
  matches the required custom modal (CG Wallet, MetaMask, Trust, SafePal, Coinbase, Brave).
- CG Wallet's rdns / injected flag is undocumented — matched heuristically by several
  candidate rdns, a name substring, and guessed injected flags; no match → install link
  to https://cryptogenieai.com/wallet/extension. Prefer EIP-6963 over injected flags
  because many wallets set `isMetaMask=true`.

## Sending the deposit
- **How to apply:** map coin.chain → chainId hex (ethereum `0x1`, bsc `0x38`);
  `wallet_switchEthereumChain`, on 4902 `wallet_addEthereumChain` then switch.
  **Re-check `eth_chainId` immediately before send** — user can switch mid-flow and the
  exact-amount transfer on the wrong chain is unrecoverable.
- native → `eth_sendTransaction {to: receivingAddress, value: hex(amountBaseUnits)}`;
  erc20 → `{to: tokenAddress, value: 0x0, data: transfer(receivingAddress, amountBaseUnits)}`.
  Always BigInt from `amountBaseUnits` (exact incl. dust). BTC = manual address + paste txHash.

## Verify-grace safety (backend `deposits.ts`)
- Verify keeps a long grace window (`VERIFY_GRACE_MIN`) AFTER the display TTL before it
  hard-410s. **Why:** a tx broadcast in time but confirming slowly must still credit.
  Safe because on-chain check requires an EXACT dust-unique amount to the receiving
  address, each tx hash credits ≤1 intent, and any block predating the request is rejected.

## Admin config
- Deposit receiving addresses / RPC / price overrides live under the NEW `deposits` config
  category (admin-ui api-keys page auto-renders by category). A coin only appears in
  `/deposit/coins` once its address (+RPC/price where required) is set — no code change to
  go live.
