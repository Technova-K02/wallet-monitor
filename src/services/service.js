import logger from "../utils/logger.js";
import { ethers } from "ethers";
import { broadcastTx } from "../websocket/socketManager.js";
import dotenv from 'dotenv';

dotenv.config();

// =============== CONFIG ===============
const RPC = {
  ethereum: process.env.ETH_MAIN_RPC,
  binance: process.env.BSC_MAIN_RPC,
  solana: process.env.SOLANA_MAIN_RPC,
  tron: process.env.TRON_MAIN_RPC,
  bitcoin: "https://api.blockcypher.com/v1/", // needs local full node
  litecoin: "https://api.blockcypher.com/v1/"  // needs local full node
};

const cypher_token = ['3517d8d5ed8f40eabf0770256c8f668f', 'd45d4af9aabd46ddadf65bedc7f09a29', 'b0936e201ef74a309af89c32d6bfa82c', '10b2adb9c0e94b6d9b63117bbfc807b0', 'baea0793428c47f8833ddc000283f42e', '22e2ddc9913e480f82c85b18d4011b34', '9f01817790f84bb8b86ee65aeb24cc36', '2e683b54aeeb45a8b5f62cc8c10fb3ac', '77a558492df44b6e8ccbd1169d7a8676', '6f31c3e2af244d3290e1ff71b6c9e16c'];
let cypher_token_count = 0;

const watch = {
  ethereum: [process.env.WALLET_ETH_1].map(a => a.toLowerCase()),
  binance: [process.env.WALLET_BSC_1].map(a => a.toLowerCase()),
  solana: [process.env.WALLET_SOL_1], //, process.env.WALLET_SOL_2],
  tron: [process.env.WALLET_TRON_1],
  bitcoin: [process.env.WALLET_BTC_1],
  litecoin: [process.env.WALLET_LTC_1]
};

// =============== UTILITIES ===============
// Format timestamp in the style: 05 Nov 2025 • 10:33:45 PM (IST)
const formatTimestamp = () => {
  const now = new Date();
  const options = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  };

  const formatted = now.toLocaleString("en-GB", options);
  const [datePart, timePart] = formatted.split(", ");
  const timeFormatted = timePart.replace(/([ap])m/, (_, p1) => p1.toUpperCase() + "M");
  return `${datePart} • ${timeFormatted} (IST)`;
};

// ======================================
const getTokenFromChain = (chain) => {
  switch (chain) {
    case "bitcoin":
      return "BTC";
    case "ethereum":
      return "ETH";
    case "binance":
      return "BNB";
    case "tron":
      return "TRX";
    case "solana":
      return "SOL";
    case "litecoin":
      return "LTC";
    default:
      return chain;
  }
};
// =====================================
let id = 1;
async function rpc(url, method, params = [], auth = null) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = "Basic " + Buffer.from(auth).toString("base64");
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params })
  });
  const j = await r.json().catch(() => ({}));
  return j.result;
}


const processPendingTransaction = async (chain, token, tx) => {
  // logger.info(`${JSON.stringify(tx)}`);
  try {
    let value, from, to, hash;
    switch (token) {
      case 'ETH':
        {
          from = tx.from;
          to = tx.to;
          value = ethers.formatEther(tx.value);
          hash = tx.hash;
          break;
        }
      case 'BNB':
        {
          from = tx.from;
          to = tx.to;
          value = ethers.formatEther(tx.value);
          hash = tx.hash;
          break;
        }
      case 'TRX':
        {
          from = tx.raw_data.contract[0].parameter.value.owner_address;
          to = tx.raw_data.contract[0].parameter.value.to_address;
          value = tx.raw_data.contract[0].parameter.value.amount;
          hash = tx.signature[0];
          break;
        }
      case 'BTC':
        {
          if (tx.tx_output_n <= -1) return;
          from = '';
          to = watch[chain][0];
          value = tx.value / le8;
          hash = tx.tx_hash;
          break;
        }
      case 'LTC':
        {
          if (tx.tx_output_n <= -1) return;
          from = '';
          to = watch[chain][0];
          value = tx.value / le8;
          hash = tx.tx_hash;
          break;
        }
      default:
        { value = 0; from = ''; to = ''; hash = ''; }
    }
    // logger.info(`${value}, ${from}, ${to}, ${hash}, ${chain}, ${token}`);
    const txData = {
      chain: chain,
      token: token,
      status: "pending",
      hash: hash,
      from: from,
      to: to,
      value: value,
      network: chain,
      timestamp: formatTimestamp()
    };

    logger.transaction(`PENDING -> ${value} ${token}`, `${chain}`, {
      hash: hash,
      from: from,
      to: to,
      value: value
    });

    broadcastTx(txData);
  } catch (error) {
    logger.error("Error processing pending transaction", "ethereum", error);
  }
};

