USE career_compass;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO student_account
  (email, password_hash, name, student_no, college, major, graduation_year, phone, nickname, agreement_accepted, status)
VALUES
  ('2335061025@st.usst.edu.cn', '$2a$10$demo', '张同学', '2335061025', '光电信息与计算机工程学院', '计算机科学与技术', '2026', '13800000000', 'Compass 用户', 1, '已完成引导')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  student_no = VALUES(student_no),
  college = VALUES(college),
  major = VALUES(major),
  graduation_year = VALUES(graduation_year),
  phone = VALUES(phone),
  nickname = VALUES(nickname),
  status = VALUES(status);

INSERT INTO admin_account (username, password_hash, display_name, status)
VALUES ('admin', '$2a$10$demo', '系统管理员', '正常')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), status = VALUES(status);

INSERT INTO content_info (title, category, body, summary, source_name, source_url, status)
VALUES
  ('国考职位表先筛专业和基层经历', '考公', '国家公务员局专题页的公告、报考指南和职位表能直接决定能不能报。学生应先核对专业限制、学历学位、政治面貌、基层经历、招录人数、报名确认和资格复审材料，再判断是否投入备考。', '国家公务员局专题页的公告、报考指南和职位表能直接决定能不能报。学生应先核对专业限制、学历学位、政治面貌、基层经历、招录人数、报名确认和资格复审材料，再判断是否投入备考。', '国家公务员局考试录用专题', 'http://bm.scs.gov.cn/kl2026', '已发布'),
  ('用研招网专业目录锁定考试科目', '考研', '研招网硕士专业目录按专业或招生单位查询当年招生专业和考试科目。择校时先核对专业代码、研究方向、学习方式、初试科目和专项计划，再到学院官网确认复试细则。', '研招网硕士专业目录按专业或招生单位查询当年招生专业和考试科目。择校时先核对专业代码、研究方向、学习方式、初试科目和专项计划，再到学院官网确认复试细则。', '中国研究生招生信息网', 'https://yz.chsi.com.cn/zsml/', '已发布'),
  ('24365 职位库适合建立岗位关键词池', '就业', '国家大学生就业服务平台职位库可按城市、学历、岗位类型和实习/全职筛选。学生可记录岗位名称、专业要求、企业行业、投递截止时间和高频技能词，用来反推简历项目表达。', '国家大学生就业服务平台职位库可按城市、学历、岗位类型和实习/全职筛选。学生可记录岗位名称、专业要求、企业行业、投递截止时间和高频技能词，用来反推简历项目表达。', '国家大学生就业服务平台', 'https://24365.ncss.cn/student/jobs/index.html', '已发布'),
  ('2026 届毕业年份范围已开放维护', '公告', '未完成基础档案的学生请先补全资料，再进入深度问卷。', '未完成基础档案的学生请先补全资料，再进入深度问卷。', '后台维护', '', '已发布'),
  ('公开权威数据发布前均需人工审核', '公告', '新增数据源抓取候选不会直接公开，管理员审核通过后才进入前台展示。', '新增数据源抓取候选不会直接公开，管理员审核通过后才进入前台展示。', '后台维护', '', '已发布'),
  ('问卷草稿会保存多久？', 'FAQ', '深度问卷草稿至少保存 180 天，再次进入会恢复最近一次填写位置。', '深度问卷草稿至少保存 180 天，再次进入会恢复最近一次填写位置。', '后台维护', '', '已发布'),
  ('AI 报告能替我做决定吗？', 'FAQ', 'AI 报告仅供辅助决策，不替代学生最终选择。', 'AI 报告仅供辅助决策，不替代学生最终选择。', '后台维护', '', '已发布'),
  ('上海本地招录公告重点看附件', '考公', '上海公务员局招录专题和上海人社招聘公告更适合查上海本地招录批次。重点看公告附件里的岗位代码、专业目录口径、资格条件、报名入口、审核、缴费和面试节点，别只看新闻标题。', '上海公务员局招录专题和上海人社招聘公告更适合查上海本地招录批次。重点看公告附件里的岗位代码、专业目录口径、资格条件、报名入口、审核、缴费和面试节点，别只看新闻标题。', '上海市公务员局 / 上海人社', 'https://rsj.sh.gov.cn/tzpgg_17408/index.html', '已发布'),
  ('调剂系统开放前先整理可接受边界', '考研', '研招网复试调剂页会显示调剂系统状态、基本要求、注意事项和院校调剂信息。初试分数处于边缘时，应提前整理成绩、专业背景、目标地区和可接受专业，避免系统开放时临时筛校。', '研招网复试调剂页会显示调剂系统状态、基本要求、注意事项和院校调剂信息。初试分数处于边缘时，应提前整理成绩、专业背景、目标地区和可接受专业，避免系统开放时临时筛校。', '研招网复试调剂', 'https://yz.chsi.com.cn/yztj/', '已发布'),
  ('本校研招网用于核对学院细则', '考研', '上海理工大学研究生招生网用于核对招生简章、学院复试办法、调剂通知和联系方式。报本校或同层次院校时，优先看学院细则和附件中的复试比例、材料清单、成绩折算办法。', '上海理工大学研究生招生网用于核对招生简章、学院复试办法、调剂通知和联系方式。报本校或同层次院校时，优先看学院细则和附件中的复试比例、材料清单、成绩折算办法。', '上海理工大学研究生招生网', 'https://yz.usst.edu.cn/', '已发布'),
  ('专场招聘会比泛岗位列表更适合抓批次', '就业', '24365 专场招聘会页面适合发现集中招聘窗口。学生可以按行业、地区和主题建立投递日历，记录报名入口、参会企业、岗位面向专业和截止时间，避免错过秋招、春招或专项招聘批次。', '24365 专场招聘会页面适合发现集中招聘窗口。学生可以按行业、地区和主题建立投递日历，记录报名入口、参会企业、岗位面向专业和截止时间，避免错过秋招、春招或专项招聘批次。', '国家大学生就业服务平台', 'https://www.24365.ncss.cn/student/jobfair/index.html', '已发布'),
  ('留沪就业要同时看公共服务和校内宣讲', '就业', '乐业上海和学校就业信息网适合核对上海本地招聘活动、政策服务、宣讲会和校内双选会。准备留沪的学生应把本地公共就业服务、校内宣讲和企业网申入口放在同一张投递表里管理。', '乐业上海和学校就业信息网适合核对上海本地招聘活动、政策服务、宣讲会和校内双选会。准备留沪的学生应把本地公共就业服务、校内宣讲和企业网申入口放在同一张投递表里管理。', '乐业上海 / 上海理工大学就业信息网', 'https://jobs.rsj.sh.gov.cn/', '已发布')
