# opencode 兵器库

## 简介

这是我自己在用的 opencode 配置与个人习惯的单一真源。换一台机器时克隆本仓库，执行一次安装脚本，就能得到同一套助手行为、同一套指令、同一套技能和插件，不用凭记忆重新调教。

仓库里只放可公开的配置与源码。密钥、服务端密码、会话数据库、插件依赖目录一律不进仓库。

## 包含内容

1. 全局规则 AGENTS.md，规定语言、工具调用、文档、代码、进程与交付方式。
2. 用户偏好 用户偏好.md，记录跨项目成立的稳定习惯，带观察日期与状态。
3. 主配置 opencode.jsonc，模型、权限、插件、MCP 与供应商策略。
4. 记忆插件配置 opencode-mem.jsonc。
5. 终端界面配置 cli.json，滚动、会话侧栏、标签布局这些手感项。
6. 自定义指令 commands，包含项目复查、调研、偏好整理、日报。
7. 技能 skills，包含 humanizer、i-have-adhd、openrouter-decisions。
8. 插件 plugins 源码，包含会话标题、记住模型、自动续跑。
9. 启动脚本 bin，包含无头浏览器拦截器、zsh 包装器、偏好到期检查。

## 安装

1. 克隆仓库到本机任意目录。

```
git clone https://github.com/buxuele/my_opencode_settings.git
cd my_opencode_settings
```

2. 执行安装脚本。脚本会先备份现有的 ~/.config/opencode，再把文件逐个安装过去，并把作者家目录路径替换成当前机器的家目录。

```
bash install.sh
```

3. 按 docs/迁移清单.md 配置环境变量和外部程序。

4. 重启 opencode。配置文件只在启动时读取。

## 安装脚本做了什么

1. 把现有 ~/.config/opencode 备份到 ~/.config/opencode.backup.时间戳，备份时跳过依赖目录与归档目录。
2. 安装 4 份配置、1 份偏好文件、全部指令、全部技能、全部插件源码、全部启动脚本。
3. 把配置里写死的 /Users/fanchuang 替换成当前机器的家目录。
4. 给缺少依赖的插件执行 npm install，使用国内镜像，失败不中断安装。
5. 检查配置引用的外部程序是否存在，逐个报告缺失项。

## 目录结构

```
my_opencode_settings/
├── README.md
├── 开发记录.md
├── install.sh
├── config/
│   ├── AGENTS.md
│   ├── cli.json
│   ├── opencode-mem.jsonc
│   └── opencode.jsonc
├── preferences/
│   └── 用户偏好.md
├── commands/
├── skills/
├── plugins/
├── bin/
└── docs/
    ├── 迁移清单.md
    └── 配置说明.md
```

## 安全说明

1. 仓库不包含 ~/.config/opencode/service.json，该文件含服务端随机密码。
2. 仓库不包含任何 api key 与 token，全部通过环境变量读取。
3. 仓库不包含会话数据库、上下文缓存、历史备份与插件依赖目录。
4. 唯一保留的作者机器信息是家目录路径，安装时自动替换。

## 回滚

安装脚本每次都会打印备份目录。想退回安装前的状态，执行：

```
cp -a ~/.config/opencode.backup.时间戳/. ~/.config/opencode/
```

## 后续维护

在本仓库改配置，然后执行一次 install.sh 同步到本机，再提交推送。不要在 ~/.config/opencode 里直接改后忘记回写仓库，否则下次换机器会丢改动。

## 文档

1. docs/迁移清单.md 写新机器需要准备哪些软件与变量。
2. docs/配置说明.md 写每份配置的用途与改动方式。

## 许可

个人配置仓库，没有对外承诺，可自行取用。