const processConfirmedTransaction = async (chain, token, tx, blockNumber, address = '') => {
  // logger.info(`${JSON.stringify(tx)}`);
  try {
    let value, from, to, hash;
    switch (token) {
      case 'ETH':
        {
          from = tx.from;
          to = tx.to;
          value = ethers.formatEther(tx.value);
          hash = tx.hash;
          break;
        }
      case 'BNB':
        {
          from = tx.from;
          to = tx.to;
          value = ethers.formatEther(tx.value);
          hash = tx.hash;
          break;
        }
      case 'TRX':
        {
          from = tx.raw_data.contract[0].parameter.value.owner_address;
          to = tx.raw_data.contract[0].parameter.value.to_address;
          value = tx.raw_data.contract[0].parameter.value.amount;
          value = value / 1000000;
          hash = tx.signature[0];
          break;
        }
      case 'SOL':
        {
          const idx = tx.transaction.message.accountKeys.indexOf(address);
          from = tx.transaction.message.accountKeys[0];
          to = tx.transaction.message.accountKeys[idx];
          let val = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
          value = val / 1000000000;
          logger.info(`${value}`);
          if (value <= 0) return;
          hash = tx.transaction.signatures[0];
          break;
        }
      case 'BTC':
        {
          if (tx.tx_output_n <= -1) return;
          from = "";
          to = watch[chain][0];
          value = tx.value / 1e8;
          hash = tx.tx_hash;
          break;
        }
      case 'LTC':
        {
          if (tx.tx_output_n <= -1) return;
          from = "";
          to = watch[chain][0];
          value = tx.value / 1e8;
          hash = tx.tx_hash;
          break;
        }
      default:
        { value = 0; from = ''; to = ''; hash = ''; }
    }
    // logger.info(`${value}, ${from}, ${to}, ${hash}, ${chain}, ${token}`);
    const txData = {
      chain: chain,
      token: token,
      status: "confirmed",
      hash: hash,
      from: from,
      to: to,
      value: value,
      blockNumber,
      network: chain,
      timestamp: formatTimestamp()
    };

    logger.transaction(`CONFIRMED -> ${value} ETH (Sepolia) Block ${blockNumber}`, chain, {
      block: blockNumber,
      hash: hash,
      from: from,
      to: to,
      value: value
    });

    broadcastTx(txData);
  } catch (error) {
    logger.error("Error processing confirmed transaction", chain, error);
  }
};

