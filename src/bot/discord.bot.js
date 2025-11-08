import { io as ioClient } from "socket.io-client";
import dotenv from "dotenv";
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from "discord.js";
import logger from "../utils/logger.js";

dotenv.config();

// Fetch crypto prices
const fetchCryptoPrice = async (chain) => {
  const coinIds = {
    'bitcoin': 'bitcoin',
    'ethereum': 'ethereum',
    'solana': 'solana',
    'litecoin': 'litecoin',
    'binance': 'binancecoin',
    'tron': 'tron'
  };

  try {
    const coinId = coinIds[chain];
    // logger.info(coinId);
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    const data = await res.json();
    logger.info(`${chain}: ${JSON.stringify(data[coinId])}`)
    return data[coinId]?.usd;
  } catch (error) {
    logger.error("Error fetching crypto price", chain, error);
    return 0;
  }
};

let geckoCount = 0;
const chains = [
  'bitcoin', 'ethereum', 'litecoin', 'solana', 'binance', 'tron'
];
const prices = {
  'bitcoin': 0,
  'ethereum': 0,
  'solana': 0,
  'litecoin': 0,
  'binance': 0,
  'tron': 0
};
const priceInterval = setInterval(async () => {
  prices[chains[geckoCount]] = await fetchCryptoPrice(chains[geckoCount]) || prices[chains[geckoCount]];
  geckoCount = geckoCount + 1;
  geckoCount = geckoCount % 6;
}, 18000);

export const startDiscordBot = () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

  if (!token || !channelId) {
    logger.warning("Discord bot not started (missing token or channel id)", "discord");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  client.once("ready", () => {
    logger.success(`Discord bot ready as ${client.user.tag}`, "discord");
    const socket = ioClient(backendUrl);
    socket.on("connect", () => logger.info(`Connected to backend socket: ${socket.id}`, "discord"));
    socket.on("newTransaction", async (data) => {
      try {
        const ch = await client.channels.fetch(channelId);
        if (!ch) return;

        let text;

        // Unified alert format for all chains
        const getChainInfo = (chain, token) => {
          switch (chain) {
            case "bitcoin":
              return { name: "BTC", asset: "Bitcoin (BTC)" };
            case "ethereum":
              return { name: "ETH", asset: "Ethereum (ETH)" };
            case "binance":
              return { name: "BNB", asset: "Binance Coin (BNB)" };
            case "tron":
              return { name: "TRX", asset: "TRON (TRX)" };
            case "solana":
              return { name: "SOL", asset: "Solana (SOL)" };
            case "litecoin":
              return { name: "LTC", asset: "Litecoin (LTC)" };
            default:
              return { name: token || chain.toUpperCase(), asset: `${token || chain.toUpperCase()}` };
          }
        };

        const chainInfo = getChainInfo(data.chain, data.token);
        const transactionType = "Incoming";
        const amount = data.value ? `${data.value} ${chainInfo.name}` : "—";
        let usdValue = 0;
        try {
          prices[data.chain] = prices[data.chain] > 0? prices[data.chain] : await fetchCryptoPrice(data.chain);
          const price = prices[data.chain];
          usdValue = data.value * price;
          console.log(`${data.chain.toUpperCase()} → USD:`, price, `Value: ${data.value} = $${usdValue.toFixed(2)}`);
        } catch (error) {
          console.error("Error fetching crypto price:", error);
          usdValue = 0;
        }
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
          const timeFormatted = timePart.replace(/([ap])m/, (match, p1) => p1.toUpperCase() + "M");
          return `${datePart} • ${timeFormatted} (IST)`;
        };

        const time = data.timestamp || formatTimestamp();
        const status = data.status === "confirmed" ? "Confirmed" : "Pending";
        const action = data.status === "confirmed" ? "Transaction confirmed" : "Wait for confirmations";
        if (status === 'Pending')
          text = [`⚠️ **${chainInfo.name} Transaction Alert**`, `
💸 Type: ${transactionType}
🪙 Asset: ${chainInfo.asset}
🔢 Amount: ${amount}
💰 USD Value: $${usdValue}
⏱️ Time: ${time}
⛓️ Status: ${status}

🏷️ Action: ${action}`];
        else
          text = [`
        ✅ New ${chainInfo.name} transaction of $${usdValue} received:`, `

💰 ${amount} ($${usdValue})
⚡ Status: Confirmed
🕒 ${time}
🔗 Network: ${chainInfo.asset}
📥 Type: Incoming
        `];
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(text[0])
          .setDescription(text[1]);
        if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) {
          await ch.send({ embeds: [embed] });
          logger.discord(`Alert sent for ${data.chain} transaction: ${data.hash}`, {
            chain: data.chain,
            hash: data.hash,
            amount: data.value,
            usdValue: data.usdValue
          });
        }
      } catch (err) {
        logger.error("Discord bot event error", "discord", err, { data });
      }
    });
  });
  client.login(token).catch(e => logger.error("Discord login error", "discord", e));
};
