# SRS 对照优化清单

更新时间：2026-05-26

本文按《Career Compass 职业规划网站 软件需求说明书》对当前实现进行核对，记录已覆盖项和本轮补齐项。

## 本轮已优化

1. 学生注册确认密码
   - 对齐 UC-01：注册时新增“确认密码”，两次密码不一致时提示并清空密码输入。
   - 位置：`frontend/src/App.tsx`

2. 社区举报补充说明
   - 对齐 UC-14：举报前要求填写原因或补充说明，取消或留空不提交。
   - 位置：`frontend/src/App.tsx`

3. 后台图表数据导入后端解析
   - 对齐 UC-17：新增 `/admin/charts/import`，后端解析 CSV/XLSX、校验表头/空值/数字列，并返回行级错误。
   - 位置：`backend/src/main/java/com/careercompass/controller/AdminApiController.java`、`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/api.ts`、`frontend/src/App.tsx`

4. AI 配置结构化校验
   - 对齐 UC-18：后台 AI 配置新增 `algorithm_weights`、`model_params` 类型；算法权重要求总和为 100%，模型参数校验 `temperature`、`topP`、`maxTokens` 范围。
   - 位置：`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/App.tsx`、`deploy/mysql/init/002_seed_demo.sql`

5. 问卷/访谈模板可配置读取
   - 对齐灵活性要求：新增 `/api/assessment/template`，前端启动访谈时读取后台已发布 questionnaire 配置，提交报告和草稿时使用当前模板版本。
   - 位置：`backend/src/main/java/com/careercompass/controller/PublicApiController.java`、`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/api.ts`、`frontend/src/App.tsx`

6. 管理员并发审核冲突提示
   - 对齐审核异常流：社区帖子、评论、举报、抓取候选审核支持 `expectedStatus`，状态已被其他管理员改变时返回“记录状态已变化，请刷新后再操作”。
   - 位置：`backend/src/main/java/com/careercompass/model/Dtos.java`、`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/api.ts`、`frontend/src/App.tsx`

7. Redis 图表缓存与降级
   - 对齐统计数据缓存要求：公开图表查询写入 Redis，保存/刷新图表时清理缓存；Redis 异常只降级到数据库读取，不阻断核心业务。
   - 位置：`backend/pom.xml`、`docker-compose.yml`、`backend/src/main/java/com/careercompass/service/CompassService.java`

8. 社区公开用户主页
   - 对齐社区输出页面要求：新增 `/api/community/users/{id}`，非匿名作者可进入公开主页，展示公开帖子、评论数、获赞数和最近公开内容。
   - 位置：`backend/src/main/java/com/careercompass/controller/PublicApiController.java`、`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/api.ts`、`frontend/src/App.tsx`、`frontend/src/styles.css`

9. 发帖与评论违规内容拦截
   - 对齐 UC-12/UC-13：发帖、编辑帖子和评论统一走社区内容校验，命中代考、包过、诈骗、赌博、买卖答案等违规词时拒绝提交并返回友好提示。
   - 位置：`backend/src/main/java/com/careercompass/service/CompassService.java`

10. 社区用户处罚入口对齐
   - 对齐 UC-20：后台社区用户“禁言/封禁/解除”按钮改用 `/admin/community/user/ban`，禁言设置 7 天、封禁设置 30 天，解除时清空处罚原因和到期时间；同时传入当前状态做并发冲突保护。
   - 位置：`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/api.ts`、`frontend/src/App.tsx`

11. 举报原因选择与评论举报
   - 对齐 UC-14：前台举报从浏览器输入框升级为弹窗，必须选择举报原因并填写补充说明；举报对象支持帖子和评论，后端校验对象必须公开可见，避免无效举报进入后台队列。
   - 位置：`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/App.tsx`、`frontend/src/styles.css`

