import server from "./app.js";
import dotenv from "dotenv";
import logger from "./utils/logger.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.system('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.system('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

server.listen(PORT, () => {
  logger.system(`Multi-chain Wallet Tracker server started on port ${PORT}`, { port: PORT });
  logger.system("=".repeat(50));
  logger.system("🚀 MULTI-CHAIN WALLET TRACKER STARTED");
  logger.system("=".repeat(50));
});
 