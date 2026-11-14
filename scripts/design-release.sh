set -Eeuo pipefail
umask 077
root=/home/ubuntu/aegisborder-soc/AegisBorder_SOC_v0.2
release=/home/ubuntu/aegisborder-releases/design-20261017-r14
backup=/home/ubuntu/aegisborder-backups/design-20261017-r14
image=aegisborder-design:20261017-r14
cd "$root"
compose() { docker compose -p aegisborder_soc_v02 -f compose.yaml -f compose.oracle.yaml "$@"; }
if [ "${1:-}" = prepare ]; then
  test ! -e "$backup"
  mkdir -p "$backup" "$release"
  cp -p compose.yaml compose.oracle.yaml .env "$backup/"
  cp -p .aegis-active-release "$backup/active-release"
  docker inspect aegisborder_soc_v02-app-1 --format '{{.Image}}' > "$backup/previous-image-id"
  docker tag "$(cat "$backup/previous-image-id")" aegisborder-design:rollback-r14
  docker exec aegisborder_soc_v02-db-1 pg_dump -U aegis -d aegisborder -Fc > "$backup/database.dump"
  test -s "$backup/database.dump"
  docker exec -i aegisborder_soc_v02-db-1 pg_restore --list < "$backup/database.dump" > "$backup/restore-list.txt"
  docker exec aegisborder_soc_v02-db-1 psql -U aegis -d aegisborder -At -c 'SELECT id,md5(username || password_hash || role || active::text) FROM cc_users ORDER BY id' > "$backup/users.before"
  docker exec aegisborder_soc_v02-db-1 psql -U aegis -d aegisborder -At -c 'SELECT id,md5(text || channel || author_id::text) FROM cc_team_messages ORDER BY id' > "$backup/chat.before"
  tar -czf "$backup/frontend-source.tar.gz" frontend/src frontend/package.json frontend/package-lock.json frontend/index.html
  tar -xzf /home/ubuntu/aegis-design-r14.tar.gz -C "$release"
  python3 - <<'PY'
import json, subprocess
from pathlib import Path
backup=Path('/home/ubuntu/aegisborder-backups/design-20261017-r14')
data=json.loads(subprocess.check_output(['docker','inspect','aegisborder_soc_v02-app-1']))[0]
env=dict(s.split('=',1) for s in data['Config']['Env'])
keys=('DATABASE_URL','ADMIN_PASSWORD','AUDIT_KEY','PUBLIC_DEMO_MODE','DLP_ENFORCE','TRUSTED_PROXY_CIDRS')
(backup/'stage.env').write_text(''.join(k+'='+env[k]+'\n' for k in keys if k in env)+'PUBLIC_ORIGIN=http://127.0.0.1:18124\n')
(backup/'network').write_text(next(iter(data['NetworkSettings']['Networks'])))
PY
  printf 'ARG BASE\nFROM ${BASE}\nCOPY frontend/dist/ /code/app/web/\n' > "$release/Dockerfile.design"
  docker build --build-arg "BASE=$(cat "$backup/previous-image-id")" -f "$release/Dockerfile.design" -t "$image" "$release"
  docker run -d --name aegis-design-r14-stage --network "$(cat "$backup/network")" --env-file "$backup/stage.env" -p 127.0.0.1:18124:8000 "$image" uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:18124/api/v1/health; then echo 'Stage healthy'; exit 0; fi
    sleep 2
  done
  exit 1
fi
if [ "${1:-}" = deploy ]; then
  test -s "$backup/database.dump"
  curl -fsS http://127.0.0.1:18124/api/v1/health
  rollback() {
    trap - ERR
    cp -p "$backup/compose.oracle.yaml" compose.oracle.yaml
    compose up -d --no-build --no-deps --wait --wait-timeout 180 app
    cp -p "$backup/active-release" .aegis-active-release
    echo 'Previous application restored; database retained.'
    exit 1
  }
  trap rollback ERR
  python3 - <<'PY'
from pathlib import Path
import re
p=Path('compose.oracle.yaml');s=p.read_text()
s,n=re.subn(r'(?m)^    image: aegisborder[^\n]*', '    image: aegisborder-design:20261017-r14', s)
assert n==1
p.write_text(s)
PY
  compose up -d --no-build --no-deps --wait --wait-timeout 180 app
  curl -fsS --max-time 20 https://aegisborder.130.61.214.154.sslip.io/api/v1/health
  docker exec aegisborder_soc_v02-db-1 psql -U aegis -d aegisborder -At -c 'SELECT id,md5(username || password_hash || role || active::text) FROM cc_users ORDER BY id' > "$backup/users.after"
  docker exec aegisborder_soc_v02-db-1 psql -U aegis -d aegisborder -At -c 'SELECT id,md5(text || channel || author_id::text) FROM cc_team_messages ORDER BY id' > "$backup/chat.after"
  python3 - <<'PY'
from pathlib import Path
p=Path('/home/ubuntu/aegisborder-backups/design-20261017-r14')
for kind in ('users','chat'):
 before=set((p/(kind+'.before')).read_text().splitlines())
 after=set((p/(kind+'.after')).read_text().splitlines())
 assert before<=after,kind+' changed'
 print(kind+': '+str(len(before))+' original records preserved')
PY
  cp -a "$release/frontend/src/." "$root/frontend/src/"
  printf 'design-20261017-r14\n' > .aegis-active-release
  trap - ERR
  echo 'Design release deployed'
fi
