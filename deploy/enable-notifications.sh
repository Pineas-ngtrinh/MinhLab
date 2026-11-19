#!/bin/bash
set -euo pipefail
umask 077
if [[ "$EUID" -ne 0 ]]; then
  echo 'Chạy: sudo bash /srv/minhlab/current/deploy/enable-notifications.sh' >&2
  exit 1
fi
cd "$(dirname "$0")/.."
[[ "$(pwd -P)" == "$(readlink -f /srv/minhlab/current)" ]] || { echo 'Chỉ cài từ release current đang chạy.' >&2; exit 1; }
test -s deploy/.env.compose
test -s deploy/.env.runtime
docker compose --env-file deploy/.env.compose -f compose.yaml config --quiet </dev/null
test -n "$(docker compose --env-file deploy/.env.compose -f compose.yaml ps -q web </dev/null)"
backup="/srv/minhlab/backups/notification-units-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup"
chmod 700 "$backup"
for unit in minhlab-worker@.service minhlab-notifications.timer; do
  if [[ -f "/etc/systemd/system/$unit" ]]; then cp -p "/etc/systemd/system/$unit" "$backup/$unit"; fi
  install -m 644 "deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now minhlab-notifications.timer
if ! systemctl start minhlab-worker@notifications.service; then
  journalctl -u minhlab-worker@notifications.service -n 40 --no-pager
  echo 'Lịch đã bật nhưng một trong hai kênh gửi báo lỗi; xem log phía trên.' >&2
  exit 1
fi
systemctl list-timers --all minhlab-notifications.timer --no-pager
echo "NOTIFICATIONS_TIMER_ENABLED. Unit backup: $backup"
