import { getAttributeUpgradeCost } from '../config/characterRules.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import { buildCharacterInfoView } from './character.js';
import { GameError } from './errors.js';
import { spendResource } from './resourceService.js';
import type { CharacterInfoView, UpgradeAttributePayload } from '../types/gameState.js';
import { isAttributeKey } from '../types/gameState.js';

export function upgradeAttribute(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<CharacterInfoView> {
  const attribute = (payload as UpgradeAttributePayload).attribute;
  if (!isAttributeKey(attribute)) {
    throw new GameError('INVALID_ATTRIBUTE_KEY', 'Attribute key is invalid.');
  }

  const currentValue = ctx.state.attributes[attribute];
  const costCopper = getAttributeUpgradeCost(currentValue);
  spendResource(ctx.state, 'copper', costCopper, 'NOT_ENOUGH_COPPER');
  ctx.state.attributes[attribute] += 1;
  ctx.markDirty();

  return {
    ok: true,
    action: 'UPGRADE_ATTRIBUTE',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: buildCharacterInfoView(ctx.state),
  };
}