12. 图表导入后落库保存
   - 对齐 UC-17：管理员先填写图表标题、类型和路径后导入 Excel/CSV，后端解析清洗通过后前端会直接调用保存接口落库，并触发图表缓存刷新；元信息不完整时保留回填表单，提示补齐后保存。
   - 位置：`backend/src/main/java/com/careercompass/service/CompassService.java`、`frontend/src/App.tsx`、`frontend/src/api.ts`

13. 公开内容失败与路径空态文案
   - 对齐 UC-03/UC-10：三路径配置、路径详情和模板资源加载失败时统一提示“内容加载失败，请刷新重试”；路径页资讯、图表、经验、模板和流程项为空时统一展示“敬请期待”。
   - 位置：`frontend/src/App.tsx`

14. 报告导出前图表状态提醒
   - 对齐 UC-07：AI 报告支持浏览器打印导出 PDF 和长图导出；当报告结构化内容存在但维度图表未加载时，页面展示导出风险提示，并在导出前二次确认，避免用户拿到缺图报告。
   - 位置：`frontend/src/App.tsx`、`frontend/src/styles.css`

15. 社区数据索引补齐
   - 对齐数据层要求：为社区帖子补充状态/类型时间索引，为评论补充用户时间与状态时间索引，为举报补充举报人时间与对象状态索引；初始化 SQL 和运行时启动修复同时覆盖，兼容新库和已部署旧库。
   - 位置：`deploy/mysql/init/001_schema.sql`、`backend/src/main/java/com/careercompass/service/CompassService.java`

16. AI 异常与报告前置校验文案
   - 对齐 UC-05/UC-06：AI 访谈、报告生成和报告追问遇到模型未配置、接口失败或空返回时统一返回“AI助手当前繁忙，请稍后再试”；生成报告前先校验职业评估素材，缺失时阻断并返回“请先完成职业评估问卷”。
   - 位置：`backend/src/main/java/com/careercompass/service/LlmClient.java`、`backend/src/main/java/com/careercompass/service/CompassService.java`

## 当前覆盖较完整的 SRS 项

- UC-01/UC-02：学生注册、邮箱验证、登录、Token、密码哈希和注册确认密码已覆盖。
- UC-03/UC-10/UC-11：三路径公开浏览、路径专题、内容加载失败提示、路径空态“敬请期待”、模板列表和下载日志已覆盖。
- UC-04：收藏表、唯一索引和收藏接口已覆盖；报告收藏已按近期产品判断弱化。
- UC-05/UC-06/UC-07/UC-08：AI 访谈、AI 繁忙友好提示、报告生成前置校验、报告 PDF/长图导出、导出前图表状态提醒、报告线程/历史对话已覆盖。
- UC-09/UC-17：图表中心、趋势数据展示、后台 CSV/XLSX 导入解析、导入后落库保存、行级错误反馈和 Redis 缓存刷新已覆盖。
- UC-12/UC-13/UC-14：发帖、评论/回复、违规内容拦截、点赞收藏、举报原因选择与补充说明、帖子/评论举报、公开用户主页、社区评论/举报检索索引已覆盖。
- UC-15/UC-16/UC-18/UC-19/UC-20：后台登录锁定、内容管理、AI 配置、社区审核、社区用户处罚入口、用户禁言/封禁和并发冲突提示已覆盖。
- 安全要求：学生 Bearer Token、后台 X-Admin-Token、生产密钥保护、CORS 配置、上传限制、抓取内网地址拦截已覆盖。

## 验证记录

- 前端：`npm.cmd run build` 通过；`npm.cmd test -- --run` 通过。
- 后端：Docker Maven `mvn test` 通过；Docker Maven `mvn package -DskipTests` 通过。
- Docker：`docker compose up -d --build` 已重建并启动。
- 接口：健康检查、AI 配置校验、图表导入、问卷模板、Redis 图表缓存、并发审核冲突、公开用户主页、社区违规内容拦截、社区用户处罚冲突保护、无效举报对象拦截均已验证。
