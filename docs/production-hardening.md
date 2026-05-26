# Career Compass 生产加固清单

## 密钥

- 生产环境设置 `REQUIRE_STRONG_SECRETS=true`。
- `ADMIN_TOKEN` 和 `JWT_SECRET` 必须使用非默认值，且长度不少于 32 个字符。
- `.env` 不提交到仓库，生产密钥由部署平台或服务器环境变量注入。

## 端口

- 生产环境不要直接暴露 Redis 端口。
- MySQL 端口只应对受信任网络开放；公网访问通过后端 API 完成。
- 前端由 Nginx 暴露 HTTP/HTTPS，后端建议只在内网暴露给前端反向代理。

## 依赖

- 前端执行 `npm audit --audit-level=moderate`，中高危依赖必须处理后再发布。
- Excel 导入使用按需加载，避免把解析库放入首屏主包。

## 数据库迁移

- 当前项目仍保留 `deploy/mysql/init/001_schema.sql` 作为新环境初始化脚本。
- 后续新增字段或表时，优先新增独立迁移文件，例如 `deploy/mysql/migrations/20260526_add_xxx.sql`。
- 迁移文件只向前执行，不修改历史迁移；生产执行前先在备份库验证。
- 适合接入 Flyway/Liquibase 的时机：发布频率稳定、多人协作或已有生产数据后。
