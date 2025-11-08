import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// Get recent logs
router.get('/recent/:type?', (req, res) => {
  try {
    const { type = 'general' } = req.params;
    const { lines = 50 } = req.query;
    
    const logs = logger.getRecentLogs(type, parseInt(lines));
    
    res.json({
      success: true,
      type,
      lines: logs.length,
      logs
    });
  } catch (error) {
    logger.error('Failed to fetch logs', 'system', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs'
    });
  }
});

// Get available log types
router.get('/types', (req, res) => {
  const types = [
    'general',
    'bitcoin',
    'ethereum', 
    'bsc',
    'tron',
    'solana',
    'litecoin',
    'discord',
    'websocket',
    'system',
    'transactions'
  ];
  
  res.json({
    success: true,
    types
  });
});

// Clean old logs manually
router.post('/clean', (req, res) => {
  try {
    logger.cleanOldLogs();
    res.json({
      success: true,
      message: 'Old logs cleaned successfully'
    });
  } catch (error) {
    logger.error('Failed to clean logs', 'system', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean logs'
    });
  }
});

export default router;