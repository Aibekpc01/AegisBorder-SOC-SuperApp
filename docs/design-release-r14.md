# Design release r14 — 17 October 2026

Published at https://aegisborder.130.61.214.154.sslip.io/.

Image: `aegisborder-design:20261017-r14`, built on the exact previously running application image. This release replaces the built web interface and synchronizes frontend source files; backend code, database schema, DLP policy, credentials and proxy configuration remain those of the running server.

Local checks: 157 backend tests passed, one skipped, one existing Starlette/httpx deprecation warning; 27 frontend tests passed; ESLint and production build passed.

Stage and public HTTPS checks: health, landing at 1440/768/390 px, three loaded identity marks, module search/reset/Escape, existing administrator login, responsive authenticated screens, no page errors. Administrator access remains subject to the existing DLP assignment; module browsing used a read-only demo viewer. Viewing the users route as this viewer verifies the access-limited state, not administrative operations. No user, role or device policies were changed by verification.

The frontend `index.html` SHA-256 matches the locally built artifact:
`8b6789e39a26dea7ca89b20d72742dd851f52f9b7e6de8819a63e716fa7b0389`.

All 19 preexisting account fingerprints and the preexisting chat message were preserved at switch-over. New demo sessions and presence entries were created by browser checks. The database dump is 437760 bytes; its archive contents were validated with `pg_restore --list`. A full restore rehearsal was not performed for this frontend-only release.

Backup: `/home/ubuntu/aegisborder-backups/design-20261017-r14`, including database dump, prior Compose/env, frontend source and previous image ID. Release payload: `/home/ubuntu/aegisborder-releases/design-20261017-r14`. The staging container was removed after publication; production app and database are healthy.

Browser evidence: `release/design-r14/production/`. Repeatable check: `frontend/scripts/design-live-check.mjs`. Deployment procedure: `scripts/design-release.sh`.

To roll back the application, from `/home/ubuntu/aegisborder-soc/AegisBorder_SOC_v0.2` restore `compose.oracle.yaml` from the backup and run:

```sh
sudo cp -p /home/ubuntu/aegisborder-backups/design-20261017-r14/compose.oracle.yaml compose.oracle.yaml
sudo docker compose -p aegisborder_soc_v02 -f compose.yaml -f compose.oracle.yaml up -d --no-build --no-deps --wait app
sudo cp -p /home/ubuntu/aegisborder-backups/design-20261017-r14/active-release .aegis-active-release
```

Do not restore the database for a normal frontend rollback. The prior image is also tagged `aegisborder-design:rollback-r14`.