ON DUPLICATE KEY UPDATE
  body = VALUES(body),
  summary = VALUES(summary),
  source_name = VALUES(source_name),
  source_url = VALUES(source_url),
  status = VALUES(status);

INSERT INTO chart_info (id, title, chart_type, path, data_json, methodology, source_name, source_url, status, visibility, display_position)
VALUES
  (1, '2024-2026 高校毕业生规模', '趋势图', '全部', json_object(
      'xKey','year',
      'series', json_array(json_object('key','graduates','name','高校毕业生规模（万人）','color','#b45309')),
      'insights', json_array('2026 届规模预计约 1270 万人，继续处在高位。','就业方向需要更早完成岗位画像、实习经历和投递节奏管理。'),
      'rows', json_array(
        json_object('year','2024','graduates',1179),
        json_object('year','2025','graduates',1222),
        json_object('year','2026','graduates',1270)
      )
    ), '按教育部公开发布的当届全国普通高校毕业生预计规模统计，单位为万人。', '教育部、央视网（据教育部）', 'https://news.cctv.com/2025/11/20/ARTI0xYbzeyS5Y6Zky3R3VZg251120.shtml', '已发布', '公开', '首页'),
  (2, '2022-2026 研考报名人数变化', '趋势图', '考研', json_object(
      'xKey','year',
      'series', json_array(json_object('key','applicants','name','研考报名人数（万人）','color','#0f766e')),
      'insights', json_array('研考报名人数连续三年回落，不代表目标院校竞争同步下降。','应结合专业目录、复试线、推免比例与调剂空间判断真实难度。'),
      'rows', json_array(
        json_object('year','2022','applicants',457),
        json_object('year','2023','applicants',474),
        json_object('year','2024','applicants',438),
        json_object('year','2025','applicants',388),
        json_object('year','2026','applicants',343)
      )
    ), '全国硕士研究生招生考试报名人数，单位为万人；用于观察总体热度，不替代院校专业层面的录取难度分析。', '教育部、央视网（据教育部）', 'https://news.cctv.cn/2025/11/24/ARTINT5iuLLp0mtEfdDd7Kkl251124.shtml', '已发布', '公开', '图表中心'),
  (3, '2024-2026 国考资格审查竞争比', '趋势图', '考公', json_object(
      'xKey','year',
      'series', json_array(json_object('key','ratio','name','约每个录用计划对应过审人数','color','#2563eb')),
      'insights', json_array('2026 年国考约 98:1，岗位筛选比单纯刷题更早决定上限。','考公规划应同时关注国考、省考、事业单位和选调等不同机会窗口。'),
      'rows', json_array(
        json_object('year','2024','ratio',77),
        json_object('year','2025','ratio',86),
        json_object('year','2026','ratio',98)
      )
    ), '以官方公布的资格审查通过人数与计划招录人数估算，展示约数竞争比。', '中国政府网、国家公务员局', 'https://www.gov.cn/lianbo/bumen/202510/content_7045734.htm', '已发布', '公开', '图表中心'),
  (4, '2026 国考招录与过审规模', '柱状图', '考公', json_object(
      'xKey','label',
      'series', json_array(json_object('key','people','name','人数（万人）','color','#2563eb')),
      'insights', json_array('报名规模远高于招录规模，选岗限制条件会显著影响真实竞争。','专业、政治面貌、基层经历、应届身份等字段需要提前核对。'),
      'rows', json_array(
        json_object('label','计划招录','people',3.81),
        json_object('label','资格审查通过','people',371.8)
      )
    ), '2026 年度中央机关及其直属机构考试录用公务员计划招录约 3.81 万人，资格审查通过 371.8 万人。', '中国政府网、国家公务员局', 'https://www.gov.cn/lianbo/bumen/202510/content_7045734.htm', '已发布', '公开', '图表中心'),
  (5, '2026 届就业供需参考', '柱状图', '就业', json_object(
      'xKey','label',
      'series', json_array(json_object('key','people','name','规模（万人/万个）','color','#b45309')),
      'insights', json_array('岗位信息规模不等同于有效 offer，仍需看行业、城市和岗位匹配度。','建议以目标岗位 JD 反推技能证据，而不是只按专业名称投递。'),
      'rows', json_array(
        json_object('label','高校毕业生规模','people',1270),
        json_object('label','金秋启航岗位信息','people',1200)
      )
    ), '2026 届高校毕业生预计约 1270 万人；教育部启动金秋启航校园招聘月，汇集发布岗位信息超 1200 万个。', '教育部、央视网（据教育部）', 'https://news.cctv.com/2025/11/20/ARTI0xYbzeyS5Y6Zky3R3VZg251120.shtml', '已发布', '公开', '图表中心'),
  (6, '考研关键节点时间线', '时间线图', '考研', json_object('rows', json_array(
      json_object('stage','9-10 月','description','关注研招网公告、招生单位章程、专业目录和网报安排。'),
      json_object('stage','12 月','description','参加初试，并同步准备复试材料和调剂预案。'),
      json_object('stage','次年 2-3 月','description','查询初试成绩、复试线与调剂系统开放安排。'),
      json_object('stage','次年 3-4 月','description','参加复试/调剂，重点跟踪目标院校学院通知。')
    ), 'insights', json_array('考研不是只看初试分数，复试信息差和调剂速度也会影响结果。')), '按研招网年度网报、初试、复试调剂服务等公开流程整理。', '中国研究生招生信息网', 'https://yz.chsi.com.cn/', '已发布', '公开', '图表中心'),
  (7, '考公关键节点时间线', '时间线图', '考公', json_object('rows', json_array(
      json_object('stage','10 月','description','关注国考公告、职位表、报考指南和专业目录匹配。'),
      json_object('stage','11-12 月','description','参加公共科目笔试，部分岗位还需专业科目。'),
      json_object('stage','次年 1 月左右','description','查询笔试成绩和首批面试名单。'),
      json_object('stage','次年 2-4 月','description','准备资格复审、面试、体检和考察。')
    ), 'insights', json_array('考公时间线固定性强，最容易被低估的是职位表筛选和资格条件核验。')), '按国家公务员局中央机关及其直属机构考试录用公务员专题信息整理。', '国家公务员局', 'http://bm.scs.gov.cn/kl2026', '已发布', '公开', '图表中心'),
  (8, '就业关键行动时间线', '时间线图', '就业', json_object('rows', json_array(
      json_object('stage','5-6 月','description','锁定 2-3 类目标岗位，整理项目、实习、竞赛和课程作品证据。'),
      json_object('stage','7-8 月','description','完成简历、作品集、笔试题库和目标企业清单。'),
      json_object('stage','9-11 月','description','跟进秋招、专场招聘和宣讲会，记录投递转化率。'),
      json_object('stage','12 月以后','description','进行 offer 对比、补录关注和毕业去向材料确认。')
    ), 'insights', json_array('就业准备要用岗位要求倒推能力证据，不能只等招聘信息出现。')), '参考教育部国家大学生就业服务平台与校园招聘专项行动公开信息整理。', '国家大学生就业服务平台', 'https://www.24365.ncss.cn/student/jobs/index.html', '已发布', '公开', '图表中心')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  chart_type = VALUES(chart_type),
  path = VALUES(path),
  data_json = VALUES(data_json),
  methodology = VALUES(methodology),
  source_name = VALUES(source_name),
  source_url = VALUES(source_url),
  status = VALUES(status),
  visibility = VALUES(visibility),
  display_position = VALUES(display_position);

