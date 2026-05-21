import { Router } from 'express';
import { serverGlobalConfig } from '../config/serverGlobalConfig.js';

const router = Router();

/**
 * GET /api/debug/config
 * 获取当前全局测试配置
 */
router.get('/config', (req, res) => {
  res.json({
    ok: true,
    config: serverGlobalConfig,
  });
});

/**
 * POST /api/debug/config
 * 更新全局测试配置，测试用无需验证
 */
router.post('/config', (req, res) => {
  const { debugTavernXpMultiplier, debugTavernCopperMultiplier } = req.body;
  
  if (typeof debugTavernXpMultiplier === 'number') {
    serverGlobalConfig.debugTavernXpMultiplier = debugTavernXpMultiplier;
    console.log(`[DEBUG] debugTavernXpMultiplier updated to ${debugTavernXpMultiplier}`);
  }

  if (typeof debugTavernCopperMultiplier === 'number') {
    serverGlobalConfig.debugTavernCopperMultiplier = debugTavernCopperMultiplier;
    console.log(`[DEBUG] debugTavernCopperMultiplier updated to ${debugTavernCopperMultiplier}`);
  }

  res.json({
    ok: true,
    config: serverGlobalConfig,
  });
});

export default router;
