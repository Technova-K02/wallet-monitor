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
  tron: process.env.TRON_TEST_RPC,
  bitcoin: "http://user:pass@127.0.0.1:8332", // needs local full node
  litecoin: "http://user:pass@127.0.0.1:9332"  // needs local full node
};

const watch = {
  ethereum: [process.env.WALLET_ETH_1, process.env.WALLET_ETH_2].map(a => a.toLowerCase()),
  binance: [process.env.WALLET_BSC_1, process.env.WALLET_BSC_2].map(a => a.toLowerCase()),
  solana: [process.env.WALLET_SOL_1, process.env.WALLET_SOL_2],
  tron: [process.env.WALLET_TRON_1, process.env.WALLET_TRON_2],
  bitcoin: [process.env.WALLET_BTC_1, process.env.WALLET_BTC_2],
  litecoin: [process.env.WALLET_LTC_1, process.env.WALLET_SOL_2]
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

const processConfirmedTransaction = async (chain, token, tx, blockNumber) => {
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
          from = tx.transaction.message.accountKeys[0];
          to = tx.transaction.message.accountKeys[1];
          let val = tx.meta.postBalances[1] - tx.meta.preBalances[1];
          value = val / 1000000000;
          hash = tx.transaction.signatures[0];
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
  }, 1000);

  // // pending
  // setInterval(async () => {
  //   try {
  //     const token = await getTokenFromChain(chain);
  //     const block = await rpc(url, "eth_getBlockByNumber", ["pending", true]);
  //     for (const tx of block?.transactions || []) {
  //       const to = await tx.to?.toLowerCase();
  //       if (to && wl.includes(to) && !pending.has(tx.hash)) {
  //         logger.info(`${JSON.stringify(tx)}`);
  //         pending.add(tx.hash);
  //         await processPendingTransaction(chain, token, tx);
  //         console.log(`[${chain.toUpperCase()}] PENDING:`, tx.hash);
  //       }
  //     }
  //   } catch (e) {
  //     console.log("RPC failed, retrying...1", e.message);
  //     await new Promise(r => setTimeout(r, 2000));
  //   }
  // }, 1000);
}

// ---------- SOLANA ----------
async function pollSol(chain) {
  let lastSeen = new Set();
  setInterval(async () => {
    for (const addr of watch[chain]) {
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
        for (const tx of data.result || []) {
          if (!lastSeen.has(tx.signature)) {
            lastSeen.add(tx.signature);
            if (lastSeen.size === 1) continue;
            const response = await fetch(RPC[chain], {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTransaction",
                params: [tx.signature, { encoding: "json" }]
              })
            });
            let transaction = await response.json();
            transaction = await transaction.result;
            await processConfirmedTransaction(chain, "SOL", transaction, transaction.blockTime);
            console.log(`[SOL] CONFIRMED: ${tx.signature} for ${addr}`);
          }
        }
        if (lastSeen.size > 1000) lastSeen = new Set([...lastSeen].slice(-500));
      } catch (e) {
        console.log("RPC failed, retrying...3", e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }, 3000);
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
  }, 3000);
}

// ---------- BTC / LTC ----------
async function pollBitcoinLike(chain, auth) {
  const url = RPC[chain];
  const wl = watch[chain];
  const seenPending = new Set();
  let lastBlock = null;

  // pending
  setInterval(async () => {
    const mempool = await rpc(url, "getrawmempool", [], auth);
    for (const h of mempool || []) {
      if (seenPending.has(h)) continue;
      const tx = await rpc(url, "getrawtransaction", [h, true], auth);
      const data = JSON.stringify(tx);
      if (wl.some(a => data.includes(a))) {
        console.log(`[${chain.toUpperCase()}] PENDING:`, h);
        seenPending.add(h);
      }
    }
  }, 5000);

  // confirmed
  setInterval(async () => {
    const bh = await rpc(url, "getbestblockhash", [], auth);
    if (bh === lastBlock) return;
    lastBlock = bh;
    const block = await rpc(url, "getblock", [bh, 2], auth);
    for (const tx of block.tx) {
      const data = JSON.stringify(tx);
      if (wl.some(a => data.includes(a))) {
        console.log(`[${chain.toUpperCase()}] CONFIRMED:`, tx.txid);
        seenPending.delete(tx.txid);
      }
    }
  }, 8000);
}

// ========== Start All ==========
export const startWalletWatcher = () => {
  pollEthLike("ethereum");
  logger.system("ETH wallet mornitoring...");
  pollEthLike("binance");
  logger.system("BSC wallet mornitoring...");
  pollSol("solana");
  logger.system("SOL wallet mornitoring...");
  pollTron("tron");
  logger.system("TRX wallet mornitoring...");
  // pollBitcoinLike("btc", "user:password");
  // pollBitcoinLike("ltc", "user:password");
}