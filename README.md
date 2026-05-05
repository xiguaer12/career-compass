# Career Compass 职业规划网站

按《Career Compass 职业规划网站 软件需求说明书》重制的 Web 项目，覆盖学生前台、管理员后台、三路径专题、AI 报告、社区、图表中心、模板资源和公开权威数据抓取审核基线。

## 技术栈

- 前端：Vite + React + TypeScript + Recharts + lucide-react
- 后端：Spring Boot 3 + Java 21 REST API
- 部署：Docker Compose + MySQL 8.0 + Redis 7 + Nginx

## Docker 启动

项目默认使用 Docker Compose 运行，前端由 Nginx 容器提供服务：

```bash
copy .env.example .env
docker compose up --build
```

完整容器启动后访问：

- 前端：`http://localhost`
- 后端健康检查：`http://localhost:8080/api/health`
- MySQL 宿主机端口默认：`3307`（容器内仍为 `3306`）
- 后台接口需要请求头：`X-Admin-Token: change-me-admin-token`

## 本地开发

只有在不通过 Docker、单独调试前端时，才需要启动 Vite 开发服务器：

```bash
cd frontend
npm install
npm run dev
```

此时前端开发服务器运行在 `http://localhost:5173`，并代理 `/api` 与 `/admin` 到 `http://localhost:8080`。

## 主要接口

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/path/{civil-exam|postgraduate|employment}`
- `GET /api/templates?category=就业`
- `GET /api/stats/trend`
- `POST /api/assessment/submit`
- `POST /api/ai/chat`
- `GET /api/community/posts`
- `POST /api/community/posts`
- `POST /api/community/report`
- `GET /admin/dashboard`
- `GET /admin/sources`
- `POST /admin/sources/{id}/crawl`

## 需求覆盖

- 学生注册登录、建档、深度问卷、AI 报告与报告追问
- 首页、三路径页面、图表中心、模板下载、社区发帖评论举报
- 管理员仪表盘、内容审核、社区用户管理、数据源抓取任务、AI 配置
- 学校邮箱域名可配置、管理员 Token 鉴权、图表来源与统计口径展示
- MySQL 初始化脚本覆盖用户、问卷、报告、内容、图表、模板、社区、举报、数据源、抓取候选、审计日志

## 当前实现程度

当前版本已经把高风险缺口中的“数据持久化”和“业务状态流转”打通到 MySQL：

- 学生注册/登录会写入并读取 `student_account`，密码使用 PBKDF2 哈希。
- 登录后签发带 HMAC 签名的 Bearer Token。
- 基础档案会更新学生状态：`待补全档案 -> 待完成问卷`。
- 问卷提交会写入 `questionnaire_snapshot`，并生成 `ai_report` 报告快照。
- 社区发帖会写入 `community_post`，默认进入 `待审核`。
- 评论、举报、后台帖子状态更新、用户状态更新、抓取候选任务会写入对应表。
- 后台仪表盘从数据库实时统计注册量、问卷完成率、报告量和待审核量。
