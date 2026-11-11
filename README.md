# opencode 配置库

个人在用的 opencode 配置与习惯，换机器时克隆后执行一次安装脚本即可还原。

## 安装

1. 克隆并安装。

```
git clone https://github.com/buxuele/my_opencode_settings.git
cd my_opencode_settings
bash install.sh
```

2. 按 docs/迁移清单.md 配好环境变量与外部程序。

3. 重启 opencode。

脚本会先备份现有 ~/.config/opencode，替换家目录路径，再给缺少依赖的插件执行 npm install。

## 内容

1. config：全局规则、主配置、记忆与终端配置。
2. preferences：跨项目稳定偏好。
3. commands、skills、plugins：自定义指令、技能与插件源码。
4. bin：无头浏览器拦截器等启动脚本。

## 说明

仓库不含 api key、service.json、会话数据库与插件依赖，密钥全部走环境变量。各配置用途见 docs/配置说明.md，迁移与回滚见 docs/迁移清单.md。