UPDATE chart_info SET filters_json = JSON_OBJECT() WHERE id BETWEEN 1 AND 8;

INSERT INTO path_page_config
  (path_key, name, intro, suitable_json, timeline_json, pitfalls_json, accent, match_score, sort_order, status)
VALUES
  ('civil-exam', '考公', '政策理解、岗位匹配与稳定备考节奏',
   json_array('偏好稳定职业环境', '愿意持续训练公共科目', '能接受岗位筛选约束'),
   json_array('3-4 月梳理岗位', '6-8 月系统刷题', '10-11 月冲刺模考', '面试前复盘表达'),
   json_array('只看热门岗位', '忽视基层经历要求', '申论练习缺少反馈'),
   '#2563eb', 82, 1, '启用'),
  ('postgraduate', '考研', '择校边界、科目规划与复试材料准备',
   json_array('希望提升学历', '能接受长周期复习', '专业兴趣明确'),
   json_array('3 月确定专业', '6 月完成基础轮', '9 月进入真题轮', '12 月考前查漏补缺'),
   json_array('择校只看名气', '忽略复试差额比', '公共课进度失衡'),
   '#0f766e', 76, 2, '启用'),
  ('employment', '就业', '能力证明、岗位画像与校招行动管理',
   json_array('项目经历较多', '希望尽快进入行业', '愿意持续面试迭代'),
   json_array('5 月整理经历', '7 月完善简历', '9 月密集投递', '11 月复盘 offer'),
   json_array('简历缺少量化结果', '只投单一岗位', '面试复盘不成体系'),
   '#b45309', 88, 3, '启用')
