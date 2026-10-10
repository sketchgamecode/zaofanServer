import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { applyDailyResetIfNeeded } from '../engine/dailyReset.js';
import { loadOrCreateGameState, saveGameState } from '../lib/gameStateStore.js';
import { loadOrCreateWorldState } from '../lib/worldStateStore.js';
import { getNow } from '../lib/time.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id as string;
  const now = getNow();

  try {
    const loadResult = await loadOrCreateGameState(userId, now);
    const globalWorld = await loadOrCreateWorldState(now);
    loadResult.state.world = globalWorld;

    const resetApplied = applyDailyResetIfNeeded(loadResult.state, now);

    if (loadResult.created || loadResult.resetInvalid || resetApplied) {
      await saveGameState(userId, loadResult.state, now);
    }

    // Client view: `world` is global server-side state (all world actors with combat
    // snapshots) and is the bulk of the payload. The client does not read it.
    // Use `?view=full` only for debugging.
    const { world: _world, ...clientSave } = loadResult.state;
    const save = req.query.view === 'full' ? loadResult.state : clientSave;

    res.json({
      save,
      saveVersion: loadResult.state.meta.schemaVersion,
      updatedAt: new Date(loadResult.state.meta.updatedAt).toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: '读取存档失败',
      detail: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

export default router;
