import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getLogFileName(type = 'general') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${type}-${date}.log`);
  }

  writeToFile(level, message, chain = null, data = null) {
    const timestamp = this.getTimestamp();
    const chainPrefix = chain ? `[${chain}]` : '';
    const logEntry = `[${timestamp}] [${level}] ${chainPrefix} ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}\n`;
    
    // Write to general log
    fs.appendFileSync(this.getLogFileName('general'), logEntry);
    
    // Write to chain-specific log if chain is specified
    if (chain) {
      fs.appendFileSync(this.getLogFileName(chain), logEntry);
    }
  }

  info(message, chain = null, data = null) {
    console.log(`ℹ️  ${chain ? `[${chain.toUpperCase()}]` : ''} ${message}`);
    this.writeToFile('INFO', message, chain, data);
  }

  success(message, chain = null, data = null) {
    console.log(`✅ ${chain ? `[${chain.toUpperCase()}]` : ''} ${message}`);
    this.writeToFile('SUCCESS', message, chain, data);
  }

  warning(message, chain = null, data = null) {
    console.warn(`⚠️  ${chain ? `[${chain.toUpperCase()}]` : ''} ${message}`);
    this.writeToFile('WARNING', message, chain, data);
  }

  error(message, chain = null, error = null, data = null) {
    console.error(`❌ ${chain ? `[${chain}]` : ''} ${message}`);
    const errorData = error ? { 
      message: error.message, 
      stack: error.stack,
      ...data 
    } : data;
    this.writeToFile('ERROR', message, chain, errorData);
  }

  transaction(message, chain, txData) {
    console.log(`💰 [${chain.toUpperCase()}] ${message}`);
    this.writeToFile('TRANSACTION', message, chain, txData);
    
    // Also write to transactions-specific log
    const timestamp = this.getTimestamp();
    const txLogEntry = `[${timestamp}] [${chain.toUpperCase()}] ${message} | TX: ${JSON.stringify(txData)}\n`;
    fs.appendFileSync(this.getLogFileName('transactions'), txLogEntry);
  }

  discord(message, data = null) {
    console.log(`🤖 [DISCORD] ${message}`);
    this.writeToFile('DISCORD', message, 'discord', data);
  }

  system(message, data = null) {
    console.log(`🔧 [SYSTEM] ${message}`);
    this.writeToFile('SYSTEM', message, 'system', data);
  }

  // Get recent logs for debugging
  getRecentLogs(type = 'general', lines = 50) {
    try {
      const logFile = this.getLogFileName(type);
      if (!fs.existsSync(logFile)) {
        return [];
      }
      
      const content = fs.readFileSync(logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      this.error('Failed to read log file', 'system', error);
      return [];
    }
  }

  // Clean old logs (keep last 7 days)
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          this.info(`Cleaned old log file: ${file}`, 'system');
        }
      });
    } catch (error) {
      this.error('Failed to clean old logs', 'system', error);
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Clean old logs on startup
logger.cleanOldLogs();

export default logger;