ON DUPLICATE KEY UPDATE
  path_key = VALUES(path_key);

INSERT INTO template_resource (name, category, file_format, file_url, status)
VALUES
  ('通用校招简历模板', '就业', 'DOCX', '/templates/employment-resume-template.docx', '已发布'),
  ('考公报名信息整理表', '考公', 'XLSX', '/templates/civil-position-screening.xlsx', '已发布'),
  ('复试个人陈述模板', '考研', 'DOCX', '/templates/postgraduate-personal-statement.docx', '已发布'),
  ('面试复盘记录表', '就业', 'DOCX', '/templates/employment-interview-review.docx', '已发布'),
  ('校招投递跟踪表', '就业', 'XLSX', '/templates/employment-application-tracker.xlsx', '已发布'),
  ('考公备考周计划模板', '考公', 'DOCX', '/templates/civil-study-plan.docx', '已发布'),
  ('考公报名材料核对清单', '考公', 'DOCX', '/templates/civil-application-checklist.docx', '已发布'),
  ('考研院校专业对比表', '考研', 'XLSX', '/templates/postgraduate-school-comparison.xlsx', '已发布'),
  ('复试材料核对清单', '考研', 'DOCX', '/templates/postgraduate-retest-materials.docx', '已发布')
ON DUPLICATE KEY UPDATE
  file_format = VALUES(file_format),
  file_url = VALUES(file_url),
  status = VALUES(status);

INSERT INTO community_post
  (id, student_id, title, body, type, path, anonymous, status, likes, favorites, replies)
VALUES
  (1, 1, '从光电专业转软件测试岗，我把项目经历这样改成简历亮点', '围绕课程设计、实习、比赛三个材料，把经历拆成问题、动作、结果三段。', '经验帖', '就业', 0, '已通过', 126, 58, 18),
  (2, 1, '省考和事业单位能不能同时准备？时间怎么分配更稳', '公共科目可复用，但岗位表筛选、申论材料和面试准备要分开管理。', '问答', '考公', 1, '已通过', 88, 41, 24)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  body = VALUES(body),
  type = VALUES(type),
  path = VALUES(path),
  anonymous = VALUES(anonymous),
  status = VALUES(status),
  likes = VALUES(likes),
  favorites = VALUES(favorites),
  replies = VALUES(replies);

