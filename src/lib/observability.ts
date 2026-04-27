import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { GameState } from '../types/gameState.js';

export type ServerLogLevel = 'info' | 'error';

export type GameStateSummary = {
  stateRevision: number;
  tavernStatus: 'IDLE' | 'IN_PROGRESS' | 'READY_TO_COMPLETE';
  missionOfferCount: number;
  activeMissionId: string | null;
};

export function getServiceName(): string {
  return 'zaofan-server';
}

export function getRuntimeEnv(): string {
  return process.env.NODE_ENV ?? 'development';
}

export function getReleaseTag(): string {
  return process.env.RELEASE_TAG
    ?? process.env.RAILWAY_GIT_COMMIT_SHA
    ?? process.env.GIT_TAG
    ?? 'dev';
}

export function createRequestId(): string {
  return randomUUID();
}

export function getRequestId(res: Response): string {
  const requestId = res.locals.requestId;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : 'unknown';
}

export function getRequestMetadata(req: Request, res: Response): Record<string, unknown> {
  return {
    requestId: getRequestId(res),
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    origin: req.headers.origin ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    hasAuthHeader: typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0,
  };
}

export function summarizeGameState(state: GameState, now: number = Date.now()): GameStateSummary {
  return {
    stateRevision: state.meta.stateRevision,
    tavernStatus: getTavernStatusFromState(state, now),
    missionOfferCount: state.tavern.missionOffers.length,
    activeMissionId: state.tavern.activeMission?.missionId ?? null,
  };
}

export function summarizeActionPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      payloadType: payload === null ? 'null' : typeof payload,
    };
  }

  const payloadRecord = payload as Record<string, unknown>;
  const keys = Object.keys(payloadRecord);

  return {
    payloadKeys: keys.slice(0, 12),
    missionId: typeof payloadRecord.missionId === 'string' ? payloadRecord.missionId : undefined,
    offerSetId: typeof payloadRecord.offerSetId === 'string' ? payloadRecord.offerSetId : undefined,
    hasPayload: keys.length > 0,
  };
}

export function logServerEvent(
  event: string,
  fields: Record<string, unknown>,
  level: ServerLogLevel = 'info',
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: getServiceName(),
    env: getRuntimeEnv(),
    releaseTag: getReleaseTag(),
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function getTavernStatusFromState(
  state: GameState,
  now: number,
): 'IDLE' | 'IN_PROGRESS' | 'READY_TO_COMPLETE' {
  const activeMission = state.tavern.activeMission;
  if (!activeMission) {
    return 'IDLE';
  }

  if (now >= activeMission.endTime) {
    return 'READY_TO_COMPLETE';
  }

  return 'IN_PROGRESS';
}
