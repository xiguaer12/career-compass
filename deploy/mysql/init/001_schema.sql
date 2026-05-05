CREATE DATABASE IF NOT EXISTS career_compass DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE career_compass;

CREATE TABLE IF NOT EXISTS student_account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(40),
  student_no VARCHAR(40) UNIQUE,
  college VARCHAR(120),
  major VARCHAR(120),
  graduation_year VARCHAR(10),
  phone VARCHAR(20),
  nickname VARCHAR(40),
  avatar_url VARCHAR(500),
  privacy_json JSON,
  agreement_accepted TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT '待邮箱验证',
  login_failures INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL,
  canceled_at TIMESTAMP NULL,
  profile_updated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  INDEX idx_student_status (status),
  INDEX idx_student_graduation_year (graduation_year)
);

CREATE TABLE IF NOT EXISTS verification_code (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(120) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(80),
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code_email_purpose (email, purpose, created_at)
);

CREATE TABLE IF NOT EXISTS questionnaire_snapshot (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  questionnaire_version VARCHAR(40) NOT NULL,
  answers_json JSON NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '草稿',
  step_key VARCHAR(60),
  completion_percent INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL,
  submitted_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_questionnaire_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  INDEX idx_questionnaire_student_status (student_id, status)
);

CREATE TABLE IF NOT EXISTS ai_report (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  questionnaire_snapshot_id BIGINT NOT NULL,
  report_version VARCHAR(40) NOT NULL,
  template_version VARCHAR(40) NOT NULL DEFAULT 'RPT-2026.04',
  prompt_version VARCHAR(40) NOT NULL DEFAULT 'PROMPT-2026.04',
  report_json JSON NOT NULL,
  generation_status VARCHAR(30) NOT NULL DEFAULT '排队中',
  failure_reason VARCHAR(500),
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  generated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  CONSTRAINT fk_report_questionnaire FOREIGN KEY (questionnaire_snapshot_id) REFERENCES questionnaire_snapshot(id),
  INDEX idx_report_student_created (student_id, created_at)
);

CREATE TABLE IF NOT EXISTS content_info (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  summary VARCHAR(500),
  source_name VARCHAR(120),
  source_url VARCHAR(500),
  tags VARCHAR(300),
  display_position VARCHAR(60),
  sort_order INT NOT NULL DEFAULT 0,
  publish_at TIMESTAMP NULL,
  offline_at TIMESTAMP NULL,
  status VARCHAR(30) NOT NULL DEFAULT '待审核',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_content_title_category (title, category),
  INDEX idx_content_category_status (category, status)
);

CREATE TABLE IF NOT EXISTS chart_info (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(80) NOT NULL,
  chart_type VARCHAR(40) NOT NULL,
  path VARCHAR(40) NOT NULL,
  data_json JSON NOT NULL,
  methodology VARCHAR(500) NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(500),
  filters_json JSON,
  visibility VARCHAR(40) NOT NULL DEFAULT '公开',
  display_position VARCHAR(60),
  status VARCHAR(30) NOT NULL DEFAULT '待审核',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chart_path_status (path, status)
);

CREATE TABLE IF NOT EXISTS path_page_config (
  path_key VARCHAR(40) PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  intro VARCHAR(500) NOT NULL,
  suitable_json JSON NOT NULL,
  timeline_json JSON NOT NULL,
  pitfalls_json JSON NOT NULL,
  accent VARCHAR(20) NOT NULL DEFAULT '#b45309',
  match_score INT NOT NULL DEFAULT 80,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT '启用',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_path_status_sort (status, sort_order)
);

CREATE TABLE IF NOT EXISTS tag_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  tag_type VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '启用',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_name_type (name, tag_type),
  INDEX idx_tag_type_status (tag_type, status)
);

CREATE TABLE IF NOT EXISTS ai_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  config_type VARCHAR(40) NOT NULL,
  version VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '草稿',
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_config_version (config_type, version),
  INDEX idx_ai_config_type_status (config_type, status)
);

CREATE TABLE IF NOT EXISTS template_resource (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '已发布',
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_name_category (name, category),
  INDEX idx_template_category_status (category, status)
);

CREATE TABLE IF NOT EXISTS community_post (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  title VARCHAR(80) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  path VARCHAR(40) NOT NULL,
  anonymous TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT '待审核',
  reject_reason VARCHAR(300),
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  favorites INT NOT NULL DEFAULT 0,
  replies INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  INDEX idx_post_path_status_created (path, status, created_at),
  INDEX idx_post_student_created (student_id, created_at)
);

CREATE TABLE IF NOT EXISTS community_comment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  parent_comment_id BIGINT NULL,
  body TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '已通过',
  best_answer TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES community_post(id),
  CONSTRAINT fk_comment_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  INDEX idx_comment_post_created (post_id, created_at)
);

CREATE TABLE IF NOT EXISTS community_interaction (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  interaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_interaction_post FOREIGN KEY (post_id) REFERENCES community_post(id),
  CONSTRAINT fk_interaction_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  UNIQUE KEY uq_interaction (post_id, student_id, interaction_type),
  INDEX idx_interaction_student (student_id, interaction_type)
);

CREATE TABLE IF NOT EXISTS abuse_report (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reporter_student_id BIGINT NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id BIGINT NOT NULL,
  reason VARCHAR(300) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '待处理',
  handled_by VARCHAR(80),
  handled_result VARCHAR(300),
  handled_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_abuse_status_created (status, created_at)
);

CREATE TABLE IF NOT EXISTS system_message (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(800) NOT NULL,
  link_url VARCHAR(500),
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  INDEX idx_message_student_read (student_id, read_at, created_at)
);

CREATE TABLE IF NOT EXISTS user_activity (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  item_type VARCHAR(40) NOT NULL,
  item_id VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  url VARCHAR(500),
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_student FOREIGN KEY (student_id) REFERENCES student_account(id),
  UNIQUE KEY uq_student_activity (student_id, item_type, item_id),
  INDEX idx_activity_student_viewed (student_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS data_source (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  crawl_frequency VARCHAR(40) NOT NULL,
  path VARCHAR(40) NOT NULL,
  trust_level VARCHAR(30) NOT NULL,
  parser_rule_json JSON,
  status VARCHAR(30) NOT NULL DEFAULT '启用',
  last_crawl_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_data_source_url (source_url),
  INDEX idx_source_path_status (path, status)
);

CREATE TABLE IF NOT EXISTS crawl_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  trigger_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '待抓取',
  result_message VARCHAR(500),
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_source FOREIGN KEY (source_id) REFERENCES data_source(id),
  INDEX idx_task_source_created (source_id, created_at)
);

CREATE TABLE IF NOT EXISTS crawl_candidate (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  task_id BIGINT NULL,
  raw_url VARCHAR(500) NOT NULL,
  parsed_json JSON NOT NULL,
  review_status VARCHAR(30) NOT NULL DEFAULT '待审核',
  failure_reason VARCHAR(500),
  crawled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  parsed_at TIMESTAMP NULL,
  published_at TIMESTAMP NULL,
  CONSTRAINT fk_candidate_source FOREIGN KEY (source_id) REFERENCES data_source(id),
  CONSTRAINT fk_candidate_task FOREIGN KEY (task_id) REFERENCES crawl_task(id),
  INDEX idx_candidate_review_status (review_status, crawled_at)
);

CREATE TABLE IF NOT EXISTS admin_account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT '正常',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(80) NOT NULL,
  detail_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_target (target_type, target_id),
  INDEX idx_audit_created (created_at)
);
