#!/usr/bin/env bash
# opencode 兵器库安装脚本。
# 把仓库里的配置、指令、技能、插件、启动脚本安装到 ~/.config/opencode。
# 安装前自动备份现有配置，安装时把作者机器的家目录路径替换成当前机器的家目录。

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.config/opencode"
AUTHOR_HOME="/Users/fanchuang"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${HOME}/.config/opencode.backup.${STAMP}"
NPM_REGISTRY="https://registry.npmmirror.com"

say() { printf '%s\n' "$*"; }

say "仓库位置：${REPO_DIR}"
say "安装目标：${DEST}"

if [[ ! -f "${REPO_DIR}/config/opencode.jsonc" ]]; then
  say "缺少 config/opencode.jsonc，当前目录不是兵器库仓库。"
  exit 1
fi

if [[ -d "${DEST}" ]]; then
  say "备份现有配置到：${BACKUP_DIR}"
  mkdir -p "${BACKUP_DIR}"
  rsync -a \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    --exclude 'archive' \
    "${DEST}/" "${BACKUP_DIR}/"
fi

mkdir -p "${DEST}/commands" "${DEST}/skills" "${DEST}/bin" "${DEST}/plugins"

# 单文件安装：先复制到临时文件，替换家目录路径后再落位。
install_file() {
  local src="$1"
  local rel="$2"
  local tmp
  tmp="$(mktemp)"
  sed "s|${AUTHOR_HOME}|${HOME}|g" "${src}" > "${tmp}"
  mkdir -p "${DEST}/$(dirname "${rel}")"
  mv "${tmp}" "${DEST}/${rel}"
  say "已安装 ${rel}"
}

install_file "${REPO_DIR}/config/opencode.jsonc" "opencode.jsonc"
install_file "${REPO_DIR}/config/opencode-mem.jsonc" "opencode-mem.jsonc"
install_file "${REPO_DIR}/config/cli.json" "cli.json"
install_file "${REPO_DIR}/config/AGENTS.md" "AGENTS.md"
install_file "${REPO_DIR}/preferences/用户偏好.md" "用户偏好.md"

for f in "${REPO_DIR}"/commands/*.md; do
  install_file "${f}" "commands/$(basename "${f}")"
done

for f in "${REPO_DIR}"/bin/*; do
  install_file "${f}" "bin/$(basename "${f}")"
  chmod 755 "${DEST}/bin/$(basename "${f}")"
done

rsync -a --exclude '.DS_Store' "${REPO_DIR}/skills/" "${DEST}/skills/"
say "已同步 skills 目录"

for plugin_dir in "${REPO_DIR}"/plugins/*/; do
  name="$(basename "${plugin_dir}")"
  mkdir -p "${DEST}/plugins/${name}"
  rsync -a \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    "${plugin_dir}" "${DEST}/plugins/${name}/"
  say "已安装插件 ${name}"
done

if command -v npm >/dev/null 2>&1; then
  for plugin_dir in "${DEST}"/plugins/*/; do
    if [[ -f "${plugin_dir}package.json" && ! -d "${plugin_dir}node_modules" ]]; then
      say "安装插件依赖：$(basename "${plugin_dir}")"
      (cd "${plugin_dir}" && npm install --omit=dev --registry="${NPM_REGISTRY}" >/dev/null 2>&1) \
        || say "依赖安装失败：$(basename "${plugin_dir}")，首次启动 opencode 时会重试"
    fi
  done
else
  say "未找到 npm，插件依赖留给 opencode 首次启动时安装"
fi

say ""
say "检查配置里引用的外部程序："
missing=0
while IFS= read -r cmd; do
  [[ -z "${cmd}" ]] && continue
  [[ "${cmd}" != /* ]] && continue
  if [[ -x "${cmd}" ]]; then
    say "  存在 ${cmd}"
  else
    say "  缺失 ${cmd}"
    missing=$((missing + 1))
  fi
done < <(sed -n 's/.*"\([^"]*\/[^"]*\)".*/\1/p' "${DEST}/opencode.jsonc" | sed "s|${AUTHOR_HOME}|${HOME}|g" | sort -u)

if (( missing > 0 )); then
  say ""
  say "有 ${missing} 个外部程序在当前机器上不存在，对应功能会在启动时报错。"
  say "处理办法见 docs/迁移清单.md，不需要的功能可以直接从 opencode.jsonc 里删掉。"
fi

say ""
say "安装完成。"
say "下一步："
say "  1. 确认环境变量已配置，参考 docs/迁移清单.md。"
say "  2. 重启 opencode 让配置生效。"
say "  3. 回滚用 cp -a ${BACKUP_DIR}/. ${DEST}/"
