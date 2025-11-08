import logger from "../utils/logger.js";

let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;
  io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`, "websocket");
    socket.on("disconnect", () => logger.info(`Client disconnected: ${socket.id}`, "websocket"));
  });
};

export const broadcastTx = (data) => {
  if (ioInstance) {
    ioInstance.emit("newTransaction", data);
    logger.info(`Transaction broadcasted to WebSocket clients`, "websocket", { 
      chain: data.chain, 
      hash: data.hash, 
      status: data.status 
    });
  } else {
    logger.warning("Attempted to broadcast transaction but no WebSocket instance available", "websocket", data);
  }
};