// ---------- ETHEREUM / BSC ----------
async function pollEthLike(chain) {
  const url = RPC[chain];
  const wl = watch[chain];
  const pending = new Set();
  let lastBlock = null;

  // confirmed
  setInterval(async () => {
    try {
      const token = await getTokenFromChain(chain);
      const block = await rpc(url, "eth_getBlockByNumber", ["latest", true]);
      if (!block || block.number === lastBlock) return;
      lastBlock = await block.number;
      for (const tx of block.transactions) {
        const to = await tx.to?.toLowerCase();
        if (to && wl.includes(to)) {
          // console.log(`[${chain.toUpperCase()}] CONFIRMED:`, tx.hash);
          await processConfirmedTransaction(chain, token, tx, 1);
          pending.delete(tx.hash);
        }
      }
    } catch (e) {
      console.log("RPC failed, retrying...2", e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }, 5000);

  // pending
  setInterval(async () => {
    try {
      const token = await getTokenFromChain(chain);
      const block = await rpc(url, "eth_getBlockByNumber", ["pending", true]);
      for (const tx of block?.transactions || []) {
        const to = await tx.to?.toLowerCase();
        if (to && wl.includes(to) && !pending.has(tx.hash)) {
          logger.info(`${JSON.stringify(tx)}`);
          pending.add(tx.hash);
          await processPendingTransaction(chain, token, tx);
          console.log(`[${chain.toUpperCase()}] PENDING:`, tx.hash);
        }
      }
    } catch (e) {
      console.log("RPC failed, retrying...1", e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }, 5000);
}

// ---------- SOLANA ----------
async function pollSol(chain) {
  let lastSeen = new Set();
  const addr = watch[chain][0];
  setInterval(async () => {
    // for (const addr of watch[chain]) {
    try {
      const res = await fetch(RPC[chain], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignaturesForAddress",
          params: [addr, { limit: 1 }]
        })
      });
      const data = await res.json();
      logger.info(`${JSON.stringify(data)}`);
      for (const tx of data.result || []) {
        logger.info(`${JSON.stringify(tx)}`);
        if (!lastSeen.has(tx.signature)) {
          lastSeen.add(tx.signature);

          logger.info(`${JSON.stringify(tx)}`);
          // if (lastSeen.size === 1) continue;
          const response = await fetch(RPC[chain], {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getTransaction",
              params: [tx.signature, {
                encoding: "json", "commitment": "confirmed",
                "maxSupportedTransactionVersion": 0
              }]
            })
          });
          let transaction = await response.json();
          transaction = await transaction.result;
          // logger.info(`${JSON.stringify(transaction)}`);
          await processConfirmedTransaction(chain, "SOL", transaction, 1, addr);
          console.log(`[SOL] CONFIRMED: ${tx.signature} for ${addr}`);
        }
      }
      if (lastSeen.size > 1000) lastSeen = new Set([...lastSeen].slice(-500));
    } catch (e) {
      console.log("RPC failed, retrying...3", e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
    // }
  }, 5000);
}

// ---------- TRON ----------
async function pollTron(chain) {
  const seen = new Set();
  setInterval(async () => {
    const token = getTokenFromChain(chain);
    for (const addr of watch.tron) {
      try {
        const res = await fetch(`${RPC.tron}/v1/accounts/${addr}/transactions?limit=1`);
        const j = await res.json();
        for (const tx of j.data || []) {
          if (!seen.has(tx.txID)) {
            seen.add(tx.txID);
            if (seen.size === 1) continue;
            await processConfirmedTransaction(chain, token, tx, tx.blockNumber);
            console.log(`[TRON] CONFIRMED: ${tx.txID} for ${addr}`);
          }
        }
      } catch (e) {
        console.log("RPC failed, retrying...4", e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }, 5000);
}

// ---------- BTC / LTC ----------
async function pollBitcoinLike(chain) {
  const wl = watch[chain][0];
  const url = RPC[chain] + (chain === 'bitcoin' ? 'btc' : 'ltc') + '/main/addrs/' + wl + '?';
  // const token = cypher_token;
  const params = new URLSearchParams({
    limit: '25',
    includeConfidence: 'true',
  });
  let seen = new Set();
  setInterval(async () => {
    try {
      params.set('token', cypher_token[cypher_token_count]);
      // logger.info(`${url + params.toString()}`);
      const response = await fetch(url + params.toString);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} - ${text}`);
      }
      const data = await response.json();
      // const confirmed = normalizeTxs(data.txrefs, 'confirmed');
      for (const confirmedTxs of data.txrefs) {
        if (!seen.has(confirmedTxs.tx_hash)) {
          seen.add(confirmedTxs.tx_hash);
          await processConfirmedTransaction(chain, getTokenFromChain(chain), confirmedTxs, 1);
          console.log(`[${getTokenFromChain(chain)}] CONFIRMED: ${confirmedTxs.tx_hash} for ${wl}`);
        }
      }
      // const pending = normalizeTxs(data.unconfirmed_txrefs, 'pending');
      if (data.unconfirmed_txrefs) {
        for (const pendingTxs of data.unconfirmed_txrefs) {
          if (!seen.has(pendingTxs)) {
            seen.add(pendingTxs.tx_hash);
            await processPendingTransaction(chain, getTokenFromChain(chain), pendingTxs);
            console.log(`[${getTokenFromChain(chain)}] PENDING: ${pendingTxs.tx_hash} for ${wl}`);
          }
        }
      }
      if (seen.size > 1000) seen = new Set([...seen].slice(-500));
      // logger.info(`${JSON.stringify(data.txrefs)}`);
    } catch (e) {
      console.log("Fetch failed, retrying", e.message);
      cypher_token_count = (cypher_token_count + 1) % 10;
      await new Promise(r => setTimeout(r, 5000));
    }
  }, 150000);
}

// ========== Start All ==========
export const startWalletWatcher = () => {
  pollEthLike("ethereum");
  logger.system("ETH wallet monitoring...");
  pollEthLike("binance");
  logger.system("BSC wallet monitoring...");
  pollSol("solana");
  logger.system("SOL wallet monitoring...");
  pollTron("tron");
  logger.system("TRX wallet monitoring...");
  pollBitcoinLike("bitcoin");
  logger.system("BTC wallet monitoring...");
  pollBitcoinLike("litecoin");
  logger.system("LTC wallet monitoring...");
}