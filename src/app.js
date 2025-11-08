import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { initSocket } from "./websocket/socketManager.js";
import logger from "./utils/logger.js";

import { startWalletWatcher } from "./services/service.js";
import { startDiscordBot } from "./bot/discord.bot.js";

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Import routes
import logsRouter from './routes/logs.js';

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => res.send("Multi-chain Wallet Tracker Running ✅"));
app.use('/api/logs', logsRouter);

logger.system("Initializing WebSocket server");
initSocket(io);

// Initialize all watchers
logger.system("Starting all blockchain watchers");
startWalletWatcher();

// Run Discord Bot
logger.system("Running Discord Bot");
startDiscordBot();

export default server;