INSERT INTO data_source
  (name, source_type, source_url, crawl_frequency, path, trust_level, status, last_crawl_at)
VALUES
  ('研招网硕士专业目录', '专业目录与考试科目', 'https://yz.chsi.com.cn/zsml/', '每日', '考研', '高', '启用', '2026-05-04 09:30:00'),
  ('研招网复试调剂服务', '复试调剂信息', 'https://yz.chsi.com.cn/yztj/', '每日', '考研', '高', '启用', '2026-05-04 09:30:00'),
  ('上海理工大学研究生招生网', '校内研招公告', 'https://yz.usst.edu.cn/', '每日', '考研', '高', '启用', '2026-05-04 09:30:00'),
  ('国考考试录用公务员专题', '岗位表与报考指南', 'http://bm.scs.gov.cn/kl2026', '每日', '考公', '高', '启用', '2026-05-04 09:30:00'),
  ('上海市公务员局招录专题', '地方公务员招录', 'https://bm.shacs.gov.cn/zlxt', '每日', '考公', '高', '启用', '2026-05-04 09:30:00'),
  ('上海人社事业单位招聘公告', '事业单位招聘公告', 'https://rsj.sh.gov.cn/tzpgg_17408/index.html', '每日', '考公', '高', '启用', '2026-05-04 09:30:00'),
  ('国家大学生就业服务平台职位库', '校招岗位与实习岗位', 'https://24365.ncss.cn/student/jobs/index.html', '每日', '就业', '高', '启用', '2026-05-04 09:30:00'),
  ('国家大学生就业服务平台专场招聘', '专场招聘会', 'https://www.24365.ncss.cn/student/jobfair/index.html', '每日', '就业', '高', '启用', '2026-05-04 09:30:00'),
  ('乐业上海第一站', '上海就业服务与招聘', 'https://jobs.rsj.sh.gov.cn/', '每日', '就业', '高', '启用', '2026-05-04 09:30:00'),
  ('上海理工大学就业信息网', '校内招聘与宣讲会', 'https://91.usst.edu.cn/', '每日', '就业', '高', '启用', '2026-05-04 09:30:00')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  source_type = VALUES(source_type),
  source_url = VALUES(source_url),
  crawl_frequency = VALUES(crawl_frequency),
  path = VALUES(path),
  trust_level = VALUES(trust_level),
  status = VALUES(status),
  last_crawl_at = VALUES(last_crawl_at);

INSERT INTO tag_config (name, tag_type, status, sort_order)
VALUES
  ('考公', '路径标签', '启用', 1),
  ('考研', '路径标签', '启用', 2),
  ('就业', '路径标签', '启用', 3),
  ('光电信息与计算机工程学院', '学院标签', '启用', 1),
  ('计算机科学与技术', '专业标签', '启用', 1),
  ('经验帖', '内容标签', '启用', 1),
  ('问答', '内容标签', '启用', 2)
ON DUPLICATE KEY UPDATE status = VALUES(status), sort_order = VALUES(sort_order);

INSERT INTO ai_config (config_type, version, title, content, status, published_at)
VALUES
  ('questionnaire', 'QNR-2026.05', '深度问卷模板', '学业成绩、英语与证书、项目/实习、家庭与经济约束、目标城市、风险偏好、兴趣倾向、时间投入、压力承受、三路径意愿强度、当前困难点', '已发布', current_timestamp),
  ('report_template', 'RPTTPL-2026.05', '三路径报告模板', '输出现状摘要、三路径评分、推荐排序、推荐理由、主要风险、备选方案、30/60/90 天行动计划、资源建议与免责声明。', '已发布', current_timestamp),
  ('prompt', 'PROMPT-2026.05', '报告生成提示词', '基于问卷输入快照生成职业路径辅助建议，不输出录取、上岸、就业结果承诺。', '已发布', current_timestamp),
  ('disclaimer', 'DISC-2026.05', 'AI 免责声明', 'AI 报告仅供辅助决策，不替代学生最终选择。', '已发布', current_timestamp)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  content = VALUES(content),
  status = VALUES(status),
  published_at = VALUES(published_at);
