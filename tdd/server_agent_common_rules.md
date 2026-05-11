# Server Agent Common Rules

Last Updated: 2026-05-11

This short document is mandatory pre-read context for future server agents before changing backend code or TDD contracts.

## 1. Clean-Wipe Upgrade Policy

ZaoFanGame uses a strict clean-wipe upgrade policy during this phase of development.

- Every incompatible server/client version update may delete all old player accounts and saves.
- Clean-wipe means a full reset: delete Supabase Auth users, `profiles`, `player_saves`, `player_resources`, battle replay archives, and other player-owned rows unless the user explicitly asks to preserve a table.
- Backward compatibility for old `GameState`, old response payloads, and old replay formats is not a product requirement.
- Do not keep legacy fields or compatibility mappers only to support stale saves or stale clients.
- Prefer one authoritative current contract over dual old/new contracts.
- If a schema or API changes, update TDD docs and tests to the new contract instead of preserving deprecated behavior.
- After a schema-changing server task, apply or explicitly hand off the latest database SQL/migration before telling the client the backend is ready.

Required finish steps after backend code changes:

1. Update the relevant `server/tdd/*` documents in the same task so the client agent can integrate against the current contract.
2. Rebuild the Supabase database from the current SQL/migration and do a clean-wipe reset. Do not preserve any previous-version Auth users, `profiles`, saves, resources, replay records, or other player-owned data unless the user explicitly says to preserve them.

Allowed exceptions:

- Temporary compatibility may be added only when explicitly requested by the user for an active client handoff.
- Such compatibility must be documented as temporary and removed once the client is updated.

## 2. Contract Source Of Truth

- Server behavior must match `server/tdd/*` first.
- If implementation changes an API response, storage shape, error code, or action behavior, update the relevant TDD document in the same task.
- Client-facing action contracts belong in `server/tdd/api_master_list.md`.
- Save and persisted data contracts belong in `server/tdd/player_save_schema.md`.
- Error codes belong in `server/tdd/error_code_dictionary.md`.

## 3. Battle System Contract

- `BattleResultV2` is the only supported battle replay contract.
- Do not reintroduce legacy `BattleResult.rounds` compatibility unless explicitly requested.
- Historical battle playback must use frozen snapshots stored in `BattleResultV2`, not current player saves.
- Large replay archives belong in independent replay storage, not inside `GameState`.
