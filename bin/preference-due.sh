#!/usr/bin/env bash
set -euo pipefail

FILE="${HOME}/.config/opencode/用户偏好.md"
INTERVAL_DAYS=14

if [ ! -f "${FILE}" ]; then
  echo "缺少偏好文件：${FILE}"
  exit 1
fi

MTIME=$(stat -f %m "${FILE}")
NOW=$(date +%s)
DAYS=$(( (NOW - MTIME) / 86400 ))
LEFT=$(( INTERVAL_DAYS - DAYS ))

if [ "${DAYS}" -ge "${INTERVAL_DAYS}" ]; then
  echo "偏好整理已到期：距离上次更新 ${DAYS} 天，请先执行 /偏好整理。"
  exit 0
fi

echo "偏好整理未到期：距离上次更新 ${DAYS} 天，还剩 ${LEFT} 天。"
