package com.careercompass.service;

import com.careercompass.model.Dtos.*;
import com.careercompass.service.SecurityService.AuthUser;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CompassService {
  private static final String QUESTIONNAIRE_VERSION = "QNR-2026.05";
  private static final String REPORT_VERSION = "RPT-2026.05";
  private static final String PROMPT_VERSION = "PROMPT-2026.05";
  private static final String TEMPLATE_VERSION = "RPTTPL-2026.05";
  private static final String GRADUATE_EMPLOYMENT_SOURCE_URL = "https://news.cctv.com/2025/11/20/ARTI0xYbzeyS5Y6Zky3R3VZg251120.shtml";
  private static final String POSTGRADUATE_SOURCE_URL = "https://news.cctv.cn/2025/11/24/ARTINT5iuLLp0mtEfdDd7Kkl251124.shtml";
  private static final String CIVIL_EXAM_SOURCE_URL = "https://www.gov.cn/lianbo/bumen/202510/content_7045734.htm";
  private static final int MAX_COMMUNITY_IMAGES = 3;
  private static final Map<String, List<String>> USST_COLLEGE_MAJORS = Map.ofEntries(
      Map.entry("能源与动力工程学院", List.of("过程装备与控制工程", "能源与动力工程", "新能源科学与工程", "储能科学与工程")),
      Map.entry("光电信息与计算机工程学院", List.of("测控技术与仪器", "电子信息工程", "电子科学与技术", "通信工程", "光电信息科学与工程", "自动化", "计算机科学与技术", "智能科学与技术", "数据科学与大数据技术")),
      Map.entry("管理学院", List.of("税收学", "金融学", "国际经济与贸易", "系统科学与工程", "人工智能", "交通工程", "管理科学", "信息管理与信息系统", "工商管理", "会计学", "公共事业管理", "工业工程")),
      Map.entry("机械工程学院", List.of("机械设计制造及其自动化", "车辆工程", "电气工程及其自动化", "机器人工程")),
      Map.entry("外语学院", List.of("英语", "德语", "日语")),
      Map.entry("环境与建筑学院", List.of("土木工程", "建筑环境与能源应用工程", "环境工程")),
      Map.entry("健康科学与工程学院", List.of("生物医学工程", "食品科学与工程", "食品质量与安全", "康复工程", "医学信息工程", "智能医学工程", "医学影像技术", "制药工程", "生物技术")),
      Map.entry("出版印刷与艺术设计学院", List.of("编辑出版学", "传播学", "广告学", "工业设计", "新媒体技术", "包装工程", "动画", "视觉传达设计", "环境设计", "产品设计", "包装设计")),
      Map.entry("理学院", List.of("数学与应用数学", "应用物理学")),
      Map.entry("材料与化学学院", List.of("材料成型及控制工程", "材料科学与工程", "应用化学")),
      Map.entry("中英国际学院", List.of("电子信息科学与技术（中英合作）", "机械设计制造及其自动化（中英合作）", "工商管理（中英合作）", "会展经济与管理"))
  );

  private final Pattern studentEmailPattern;
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final SecurityService security;
  private final LlmClient llmClient;
  private final EmailVerificationService emailVerificationService;
  private final HttpClient crawlHttpClient = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(12))
      .followRedirects(HttpClient.Redirect.NORMAL)
      .build();
  private final ScheduledExecutorService reportExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
    Thread thread = new Thread(runnable, "career-compass-report-worker");
    thread.setDaemon(true);
    return thread;
  });
  private final ScheduledExecutorService crawlExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
    Thread thread = new Thread(runnable, "career-compass-crawl-worker");
    thread.setDaemon(true);
    return thread;
  });
  private final ScheduledExecutorService chartExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
    Thread thread = new Thread(runnable, "career-compass-chart-refresh-worker");
    thread.setDaemon(true);
    return thread;
  });
  private final AtomicBoolean autoCrawlRunning = new AtomicBoolean(false);
  private final AtomicBoolean chartRefreshRunning = new AtomicBoolean(false);
  private final boolean autoCrawlEnabled;
  private final int autoCrawlInitialDelayMinutes;
  private final int autoCrawlIntervalMinutes;
  private final boolean chartAutoRefreshEnabled;
  private final int chartAutoRefreshInitialDelayMinutes;
  private final int chartAutoRefreshIntervalMinutes;
  private final Path communityUploadDir;
  private final long communityUploadMaxBytes;

  public CompassService(
      @Value("${app.student-email-pattern:^\\d{10}@st\\.usst\\.edu\\.cn$}") String studentEmailPattern,
      @Value("${app.auto-crawl.enabled:true}") boolean autoCrawlEnabled,
      @Value("${app.auto-crawl.initial-delay-minutes:5}") int autoCrawlInitialDelayMinutes,
      @Value("${app.auto-crawl.interval-minutes:60}") int autoCrawlIntervalMinutes,
      @Value("${app.chart-auto-refresh.enabled:true}") boolean chartAutoRefreshEnabled,
      @Value("${app.chart-auto-refresh.initial-delay-minutes:10}") int chartAutoRefreshInitialDelayMinutes,
      @Value("${app.chart-auto-refresh.interval-minutes:720}") int chartAutoRefreshIntervalMinutes,
      @Value("${app.community-upload.dir:uploads/community}") String communityUploadDir,
      @Value("${app.community-upload.max-image-mb:5}") long communityUploadMaxImageMb,
      JdbcTemplate jdbc,
      ObjectMapper objectMapper,
      SecurityService security,
      LlmClient llmClient,
      EmailVerificationService emailVerificationService
  ) {
    this.studentEmailPattern = Pattern.compile(studentEmailPattern, Pattern.CASE_INSENSITIVE);
    this.autoCrawlEnabled = autoCrawlEnabled;
    this.autoCrawlInitialDelayMinutes = Math.max(1, autoCrawlInitialDelayMinutes);
    this.autoCrawlIntervalMinutes = Math.max(5, autoCrawlIntervalMinutes);
    this.chartAutoRefreshEnabled = chartAutoRefreshEnabled;
    this.chartAutoRefreshInitialDelayMinutes = Math.max(1, chartAutoRefreshInitialDelayMinutes);
    this.chartAutoRefreshIntervalMinutes = Math.max(30, chartAutoRefreshIntervalMinutes);
    this.communityUploadDir = Path.of(communityUploadDir).toAbsolutePath().normalize();
    this.communityUploadMaxBytes = Math.max(1, communityUploadMaxImageMb) * 1024 * 1024;
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.security = security;
    this.llmClient = llmClient;
    this.emailVerificationService = emailVerificationService;
  }

  @PostConstruct
  public void ensureSchemaAndSeedData() {
    createRuntimeTables();
    addColumn("student_account", "canceled_at TIMESTAMP NULL");
    addColumn("student_account", "profile_updated_at TIMESTAMP NULL");
    addColumn("questionnaire_snapshot", "step_key VARCHAR(60)");
    addColumn("questionnaire_snapshot", "completion_percent INT NOT NULL DEFAULT 0");
    addColumn("questionnaire_snapshot", "expires_at TIMESTAMP NULL");
    addColumn("ai_report", "template_version VARCHAR(40) NOT NULL DEFAULT 'RPTTPL-2026.05'");
    addColumn("ai_report", "prompt_version VARCHAR(40) NOT NULL DEFAULT 'PROMPT-2026.05'");
    addColumn("ai_report", "failure_reason VARCHAR(500)");
    addColumn("ai_report", "started_at TIMESTAMP NULL");
    addColumn("ai_report", "completed_at TIMESTAMP NULL");
    addColumn("content_info", "tags VARCHAR(300)");
    addColumn("content_info", "display_position VARCHAR(60)");
    addColumn("content_info", "sort_order INT NOT NULL DEFAULT 0");
    addColumn("content_info", "publish_at TIMESTAMP NULL");
    addColumn("content_info", "offline_at TIMESTAMP NULL");
    addColumn("chart_info", "filters_json JSON");
    addColumn("chart_info", "visibility VARCHAR(40) NOT NULL DEFAULT '公开'");
    addColumn("chart_info", "display_position VARCHAR(60)");
    addColumn("community_post", "reject_reason VARCHAR(300)");
    addColumn("community_post", "pinned TINYINT(1) NOT NULL DEFAULT 0");
    addColumn("community_post", "featured TINYINT(1) NOT NULL DEFAULT 0");
    addColumn("community_post", "image_urls_json JSON");
    addColumn("community_post", "deleted_at TIMESTAMP NULL");
    addColumn("community_comment", "best_answer TINYINT(1) NOT NULL DEFAULT 0");
    addColumn("community_comment", "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    addColumn("abuse_report", "handled_result VARCHAR(300)");
    addColumn("data_source", "parser_rule_json JSON");
    addColumn("crawl_candidate", "task_id BIGINT NULL");
    repairSeedData();
    recoverInterruptedCrawlTasks();
    startAutoCrawlScheduler();
    startAutoChartRefreshScheduler();
  }

  @PreDestroy
  public void shutdownReportExecutor() {
    reportExecutor.shutdownNow();
    crawlExecutor.shutdownNow();
    chartExecutor.shutdownNow();
  }

  public Session register(AuthRequest request) {
    validateAuth(request);
    String email = normalizeEmail(request.email());
    Integer existing = jdbc.queryForObject("select count(*) from student_account where email = ?", Integer.class, email);
    if (existing != null && existing > 0) {
      throw new IllegalArgumentException("该邮箱已注册，请直接登录");
    }
    String studentNo = studentNoFromEmail(email);
    String graduationYear = graduationYearFromStudentNo(studentNo);
    ProfileRequest profileRequest = new ProfileRequest(
        request.name(),
        studentNo,
        request.college(),
        request.major(),
        graduationYear,
        request.phone(),
        request.nickname(),
        Map.of("hideSensitive", true)
    );
    validateProfile(0, profileRequest, studentNo);
    emailVerificationService.verifyRegisterCode(email, request.verificationCode());

    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into student_account
            (email, password_hash, name, student_no, college, major, graduation_year, phone, nickname,
             privacy_json, agreement_accepted, status, profile_updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as json), 1, '待完成问卷', current_timestamp)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, email);
      statement.setString(2, security.hashPassword(request.password()));
      statement.setString(3, profileRequest.name());
      statement.setString(4, studentNo);
      statement.setString(5, profileRequest.college());
      statement.setString(6, profileRequest.major());
      statement.setString(7, graduationYear);
      statement.setString(8, profileRequest.phone());
      statement.setString(9, StringUtils.hasText(profileRequest.nickname()) ? profileRequest.nickname() : null);
      statement.setString(10, toJson(profileRequest.privacy()));
      return statement;
    }, keyHolder);

    long id = keyHolder.getKey().longValue();
    audit("student:" + email, "REGISTER", "student_account", String.valueOf(id), Map.of("email", email, "studentNo", studentNo, "college", profileRequest.college(), "major", profileRequest.major()));
    createMessage(id, "系统", "注册成功", "个人信息已保存，可以直接开始 AI 访谈。", "/workspace");
    StudentProfile profile = findStudent(id).orElseThrow();
    return new Session(security.issueToken(id, email, "student"), "student", profile.status(), profile);
  }

  public EmailCodeResult sendRegisterCode(EmailCodeRequest request) {
    if (request == null || !StringUtils.hasText(request.email())) {
      throw new IllegalArgumentException("邮箱不能为空");
    }
    String email = normalizeEmail(request.email());
    validateEmailDomain(email);
    Integer existing = jdbc.queryForObject("select count(*) from student_account where email = ?", Integer.class, email);
    if (existing != null && existing > 0) {
      throw new IllegalArgumentException("该邮箱已注册，请直接登录");
    }
    return emailVerificationService.sendRegisterCode(email);
  }

  public Session login(AuthRequest request) {
    validateAuth(request);
    String email = normalizeEmail(request.email());
    List<Map<String, Object>> rows = jdbc.queryForList(
        "select id, password_hash, status from student_account where email = ?",
        email
    );
    if (rows.isEmpty()) {
      throw new IllegalArgumentException("账号或密码错误");
    }
    Map<String, Object> row = rows.getFirst();
    assertLoginAllowed(row);
    long id = ((Number) row.get("id")).longValue();
    if (!security.verifyPassword(request.password(), String.valueOf(row.get("password_hash")))) {
      throw new IllegalArgumentException("账号或密码错误");
    }
    jdbc.update("update student_account set last_login_at = current_timestamp where id = ?", id);
    StudentProfile profile = findStudent(id).orElseThrow();
    return new Session(security.issueToken(id, email, "student"), "student", profile.status(), profile);
  }

  public AdminSession adminLogin(AdminLoginRequest request) {
    if (request == null || !StringUtils.hasText(request.username()) || !StringUtils.hasText(request.password())) {
      throw new IllegalArgumentException("管理员账号和密码不能为空");
    }
    List<Map<String, Object>> rows = jdbc.queryForList(
        "select id, username, password_hash, display_name, status from admin_account where username = ?",
        request.username()
    );
    if (rows.isEmpty() || !"正常".equals(String.valueOf(rows.getFirst().get("status")))) {
      throw new IllegalArgumentException("管理员账号不可用");
    }
    Map<String, Object> row = rows.getFirst();
    if (!security.verifyPassword(request.password(), String.valueOf(row.get("password_hash")))) {
      throw new IllegalArgumentException("管理员账号或密码错误");
    }
    long id = ((Number) row.get("id")).longValue();
    jdbc.update("update admin_account set last_login_at = current_timestamp where id = ?", id);
    return new AdminSession(security.issueToken(id, request.username(), "admin"), "admin", String.valueOf(row.get("display_name")));
  }

  public StudentProfile me(AuthUser user) {
    return findStudent(user.id()).orElseThrow(() -> new IllegalArgumentException("学生不存在"));
  }

  public StudentProfile saveProfile(AuthUser user, ProfileRequest request) {
    String studentNo = studentNoFromEmail(user.email());
    String graduationYear = graduationYearFromStudentNo(studentNo);
    validateProfile(user.id(), request, studentNo);
    jdbc.update(
        """
        update student_account
        set name = ?, student_no = ?, college = ?, major = ?, graduation_year = ?,
            phone = ?, nickname = ?, privacy_json = cast(? as json),
            profile_updated_at = current_timestamp,
            status = case when status = '待补全档案' then '待完成问卷' else status end
        where id = ?
        """,
        request.name(),
        studentNo,
        request.college(),
        request.major(),
        graduationYear,
        request.phone(),
        StringUtils.hasText(request.nickname()) ? request.nickname() : null,
        toJson(request.privacy() == null ? Map.of("hideSensitive", true) : request.privacy()),
        user.id()
    );
    audit("student:" + user.email(), "SAVE_PROFILE", "student_account", String.valueOf(user.id()), Map.of("studentNo", studentNo, "graduationYear", graduationYear));
    return me(user);
  }

  public Map<String, Object> cancelAccount(AuthUser user, CancelAccountRequest request) {
    requireConfirmed(request == null ? null : request.confirmed(), "账号注销");
    jdbc.update("update student_account set status = '注销中', canceled_at = current_timestamp where id = ?", user.id());
    audit("student:" + user.email(), "REQUEST_ACCOUNT_CANCEL", "student_account", String.valueOf(user.id()), Map.of("reason", request == null ? "" : request.reason()));
    createMessage(user.id(), "账号", "注销申请已提交", "账号已进入注销中状态，后台仍会保留必要审计信息。", "/me");
    return Map.of("status", "注销中", "updatedAt", Instant.now().toString());
  }

  public HomePayload homePayload() {
    List<HomeMetric> metrics = homeMetrics();
    List<ContentItem> notices = contents("公告").stream().limit(5).toList();
    List<ContentItem> faqs = contents("FAQ").stream().limit(5).toList();
    List<ChartItem> charts = publicCharts(null, null, null, null).stream()
        .filter(chart -> "首页".equals(chart.displayPosition()) || "图表中心".equals(chart.displayPosition()))
        .sorted(Comparator
            .comparingInt((ChartItem chart) -> "首页".equals(chart.displayPosition()) ? 0 : 1)
            .thenComparing(ChartItem::updatedAt, Comparator.reverseOrder()))
        .limit(4)
        .toList();
    List<CommunityPost> featuredPosts = communityPosts(null, null, null, "featured").stream().limit(4).toList();
    return new HomePayload(metrics, notices, faqs, charts, featuredPosts);
  }

  private List<HomeMetric> homeMetrics() {
    int registeredStudents = countSql("select count(*) from student_account where canceled_at is null");
    int recentStudents = countSql(
        "select count(*) from student_account where canceled_at is null and created_at >= date_sub(current_timestamp, interval 30 day)"
    );
    int completedStudents = countSql("select count(distinct student_id) from questionnaire_snapshot where status = '已完成'");
    int recentCompleted = countSql(
        """
        select count(distinct student_id)
        from questionnaire_snapshot
        where status = '已完成' and submitted_at >= date_sub(current_timestamp, interval 30 day)
        """
    );
    int reportCount = countSql("select count(*) from ai_report where generation_status = '已完成'");
    int recentReports = countSql(
        """
        select count(*)
        from ai_report
        where generation_status = '已完成'
          and coalesce(generated_at, completed_at, created_at) >= date_sub(current_timestamp, interval 30 day)
        """
    );
    int pendingReviews = pendingReviewCount();
    double completionRate = registeredStudents == 0 ? 0 : Math.round(completedStudents * 1000.0 / registeredStudents) / 10.0;

    return List.of(
        new HomeMetric("registeredStudents", "注册学生", formatInteger(registeredStudents), "近30天 +" + recentStudents, "up"),
        new HomeMetric("completionRate", "测评完成率", formatPercent(completionRate), "近30天完成 " + recentCompleted, "up"),
        new HomeMetric("reportCount", "报告生成量", formatInteger(reportCount), "近30天 +" + recentReports, "up"),
        new HomeMetric("pendingReviews", "待审核项", formatInteger(pendingReviews), pendingReviews > 0 ? "需处理" : "暂无待办", pendingReviews > 0 ? "warn" : "ok")
    );
  }

  private int pendingReviewCount() {
    return countSql("select count(*) from community_post where status = '待审核' and deleted_at is null")
        + countSql("select count(*) from abuse_report where status = '待处理'")
        + countSql("select count(*) from crawl_candidate where review_status = '待审核'")
        + countSql("select count(*) from content_info where status = '待审核'")
        + countSql("select count(*) from chart_info where status = '待审核'");
  }

  private String formatInteger(int value) {
    return String.format(Locale.US, "%,d", value);
  }

  private String formatPercent(double value) {
    return String.format(Locale.US, "%.1f%%", value);
  }

  public List<ContentItem> contents(String category) {
    if (!StringUtils.hasText(category)) {
      return jdbc.query(
          "select * from content_info where status = '已发布' order by sort_order asc, updated_at desc",
          (rs, rowNum) -> mapContent(rs)
      );
    }
    return jdbc.query(
        "select * from content_info where status = '已发布' and category = ? order by sort_order asc, updated_at desc",
        (rs, rowNum) -> mapContent(rs),
        category
    );
  }

  public Map<String, Object> saveContent(ContentSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.title()) || !StringUtils.hasText(request.category())) {
      throw new IllegalArgumentException("标题和分类不能为空");
    }
    if (request.id() != null) {
      jdbc.update(
          """
          update content_info
          set title = ?, category = ?, body = ?, summary = ?, source_name = ?, source_url = ?,
              tags = ?, display_position = ?, sort_order = ?, status = ?, updated_at = current_timestamp
          where id = ?
          """,
          request.title(),
          request.category(),
          valueOr(request.body(), request.summary()),
          valueOr(request.summary(), request.body()),
          request.sourceName(),
          request.sourceUrl(),
          request.tags(),
          request.displayPosition(),
          request.sortOrder() == null ? 0 : request.sortOrder(),
          valueOr(request.status(), "待审核"),
          request.id()
      );
      audit("admin", "SAVE_CONTENT", "content_info", String.valueOf(request.id()), Map.of("title", request.title()));
      return Map.of("id", request.id(), "status", "已保存");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into content_info
            (title, category, body, summary, source_name, source_url, tags, display_position, sort_order, status)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, request.title());
      statement.setString(2, request.category());
      statement.setString(3, valueOr(request.body(), request.summary()));
      statement.setString(4, valueOr(request.summary(), request.body()));
      statement.setString(5, request.sourceName());
      statement.setString(6, request.sourceUrl());
      statement.setString(7, request.tags());
      statement.setString(8, request.displayPosition());
      statement.setInt(9, request.sortOrder() == null ? 0 : request.sortOrder());
      statement.setString(10, valueOr(request.status(), "待审核"));
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("admin", "CREATE_CONTENT", "content_info", String.valueOf(id), Map.of("title", request.title()));
    return Map.of("id", id, "status", "已保存");
  }

  public WorkbenchResponse workbench(AuthUser user) {
    requireCompletedStudent(user);
    StudentProfile profile = me(user);
    AiReport latest = latestReport(user).orElse(null);
    List<ReportHistoryItem> history = reportHistory(user);
    List<MessageItem> unreadMessages = messages(user).stream().filter(message -> !message.read()).limit(5).toList();
    Map<String, Object> community = userCommunity(user);
    @SuppressWarnings("unchecked")
    List<CommunityPost> favorites = (List<CommunityPost>) community.getOrDefault("favorites", List.of());
    List<Map<String, Object>> recentViews = recentViews(user.id());
    String mainPath = latest == null ? null : latest.scores().stream()
        .max(Comparator.comparingInt(Score::score))
        .map(Score::path)
        .orElse(StringUtils.hasText(latest.narrativeReport()) ? "已生成开放报告" : null);
    List<String> alternatives = latest == null ? List.of() : latest.scores().stream()
        .sorted(Comparator.comparingInt(Score::score).reversed())
        .skip(1)
        .map(Score::path)
        .toList();
    List<Map<String, Object>> timeline = buildTimeline(latest);
    List<Map<String, Object>> todos = buildTodos(latest);
    return new WorkbenchResponse(
        profile,
        latest,
        history,
        unreadMessages,
        recentViews,
        todos,
        timeline,
        favorites.stream().limit(6).toList(),
        mainPath,
        alternatives,
        isReportStale(user.id())
    );
  }

  public Map<String, Object> recordActivity(AuthUser user, ActivityRequest request) {
    if (request == null || !StringUtils.hasText(request.itemType()) || !StringUtils.hasText(request.itemId()) || !StringUtils.hasText(request.title())) {
      throw new IllegalArgumentException("浏览对象信息不能为空");
    }
    jdbc.update(
        """
        insert into user_activity (student_id, item_type, item_id, title, url, viewed_at)
        values (?, ?, ?, ?, ?, current_timestamp)
        on duplicate key update title = values(title), url = values(url), viewed_at = current_timestamp
        """,
        user.id(),
        request.itemType(),
        request.itemId(),
        request.title(),
        request.url()
    );
    return Map.of("itemType", request.itemType(), "itemId", request.itemId(), "recorded", true);
  }

  public PathPage pathPage(String key) {
    String normalized = normalizePathKey(key);
    return queryPathConfigs("where path_key = ? and status = '启用'", normalized).stream()
        .findFirst()
        .map(this::toPathPage)
        .orElseGet(() -> toPathPage(defaultPathConfig(normalized)));
  }

  public List<PathPage> pathPages() {
    return queryPathConfigs("where status = '启用'").stream()
        .map(this::toPathPage)
        .toList();
  }

  public List<PathConfigItem> adminPaths() {
    return queryPathConfigs("");
  }

  public Map<String, Object> savePath(PathConfigSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.key()) || !StringUtils.hasText(request.name())
        || !StringUtils.hasText(request.intro())) {
      throw new IllegalArgumentException("路径标识、名称和简介不能为空");
    }
    List<String> suitable = normalizeStringList(request.suitable(), "适合人群");
    List<String> timeline = normalizeStringList(request.timeline(), "准备时间线");
    List<String> pitfalls = normalizeStringList(request.pitfalls(), "常见误区");
    String key = normalizePathKey(request.key());
    int matchScore = clamp(request.matchScore() == null ? 80 : request.matchScore());
    int sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
    String status = valueOr(request.status(), "启用");
    jdbc.update(
        """
        insert into path_page_config
          (path_key, name, intro, suitable_json, timeline_json, pitfalls_json, accent, match_score, sort_order, status)
        values (?, ?, ?, cast(? as json), cast(? as json), cast(? as json), ?, ?, ?, ?)
        on duplicate key update name = values(name), intro = values(intro),
          suitable_json = values(suitable_json), timeline_json = values(timeline_json), pitfalls_json = values(pitfalls_json),
          accent = values(accent), match_score = values(match_score), sort_order = values(sort_order),
          status = values(status), updated_at = current_timestamp
        """,
        key,
        request.name(),
        request.intro(),
        toJson(suitable),
        toJson(timeline),
        toJson(pitfalls),
        valueOr(request.accent(), pathAccent(request.name())),
        matchScore,
        sortOrder,
        status
    );
    audit("admin", "SAVE_PATH_CONFIG", "path_page_config", key, Map.of("name", request.name(), "status", status));
    return Map.of("key", key, "status", "已保存");
  }

  public List<TemplateResource> templates(String category) {
    if (!StringUtils.hasText(category)) {
      return jdbc.query(
          "select * from template_resource where status = '已发布' order by uploaded_at desc",
          (rs, rowNum) -> mapTemplate(rs)
      );
    }
    return jdbc.query(
        "select * from template_resource where status = '已发布' and category = ? order by uploaded_at desc",
        (rs, rowNum) -> mapTemplate(rs),
        category
    );
  }

  public ChartBundle charts() {
    Optional<ChartItem> trend = publicCharts(null, null, null, null).stream()
        .filter(chart -> chart.chartType().contains("趋势"))
        .findFirst();
    if (trend.isEmpty()) {
      return new ChartBundle(List.of(), "后台图表配置", "暂无已发布趋势图", Instant.now().toString());
    }
    ChartItem chart = trend.get();
    Object rows = chart.data().get("rows");
    List<TrendPoint> points = rows instanceof List<?> values ? values.stream()
        .filter(Map.class::isInstance)
        .map(value -> {
          Map<?, ?> row = (Map<?, ?>) value;
          return new TrendPoint(
              row.get("year") == null ? "" : String.valueOf(row.get("year")),
              doubleFromObject(row.get("考公")),
              doubleFromObject(row.get("考研")),
              doubleFromObject(row.get("就业"))
          );
        })
        .filter(point -> StringUtils.hasText(point.year()))
        .toList() : List.of();
    return new ChartBundle(points, chart.sourceName(), chart.methodology(), chart.updatedAt());
  }

  public QuestionnaireDraft saveDraft(AuthUser user, AssessmentRequest request) {
    ensureQuestionnaireAllowed(user);
    Map<String, Object> answers = openAssessmentAnswers(request == null || request.answers() == null ? Map.of() : request.answers());
    String version = StringUtils.hasText(request == null ? null : request.questionnaireVersion()) ? request.questionnaireVersion() : QUESTIONNAIRE_VERSION;
    String stepKey = valueOr(request == null ? null : request.stepKey(), "profile");
    int percent = clamp(request == null || request.completionPercent() == null ? 0 : request.completionPercent());
    List<Long> draftIds = jdbc.query(
        "select id from questionnaire_snapshot where student_id = ? and status = '草稿' order by updated_at desc limit 1",
        (rs, rowNum) -> rs.getLong("id"),
        user.id()
    );
    if (draftIds.isEmpty()) {
      KeyHolder keyHolder = new GeneratedKeyHolder();
      jdbc.update(connection -> {
        PreparedStatement statement = connection.prepareStatement(
            """
            insert into questionnaire_snapshot
              (student_id, questionnaire_version, answers_json, status, step_key, completion_percent, expires_at)
            values (?, ?, cast(? as json), '草稿', ?, ?, date_add(current_timestamp, interval 180 day))
            """,
            Statement.RETURN_GENERATED_KEYS
        );
        statement.setLong(1, user.id());
        statement.setString(2, version);
        statement.setString(3, toJson(answers));
        statement.setString(4, stepKey);
        statement.setInt(5, percent);
        return statement;
      }, keyHolder);
      return latestDraft(user).orElseThrow();
    }
    jdbc.update(
        """
        update questionnaire_snapshot
        set questionnaire_version = ?, answers_json = cast(? as json), step_key = ?, completion_percent = ?,
            expires_at = date_add(current_timestamp, interval 180 day)
        where id = ?
        """,
        version,
        toJson(answers),
        stepKey,
        percent,
        draftIds.getFirst()
    );
    return latestDraft(user).orElseThrow();
  }

  public Optional<QuestionnaireDraft> latestDraft(AuthUser user) {
    List<QuestionnaireDraft> drafts = jdbc.query(
        """
        select id, questionnaire_version, answers_json, step_key, completion_percent, status, updated_at
        from questionnaire_snapshot
        where student_id = ? and status = '草稿'
        order by updated_at desc, id desc limit 1
        """,
        (rs, rowNum) -> new QuestionnaireDraft(
            rs.getLong("id"),
            rs.getString("questionnaire_version"),
            openAssessmentAnswers(jsonToMap(rs.getString("answers_json"))),
            rs.getString("step_key"),
            rs.getInt("completion_percent"),
            rs.getString("status"),
            toInstantString(rs.getTimestamp("updated_at"))
        ),
        user.id()
    );
    return drafts.stream().findFirst();
  }

  public InterviewResponse interviewAssessment(AuthUser user, InterviewRequest request) {
    ensureQuestionnaireAllowed(user);
    ensureLlmAvailable();
    StudentProfile profile = me(user);
    List<Map<String, String>> messages = request == null || request.messages() == null ? List.of() : request.messages();
    InterviewResponse fallback = fallbackInterview(messages, profile);
    InterviewResponse response = llmClient.interview(messages, profile, fallback);
    Map<String, Object> persistedAnswers = new LinkedHashMap<>(response.answers() == null ? Map.of() : response.answers());
    persistedAnswers.put("sourceMessages", interviewTranscript(messages, response.assistantMessage()));
    saveDraft(user, new AssessmentRequest(
        QUESTIONNAIRE_VERSION,
        persistedAnswers,
        "ai-interview",
        response.completionPercent()
    ));
    return new InterviewResponse(
        response.assistantMessage(),
        persistedAnswers,
        response.profileSummary(),
        response.decisionSignals(),
        response.completionPercent(),
        response.readyToGenerate(),
        response.missingFields()
    );
  }

  public ReportTask submitAssessment(AuthUser user, AssessmentRequest request) {
    ensureQuestionnaireAllowed(user);
    ensureLlmAvailable();
    Map<String, Object> answers = openAssessmentAnswers(request == null || request.answers() == null ? latestDraft(user).map(QuestionnaireDraft::answers).orElse(Map.of()) : request.answers());
    validateAssessment(answers);
    String version = StringUtils.hasText(request == null ? null : request.questionnaireVersion()) ? request.questionnaireVersion() : QUESTIONNAIRE_VERSION;
    KeyHolder questionnaireKey = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into questionnaire_snapshot
            (student_id, questionnaire_version, answers_json, status, step_key, completion_percent, submitted_at)
          values (?, ?, cast(? as json), '已完成', 'completed', 100, current_timestamp)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setLong(1, user.id());
      statement.setString(2, version);
      statement.setString(3, toJson(answers));
      return statement;
    }, questionnaireKey);
    jdbc.update("delete from questionnaire_snapshot where student_id = ? and status = '草稿'", user.id());

    AiReport report = buildReport(0, answers, version, "生成中");
    KeyHolder reportKey = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into ai_report
            (student_id, questionnaire_snapshot_id, report_version, template_version, prompt_version, report_json,
             generation_status, started_at, generated_at)
          values (?, ?, ?, ?, ?, cast(? as json), '生成中', current_timestamp, current_timestamp)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setLong(1, user.id());
      statement.setLong(2, questionnaireKey.getKey().longValue());
      statement.setString(3, report.reportVersion());
      statement.setString(4, TEMPLATE_VERSION);
      statement.setString(5, PROMPT_VERSION);
      statement.setString(6, toJson(report));
      return statement;
    }, reportKey);

    long reportId = reportKey.getKey().longValue();
    AiReport persisted = buildReport(reportId, answers, version, "生成中");
    jdbc.update("update ai_report set report_json = cast(? as json) where id = ?", toJson(persisted), reportId);
    audit("student:" + user.email(), "START_REPORT_GENERATION", "ai_report", String.valueOf(reportId), Map.of("questionnaireVersion", version));
    scheduleReportGeneration(reportId, user.id(), user.email(), answers, version);
    return new ReportTask("生成中", reportId, persisted, "访谈素材已提交，AI 报告正在生成");
  }

  public ReportTask reportTask(AuthUser user, long reportId) {
    List<Map<String, Object>> rows = jdbc.queryForList(
        "select id, student_id, generation_status, failure_reason, report_json, started_at from ai_report where id = ? and student_id = ?",
        reportId,
        user.id()
    );
    if (rows.isEmpty()) throw new IllegalArgumentException("报告任务不存在");
    Map<String, Object> row = rows.getFirst();
    String status = String.valueOf(row.get("generation_status"));
    AiReport report = fromJson(String.valueOf(row.get("report_json")), AiReport.class);
    String message = switch (status) {
      case "已完成" -> "AI 报告已生成";
      case "失败" -> "AI 报告生成失败：" + (row.get("failure_reason") == null ? "请重试" : String.valueOf(row.get("failure_reason")));
      default -> reportOvertimeMessage(row.get("started_at"));
    };
    return new ReportTask(status, reportId, report, message);
  }

  public Optional<ReportTask> latestReportTask(AuthUser user) {
    List<Long> ids = jdbc.query(
        "select id from ai_report where student_id = ? order by created_at desc, id desc limit 1",
        (rs, rowNum) -> rs.getLong("id"),
        user.id()
    );
    if (ids.isEmpty()) return Optional.empty();
    return Optional.of(reportTask(user, ids.getFirst()));
  }

  public ReportTask retryReport(AuthUser user, long reportId) {
    ensureLlmAvailable();
    List<Map<String, Object>> rows = jdbc.queryForList(
        """
        select r.id, r.student_id, r.generation_status, q.answers_json, q.questionnaire_version
        from ai_report r join questionnaire_snapshot q on q.id = r.questionnaire_snapshot_id
        where r.id = ? and r.student_id = ?
        """,
        reportId,
        user.id()
    );
    if (rows.isEmpty()) throw new IllegalArgumentException("报告任务不存在");
    Map<String, Object> row = rows.getFirst();
    if (!"失败".equals(String.valueOf(row.get("generation_status")))) {
      throw new IllegalArgumentException("仅失败的报告任务可以重试");
    }
    Map<String, Object> answers = openAssessmentAnswers(jsonToMap(String.valueOf(row.get("answers_json"))));
    String version = String.valueOf(row.get("questionnaire_version"));
    AiReport retrying = buildReport(reportId, answers, version, "生成中");
    jdbc.update(
        """
        update ai_report
        set generation_status = '生成中', failure_reason = null, started_at = current_timestamp,
            completed_at = null, report_json = cast(? as json)
        where id = ?
        """,
        toJson(retrying),
        reportId
    );
    audit("student:" + user.email(), "RETRY_REPORT_GENERATION", "ai_report", String.valueOf(reportId), Map.of("questionnaireVersion", version));
    scheduleReportGeneration(reportId, user.id(), user.email(), answers, version);
    return new ReportTask("生成中", reportId, retrying, "AI 报告已重新进入生成队列");
  }

  public Optional<AiReport> latestReport(AuthUser user) {
    List<AiReport> reports = jdbc.query(
        "select report_json from ai_report where student_id = ? and generation_status = '已完成' order by generated_at desc, id desc limit 1",
        (rs, rowNum) -> fromJson(rs.getString("report_json"), AiReport.class),
        user.id()
    );
    return reports.stream().findFirst();
  }

  private Optional<AiReport> reportForQuestion(AuthUser user, AiQuestion question) {
    if (question != null && StringUtils.hasText(question.reportId())) {
      try {
        long reportId = Long.parseLong(question.reportId());
        List<AiReport> reports = jdbc.query(
            "select report_json from ai_report where id = ? and student_id = ? and generation_status = '已完成'",
            (rs, rowNum) -> fromJson(rs.getString("report_json"), AiReport.class),
            reportId,
            user.id()
        );
        if (!reports.isEmpty()) return reports.stream().findFirst();
      } catch (NumberFormatException ignored) {
        // Fall back to latest report.
      }
    }
    return latestReport(user);
  }

  private String latestAiConfigContent(String type, String fallback) {
    List<String> rows = jdbc.query(
        """
        select content
        from ai_config
        where config_type = ? and status = '已发布'
        order by published_at desc, created_at desc, id desc
        limit 1
        """,
        (rs, rowNum) -> rs.getString("content"),
        type
    );
    return rows.isEmpty() || !StringUtils.hasText(rows.getFirst()) ? fallback : rows.getFirst();
  }

  public List<ReportHistoryItem> reportHistory(AuthUser user) {
    return jdbc.query(
        "select id, report_version, generated_at, report_json from ai_report where student_id = ? and generation_status = '已完成' order by generated_at desc, id desc",
        (rs, rowNum) -> {
          AiReport report = fromJson(rs.getString("report_json"), AiReport.class);
          Score top = report.scores().stream()
              .max(Comparator.comparingInt(Score::score))
              .orElse(new Score(StringUtils.hasText(report.narrativeReport()) ? "开放报告" : "就业", 0, "", List.of()));
          return new ReportHistoryItem(
              rs.getLong("id"),
              rs.getString("report_version"),
              toInstantString(rs.getTimestamp("generated_at")),
              top.path(),
              top.score()
          );
        },
        user.id()
    );
  }

  public AiAnswer answer(AuthUser user, AiQuestion question) {
    requireCompletedStudent(user);
    ensureLlmAvailable();
    String asked = question == null || !StringUtils.hasText(question.question()) ? "如何安排下一步行动" : question.question();
    String fallbackText = """
        你正在追问：%s

        我会把这份报告里的综合正文、路径排序、行动计划和你补充的问题放在一起看。比较稳妥的做法是：先沿着报告里的主路径推进一轮低成本验证，同时保留一个备选路径的小时间块；如果接下来两周的新信息明显改变了你的约束条件，再调整主次顺序。

        这类追问更适合结合你的最新补充继续细化，AI 建议只作为辅助判断，不代表录取、上岸或就业结果承诺。
        """.formatted(asked).strip();
    AiAnswer fallback = new AiAnswer(
        "",
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        fallbackText
    );
    AiReport report = reportForQuestion(user, question).orElse(null);
    return llmClient.answer(report, question, latestAiConfigContent("prompt", "围绕报告正文和访谈素材自由回答追问，可以自然展开分析，不需要按固定维度分栏；不输出录取、上岸、就业结果承诺。"), fallback);
  }

  public List<CommunityPost> communityPosts(String path, String type, String keyword, String sort) {
    return communityPosts(path, type, keyword, sort, null);
  }

  public List<CommunityPost> communityPosts(String path, String type, String keyword, String sort, Long viewerStudentId) {
    return queryCommunityPosts(false, path, type, keyword, sort, viewerStudentId);
  }

  public List<CommunityPost> communityPosts() {
    return communityPosts(null, null, null, "latest");
  }

  public List<CommunityPost> adminCommunityPosts() {
    return queryCommunityPosts(true, null, null, null, "latest", null);
  }

  public Optional<CommunityPost> communityPost(long id) {
    return communityPost(id, null);
  }

  public Optional<CommunityPost> communityPost(long id, Long viewerStudentId) {
    List<Object> params = new ArrayList<>();
    addInteractionParams(params, viewerStudentId);
    params.add(id);
    List<CommunityPost> rows = jdbc.query(
        """
        select p.*, case when p.anonymous = 1 then '匿名用户' else coalesce(s.nickname, s.name, '未命名用户') end as author_name,
        """ + interactionSelectColumns(viewerStudentId) + """
        from community_post p join student_account s on s.id = p.student_id
        where p.id = ? and p.deleted_at is null and p.status = '已通过'
        """,
        (rs, rowNum) -> mapPost(rs),
        params.toArray()
    );
    return rows.stream().findFirst();
  }

  public CommunityPost createPost(AuthUser user, PostRequest request) {
    requireCompletedStudent(user);
    validatePost(request);
    List<String> imageUrls = normalizePostImages(request.imageUrls());
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into community_post
            (student_id, title, body, type, path, anonymous, image_urls_json, status)
          values (?, ?, ?, ?, ?, ?, cast(? as json), '待审核')
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setLong(1, user.id());
      statement.setString(2, request.title());
      statement.setString(3, request.body());
      statement.setString(4, StringUtils.hasText(request.type()) ? request.type() : "问答");
      statement.setString(5, StringUtils.hasText(request.path()) ? request.path() : "就业");
      statement.setBoolean(6, request.anonymous());
      statement.setString(7, toJson(imageUrls));
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("student:" + user.email(), "CREATE_POST", "community_post", String.valueOf(id), Map.of("title", request.title()));
    createMessage(user.id(), "社区", "内容已提交审核", "你的内容已进入审核队列，通过后会公开展示。", "/community");
    return communityPostAny(id).orElseThrow();
  }

  public CommunityPost updateOwnPost(AuthUser user, long id, PostRequest request) {
    validatePost(request);
    List<String> imageUrls = normalizePostImages(request.imageUrls());
    int updated = jdbc.update(
        """
        update community_post
        set title = ?, body = ?, type = ?, path = ?, anonymous = ?, image_urls_json = cast(? as json),
            status = '待审核', reject_reason = null, updated_at = current_timestamp
        where id = ? and student_id = ? and deleted_at is null
        """,
        request.title(),
        request.body(),
        valueOr(request.type(), "问答"),
        valueOr(request.path(), "就业"),
        request.anonymous(),
        toJson(imageUrls),
        id,
        user.id()
    );
    if (updated == 0) throw new IllegalArgumentException("只能编辑自己的帖子");
    audit("student:" + user.email(), "UPDATE_POST", "community_post", String.valueOf(id), Map.of("status", "待审核"));
    return communityPostAny(id).orElseThrow();
  }

  public List<String> storeCommunityImages(AuthUser user, List<MultipartFile> files) {
    requireCompletedStudent(user);
    if (files == null || files.isEmpty()) {
      throw new IllegalArgumentException("请选择要上传的图片");
    }
    if (files.size() > MAX_COMMUNITY_IMAGES) {
      throw new IllegalArgumentException("每条内容最多添加 " + MAX_COMMUNITY_IMAGES + " 张图片");
    }
    try {
      Files.createDirectories(communityUploadDir);
    } catch (IOException exception) {
      throw new IllegalStateException("图片目录创建失败", exception);
    }
    List<String> urls = new ArrayList<>();
    for (MultipartFile file : files) {
      urls.add(storeCommunityImage(file));
    }
    audit("student:" + user.email(), "UPLOAD_COMMUNITY_IMAGES", "community_post", "pending", Map.of("count", urls.size()));
    return urls;
  }

  public Path communityUploadPath(String fileName) {
    if (!StringUtils.hasText(fileName) || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
      throw new IllegalArgumentException("图片不存在");
    }
    Path resolved = communityUploadDir.resolve(fileName).normalize();
    if (!resolved.startsWith(communityUploadDir) || !Files.exists(resolved) || !Files.isRegularFile(resolved)) {
      throw new IllegalArgumentException("图片不存在");
    }
    return resolved;
  }

  public Map<String, Object> deleteOwnPost(AuthUser user, long id) {
    int updated = jdbc.update("update community_post set status = '已删除', deleted_at = current_timestamp where id = ? and student_id = ?", id, user.id());
    if (updated == 0) throw new IllegalArgumentException("只能删除自己的帖子");
    audit("student:" + user.email(), "DELETE_POST", "community_post", String.valueOf(id), Map.of("logical", true));
    return Map.of("id", id, "status", "已删除");
  }

  public Map<String, Object> addComment(AuthUser user, CommentRequest request) {
    requireCompletedStudent(user);
    if (request == null || !StringUtils.hasText(request.body())) {
      throw new IllegalArgumentException("评论内容不能为空");
    }
    CommunityPost post = communityPost(request.postId()).orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
    if (!"已通过".equals(post.status())) {
      throw new IllegalArgumentException("仅已通过内容可回复");
    }
    jdbc.update(
        "insert into community_comment (post_id, student_id, parent_comment_id, body, status) values (?, ?, ?, ?, '已通过')",
        request.postId(),
        user.id(),
        request.parentCommentId(),
        request.body()
    );
    jdbc.update("update community_post set replies = replies + 1 where id = ?", request.postId());
    createMessage(findPostAuthor(request.postId()), "互动", "你的内容收到新回复", "有同学回复了你的社区内容。", "/community");
    return Map.of("postId", request.postId(), "status", "已提交", "createdAt", Instant.now().toString());
  }

  public Map<String, Object> setBestAnswer(AuthUser user, BestAnswerRequest request) {
    if (request == null || request.commentId() <= 0) {
      throw new IllegalArgumentException("评论不存在");
    }
    List<Map<String, Object>> rows = jdbc.queryForList(
        """
        select c.id, c.post_id, p.student_id as post_author, p.type
        from community_comment c join community_post p on p.id = c.post_id
        where c.id = ?
        """,
        request.commentId()
    );
    if (rows.isEmpty()) throw new IllegalArgumentException("评论不存在");
    Map<String, Object> row = rows.getFirst();
    if (!"问答".equals(String.valueOf(row.get("type")))) {
      throw new IllegalArgumentException("仅问答内容支持最佳回答");
    }
    long postAuthor = ((Number) row.get("post_author")).longValue();
    if (postAuthor != user.id()) {
      throw new IllegalArgumentException("只有问题作者可以设置最佳回答");
    }
    return setBestAnswerInternal(request);
  }

  public List<CommunityComment> comments(long postId) {
    return jdbc.query(
        """
        select c.*, case when p.anonymous = 1 and c.student_id = p.student_id then '匿名作者' else coalesce(s.nickname, s.name, '匿名用户') end as author_name
        from community_comment c
        join student_account s on s.id = c.student_id
        join community_post p on p.id = c.post_id
        where c.post_id = ? and c.status = '已通过'
        order by c.best_answer desc, c.created_at asc
        """,
        (rs, rowNum) -> new CommunityComment(
            rs.getLong("id"),
            rs.getLong("post_id"),
            rs.getString("body"),
            rs.getString("author_name"),
            rs.getBoolean("best_answer"),
            rs.getString("status"),
            rs.getTimestamp("created_at").toInstant()
        ),
        postId
    );
  }

  public Map<String, Object> toggleInteraction(AuthUser user, InteractionRequest request) {
    requireCompletedStudent(user);
    if (request == null || request.postId() <= 0) throw new IllegalArgumentException("帖子不存在");
    String type = normalizeInteraction(request.type());
    String column = "like".equals(type) ? "likes" : "favorites";
    Integer exists = jdbc.queryForObject(
        "select count(*) from community_interaction where post_id = ? and student_id = ? and interaction_type = ?",
        Integer.class,
        request.postId(),
        user.id(),
        type
    );
    boolean active;
    if (exists != null && exists > 0) {
      jdbc.update("delete from community_interaction where post_id = ? and student_id = ? and interaction_type = ?", request.postId(), user.id(), type);
      jdbc.update("update community_post set " + column + " = greatest(" + column + " - 1, 0) where id = ?", request.postId());
      active = false;
    } else {
      jdbc.update("insert into community_interaction (post_id, student_id, interaction_type) values (?, ?, ?)", request.postId(), user.id(), type);
      jdbc.update("update community_post set " + column + " = " + column + " + 1 where id = ?", request.postId());
      active = true;
    }
    return Map.of("postId", request.postId(), "type", type, "active", active);
  }

  public Map<String, Object> reportAbuse(AuthUser user, ReportAbuseRequest request) {
    requireCompletedStudent(user);
    if (request == null || !StringUtils.hasText(request.reason())) {
      throw new IllegalArgumentException("举报原因不能为空");
    }
    jdbc.update(
        "insert into abuse_report (reporter_student_id, target_type, target_id, reason, status) values (?, ?, ?, ?, '待处理')",
        user.id(),
        valueOr(request.targetType(), "post"),
        request.targetId(),
        request.reason()
    );
    audit("student:" + user.email(), "REPORT_ABUSE", valueOr(request.targetType(), "post"), String.valueOf(request.targetId()), Map.of("reason", request.reason()));
    return Map.of("targetId", request.targetId(), "targetType", valueOr(request.targetType(), "post"), "status", "待处理");
  }

  public Map<String, Object> userCommunity(AuthUser user) {
    List<CommunityPost> ownPosts = jdbc.query(
        """
        select p.*, case when p.anonymous = 1 then '匿名用户' else coalesce(s.nickname, s.name, '未命名用户') end as author_name,
          exists(select 1 from community_interaction ii where ii.post_id = p.id and ii.student_id = ? and ii.interaction_type = 'like') as liked,
          exists(select 1 from community_interaction ii where ii.post_id = p.id and ii.student_id = ? and ii.interaction_type = 'favorite') as favorited
        from community_post p join student_account s on s.id = p.student_id
        where p.student_id = ? and p.deleted_at is null
        order by p.created_at desc
        """,
        (rs, rowNum) -> mapPost(rs),
        user.id(),
        user.id(),
        user.id()
    );
    List<CommunityPost> favorites = jdbc.query(
        """
        select p.*, case when p.anonymous = 1 then '匿名用户' else coalesce(s.nickname, s.name, '未命名用户') end as author_name,
          exists(select 1 from community_interaction ii where ii.post_id = p.id and ii.student_id = ? and ii.interaction_type = 'like') as liked,
          1 as favorited
        from community_interaction i
        join community_post p on p.id = i.post_id
        join student_account s on s.id = p.student_id
        where i.student_id = ? and i.interaction_type = 'favorite' and p.deleted_at is null
        order by i.created_at desc
        """,
        (rs, rowNum) -> mapPost(rs),
        user.id(),
        user.id()
    );
    return Map.of("posts", ownPosts, "favorites", favorites);
  }

  public List<MessageItem> messages(AuthUser user) {
    return jdbc.query(
        "select * from system_message where student_id = ? order by created_at desc limit 100",
        (rs, rowNum) -> new MessageItem(
            rs.getLong("id"),
            rs.getString("type"),
            rs.getString("title"),
            rs.getString("body"),
            rs.getString("link_url"),
            rs.getTimestamp("read_at") != null,
            rs.getTimestamp("created_at").toInstant()
        ),
        user.id()
    );
  }

  public Map<String, Object> markMessageRead(AuthUser user, long id) {
    jdbc.update("update system_message set read_at = current_timestamp where id = ? and student_id = ?", id, user.id());
    return Map.of("id", id, "read", true);
  }

  public Map<String, Object> markAllMessagesRead(AuthUser user) {
    int updated = jdbc.update("update system_message set read_at = current_timestamp where student_id = ? and read_at is null", user.id());
    return Map.of("updated", updated);
  }

  public AdminDashboard adminDashboard() {
    int registeredUsers = countSql("select count(*) from student_account");
    int activeUsers = countSql("select count(*) from student_account where last_login_at > date_sub(current_timestamp, interval 30 day)");
    int completedStudents = countSql("select count(distinct student_id) from questionnaire_snapshot where status = '已完成'");
    int reportCount = countSql("select count(*) from ai_report where generation_status = '已完成'");
    int postCount = countSql("select count(*) from community_post where deleted_at is null");
    int questionCount = countSql("select count(*) from community_post where type = '问答' and deleted_at is null");
    int pendingPosts = countSql("select count(*) from community_post where status = '待审核' and deleted_at is null");
    int pendingReports = countSql("select count(*) from abuse_report where status = '待处理'");
    int dataSourceCount = countSql("select count(*) from data_source");
    int crawlTaskCount = countSql("select count(*) from crawl_task");
    int pendingCrawl = countSql("select count(*) from crawl_candidate where review_status = '待审核'");
    double completionRate = registeredUsers == 0 ? 0 : Math.round(completedStudents * 1000.0 / registeredUsers) / 10.0;
    return new AdminDashboard(
        registeredUsers,
        activeUsers,
        completionRate,
        reportCount,
        postCount,
        questionCount,
        dataSourceCount,
        crawlTaskCount,
        pendingCrawl,
        pendingPosts + pendingReports + pendingCrawl,
        Instant.now().toString(),
        List.of(
            Map.of("id", "POST", "item", "待审核社区帖子", "type", "社区帖子", "status", pendingPosts + " 条"),
            Map.of("id", "REPORT", "item", "待处理举报", "type", "社区举报", "status", pendingReports + " 条"),
            Map.of("id", "CRAWL", "item", "待审核抓取数据", "type", "抓取数据", "status", pendingCrawl + " 条")
        )
    );
  }

  public List<CommunityUser> communityUsers() {
    return jdbc.query(
        """
        select s.nickname, s.name, s.student_no, s.status,
               count(p.id) as posts,
               (select count(*) from abuse_report r where r.reporter_student_id = s.id) as reports
        from student_account s
        left join community_post p on p.student_id = s.id and p.deleted_at is null
        group by s.id, s.nickname, s.name, s.student_no, s.status
        order by posts desc, s.id desc
        """,
        (rs, rowNum) -> new CommunityUser(
            Optional.ofNullable(rs.getString("nickname")).orElse(Optional.ofNullable(rs.getString("name")).orElse("未命名用户")),
            rs.getString("student_no"),
            rs.getInt("posts"),
            rs.getInt("reports"),
            rs.getString("status")
        )
    );
  }

  public List<CrawlSource> sources() {
    return jdbc.query(
        """
        select s.*,
               (select count(*) from crawl_task t where t.source_id = s.id) as task_count,
               (select count(*) from crawl_task t where t.source_id = s.id and t.status = '已完成') as success_count,
               (select t.status from crawl_task t where t.source_id = s.id order by t.created_at desc, t.id desc limit 1) as last_task_status,
               (select t.result_message from crawl_task t where t.source_id = s.id order by t.created_at desc, t.id desc limit 1) as last_task_message,
               (select coalesce(t.finished_at, t.started_at, t.created_at) from crawl_task t where t.source_id = s.id order by t.created_at desc, t.id desc limit 1) as last_task_at
        from data_source s
        order by s.updated_at desc, s.id desc
        """,
        (rs, rowNum) -> {
          int taskCount = rs.getInt("task_count");
          int successCount = rs.getInt("success_count");
          String passRate = taskCount == 0 ? "暂无任务" : Math.round(successCount * 1000.0 / taskCount) / 10.0 + "%";
          return new CrawlSource(
              rs.getLong("id"),
              rs.getString("name"),
              rs.getString("source_url"),
              rs.getString("source_type"),
              rs.getString("path"),
              rs.getString("crawl_frequency"),
              rs.getString("trust_level"),
              rs.getString("status"),
              toInstantString(rs.getTimestamp("last_crawl_at")),
              passRate,
              toInstantString(rs.getTimestamp("updated_at")),
              rs.getString("last_task_status"),
              rs.getString("last_task_message"),
              toInstantString(rs.getTimestamp("last_task_at")),
              jsonToMap(rs.getString("parser_rule_json"))
          );
        }
    );
  }

  public Map<String, Object> saveSource(CrawlSourceSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.name()) || !StringUtils.hasText(request.url())) {
      throw new IllegalArgumentException("来源名称和地址不能为空");
    }
    String status = valueOr(request.status(), "启用");
    if (request.id() != null) {
      jdbc.update(
          """
          update data_source
          set name = ?, source_type = ?, source_url = ?, crawl_frequency = ?, path = ?,
              trust_level = ?, parser_rule_json = cast(? as json), status = ?, updated_at = current_timestamp
          where id = ?
          """,
          request.name(),
          valueOr(request.type(), "公开权威数据"),
          request.url(),
          valueOr(request.frequency(), "每日"),
          valueOr(request.path(), "就业"),
          valueOr(request.trustLevel(), "中"),
          toJson(request.parserRule() == null ? Map.of() : request.parserRule()),
          status,
          request.id()
      );
      audit("admin", "SAVE_SOURCE", "data_source", String.valueOf(request.id()), Map.of("name", request.name(), "status", status));
      return Map.of("id", request.id(), "status", "已保存");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into data_source
            (name, source_type, source_url, crawl_frequency, path, trust_level, parser_rule_json, status)
          values (?, ?, ?, ?, ?, ?, cast(? as json), ?)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, request.name());
      statement.setString(2, valueOr(request.type(), "公开权威数据"));
      statement.setString(3, request.url());
      statement.setString(4, valueOr(request.frequency(), "每日"));
      statement.setString(5, valueOr(request.path(), "就业"));
      statement.setString(6, valueOr(request.trustLevel(), "中"));
      statement.setString(7, toJson(request.parserRule() == null ? Map.of() : request.parserRule()));
      statement.setString(8, status);
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("admin", "CREATE_SOURCE", "data_source", String.valueOf(id), Map.of("name", request.name(), "status", status));
    return Map.of("id", id, "status", "已保存");
  }

  public List<CrawlCandidateItem> crawlCandidates(String status) {
    StringBuilder sql = new StringBuilder(
        """
        select c.*, s.name as source_name
        from crawl_candidate c join data_source s on s.id = c.source_id
        where 1 = 1
        """
    );
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(status)) {
      sql.append(" and c.review_status = ?");
      params.add(status);
    }
    sql.append(" order by c.crawled_at desc, c.id desc limit 200");
    return jdbc.query(sql.toString(), (rs, rowNum) -> mapCandidate(rs), params.toArray());
  }

  public Map<String, Object> reviewCandidate(CrawlCandidateReviewRequest request) {
    if (request == null || request.id() <= 0 || !StringUtils.hasText(request.action())) {
      throw new IllegalArgumentException("抓取候选和审核动作不能为空");
    }
    List<Map<String, Object>> rows = jdbc.queryForList(
        """
        select c.*, s.name as source_name
        from crawl_candidate c join data_source s on s.id = c.source_id
        where c.id = ?
        """,
        request.id()
    );
    if (rows.isEmpty()) throw new IllegalArgumentException("抓取候选不存在");
    Map<String, Object> row = rows.getFirst();
    Map<String, Object> parsed = jsonToMap(String.valueOf(row.get("parsed_json")));
    String action = request.action().trim();
    boolean rejectAction = "驳回".equals(action) || "已驳回".equals(action) || "reject".equalsIgnoreCase(action);
    if (rejectAction) {
      if (!StringUtils.hasText(request.reason())) throw new IllegalArgumentException("驳回必须填写原因");
      String rawUrl = String.valueOf(row.get("raw_url"));
      int offlineCount = jdbc.update(
          """
          update content_info
          set status = '已下架', offline_at = current_timestamp, updated_at = current_timestamp
          where source_url = ? and status = '已发布'
          """,
          rawUrl
      );
      jdbc.update(
          "update crawl_candidate set review_status = '已驳回', failure_reason = ?, published_at = null where id = ?",
          request.reason(),
          request.id()
      );
      audit(
          "admin",
          "REJECT_CRAWL_CANDIDATE",
          "crawl_candidate",
          String.valueOf(request.id()),
          Map.of("reason", request.reason(), "offlineContentCount", offlineCount, "rawUrl", rawUrl)
      );
      return Map.of("id", request.id(), "status", "已驳回", "offlineContentCount", offlineCount);
    }
    if ("重新抓取".equals(action)) {
      return triggerCrawl(((Number) row.get("source_id")).longValue());
    }
    if (!"发布".equals(action) && !"编辑后发布".equals(action)) {
      throw new IllegalArgumentException("不支持的审核动作");
    }
    String title = valueOr(request.title(), String.valueOf(parsed.getOrDefault("title", "抓取候选内容")));
    String summary = valueOr(request.summary(), String.valueOf(parsed.getOrDefault("summary", "公开来源抓取内容")));
    String category = valueOr(request.category(), String.valueOf(parsed.getOrDefault("path", "就业")));
    String body = valueOr(String.valueOf(parsed.getOrDefault("body", "")), summary);
    String tags = valueOr(request.tags(), tagsFromParsed(parsed, category));
    String displayPosition = valueOr(request.displayPosition(), "路径页");
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into content_info
            (title, category, body, summary, source_name, source_url, tags, display_position, sort_order, status, publish_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, 0, '已发布', current_timestamp)
          on duplicate key update id = last_insert_id(id), body = values(body), summary = values(summary), source_name = values(source_name),
            source_url = values(source_url), tags = values(tags), display_position = values(display_position),
            status = '已发布', publish_at = current_timestamp, updated_at = current_timestamp
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, title);
      statement.setString(2, category);
      statement.setString(3, body);
      statement.setString(4, summary);
      statement.setString(5, String.valueOf(row.get("source_name")));
      statement.setString(6, String.valueOf(row.get("raw_url")));
      statement.setString(7, tags);
      statement.setString(8, displayPosition);
      return statement;
    }, keyHolder);
    long contentId = keyHolder.getKey().longValue();
    jdbc.update("update crawl_candidate set review_status = '已发布', published_at = current_timestamp where id = ?", request.id());
    audit("admin", "PUBLISH_CRAWL_CANDIDATE", "crawl_candidate", String.valueOf(request.id()), Map.of("contentId", contentId, "title", title));
    return Map.of("id", request.id(), "contentId", contentId, "status", "已发布");
  }

  private String tagsFromParsed(Map<String, Object> parsed, String fallback) {
    Object tags = parsed.get("tags");
    if (tags instanceof List<?> rows && !rows.isEmpty()) {
      return rows.stream()
          .map(String::valueOf)
          .filter(StringUtils::hasText)
          .limit(5)
          .reduce((left, right) -> left + "," + right)
          .orElse(fallback);
    }
    return fallback;
  }

  public List<StudentAdminItem> adminStudents(String status, String keyword) {
    StringBuilder sql = new StringBuilder("select * from student_account where 1 = 1");
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(status)) {
      sql.append(" and status = ?");
      params.add(status);
    }
    if (StringUtils.hasText(keyword)) {
      sql.append(" and (email like ? or name like ? or student_no like ? or college like ? or major like ?)");
      for (int i = 0; i < 5; i++) params.add("%" + keyword + "%");
    }
    sql.append(" order by created_at desc, id desc limit 200");
    return jdbc.query(sql.toString(), (rs, rowNum) -> new StudentAdminItem(
        rs.getLong("id"),
        rs.getString("email"),
        rs.getString("name"),
        rs.getString("student_no"),
        rs.getString("college"),
        rs.getString("major"),
        rs.getString("graduation_year"),
        rs.getString("phone"),
        rs.getString("nickname"),
        rs.getString("status"),
        toInstantString(rs.getTimestamp("created_at")),
        toInstantString(rs.getTimestamp("last_login_at"))
    ), params.toArray());
  }

  public Map<String, Object> updateStudentStatus(AdminStatusRequest request) {
    if (request == null || request.id() <= 0 || !StringUtils.hasText(request.status())) {
      throw new IllegalArgumentException("用户状态不能为空");
    }
    int updated = jdbc.update("update student_account set status = ? where id = ?", request.status(), request.id());
    if (updated == 0) throw new IllegalArgumentException("用户不存在");
    audit("admin", "UPDATE_USER_STATUS", "student_account", String.valueOf(request.id()), Map.of("status", request.status(), "reason", valueOr(request.reason(), "")));
    createMessage(request.id(), "账号", "账号状态已更新", "你的账号状态已更新为：" + request.status(), "/me");
    return Map.of("userId", request.id(), "status", request.status(), "updatedAt", Instant.now().toString());
  }

  public List<ChartItem> adminCharts() {
    return jdbc.query("select * from chart_info order by updated_at desc, id desc", (rs, rowNum) -> mapChart(rs));
  }

  public List<ChartItem> publicCharts(String path) {
    return publicCharts(path, null, null, null);
  }

  public List<ChartItem> publicCharts(String path, String college, String major, String graduationYear) {
    StringBuilder sql = new StringBuilder("select * from chart_info where status = '已发布' and visibility = '公开'");
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(path) && !"全部".equals(path)) {
      sql.append(" and (path = ? or path = '全部')");
      params.add(path);
    }
    sql.append(" order by display_position asc, updated_at desc");
    return jdbc.query(sql.toString(), (rs, rowNum) -> mapChart(rs), params.toArray()).stream()
        .filter(chart -> chartMatchesFilters(chart, college, major, graduationYear))
        .toList();
  }

  public Map<String, Object> saveChart(ChartSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.title()) || !StringUtils.hasText(request.chartType())) {
      throw new IllegalArgumentException("图表标题和类型不能为空");
    }
    if (!chartHasRows(request.data())) {
      throw new IllegalArgumentException("图表数据至少需要提供 data.rows 的一行真实数据");
    }
    String status = valueOr(request.status(), "待审核");
    if (request.id() != null) {
      jdbc.update(
          """
          update chart_info
          set title = ?, chart_type = ?, path = ?, data_json = cast(? as json), methodology = ?,
              source_name = ?, source_url = ?, filters_json = cast(? as json), visibility = ?,
              display_position = ?, status = ?, updated_at = current_timestamp
          where id = ?
          """,
          request.title(),
          request.chartType(),
          valueOr(request.path(), "全部"),
          toJson(request.data() == null ? Map.of() : request.data()),
          valueOr(request.methodology(), "待补充统计口径"),
          valueOr(request.sourceName(), "后台维护数据"),
          request.sourceUrl(),
          toJson(request.filters() == null ? Map.of() : request.filters()),
          valueOr(request.visibility(), "公开"),
          request.displayPosition(),
          status,
          request.id()
      );
      audit("admin", "SAVE_CHART", "chart_info", String.valueOf(request.id()), Map.of("title", request.title(), "status", status));
      return Map.of("id", request.id(), "status", "已保存");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into chart_info
            (title, chart_type, path, data_json, methodology, source_name, source_url, filters_json, visibility, display_position, status)
          values (?, ?, ?, cast(? as json), ?, ?, ?, cast(? as json), ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, request.title());
      statement.setString(2, request.chartType());
      statement.setString(3, valueOr(request.path(), "全部"));
      statement.setString(4, toJson(request.data() == null ? Map.of() : request.data()));
      statement.setString(5, valueOr(request.methodology(), "待补充统计口径"));
      statement.setString(6, valueOr(request.sourceName(), "后台维护数据"));
      statement.setString(7, request.sourceUrl());
      statement.setString(8, toJson(request.filters() == null ? Map.of() : request.filters()));
      statement.setString(9, valueOr(request.visibility(), "公开"));
      statement.setString(10, request.displayPosition());
      statement.setString(11, status);
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("admin", "CREATE_CHART", "chart_info", String.valueOf(id), Map.of("title", request.title(), "status", status));
    return Map.of("id", id, "status", "已保存");
  }

  public List<TagItem> tags(String type, boolean admin) {
    StringBuilder sql = new StringBuilder("select * from tag_config where 1 = 1");
    List<Object> params = new ArrayList<>();
    if (!admin) sql.append(" and status = '启用'");
    if (StringUtils.hasText(type)) {
      sql.append(" and tag_type = ?");
      params.add(type);
    }
    sql.append(" order by sort_order asc, id asc");
    return jdbc.query(sql.toString(), (rs, rowNum) -> new TagItem(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("tag_type"),
        rs.getString("status"),
        rs.getInt("sort_order"),
        toInstantString(rs.getTimestamp("created_at"))
    ), params.toArray());
  }

  public Map<String, Object> saveTag(TagSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.name()) || !StringUtils.hasText(request.type())) {
      throw new IllegalArgumentException("标签名称和类型不能为空");
    }
    if (request.id() != null) {
      jdbc.update(
          "update tag_config set name = ?, tag_type = ?, status = ?, sort_order = ? where id = ?",
          request.name(),
          request.type(),
          valueOr(request.status(), "启用"),
          request.sortOrder() == null ? 0 : request.sortOrder(),
          request.id()
      );
      audit("admin", "SAVE_TAG", "tag_config", String.valueOf(request.id()), Map.of("name", request.name(), "type", request.type()));
      return Map.of("id", request.id(), "status", "已保存");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          "insert into tag_config (name, tag_type, status, sort_order) values (?, ?, ?, ?)",
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, request.name());
      statement.setString(2, request.type());
      statement.setString(3, valueOr(request.status(), "启用"));
      statement.setInt(4, request.sortOrder() == null ? 0 : request.sortOrder());
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("admin", "CREATE_TAG", "tag_config", String.valueOf(id), Map.of("name", request.name(), "type", request.type()));
    return Map.of("id", id, "status", "已保存");
  }

  public List<AiConfigItem> aiConfigs(String type) {
    StringBuilder sql = new StringBuilder("select * from ai_config where 1 = 1");
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(type)) {
      sql.append(" and config_type = ?");
      params.add(type);
    }
    sql.append(" order by config_type asc, created_at desc, id desc");
    return jdbc.query(sql.toString(), (rs, rowNum) -> new AiConfigItem(
        rs.getLong("id"),
        rs.getString("config_type"),
        rs.getString("version"),
        rs.getString("title"),
        rs.getString("content"),
        rs.getString("status"),
        toInstantString(rs.getTimestamp("created_at")),
        toInstantString(rs.getTimestamp("published_at"))
    ), params.toArray());
  }

  public Map<String, Object> saveAiConfig(AiConfigSaveRequest request) {
    if (request == null || !StringUtils.hasText(request.configType()) || !StringUtils.hasText(request.version())
        || !StringUtils.hasText(request.title()) || !StringUtils.hasText(request.content())) {
      throw new IllegalArgumentException("AI 配置类型、版本、标题和内容不能为空");
    }
    String status = valueOr(request.status(), "草稿");
    if (request.id() != null) {
      jdbc.update(
          """
          update ai_config
          set config_type = ?, version = ?, title = ?, content = ?, status = ?,
              published_at = case when ? = '已发布' then coalesce(published_at, current_timestamp) else published_at end
          where id = ?
          """,
          request.configType(),
          request.version(),
          request.title(),
          request.content(),
          status,
          status,
          request.id()
      );
      audit("admin", "SAVE_AI_CONFIG", "ai_config", String.valueOf(request.id()), Map.of("type", request.configType(), "version", request.version(), "status", status));
      return Map.of("id", request.id(), "status", "已保存");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          """
          insert into ai_config (config_type, version, title, content, status, published_at)
          values (?, ?, ?, ?, ?, case when ? = '已发布' then current_timestamp else null end)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setString(1, request.configType());
      statement.setString(2, request.version());
      statement.setString(3, request.title());
      statement.setString(4, request.content());
      statement.setString(5, status);
      statement.setString(6, status);
      return statement;
    }, keyHolder);
    long id = keyHolder.getKey().longValue();
    audit("admin", "CREATE_AI_CONFIG", "ai_config", String.valueOf(id), Map.of("type", request.configType(), "version", request.version(), "status", status));
    return Map.of("id", id, "status", "已保存");
  }

  public List<AbuseReportItem> abuseReports(String status) {
    StringBuilder sql = new StringBuilder("select * from abuse_report where 1 = 1");
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(status)) {
      sql.append(" and status = ?");
      params.add(status);
    }
    sql.append(" order by created_at desc, id desc limit 200");
    return jdbc.query(sql.toString(), (rs, rowNum) -> new AbuseReportItem(
        rs.getLong("id"),
        rs.getLong("reporter_student_id"),
        rs.getString("target_type"),
        rs.getLong("target_id"),
        rs.getString("reason"),
        rs.getString("status"),
        rs.getString("handled_by"),
        rs.getString("handled_result"),
        toInstantString(rs.getTimestamp("handled_at")),
        toInstantString(rs.getTimestamp("created_at"))
    ), params.toArray());
  }

  public Map<String, Object> handleAbuse(AdminStatusRequest request) {
    if (request == null || request.id() <= 0 || !StringUtils.hasText(request.status())) {
      throw new IllegalArgumentException("举报处理状态不能为空");
    }
    jdbc.update(
        "update abuse_report set status = ?, handled_by = 'admin', handled_result = ?, handled_at = current_timestamp where id = ?",
        request.status(),
        valueOr(request.reason(), request.status()),
        request.id()
    );
    audit("admin", "HANDLE_ABUSE", "abuse_report", String.valueOf(request.id()), Map.of("status", request.status(), "result", valueOr(request.reason(), "")));
    return Map.of("id", request.id(), "status", request.status());
  }

  public Map<String, Object> updatePostStatus(AdminStatusRequest request) {
    if (request == null || request.id() <= 0 || !StringUtils.hasText(request.status())) {
      throw new IllegalArgumentException("审核状态不能为空");
    }
    String status = request.status();
    if ("置顶".equals(status)) {
      jdbc.update("update community_post set pinned = 1, updated_at = current_timestamp where id = ?", request.id());
    } else if ("取消置顶".equals(status)) {
      jdbc.update("update community_post set pinned = 0, updated_at = current_timestamp where id = ?", request.id());
    } else if ("精选".equals(status)) {
      jdbc.update("update community_post set featured = 1, updated_at = current_timestamp where id = ?", request.id());
    } else if ("取消精选".equals(status)) {
      jdbc.update("update community_post set featured = 0, updated_at = current_timestamp where id = ?", request.id());
    } else {
      if (("已驳回".equals(status) || "已下架".equals(status)) && !StringUtils.hasText(request.reason())) {
        throw new IllegalArgumentException("驳回或下架必须填写处置原因");
      }
      jdbc.update("update community_post set status = ?, reject_reason = ?, updated_at = current_timestamp where id = ?", status, request.reason(), request.id());
      createMessage(findPostAuthor(request.id()), "审核", "社区内容审核结果", "你的社区内容状态已更新为：" + status + (StringUtils.hasText(request.reason()) ? "，原因：" + request.reason() : ""), "/community");
    }
    audit("admin", "UPDATE_POST_STATUS", "community_post", String.valueOf(request.id()), Map.of("status", status, "reason", valueOr(request.reason(), "")));
    return Map.of("id", request.id(), "status", status, "updatedAt", Instant.now().toString());
  }

  public Map<String, Object> adminSetBestAnswer(BestAnswerRequest request) {
    return setBestAnswerInternal(request);
  }

  public Map<String, Object> banUser(AdminStatusRequest request) {
    if (request == null || request.id() <= 0 || !StringUtils.hasText(request.status())) {
      throw new IllegalArgumentException("用户状态不能为空");
    }
    jdbc.update("update student_account set status = ? where id = ?", request.status(), request.id());
    audit("admin", "UPDATE_USER_STATUS", "student_account", String.valueOf(request.id()), Map.of("status", request.status(), "reason", valueOr(request.reason(), "")));
    createMessage(request.id(), "账号", "账号状态已更新", "你的账号状态已更新为：" + request.status(), "/me");
    return Map.of("userId", request.id(), "status", request.status(), "updatedAt", Instant.now().toString());
  }

  public Map<String, Object> triggerCrawl(long sourceId) {
    return triggerCrawlInternal(sourceId, "手动", "admin");
  }

  private Map<String, Object> triggerCrawlInternal(long sourceId, String triggerType, String actor) {
    List<Map<String, Object>> rows = jdbc.queryForList("select * from data_source where id = ?", sourceId);
    if (rows.isEmpty()) throw new IllegalArgumentException("数据源不存在");
    Map<String, Object> source = rows.getFirst();
    if (!"启用".equals(String.valueOf(source.get("status")))) {
      throw new IllegalArgumentException("来源已停用，不允许继续抓取");
    }
    KeyHolder taskKey = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement statement = connection.prepareStatement(
          "insert into crawl_task (source_id, trigger_type, status, started_at) values (?, ?, '抓取中', current_timestamp)",
          Statement.RETURN_GENERATED_KEYS
      );
      statement.setLong(1, sourceId);
      statement.setString(2, triggerType);
      return statement;
    }, taskKey);
    long taskId = taskKey.getKey().longValue();
    List<String> sourceUrls = sourceCandidateUrls(source);
    try {
      List<String> fetchErrors = new ArrayList<>();
      CrawledPage entryPage = null;
      for (String candidateUrl : sourceUrls) {
        try {
          entryPage = fetchCrawlPage(candidateUrl);
          break;
        } catch (Exception exception) {
          fetchErrors.add(candidateUrl + "：" + trimText(valueOr(exception.getMessage(), "抓取失败"), 180));
        }
      }
      if (entryPage == null) {
        throw new IllegalStateException("所有来源地址抓取失败；" + String.join("；", fetchErrors));
      }
      List<CrawledPage> pages = crawlPagesForSource(source, entryPage);
      int created = 0;
      int skipped = 0;
      for (CrawledPage page : pages) {
        if (crawlCandidateExists(sourceId, page.url())) {
          skipped++;
          continue;
        }
        Map<String, Object> fallback = fallbackCrawlCandidate(source, page);
        Map<String, Object> parsed = llmClient.summarizeCrawlCandidate(
            sourceField(source, "name", "公开来源"),
            sourceField(source, "source_type", "公开来源"),
            sourceField(source, "path", "就业"),
            page.url(),
            page.title(),
            page.text(),
            fallback
        );
        jdbc.update(
            """
            insert into crawl_candidate (source_id, task_id, raw_url, parsed_json, review_status, crawled_at, parsed_at)
            values (?, ?, ?, cast(? as json), '待审核', current_timestamp, current_timestamp)
            """,
            sourceId,
            taskId,
            page.url(),
            toJson(parsed)
        );
        created++;
      }
      String resultMessage = created > 0
          ? "已生成 " + created + " 条待审核候选" + (skipped > 0 ? "，跳过重复 " + skipped + " 条" : "")
          : "未发现新的候选内容" + (skipped > 0 ? "，已跳过重复 " + skipped + " 条" : "");
      jdbc.update("update crawl_task set status = '已完成', result_message = ?, finished_at = current_timestamp where id = ?", resultMessage, taskId);
      jdbc.update("update data_source set last_crawl_at = current_timestamp where id = ?", sourceId);
      audit(actor, "TRIGGER_CRAWL", "data_source", String.valueOf(sourceId), Map.of("taskId", taskId, "created", created, "skipped", skipped, "entryUrl", entryPage.url()));
      return Map.of("sourceId", sourceId, "taskId", taskId, "taskStatus", "已完成", "createdCount", created, "skippedCount", skipped, "message", resultMessage, "createdAt", Instant.now().toString());
    } catch (Exception exception) {
      String message = trimText(exception.getMessage() == null ? "抓取失败" : exception.getMessage(), 480);
      jdbc.update("update crawl_task set status = '失败', result_message = ?, finished_at = current_timestamp where id = ?", message, taskId);
      audit(actor, "FAIL_CRAWL", "data_source", String.valueOf(sourceId), Map.of("taskId", taskId, "reason", message));
      return Map.of("sourceId", sourceId, "taskId", taskId, "taskStatus", "失败", "message", message, "createdAt", Instant.now().toString());
    }
  }

  private List<String> sourceCandidateUrls(Map<String, Object> source) {
    List<String> urls = new ArrayList<>();
    Object primary = source.get("source_url");
    if (primary != null && StringUtils.hasText(String.valueOf(primary))) {
      urls.add(String.valueOf(primary));
    }
    Map<String, Object> rule = sourceParserRule(source);
    Object fallbackUrls = rule.get("fallbackUrls");
    if (fallbackUrls instanceof Iterable<?> values) {
      for (Object value : values) {
        if (value != null && StringUtils.hasText(String.valueOf(value))) {
          urls.add(String.valueOf(value));
        }
      }
    }
    Object mirrorUrl = rule.get("mirrorUrl");
    if (mirrorUrl != null && StringUtils.hasText(String.valueOf(mirrorUrl))) {
      urls.add(String.valueOf(mirrorUrl));
    }
    return urls.stream()
        .map(String::trim)
        .filter(StringUtils::hasText)
        .distinct()
        .limit(5)
        .toList();
  }

  private Map<String, Object> sourceParserRule(Map<String, Object> source) {
    Object raw = source.get("parser_rule_json");
    if (raw == null) return Map.of();
    return jsonToMap(String.valueOf(raw));
  }

  private void startAutoCrawlScheduler() {
    if (!autoCrawlEnabled) return;
    crawlExecutor.scheduleWithFixedDelay(this::runDueAutoCrawls, autoCrawlInitialDelayMinutes, autoCrawlIntervalMinutes, TimeUnit.MINUTES);
  }

  private void startAutoChartRefreshScheduler() {
    if (!chartAutoRefreshEnabled) return;
    chartExecutor.scheduleWithFixedDelay(
        () -> refreshOfficialChartsInternal("自动", "system"),
        chartAutoRefreshInitialDelayMinutes,
        chartAutoRefreshIntervalMinutes,
        TimeUnit.MINUTES
    );
  }

  public Map<String, Object> refreshOfficialCharts() {
    return refreshOfficialChartsInternal("手动", "admin");
  }

  private Map<String, Object> refreshOfficialChartsInternal(String triggerType, String actor) {
    if (!chartRefreshRunning.compareAndSet(false, true)) {
      return Map.of("status", "跳过", "updatedCount", 0, "message", "已有图表刷新任务正在执行");
    }
    int updated = 0;
    List<String> messages = new ArrayList<>();
    try {
      Optional<CrawledPage> graduatePage = fetchChartPage(GRADUATE_EMPLOYMENT_SOURCE_URL, messages);
      if (graduatePage.isPresent()) {
        String text = graduatePage.get().text();
        double graduates = findWanNumberNear(text, List.of("高校毕业生", "毕业生")).orElse(1270D);
        double jobs = findWanNumberNear(text, List.of("岗位信息", "岗位")).orElse(1200D);
        updated += updateOfficialChart(
            1,
            officialGraduateTrendData(graduates),
            "按教育部公开发布的当届全国普通高校毕业生预计规模统计，单位为万人。",
            "教育部、央视网（据教育部）",
            GRADUATE_EMPLOYMENT_SOURCE_URL
        );
        updated += updateOfficialChart(
            5,
            officialEmploymentSupplyData(graduates, jobs),
            "2026 届高校毕业生预计约 " + formatNumber(graduates) + " 万人；教育部启动金秋启航校园招聘月，汇集发布岗位信息超 " + formatNumber(jobs) + " 万个。",
            "教育部、央视网（据教育部）",
            GRADUATE_EMPLOYMENT_SOURCE_URL
        );
      }

      Optional<CrawledPage> postgraduatePage = fetchChartPage(POSTGRADUATE_SOURCE_URL, messages);
      if (postgraduatePage.isPresent()) {
        double applicants = findWanNumberNear(postgraduatePage.get().text(), List.of("报名人数", "研考报名", "全国硕士研究生招生考试")).orElse(343D);
        updated += updateOfficialChart(
            2,
            officialPostgraduateTrendData(applicants),
            "全国硕士研究生招生考试报名人数，单位为万人；用于观察总体热度，不替代院校专业层面的录取难度分析。",
            "教育部、央视网（据教育部）",
            POSTGRADUATE_SOURCE_URL
        );
      }

      Optional<CrawledPage> civilPage = fetchChartPage(CIVIL_EXAM_SOURCE_URL, messages);
      if (civilPage.isPresent()) {
        String text = civilPage.get().text();
        double recruited = findWanNumberNear(text, List.of("计划招录", "招录")).orElse(3.81D);
        double qualified = findWanNumberNear(text, List.of("通过资格审查", "资格审查通过", "资格审查")).orElse(371.8D);
        updated += updateOfficialChart(
            3,
            officialCivilExamRatioData(recruited, qualified),
            "以官方公布的资格审查通过人数与计划招录人数估算，展示约数竞争比。",
            "中国政府网、国家公务员局",
            CIVIL_EXAM_SOURCE_URL
        );
        updated += updateOfficialChart(
            4,
            officialCivilExamScaleData(recruited, qualified),
            "2026 年度中央机关及其直属机构考试录用公务员计划招录约 " + formatNumber(recruited) + " 万人，资格审查通过 " + formatNumber(qualified) + " 万人。",
            "中国政府网、国家公务员局",
            CIVIL_EXAM_SOURCE_URL
        );
      }

      String message = messages.isEmpty()
          ? "官方图表数据刷新完成"
          : "官方图表数据刷新完成；" + String.join("；", messages);
      audit(actor, "自动".equals(triggerType) ? "AUTO_CHART_REFRESH" : "REFRESH_CHARTS", "chart_info", "official", Map.of(
          "triggerType", triggerType,
          "updated", updated,
          "message", trimText(message, 500)
      ));
      return Map.of("status", "已完成", "updatedCount", updated, "message", trimText(message, 500), "updatedAt", Instant.now().toString());
    } catch (Exception exception) {
      String message = trimText(exception.getMessage() == null ? "官方图表刷新失败" : exception.getMessage(), 480);
      audit(actor, "AUTO_CHART_REFRESH_ERROR", "chart_info", "official", Map.of("triggerType", triggerType, "reason", message));
      return Map.of("status", "失败", "updatedCount", updated, "message", message, "updatedAt", Instant.now().toString());
    } finally {
      chartRefreshRunning.set(false);
    }
  }

  private Optional<CrawledPage> fetchChartPage(String url, List<String> messages) {
    try {
      return Optional.of(fetchCrawlPage(url));
    } catch (Exception exception) {
      messages.add("来源抓取失败：" + trimText(url + " " + valueOr(exception.getMessage(), ""), 180));
      return Optional.empty();
    }
  }

  private int updateOfficialChart(long id, Map<String, Object> data, String methodology, String sourceName, String sourceUrl) {
    return jdbc.update(
        """
        update chart_info
        set data_json = cast(? as json),
            methodology = ?,
            source_name = ?,
            source_url = ?,
            filters_json = json_object(),
            updated_at = current_timestamp
        where id = ?
        """,
        toJson(data),
        methodology,
        sourceName,
        sourceUrl,
        id
    );
  }

  private Map<String, Object> officialGraduateTrendData(double graduates2026) {
    return Map.of(
        "rows", List.of(
            Map.of("year", "2024", "graduates", 1179),
            Map.of("year", "2025", "graduates", 1222),
            Map.of("year", "2026", "graduates", round1(graduates2026))
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "graduates", "name", "高校毕业生规模（万人）", "color", "#b45309")),
        "insights", List.of("2026 届规模预计约 " + formatNumber(graduates2026) + " 万人，继续处在高位。", "就业方向需要更早完成岗位画像、实习经历和投递节奏管理。")
    );
  }

  private Map<String, Object> officialEmploymentSupplyData(double graduates2026, double jobs2026) {
    return Map.of(
        "rows", List.of(
            Map.of("label", "高校毕业生规模", "people", round1(graduates2026)),
            Map.of("label", "金秋启航岗位信息", "people", round1(jobs2026))
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "people", "name", "规模（万人/万个）", "color", "#b45309")),
        "insights", List.of("岗位信息规模不等同于有效 offer，仍需看行业、城市和岗位匹配度。", "建议以目标岗位 JD 反推技能证据，而不是只按专业名称投递。")
    );
  }

  private Map<String, Object> officialPostgraduateTrendData(double applicants2026) {
    return Map.of(
        "rows", List.of(
            Map.of("year", "2022", "applicants", 457),
            Map.of("year", "2023", "applicants", 474),
            Map.of("year", "2024", "applicants", 438),
            Map.of("year", "2025", "applicants", 388),
            Map.of("year", "2026", "applicants", round1(applicants2026))
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "applicants", "name", "研考报名人数（万人）", "color", "#0f766e")),
        "insights", List.of("研考报名人数连续三年回落，不代表目标院校竞争同步下降。", "应结合专业目录、复试线、推免比例与调剂空间判断真实难度。")
    );
  }

  private Map<String, Object> officialCivilExamRatioData(double recruited2026, double qualified2026) {
    long ratio = Math.round(qualified2026 / Math.max(recruited2026, 0.1));
    return Map.of(
        "rows", List.of(
            Map.of("year", "2024", "ratio", 77),
            Map.of("year", "2025", "ratio", 86),
            Map.of("year", "2026", "ratio", ratio)
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "ratio", "name", "约每个录用计划对应过审人数", "color", "#2563eb")),
        "insights", List.of("2026 年国考约 " + ratio + ":1，岗位筛选比单纯刷题更早决定上限。", "考公规划应同时关注国考、省考、事业单位和选调等不同机会窗口。")
    );
  }

  private Map<String, Object> officialCivilExamScaleData(double recruited2026, double qualified2026) {
    return Map.of(
        "rows", List.of(
            Map.of("label", "计划招录", "people", round2(recruited2026)),
            Map.of("label", "资格审查通过", "people", round1(qualified2026))
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "people", "name", "人数（万人）", "color", "#2563eb")),
        "insights", List.of("报名规模远高于招录规模，选岗限制条件会显著影响真实竞争。", "专业、政治面貌、基层经历、应届身份等字段需要提前核对。")
    );
  }

  private Optional<Double> findWanNumberNear(String text, List<String> keywords) {
    if (!StringUtils.hasText(text)) return Optional.empty();
    String compact = text.replaceAll("\\s+", "");
    double bestValue = 0;
    int bestDistance = Integer.MAX_VALUE;
    Pattern pattern = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)万(?:人|个|条)?");
    for (String keyword : keywords) {
      int index = compact.indexOf(keyword);
      while (index >= 0) {
        int start = Math.max(0, index - 120);
        int end = Math.min(compact.length(), index + keyword.length() + 160);
        String window = compact.substring(start, end);
        java.util.regex.Matcher matcher = pattern.matcher(window);
        while (matcher.find()) {
          int numberCenter = start + matcher.start(1) + matcher.group(1).length() / 2;
          int distance = Math.abs(numberCenter - index);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestValue = Double.parseDouble(matcher.group(1));
          }
        }
        index = compact.indexOf(keyword, index + keyword.length());
      }
    }
    return bestDistance == Integer.MAX_VALUE ? Optional.empty() : Optional.of(bestValue);
  }

  private double round1(double value) {
    return Math.round(value * 10D) / 10D;
  }

  private double round2(double value) {
    return Math.round(value * 100D) / 100D;
  }

  private String formatNumber(double value) {
    double rounded = Math.abs(value) < 10 ? round2(value) : round1(value);
    if (Math.abs(rounded - Math.rint(rounded)) < 0.0001) {
      return String.valueOf((long) Math.rint(rounded));
    }
    String formatted = Math.abs(rounded) < 10
        ? String.format(Locale.ROOT, "%.2f", rounded)
        : String.format(Locale.ROOT, "%.1f", rounded);
    return formatted.replaceAll("0+$", "").replaceAll("\\.$", "");
  }

  private void recoverInterruptedCrawlTasks() {
    jdbc.update(
        """
        update crawl_task
        set status = '失败',
            result_message = '服务重启导致抓取中断，已自动标记为失败，可重新抓取',
            finished_at = current_timestamp
        where status = '抓取中'
        """
    );
  }

  private void runDueAutoCrawls() {
    if (!autoCrawlRunning.compareAndSet(false, true)) return;
    try {
      for (Long sourceId : dueAutoCrawlSourceIds()) {
        triggerCrawlInternal(sourceId, "自动", "system");
      }
    } catch (Exception exception) {
      audit("system", "AUTO_CRAWL_ERROR", "data_source", "scheduler", Map.of(
          "reason", trimText(exception.getMessage() == null ? "自动抓取失败" : exception.getMessage(), 300)
      ));
    } finally {
      autoCrawlRunning.set(false);
    }
  }

  private List<Long> dueAutoCrawlSourceIds() {
    Instant now = Instant.now();
    List<Long> due = new ArrayList<>();
    List<Map<String, Object>> rows = jdbc.queryForList(
        """
        select id, crawl_frequency, last_crawl_at
        from data_source
        where status = '启用'
        order by case when last_crawl_at is null then 0 else 1 end, last_crawl_at asc, id asc
        limit 20
        """
    );
    for (Map<String, Object> row : rows) {
      Object last = row.get("last_crawl_at");
      int intervalMinutes = crawlIntervalMinutes(String.valueOf(row.get("crawl_frequency")));
      boolean isDue = !(last instanceof Timestamp timestamp)
          || timestamp.toInstant().plusSeconds(intervalMinutes * 60L).isBefore(now);
      if (isDue) {
        due.add(((Number) row.get("id")).longValue());
      }
      if (due.size() >= 3) break;
    }
    return due;
  }

  private int crawlIntervalMinutes(String frequency) {
    if (!StringUtils.hasText(frequency)) return 24 * 60;
    if (frequency.contains("小时")) return 60;
    if (frequency.contains("周")) return 7 * 24 * 60;
    if (frequency.contains("月")) return 30 * 24 * 60;
    if (frequency.contains("每日") || frequency.contains("天")) return 24 * 60;
    return 24 * 60;
  }

  private List<CrawledPage> crawlPagesForSource(Map<String, Object> source, CrawledPage entryPage) {
    List<LinkCandidate> links = extractActionableLinks(entryPage.url(), entryPage.html(), sourceField(source, "path", "就业"));
    List<CrawledPage> pages = new ArrayList<>();
    for (LinkCandidate link : links) {
      if (pages.size() >= 5) break;
      if (crawlCandidateExists(((Number) source.get("id")).longValue(), link.url())) continue;
      try {
        pages.add(fetchCrawlPage(link.url()));
      } catch (Exception exception) {
        audit("system", "SKIP_CRAWL_LINK", "data_source", String.valueOf(source.get("id")), Map.of(
            "url", link.url(),
            "reason", trimText(exception.getMessage() == null ? "详情链接抓取失败" : exception.getMessage(), 240)
        ));
      }
    }
    return pages.isEmpty() ? List.of(entryPage) : pages;
  }

  private List<LinkCandidate> extractActionableLinks(String baseUrl, String html, String path) {
    if (!StringUtils.hasText(html)) return List.of();
    URI base = URI.create(baseUrl);
    String baseHost = normalizedHost(base.getHost());
    Map<String, LinkCandidate> candidates = new LinkedHashMap<>();
    java.util.regex.Matcher matcher = Pattern
        .compile("(?is)<a\\b[^>]*href\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>(.*?)</a>")
        .matcher(html);
    while (matcher.find()) {
      String href = decodeHtml(matcher.group(1)).trim();
      if (!StringUtils.hasText(href) || href.startsWith("#") || href.toLowerCase(Locale.ROOT).startsWith("javascript:")
          || href.toLowerCase(Locale.ROOT).startsWith("mailto:")) {
        continue;
      }
      URI resolved;
      try {
        resolved = validateCrawlUri(base.resolve(href).toString());
      } catch (RuntimeException exception) {
        continue;
      }
      if (!baseHost.equals(normalizedHost(resolved.getHost())) || looksLikeDownload(resolved.getPath())) continue;
      String text = cleanAnchorText(matcher.group(2));
      int score = linkScore(text + " " + resolved, path);
      if (score < 2) continue;
      String url = normalizedCrawlUrl(resolved);
      LinkCandidate current = candidates.get(url);
      if (current == null || score > current.score()) {
        candidates.put(url, new LinkCandidate(url, valueOr(text, "详情页"), score));
      }
    }
    return candidates.values().stream()
        .sorted(Comparator.comparingInt(LinkCandidate::score).reversed())
        .limit(8)
        .toList();
  }

  private int linkScore(String raw, String path) {
    String text = raw == null ? "" : raw;
    int score = 0;
    for (String keyword : List.of("公告", "通知", "公示", "职位", "岗位", "报名", "资格", "时间", "安排", "2026", "2025")) {
      if (text.contains(keyword)) score++;
    }
    List<String> pathKeywords = switch (path) {
      case "考公" -> List.of("国考", "省考", "公务员", "事业单位", "招录", "考试录用", "职位表", "面试", "资格复审");
      case "考研" -> List.of("硕士", "研究生", "招生", "专业目录", "复试", "调剂", "拟录取", "考试科目", "招生简章");
      default -> List.of("就业", "招聘", "校招", "实习", "宣讲", "双选", "招聘会", "毕业生", "用人单位");
    };
    for (String keyword : pathKeywords) {
      if (text.contains(keyword)) score += 2;
    }
    if (text.length() > 8 && text.length() < 90) score++;
    return score;
  }

  private boolean crawlCandidateExists(long sourceId, String url) {
    Integer count = jdbc.queryForObject(
        """
        select
          (select count(*) from crawl_candidate where source_id = ? and raw_url = ? and review_status in ('待审核', '已发布'))
          +
          (select count(*) from content_info where source_url = ? and status = '已发布')
        """,
        Integer.class,
        sourceId,
        url,
        url
    );
    return count != null && count > 0;
  }

  private String cleanAnchorText(String html) {
    return trimText(cleanHtml(html), 120);
  }

  private String normalizedHost(String host) {
    if (host == null) return "";
    String normalized = host.toLowerCase(Locale.ROOT);
    return normalized.startsWith("www.") ? normalized.substring(4) : normalized;
  }

  private String normalizedCrawlUrl(URI uri) {
    String url = uri.toString();
    int hashIndex = url.indexOf('#');
    return hashIndex >= 0 ? url.substring(0, hashIndex) : url;
  }

  private boolean looksLikeDownload(String path) {
    if (path == null) return false;
    String lower = path.toLowerCase(Locale.ROOT);
    return lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx")
        || lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".zip") || lower.endsWith(".rar");
  }

  private CrawledPage fetchCrawlPage(String sourceUrl) throws Exception {
    URI uri = validateCrawlUri(sourceUrl);
    HttpResponse<String> response = null;
    List<String> userAgents = List.of(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "CareerCompassBot/1.0 (+reviewed education information crawler)"
    );
    for (String userAgent : userAgents) {
      URI current = uri;
      for (int redirects = 0; redirects < 4; redirects++) {
        HttpRequest request = crawlRequest(current, userAgent);
        response = crawlHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 300 || response.statusCode() >= 400) break;
        Optional<String> location = response.headers().firstValue("location");
        if (location.isEmpty()) break;
        current = validateCrawlUri(current.resolve(location.get()).toString());
      }
      if (response == null || !List.of(401, 403, 429).contains(response.statusCode())) {
        uri = current;
        break;
      }
    }
    if (response == null) throw new IllegalStateException("来源请求未返回响应");
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      String deniedHint = List.of(401, 403, 429).contains(response.statusCode())
          ? "，来源拒绝访问；已尝试浏览器请求头，可在后台为该数据源配置 fallbackUrls 或更换公开入口"
          : "";
      throw new IllegalStateException("来源返回 HTTP " + response.statusCode() + deniedHint);
    }
    String body = response.body();
    if (!StringUtils.hasText(body)) {
      throw new IllegalStateException("来源页面为空");
    }
    String title = extractPageTitle(body);
    String text = cleanHtml(body);
    if (!StringUtils.hasText(title)) title = firstSentence(text, 80);
    if (text.length() < 80) {
      throw new IllegalStateException("来源正文过短，无法形成候选资讯");
    }
    return new CrawledPage(uri.toString(), title, trimText(text, 12000), body);
  }

  private HttpRequest crawlRequest(URI uri, String userAgent) {
    String referer = uri.getScheme() + "://" + uri.getHost() + "/";
    return HttpRequest.newBuilder(uri)
        .version(HttpClient.Version.HTTP_1_1)
        .timeout(Duration.ofSeconds(20))
        .header("User-Agent", userAgent)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.6")
        .header("Cache-Control", "no-cache")
        .header("Pragma", "no-cache")
        .header("Referer", referer)
        .header("Upgrade-Insecure-Requests", "1")
        .GET()
        .build();
  }

  private URI validateCrawlUri(String sourceUrl) {
    if (!StringUtils.hasText(sourceUrl)) throw new IllegalArgumentException("来源地址不能为空");
    URI uri = URI.create(sourceUrl.trim());
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
      throw new IllegalArgumentException("来源地址仅支持 http 或 https");
    }
    if (!StringUtils.hasText(host)) throw new IllegalArgumentException("来源地址缺少域名");
    String normalizedHost = host.toLowerCase(Locale.ROOT);
    if (normalizedHost.equals("localhost")
        || normalizedHost.equals("127.0.0.1")
        || normalizedHost.equals("0.0.0.0")
        || normalizedHost.equals("::1")
        || normalizedHost.startsWith("192.168.")
        || normalizedHost.startsWith("10.")
        || normalizedHost.matches("^172\\.(1[6-9]|2\\d|3[0-1])\\..*")) {
      throw new IllegalArgumentException("不允许抓取本机或内网地址");
    }
    return uri;
  }

  private Map<String, Object> fallbackCrawlCandidate(Map<String, Object> source, CrawledPage page) {
    String path = sourceField(source, "path", "就业");
    String sourceType = sourceField(source, "source_type", "公开来源");
    String title = StringUtils.hasText(page.title()) ? page.title() : sourceField(source, "name", "公开来源");
    String summary = firstSentence(page.text(), 180);
    String checklist = actionableChecklist(path);
    String nextStep = actionableNextStep(path);
    int quality = switch (sourceField(source, "trust_level", "中")) {
      case "高" -> 82;
      case "低" -> 55;
      default -> 68;
    };
    String body = "关键信息：" + valueOr(summary, "该来源已抓取到公开页面正文。")
        + " 学生应核对字段：" + checklist
        + " 下一步动作：" + nextStep
        + " 风险提醒：以来源原文、附件和报名系统为准；如果当前页面只是门户首页，需要继续进入具体公告、岗位页或下载附件后再判断。";
    return Map.of(
        "title", trimText(title, 120),
        "summary", trimText(sourceType + "可用于核对：" + checklist + " " + summary, 500),
        "body", trimText(body, 1200),
        "path", path,
        "tags", actionableTags(path, sourceType),
        "qualityScore", quality,
        "reason", "按信息差字段生成候选：优先提示核对字段、时间节点、下一步动作和来源风险。"
    );
  }

  private String sourceField(Map<String, Object> source, String key, String fallback) {
    Object value = source.get(key);
    if (value == null) return fallback;
    String text = String.valueOf(value);
    return "null".equalsIgnoreCase(text) ? fallback : valueOr(text, fallback);
  }

  private String actionableChecklist(String path) {
    return switch (path) {
      case "考公" -> "岗位代码、招录人数、专业限制、学历学位、政治面貌、基层经历、报名确认时间、资格复审材料";
      case "考研" -> "招生单位、专业代码、研究方向、考试科目、学习方式、复试线、调剂系统开放时间、学院复试细则";
      default -> "岗位名称、城市、学历要求、专业要求、投递截止时间、招聘会时间、薪酬福利、劳动合同与试用期条款";
    };
  }

  private String actionableNextStep(String path) {
    return switch (path) {
      case "考公" -> "下载公告附件或职位表，用自身专业、学历、政治面貌和经历条件先做排除，再记录报名、缴费、准考证和资格复审节点。";
      case "考研" -> "先用专业目录锁定考试科目和招生单位，再到目标学院官网核对复试调剂细则、参考资料和联系方式。";
      default -> "把页面中的岗位关键词、企业类型和城市要求整理成投递清单，同时核对宣讲会或招聘会时间，避免错过批次。";
    };
  }

  private List<String> actionableTags(String path, String sourceType) {
    return switch (path) {
      case "考公" -> List.of(path, sourceType, "岗位表", "资格复审");
      case "考研" -> List.of(path, sourceType, "专业目录", "复试调剂");
      default -> List.of(path, sourceType, "职位库", "招聘会");
    };
  }

  private String extractPageTitle(String html) {
    java.util.regex.Matcher matcher = Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html);
    return matcher.find() ? decodeHtml(matcher.group(1)).replaceAll("\\s+", " ").trim() : "";
  }

  private String cleanHtml(String html) {
    String text = html
        .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
        .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
        .replaceAll("(?is)<noscript[^>]*>.*?</noscript>", " ")
        .replaceAll("(?is)<br\\s*/?>", "\n")
        .replaceAll("(?is)</p>|</div>|</li>|</h[1-6]>", "\n")
        .replaceAll("(?is)<[^>]+>", " ");
    return decodeHtml(text)
        .replaceAll("[\\t\\x0B\\f\\r]+", " ")
        .replaceAll(" *\\n+ *", "\n")
        .replaceAll("[ ]{2,}", " ")
        .trim();
  }

  private String decodeHtml(String text) {
    return text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&ldquo;", "“")
        .replace("&rdquo;", "”")
        .replace("&mdash;", "—");
  }

  private String firstSentence(String text, int limit) {
    if (!StringUtils.hasText(text)) return "";
    String normalized = text.replaceAll("\\s+", " ").trim();
    int cut = normalized.length();
    for (String mark : List.of("。", "！", "？", ".", "!", "?")) {
      int index = normalized.indexOf(mark);
      if (index > 20) cut = Math.min(cut, index + mark.length());
    }
    return trimText(normalized.substring(0, Math.min(cut, normalized.length())), limit);
  }

  private String trimText(String text, int limit) {
    if (text == null) return "";
    String normalized = text.replaceAll("\\s+", " ").trim();
    return normalized.length() <= limit ? normalized : normalized.substring(0, limit);
  }

  private record CrawledPage(String url, String title, String text, String html) {}

  private record LinkCandidate(String url, String text, int score) {}

  public List<AuditItem> audits(String targetType, String action) {
    StringBuilder sql = new StringBuilder("select * from audit_log where 1 = 1");
    List<Object> params = new ArrayList<>();
    if (StringUtils.hasText(targetType)) {
      sql.append(" and target_type = ?");
      params.add(targetType);
    }
    if (StringUtils.hasText(action)) {
      sql.append(" and action = ?");
      params.add(action);
    }
    sql.append(" order by created_at desc limit 200");
    return jdbc.query(
        sql.toString(),
        (rs, rowNum) -> new AuditItem(
            rs.getLong("id"),
            rs.getString("actor"),
            rs.getString("action"),
            rs.getString("target_type"),
            rs.getString("target_id"),
            rs.getString("detail_json"),
            rs.getTimestamp("created_at").toInstant()
        ),
        params.toArray()
    );
  }

  private void createRuntimeTables() {
    execute("""
        create table if not exists community_interaction (
          id bigint primary key auto_increment,
          post_id bigint not null,
          student_id bigint not null,
          interaction_type varchar(20) not null,
          created_at timestamp not null default current_timestamp,
          unique key uq_interaction (post_id, student_id, interaction_type),
          index idx_interaction_student (student_id, interaction_type)
        )
        """);
    execute("""
        create table if not exists system_message (
          id bigint primary key auto_increment,
          student_id bigint not null,
          type varchar(40) not null,
          title varchar(120) not null,
          body varchar(800) not null,
          link_url varchar(500),
          read_at timestamp null,
          created_at timestamp not null default current_timestamp,
          index idx_message_student_read (student_id, read_at, created_at)
        )
        """);
    execute("""
        create table if not exists user_activity (
          id bigint primary key auto_increment,
          student_id bigint not null,
          item_type varchar(40) not null,
          item_id varchar(80) not null,
          title varchar(160) not null,
          url varchar(500),
          viewed_at timestamp not null default current_timestamp,
          unique key uq_student_activity (student_id, item_type, item_id),
          index idx_activity_student_viewed (student_id, viewed_at)
        )
        """);
    execute("""
        create table if not exists crawl_task (
          id bigint primary key auto_increment,
          source_id bigint not null,
          trigger_type varchar(30) not null,
          status varchar(30) not null default '待抓取',
          result_message varchar(500),
          started_at timestamp null,
          finished_at timestamp null,
          created_at timestamp not null default current_timestamp,
          index idx_task_source_created (source_id, created_at)
        )
        """);
    execute("""
        create table if not exists admin_account (
          id bigint primary key auto_increment,
          username varchar(60) not null unique,
          password_hash varchar(255) not null,
          display_name varchar(80) not null,
          status varchar(30) not null default '正常',
          created_at timestamp not null default current_timestamp,
          last_login_at timestamp null
        )
        """);
    execute("""
        create table if not exists tag_config (
          id bigint primary key auto_increment,
          name varchar(60) not null,
          tag_type varchar(40) not null,
          status varchar(30) not null default '启用',
          sort_order int not null default 0,
          created_at timestamp not null default current_timestamp,
          unique key uq_tag_name_type (name, tag_type),
          index idx_tag_type_status (tag_type, status)
        )
        """);
    execute("""
        create table if not exists ai_config (
          id bigint primary key auto_increment,
          config_type varchar(40) not null,
          version varchar(40) not null,
          title varchar(120) not null,
          content mediumtext not null,
          status varchar(30) not null default '草稿',
          published_at timestamp null,
          created_at timestamp not null default current_timestamp,
          updated_at timestamp not null default current_timestamp on update current_timestamp,
          unique key uq_ai_config_version (config_type, version),
          index idx_ai_config_type_status (config_type, status)
        )
        """);
    execute("""
        create table if not exists path_page_config (
          path_key varchar(40) primary key,
          name varchar(40) not null,
          intro varchar(500) not null,
          suitable_json json not null,
          timeline_json json not null,
          pitfalls_json json not null,
          accent varchar(20) not null default '#b45309',
          match_score int not null default 80,
          sort_order int not null default 0,
          status varchar(30) not null default '启用',
          created_at timestamp not null default current_timestamp,
          updated_at timestamp not null default current_timestamp on update current_timestamp,
          index idx_path_status_sort (status, sort_order)
        )
        """);
  }

  private void repairSeedData() {
    execute("set names utf8mb4");
    jdbc.update(
        """
        insert into admin_account (username, password_hash, display_name, status)
        values ('admin', '$2a$10$demo', '系统管理员', '正常')
        on duplicate key update display_name = values(display_name), status = values(status)
        """
    );
    jdbc.update(
        """
        insert into student_account
          (email, password_hash, name, student_no, college, major, graduation_year, phone, nickname, agreement_accepted, status)
        values
          ('2335061025@st.usst.edu.cn', '$2a$10$demo', '张同学', '2335061025', '光电信息与计算机工程学院', '计算机科学与技术', '2027', '13800000000', 'Compass 用户', 1, '已完成引导')
        on duplicate key update
          name = values(name), student_no = values(student_no), college = values(college), major = values(major),
          graduation_year = values(graduation_year), phone = values(phone), nickname = values(nickname), status = values(status)
        """
    );
    seedContent(1, "国考职位表先筛专业和基层经历", "考公", "国家公务员局专题页的公告、报考指南和职位表能直接决定能不能报。学生应先核对专业限制、学历学位、政治面貌、基层经历、招录人数、报名确认和资格复审材料，再判断是否投入备考。", "国家公务员局考试录用专题", "http://bm.scs.gov.cn/kl2026");
    seedContent(2, "用研招网专业目录锁定考试科目", "考研", "研招网硕士专业目录按专业或招生单位查询当年招生专业和考试科目。择校时先核对专业代码、研究方向、学习方式、初试科目和专项计划，再到学院官网确认复试细则。", "中国研究生招生信息网", "https://yz.chsi.com.cn/zsml/");
    seedContent(3, "24365 职位库适合建立岗位关键词池", "就业", "国家大学生就业服务平台职位库可按城市、学历、岗位类型和实习/全职筛选。学生可记录岗位名称、专业要求、企业行业、投递截止时间和高频技能词，用来反推简历项目表达。", "国家大学生就业服务平台", "https://24365.ncss.cn/student/jobs/index.html");
    seedContent(4, "学校邮箱自动识别学号", "公告", "注册时会根据学校邮箱前 10 位数字自动绑定学号，并自动推算基础届别背景。", "后台维护", "");
    seedContent(5, "公开权威数据发布前均需人工审核", "公告", "新增数据源抓取候选不会直接公开，管理员审核通过后才进入前台展示。", "后台维护", "");
    seedContent(6, "访谈草稿会保存多久？", "FAQ", "AI 访谈草稿至少保存 180 天，再次进入会恢复最近一次整理结果。", "后台维护", "");
    seedContent(7, "AI 报告能替我做决定吗？", "FAQ", "AI 报告仅供辅助决策，不替代学生最终选择。", "后台维护", "");
    seedContent(8, "上海本地招录公告重点看附件", "考公", "上海公务员局招录专题和上海人社招聘公告更适合查上海本地招录批次。重点看公告附件里的岗位代码、专业目录口径、资格条件、报名入口、审核、缴费和面试节点，别只看新闻标题。", "上海市公务员局 / 上海人社", "https://rsj.sh.gov.cn/tzpgg_17408/index.html");
    seedContent(9, "调剂系统开放前先整理可接受边界", "考研", "研招网复试调剂页会显示调剂系统状态、基本要求、注意事项和院校调剂信息。初试分数处于边缘时，应提前整理成绩、专业背景、目标地区和可接受专业，避免系统开放时临时筛校。", "研招网复试调剂", "https://yz.chsi.com.cn/yztj/");
    seedContent(10, "本校研招网用于核对学院细则", "考研", "上海理工大学研究生招生网用于核对招生简章、学院复试办法、调剂通知和联系方式。报本校或同层次院校时，优先看学院细则和附件中的复试比例、材料清单、成绩折算办法。", "上海理工大学研究生招生网", "https://yz.usst.edu.cn/");
    seedContent(11, "专场招聘会比泛岗位列表更适合抓批次", "就业", "24365 专场招聘会页面适合发现集中招聘窗口。学生可以按行业、地区和主题建立投递日历，记录报名入口、参会企业、岗位面向专业和截止时间，避免错过秋招、春招或专项招聘批次。", "国家大学生就业服务平台", "https://www.24365.ncss.cn/student/jobfair/index.html");
    seedContent(12, "留沪就业要同时看公共服务和校内宣讲", "就业", "乐业上海和学校就业信息网适合核对上海本地招聘活动、政策服务、宣讲会和校内双选会。准备留沪的学生应把本地公共就业服务、校内宣讲和企业网申入口放在同一张投递表里管理。", "乐业上海 / 上海理工大学就业信息网", "https://jobs.rsj.sh.gov.cn/");
    retireGenericPathContent();
    seedTemplate(1, "通用校招简历模板", "就业", "DOCX", "/templates/employment-resume-template.docx");
    seedTemplate(2, "考公报名信息整理表", "考公", "XLSX", "/templates/civil-position-screening.xlsx");
    seedTemplate(3, "复试个人陈述模板", "考研", "DOCX", "/templates/postgraduate-personal-statement.docx");
    seedTemplate(4, "面试复盘记录表", "就业", "DOCX", "/templates/employment-interview-review.docx");
    seedTemplate(5, "校招投递跟踪表", "就业", "XLSX", "/templates/employment-application-tracker.xlsx");
    seedTemplate(6, "考公备考周计划模板", "考公", "DOCX", "/templates/civil-study-plan.docx");
    seedTemplate(7, "考公报名材料核对清单", "考公", "DOCX", "/templates/civil-application-checklist.docx");
    seedTemplate(8, "考研院校专业对比表", "考研", "XLSX", "/templates/postgraduate-school-comparison.xlsx");
    seedTemplate(9, "复试材料核对清单", "考研", "DOCX", "/templates/postgraduate-retest-materials.docx");
    seedPathConfig(
        "civil-exam",
        "考公",
        "政策理解、岗位匹配与稳定备考节奏",
        List.of("偏好稳定职业环境", "愿意持续训练公共科目", "能接受岗位筛选约束"),
        List.of("3-4 月梳理岗位", "6-8 月系统刷题", "10-11 月冲刺模考", "面试前复盘表达"),
        List.of("只看热门岗位", "忽视基层经历要求", "申论练习缺少反馈"),
        "#2563eb",
        82,
        1
    );
    seedPathConfig(
        "postgraduate",
        "考研",
        "择校边界、科目规划与复试材料准备",
        List.of("希望提升学历", "能接受长周期复习", "专业兴趣明确"),
        List.of("3 月确定专业", "6 月完成基础轮", "9 月进入真题轮", "12 月考前查漏补缺"),
        List.of("择校只看名气", "忽略复试差额比", "公共课进度失衡"),
        "#0f766e",
        76,
        2
    );
    seedPathConfig(
        "employment",
        "就业",
        "能力证明、岗位画像与校招行动管理",
        List.of("项目经历较多", "希望尽快进入行业", "愿意持续面试迭代"),
        List.of("5 月整理经历", "7 月完善简历", "9 月密集投递", "11 月复盘 offer"),
        List.of("简历缺少量化结果", "只投单一岗位", "面试复盘不成体系"),
        "#b45309",
        88,
        3
    );
    seedPost(1, "从光电专业转软件测试岗，我把项目经历这样改成简历亮点", "围绕课程设计、实习、比赛三个材料，把经历拆成问题、动作、结果三段。", "经验帖", "就业", false, 126, 58, 18);
    seedPost(2, "省考和事业单位能不能同时准备？时间怎么分配更稳", "公共科目可复用，但岗位表筛选、申论材料和面试准备要分开管理。", "问答", "考公", true, 88, 41, 24);
    seedSource(1, "研招网硕士专业目录", "专业目录与考试科目", "https://yz.chsi.com.cn/zsml/", "每日", "考研", "高", "启用");
    seedSource(2, "研招网复试调剂服务", "复试调剂信息", "https://yz.chsi.com.cn/yztj/", "每日", "考研", "高", "启用");
    seedSource(3, "上海理工大学研究生招生网", "校内研招公告", "https://yz.usst.edu.cn/", "每日", "考研", "高", "启用");
    seedSource(4, "国考考试录用公务员专题", "岗位表与报考指南", "http://bm.scs.gov.cn/kl2026", "每日", "考公", "高", "启用");
    seedSource(5, "上海市公务员局招录专题", "地方公务员招录", "https://bm.shacs.gov.cn/zlxt", "每日", "考公", "高", "启用");
    seedSource(6, "上海人社事业单位招聘公告", "事业单位招聘公告", "https://rsj.sh.gov.cn/tzpgg_17408/index.html", "每日", "考公", "高", "启用");
    seedSource(7, "国家大学生就业服务平台职位库", "校招岗位与实习岗位", "https://24365.ncss.cn/student/jobs/index.html", "每日", "就业", "高", "启用");
    seedSource(8, "国家大学生就业服务平台专场招聘", "专场招聘会", "https://www.24365.ncss.cn/student/jobfair/index.html", "每日", "就业", "高", "启用");
    seedSource(9, "乐业上海第一站", "上海就业服务与招聘", "https://jobs.rsj.sh.gov.cn/", "每日", "就业", "高", "启用");
    seedSource(10, "上海理工大学就业信息网", "校内招聘与宣讲会", "https://91.usst.edu.cn/", "每日", "就业", "高", "启用");
    seedChart(1, "2024-2026 高校毕业生规模", "趋势图", "全部", Map.of(
        "rows", List.of(
            Map.of("year", "2024", "graduates", 1179),
            Map.of("year", "2025", "graduates", 1222),
            Map.of("year", "2026", "graduates", 1270)
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "graduates", "name", "高校毕业生规模（万人）", "color", "#b45309")),
        "insights", List.of("2026 届规模预计约 1270 万人，继续处在高位。", "就业方向需要更早完成岗位画像、实习经历和投递节奏管理。")
    ), "按教育部公开发布的当届全国普通高校毕业生预计规模统计，单位为万人。", "教育部、央视网（据教育部）", "https://news.cctv.com/2025/11/20/ARTI0xYbzeyS5Y6Zky3R3VZg251120.shtml", "公开", "首页", "已发布");
    seedChart(2, "2022-2026 研考报名人数变化", "趋势图", "考研", Map.of(
        "rows", List.of(
            Map.of("year", "2022", "applicants", 457),
            Map.of("year", "2023", "applicants", 474),
            Map.of("year", "2024", "applicants", 438),
            Map.of("year", "2025", "applicants", 388),
            Map.of("year", "2026", "applicants", 343)
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "applicants", "name", "研考报名人数（万人）", "color", "#0f766e")),
        "insights", List.of("研考报名人数连续三年回落，不代表目标院校竞争同步下降。", "应结合专业目录、复试线、推免比例与调剂空间判断真实难度。")
    ), "全国硕士研究生招生考试报名人数，单位为万人；用于观察总体热度，不替代院校专业层面的录取难度分析。", "教育部、央视网（据教育部）", "https://news.cctv.cn/2025/11/24/ARTINT5iuLLp0mtEfdDd7Kkl251124.shtml", "公开", "图表中心", "已发布");
    seedChart(3, "2024-2026 国考资格审查竞争比", "趋势图", "考公", Map.of(
        "rows", List.of(
            Map.of("year", "2024", "ratio", 77),
            Map.of("year", "2025", "ratio", 86),
            Map.of("year", "2026", "ratio", 98)
        ),
        "xKey", "year",
        "series", List.of(Map.of("key", "ratio", "name", "约每个录用计划对应过审人数", "color", "#2563eb")),
        "insights", List.of("2026 年国考约 98:1，岗位筛选比单纯刷题更早决定上限。", "考公规划应同时关注国考、省考、事业单位和选调等不同机会窗口。")
    ), "以官方公布的资格审查通过人数与计划招录人数估算，展示约数竞争比。", "中国政府网、国家公务员局", "https://www.gov.cn/lianbo/bumen/202510/content_7036992.htm", "公开", "图表中心", "已发布");
    seedChart(4, "2026 国考招录与过审规模", "柱状图", "考公", Map.of(
        "rows", List.of(
            Map.of("label", "计划招录", "people", 3.81),
            Map.of("label", "资格审查通过", "people", 371.8)
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "people", "name", "人数（万人）", "color", "#2563eb")),
        "insights", List.of("报名规模远高于招录规模，选岗限制条件会显著影响真实竞争。", "专业、政治面貌、基层经历、应届身份等字段需要提前核对。")
    ), "2026 年度中央机关及其直属机构考试录用公务员计划招录约 3.81 万人，资格审查通过 371.8 万人。", "中国政府网、国家公务员局", "https://www.gov.cn/lianbo/bumen/202510/content_7036992.htm", "公开", "图表中心", "已发布");
    seedChart(5, "2026 届就业供需参考", "柱状图", "就业", Map.of(
        "rows", List.of(
            Map.of("label", "高校毕业生规模", "people", 1270),
            Map.of("label", "金秋启航岗位信息", "people", 1200)
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "people", "name", "规模（万人/万个）", "color", "#b45309")),
        "insights", List.of("岗位信息规模不等同于有效 offer，仍需看行业、城市和岗位匹配度。", "建议以目标岗位 JD 反推技能证据，而不是只按专业名称投递。")
    ), "2026 届高校毕业生预计约 1270 万人；教育部启动金秋启航校园招聘月，汇集发布岗位信息超 1200 万个。", "教育部、央视网（据教育部）", "https://news.cctv.com/2025/11/20/ARTI0xYbzeyS5Y6Zky3R3VZg251120.shtml", "公开", "图表中心", "已发布");
    seedChart(6, "考研关键节点时间线", "时间线图", "考研", Map.of(
        "rows", List.of(
            Map.of("stage", "9-10 月", "description", "关注研招网公告、招生单位章程、专业目录和网报安排。"),
            Map.of("stage", "12 月", "description", "参加初试，并同步准备复试材料和调剂预案。"),
            Map.of("stage", "次年 2-3 月", "description", "查询初试成绩、复试线与调剂系统开放安排。"),
            Map.of("stage", "次年 3-4 月", "description", "参加复试/调剂，重点跟踪目标院校学院通知。")
        ),
        "insights", List.of("考研不是只看初试分数，复试信息差和调剂速度也会影响结果。")
    ), "按研招网年度网报、初试、复试调剂服务等公开流程整理。", "中国研究生招生信息网", "https://yz.chsi.com.cn/", "公开", "图表中心", "已发布");
    seedChart(7, "考公关键节点时间线", "时间线图", "考公", Map.of(
        "rows", List.of(
            Map.of("stage", "10 月", "description", "关注国考公告、职位表、报考指南和专业目录匹配。"),
            Map.of("stage", "11-12 月", "description", "参加公共科目笔试，部分岗位还需专业科目。"),
            Map.of("stage", "次年 1 月左右", "description", "查询笔试成绩和首批面试名单。"),
            Map.of("stage", "次年 2-4 月", "description", "准备资格复审、面试、体检和考察。")
        ),
        "insights", List.of("考公时间线固定性强，最容易被低估的是职位表筛选和资格条件核验。")
    ), "按国家公务员局中央机关及其直属机构考试录用公务员专题信息整理。", "国家公务员局", "http://bm.scs.gov.cn/kl2026", "公开", "图表中心", "已发布");
    seedChart(8, "就业关键行动时间线", "时间线图", "就业", Map.of(
        "rows", List.of(
            Map.of("stage", "5-6 月", "description", "锁定 2-3 类目标岗位，整理项目、实习、竞赛和课程作品证据。"),
            Map.of("stage", "7-8 月", "description", "完成简历、作品集、笔试题库和目标企业清单。"),
            Map.of("stage", "9-11 月", "description", "跟进秋招、专场招聘和宣讲会，记录投递转化率。"),
            Map.of("stage", "12 月以后", "description", "进行 offer 对比、补录关注和毕业去向材料确认。")
        ),
        "insights", List.of("就业准备要用岗位要求倒推能力证据，不能只等招聘信息出现。")
    ), "参考教育部国家大学生就业服务平台与校园招聘专项行动公开信息整理。", "国家大学生就业服务平台", "https://www.24365.ncss.cn/student/jobs/index.html", "公开", "图表中心", "已发布");
    seedChart(9, "三路径准备成本与反馈速度", "雷达图", "全部", Map.of(
        "rows", List.of(
            Map.of("subject", "信息透明", "就业", 72, "考研", 64, "考公", 86),
            Map.of("subject", "准备周期", "就业", 78, "考研", 58, "考公", 66),
            Map.of("subject", "现金流压力", "就业", 82, "考研", 46, "考公", 62),
            Map.of("subject", "反馈速度", "就业", 84, "考研", 48, "考公", 55),
            Map.of("subject", "能力可迁移", "就业", 80, "考研", 76, "考公", 60)
        ),
        "xKey", "subject",
        "series", List.of(
            Map.of("key", "就业", "name", "就业", "color", "#b45309"),
            Map.of("key", "考研", "name", "考研", "color", "#0f766e"),
            Map.of("key", "考公", "name", "考公", "color", "#2563eb")
        ),
        "insights", List.of("就业通常反馈更快，考研更依赖长期投入，考公的信息透明度更高但岗位限制更强。", "该图用于帮助学生理解投入结构，不代表个人最终匹配度。")
    ), "按三路径典型准备动作、反馈周期和公开信息透明度进行规划型对比，供报告解释使用。", "Career Compass 规划模型", "公开", "图表中心", "已发布");
    seedChart(10, "就业岗位能力需求拆解", "环图", "就业", Map.of(
        "rows", List.of(
            Map.of("label", "项目经历", "value", 32, "color", "#b45309"),
            Map.of("label", "实习/实践", "value", 24, "color", "#2563eb"),
            Map.of("label", "技术证据", "value", 18, "color", "#0f766e"),
            Map.of("label", "沟通表达", "value", 14, "color", "#be123c"),
            Map.of("label", "投递复盘", "value", 12, "color", "#475569")
        ),
        "nameKey", "label",
        "valueKey", "value",
        "insights", List.of("就业路径更看重可被面试追问验证的经历证据。", "简历优化应从项目结果、实习任务和岗位关键词三处同步推进。")
    ), "根据校招简历筛选常见材料类型整理为规划参考比例。", "Career Compass 规划模型", "公开", "图表中心", "已发布");
    seedChart(11, "考研择校关注因素权重", "柱状图", "考研", Map.of(
        "rows", List.of(
            Map.of("label", "专业匹配", "importance", 34),
            Map.of("label", "考试科目", "importance", 26),
            Map.of("label", "复试比例", "importance", 18),
            Map.of("label", "地区成本", "importance", 12),
            Map.of("label", "调剂空间", "importance", 10)
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "importance", "name", "关注权重", "color", "#0f766e")),
        "insights", List.of("择校先看专业与科目，再看复试和调剂风险。", "只看学校名气容易低估科目切换和复试信息差。")
    ), "按研招信息核对流程拆解择校变量，作为目标院校梯度表的字段建议。", "Career Compass 规划模型", "公开", "图表中心", "已发布");
    seedChart(12, "考公备考模块投入建议", "柱状图", "考公", Map.of(
        "rows", List.of(
            Map.of("label", "岗位筛选", "hours", 18),
            Map.of("label", "行测模块", "hours", 42),
            Map.of("label", "申论训练", "hours", 28),
            Map.of("label", "时政积累", "hours", 16),
            Map.of("label", "面试预案", "hours", 12)
        ),
        "xKey", "label",
        "series", List.of(Map.of("key", "hours", "name", "月度建议投入小时", "color", "#2563eb")),
        "insights", List.of("岗位筛选应前置，避免刷题后发现资格条件不匹配。", "申论和面试表达需要持续反馈，不适合只在考前突击。")
    ), "按考公准备阶段的典型任务拆解月度投入建议，实际应结合目标岗位调整。", "Career Compass 规划模型", "公开", "图表中心", "已发布");
    seedTag("考公", "路径标签", 1);
    seedTag("考研", "路径标签", 2);
    seedTag("就业", "路径标签", 3);
    seedTag("光电信息与计算机工程学院", "学院标签", 1);
    seedTag("计算机科学与技术", "专业标签", 1);
    seedTag("经验帖", "内容标签", 1);
    seedTag("问答", "内容标签", 2);
    seedAiConfig("questionnaire", QUESTIONNAIRE_VERSION, "开放访谈素材模板", "围绕学生原始叙述、关键经历、价值取向、现实约束、情绪压力、资源条件、路径假设和未说透的矛盾进行开放整理。", "已发布");
    seedAiConfig("report_template", TEMPLATE_VERSION, "开放式报告模板", "基于学生开放访谈素材直接写一篇完整自然语言报告。可以比较考公、考研、就业，也可以按学生真实情况自由组织判断，并自然解释系统动态评分和推荐排序。", "已发布");
    seedAiConfig("prompt", PROMPT_VERSION, "报告生成提示词", "像读完访谈记录的咨询老师一样综合判断学生经历、动机、约束、情绪压力、资源条件和未说透的矛盾；结合考公、考研、就业三路径动态评分解释推荐排序；报告只供辅助决策，不输出录取、上岸、就业结果承诺。", "已发布");
    seedAiConfig("disclaimer", "DISC-2026.05", "AI 免责声明", "AI 报告仅供辅助决策，不替代学生最终选择。", "已发布");
  }

  private void seedContent(long id, String title, String category, String summary, String source, String url) {
    jdbc.update(
        """
        insert into content_info (id, title, category, body, summary, source_name, source_url, status)
        values (?, ?, ?, ?, ?, ?, ?, '已发布')
        on duplicate key update title = values(title), category = values(category), body = values(body),
          summary = values(summary), source_name = values(source_name), source_url = values(source_url), status = values(status)
        """,
        id,
        title,
        category,
        summary,
        summary,
        source,
        url
    );
  }

  private void seedTemplate(long id, String name, String category, String format, String url) {
    jdbc.update(
        """
        insert into template_resource (id, name, category, file_format, file_url, status)
        values (?, ?, ?, ?, ?, '已发布')
        on duplicate key update name = values(name), category = values(category), file_format = values(file_format),
          file_url = values(file_url), status = values(status)
        """,
        id,
        name,
        category,
        format,
        url
    );
  }

  private void retireGenericPathContent() {
    jdbc.update(
        """
        update content_info
        set status = '已下架', offline_at = current_timestamp, updated_at = current_timestamp
        where status = '已发布'
          and category in ('考公', '考研', '就业')
          and (
            source_url in ('https://www.gov.cn/', 'https://example.gov.cn/jobs', 'https://example.edu.gov.cn', 'https://career.example.edu.cn')
            or title like '中国政府网首页%'
            or title like '中国政府网发布多项就业相关最新政策%'
            or title like '习近平回信勉励青年%'
            or title like '%抓取候选'
          )
        """
    );
  }

  private void seedPathConfig(
      String key,
      String name,
      String intro,
      List<String> suitable,
      List<String> timeline,
      List<String> pitfalls,
      String accent,
      int matchScore,
      int sortOrder
  ) {
    jdbc.update(
        """
        insert into path_page_config
          (path_key, name, intro, suitable_json, timeline_json, pitfalls_json, accent, match_score, sort_order, status)
        values (?, ?, ?, cast(? as json), cast(? as json), cast(? as json), ?, ?, ?, '启用')
        on duplicate key update path_key = values(path_key)
        """,
        key,
        name,
        intro,
        toJson(suitable),
        toJson(timeline),
        toJson(pitfalls),
        accent,
        matchScore,
        sortOrder
    );
  }

  private void seedPost(long id, String title, String body, String type, String path, boolean anonymous, int likes, int favorites, int replies) {
    jdbc.update(
        """
        insert into community_post (id, student_id, title, body, type, path, anonymous, status, likes, favorites, replies)
        values (?, 1, ?, ?, ?, ?, ?, '已通过', ?, ?, ?)
        on duplicate key update title = values(title), body = values(body), type = values(type), path = values(path),
          anonymous = values(anonymous), status = values(status), likes = values(likes), favorites = values(favorites), replies = values(replies),
          deleted_at = null
        """,
        id,
        title,
        body,
        type,
        path,
        anonymous,
        likes,
        favorites,
        replies
    );
  }

  private void seedSource(long id, String name, String type, String url, String frequency, String path, String trust, String status) {
    jdbc.update(
        """
        insert into data_source (id, name, source_type, source_url, crawl_frequency, path, trust_level, status, last_crawl_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
        on duplicate key update name = values(name), source_type = values(source_type), source_url = values(source_url),
          crawl_frequency = values(crawl_frequency), path = values(path), trust_level = values(trust_level), status = values(status)
        """,
        id,
        name,
        type,
        url,
        frequency,
        path,
        trust,
        status
    );
  }

  private void seedChart(long id, String title, String type, String path, Map<String, Object> data, String methodology, String source, String visibility, String position, String status) {
    seedChart(id, title, type, path, data, methodology, source, null, visibility, position, status, Map.of());
  }

  private void seedChart(long id, String title, String type, String path, Map<String, Object> data, String methodology, String source, String visibility, String position, String status, Map<String, Object> filters) {
    seedChart(id, title, type, path, data, methodology, source, null, visibility, position, status, filters);
  }

  private void seedChart(long id, String title, String type, String path, Map<String, Object> data, String methodology, String source, String sourceUrl, String visibility, String position, String status) {
    seedChart(id, title, type, path, data, methodology, source, sourceUrl, visibility, position, status, Map.of());
  }

  private void seedChart(long id, String title, String type, String path, Map<String, Object> data, String methodology, String source, String sourceUrl, String visibility, String position, String status, Map<String, Object> filters) {
    jdbc.update(
        """
        insert into chart_info (id, title, chart_type, path, data_json, methodology, source_name, source_url, filters_json, visibility, display_position, status)
        values (?, ?, ?, ?, cast(? as json), ?, ?, ?, cast(? as json), ?, ?, ?)
        on duplicate key update id = values(id)
        """,
        id,
        title,
        type,
        path,
        toJson(data),
        methodology,
        source,
        sourceUrl,
        toJson(filters == null ? Map.of() : filters),
        visibility,
        position,
        status
    );
  }

  private void seedTag(String name, String type, int sortOrder) {
    jdbc.update(
        """
        insert into tag_config (name, tag_type, status, sort_order)
        values (?, ?, '启用', ?)
        on duplicate key update status = values(status), sort_order = values(sort_order)
        """,
        name,
        type,
        sortOrder
    );
  }

  private void seedAiConfig(String type, String version, String title, String content, String status) {
    jdbc.update(
        """
        insert into ai_config (config_type, version, title, content, status, published_at)
        values (?, ?, ?, ?, ?, case when ? = '已发布' then current_timestamp else null end)
        on duplicate key update title = values(title), content = values(content), status = values(status),
          published_at = case when values(status) = '已发布' then coalesce(published_at, current_timestamp) else published_at end
        """,
        type,
        version,
        title,
        content,
        status,
        status
    );
  }

  private Optional<StudentProfile> findStudent(long id) {
    List<StudentProfile> rows = jdbc.query(
        "select * from student_account where id = ?",
        (rs, rowNum) -> mapStudent(rs),
        id
    );
    return rows.stream().findFirst();
  }

  private Optional<CommunityPost> communityPostAny(long id) {
    List<CommunityPost> rows = jdbc.query(
        """
        select p.*, case when p.anonymous = 1 then '匿名用户' else coalesce(s.nickname, s.name, '未命名用户') end as author_name
        from community_post p join student_account s on s.id = p.student_id
        where p.id = ? and p.deleted_at is null
        """,
        (rs, rowNum) -> mapPost(rs),
        id
    );
    return rows.stream().findFirst();
  }

  private StudentProfile mapStudent(ResultSet rs) throws java.sql.SQLException {
    return new StudentProfile(
        rs.getLong("id"),
        rs.getString("email"),
        rs.getString("name"),
        rs.getString("student_no"),
        rs.getString("college"),
        rs.getString("major"),
        rs.getString("graduation_year"),
        rs.getString("phone"),
        rs.getString("nickname"),
        rs.getString("status")
    );
  }

  private ContentItem mapContent(ResultSet rs) throws java.sql.SQLException {
    return new ContentItem(
        rs.getLong("id"),
        rs.getString("title"),
        rs.getString("category"),
        rs.getString("body"),
        rs.getString("summary"),
        rs.getString("source_name"),
        rs.getString("source_url"),
        rs.getString("tags"),
        rs.getString("display_position"),
        rs.getInt("sort_order"),
        toInstantString(rs.getTimestamp("updated_at")),
        rs.getString("status")
    );
  }

  private List<PathConfigItem> queryPathConfigs(String whereClause, Object... params) {
    String sql = """
        select *
        from path_page_config
        %s
        order by sort_order asc, updated_at desc
        """.formatted(whereClause == null ? "" : whereClause);
    return jdbc.query(sql, (rs, rowNum) -> mapPathConfig(rs), params);
  }

  private PathConfigItem mapPathConfig(ResultSet rs) throws java.sql.SQLException {
    return new PathConfigItem(
        rs.getString("path_key"),
        rs.getString("name"),
        rs.getString("intro"),
        jsonToStringList(rs.getString("suitable_json")),
        jsonToStringList(rs.getString("timeline_json")),
        jsonToStringList(rs.getString("pitfalls_json")),
        rs.getString("accent"),
        rs.getInt("match_score"),
        rs.getInt("sort_order"),
        rs.getString("status"),
        toInstantString(rs.getTimestamp("updated_at"))
    );
  }

  private PathPage toPathPage(PathConfigItem config) {
    return new PathPage(
        config.key(),
        config.name(),
        config.intro(),
        config.suitable(),
        config.timeline(),
        config.pitfalls(),
        config.accent(),
        config.matchScore(),
        config.sortOrder(),
        config.status(),
        config.updatedAt(),
        templates(config.name()),
        contents(config.name())
    );
  }

  private TemplateResource mapTemplate(ResultSet rs) throws java.sql.SQLException {
    return new TemplateResource(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("category"),
        rs.getString("file_format"),
        rs.getString("file_url"),
        toInstantString(rs.getTimestamp("uploaded_at"))
    );
  }

  private CommunityPost mapPost(ResultSet rs) throws java.sql.SQLException {
    return new CommunityPost(
        rs.getLong("id"),
        rs.getString("title"),
        rs.getString("body"),
        rs.getString("type"),
        rs.getString("path"),
        rs.getString("author_name"),
        rs.getBoolean("anonymous"),
        rs.getString("status"),
        rs.getInt("likes"),
        rs.getInt("favorites"),
        booleanColumnOrFalse(rs, "liked"),
        booleanColumnOrFalse(rs, "favorited"),
        rs.getInt("replies"),
        jsonToStringList(rs.getString("image_urls_json")),
        rs.getTimestamp("created_at").toInstant()
    );
  }

  private boolean booleanColumnOrFalse(ResultSet rs, String column) {
    try {
      return rs.getBoolean(column);
    } catch (java.sql.SQLException exception) {
      return false;
    }
  }

  private void scheduleReportGeneration(long reportId, long studentId, String email, Map<String, Object> answers, String questionnaireVersion) {
    reportExecutor.schedule(() -> {
      try {
        AiReport fallback = buildReport(reportId, answers, questionnaireVersion, "已完成");
        AiReport completed = llmClient.generateReport(
            reportId,
            answers,
            questionnaireVersion,
            TEMPLATE_VERSION,
            PROMPT_VERSION,
            latestAiConfigContent("report_template", "基于学生开放访谈素材直接写一篇完整自然语言报告，并自然解释系统已计算的考公、考研、就业动态评分。"),
            latestAiConfigContent("prompt", "像读完访谈记录的咨询老师一样综合判断学生经历、动机、约束、情绪压力、资源条件和未说透的矛盾；结合三路径动态评分解释推荐排序；报告只供辅助决策，不输出录取、上岸、就业结果承诺。"),
            latestAiConfigContent("disclaimer", "AI 报告仅供辅助决策，不替代学生最终选择。"),
            fallback
        );
        int updated = jdbc.update(
            """
            update ai_report
            set generation_status = '已完成', report_json = cast(? as json),
                completed_at = current_timestamp, generated_at = current_timestamp
            where id = ? and generation_status = '生成中'
            """,
            toJson(completed),
            reportId
        );
        if (updated == 0) return;
        jdbc.update("update student_account set status = '已完成引导' where id = ? and status in ('待补全档案', '待完成问卷')", studentId);
        audit("student:" + email, "COMPLETE_REPORT_GENERATION", "ai_report", String.valueOf(reportId), Map.of("questionnaireVersion", questionnaireVersion));
        createMessage(studentId, "报告", "AI 报告已生成", "你的三路径评估报告已生成，可在报告页查看并继续追问。", "/report");
      } catch (Exception exception) {
        jdbc.update(
            "update ai_report set generation_status = '失败', failure_reason = ?, completed_at = current_timestamp where id = ?",
            exception.getMessage() == null ? "报告生成异常" : exception.getMessage(),
            reportId
        );
        createMessage(studentId, "报告", "AI 报告生成失败", "报告生成遇到异常，请在报告页手动重试。", "/report");
      }
    }, 3, TimeUnit.SECONDS);
  }

  private String reportOvertimeMessage(Object startedAt) {
    if (startedAt instanceof Timestamp timestamp && timestamp.toInstant().isBefore(Instant.now().minusSeconds(120))) {
      return "AI 报告仍在处理中，完成后会生成消息提醒";
    }
    return "AI 报告正在生成，请稍后刷新状态";
  }

  private InterviewResponse fallbackInterview(List<Map<String, String>> messages, StudentProfile profile) {
    Map<String, Object> answers = extractInterviewAnswers(messages, profile);
    List<String> explorationTopics = explorationTopics(answers, messages);
    List<String> decisionSignals = fallbackDecisionSignals(answers, messages);
    String profileSummary = String.valueOf(answers.getOrDefault("profileSummary", "目前素材还不完整，但已开始记录你的经历、偏好和现实约束。"));
    int completion = interviewCompletion(messages, answers);
    boolean ready = StringUtils.hasText(userNarrative(messages)) && (completion >= 45 || userMessageCount(messages) >= 2);
    String assistantMessage;
    if (messages == null || messages.isEmpty()) {
      assistantMessage = "你可以从这两个入口里任选一个说起：最近让你纠结的一件事，或者一段项目、实习、课程、考证经历；如果愿意，也可以顺带说说城市、家庭、收入、成长里你最在意哪一两个因素。";
    } else if (ready) {
      assistantMessage = "这些素材已经能生成第一版报告草案了。我会先按你刚才提到的经历和顾虑整理判断依据；如果还有别的重要背景，也可以继续聊完再生成。";
    } else {
      assistantMessage = nextFallbackQuestion(explorationTopics);
    }
    return new InterviewResponse(assistantMessage, answers, profileSummary, decisionSignals, completion, ready, explorationTopics);
  }

  private List<Map<String, String>> interviewTranscript(List<Map<String, String>> messages, String assistantMessage) {
    List<Map<String, String>> transcript = new ArrayList<>();
    if (messages != null) {
      for (Map<String, String> message : messages) {
        if (message == null) continue;
        String role = message.get("role");
        String content = message.get("content");
        if (StringUtils.hasText(role) && StringUtils.hasText(content)) {
          transcript.add(Map.of("role", role, "content", content));
        }
      }
    }
    if (StringUtils.hasText(assistantMessage)) {
      transcript.add(Map.of("role", "assistant", "content", assistantMessage));
    }
    return transcript;
  }

  private Map<String, Object> extractInterviewAnswers(List<Map<String, String>> messages, StudentProfile profile) {
    String text = userNarrative(messages);
    Map<String, Object> answers = new LinkedHashMap<>();
    answers.put("rawNarrative", trimText(text, 1200));
    answers.put("sourceMessages", messages == null ? List.of() : messages);
    if (profile != null) {
      answers.put("studentContext", Map.of(
          "college", valueOr(profile.college(), ""),
          "major", valueOr(profile.major(), "")
      ));
    }
    answers.put("profileSummary", StringUtils.hasText(text)
        ? trimText("已记录学生原始表达，等待 AI 基于完整语境整理学生画像和判断线索：" + text.replaceAll("\\s+", " "), 260)
        : "尚未形成完整学生画像，需要继续通过开放访谈补充。");
    answers.put("decisionSignals", fallbackDecisionSignals(answers, messages));
    return answers;
  }

  private List<String> fallbackDecisionSignals(Map<String, Object> answers, List<Map<String, String>> messages) {
    String text = userNarrative(messages);
    if (!StringUtils.hasText(text)) {
      return List.of("等待学生补充原始叙述");
    }
    return List.of("已保留原始叙述，具体画像和路径判断交由 AI 综合整理");
  }

  private String userNarrative(List<Map<String, String>> messages) {
    if (messages == null) return "";
    return messages.stream()
        .filter(message -> "user".equals(message.get("role")))
        .map(message -> message.getOrDefault("content", ""))
        .reduce("", (left, right) -> left + "\n" + right)
        .trim();
  }

  private int userMessageCount(List<Map<String, String>> messages) {
    if (messages == null) return 0;
    return (int) messages.stream().filter(message -> "user".equals(message.get("role"))).count();
  }

  private int interviewCompletion(List<Map<String, String>> messages, Map<String, Object> answers) {
    String text = userNarrative(messages);
    if (!StringUtils.hasText(text)) return 0;
    int lengthBoost = Math.min(30, text.length() / 6);
    int messageBoost = Math.min(15, userMessageCount(messages) * 5);
    return Math.min(100, 20 + lengthBoost + messageBoost);
  }

  private List<String> explorationTopics(Map<String, Object> answers, List<Map<String, String>> messages) {
    String text = userNarrative(messages);
    if (!StringUtils.hasText(text)) {
      return List.of("最近最困扰你的选择", "一段有代表性的经历", "必须考虑的现实条件");
    }
    return List.of("还想补充的重要背景", "最真实的顾虑或期待", "希望 AI 重点参考的经历");
  }

  private String nextFallbackQuestion(List<String> explorationTopics) {
    return "我先把你刚才说的内容记下来。接下来你可以继续补充任何你觉得会影响选择的背景、经历、顾虑或期待，不需要按固定维度回答。";
  }

  private CrawlCandidateItem mapCandidate(ResultSet rs) throws java.sql.SQLException {
    Map<String, Object> parsed = jsonToMap(rs.getString("parsed_json"));
    return new CrawlCandidateItem(
        rs.getLong("id"),
        rs.getLong("source_id"),
        rs.getString("source_name"),
        rs.getString("raw_url"),
        String.valueOf(parsed.getOrDefault("title", "抓取候选内容")),
        String.valueOf(parsed.getOrDefault("summary", "")),
        String.valueOf(parsed.getOrDefault("path", "")),
        rs.getString("review_status"),
        rs.getString("failure_reason"),
        toInstantString(rs.getTimestamp("crawled_at")),
        toInstantString(rs.getTimestamp("parsed_at")),
        toInstantString(rs.getTimestamp("published_at")),
        intFromObject(parsed.get("qualityScore"), 0),
        String.valueOf(parsed.getOrDefault("reason", "")),
        tagsFromParsed(parsed, String.valueOf(parsed.getOrDefault("path", "")))
    );
  }

  private ChartItem mapChart(ResultSet rs) throws java.sql.SQLException {
    return new ChartItem(
        rs.getLong("id"),
        rs.getString("title"),
        rs.getString("chart_type"),
        rs.getString("path"),
        jsonToMap(rs.getString("data_json")),
        rs.getString("methodology"),
        rs.getString("source_name"),
        rs.getString("source_url"),
        jsonToMap(rs.getString("filters_json")),
        rs.getString("visibility"),
        rs.getString("display_position"),
        rs.getString("status"),
        toInstantString(rs.getTimestamp("updated_at"))
    );
  }

  private AiReport buildReport(long id, Map<String, Object> answers, String questionnaireVersion, String status) {
    int employment = clamp(scoreFromAnswers(answers, "employment", 78));
    int civil = clamp(scoreFromAnswers(answers, "civil", 70));
    int postgraduate = clamp(scoreFromAnswers(answers, "postgraduate", 68));
    List<Score> sorted = new ArrayList<>(List.of(
        new Score("就业", employment, "", List.of("项目和实习材料可直接转化为岗位能力证明", "反馈周期短，便于 90 天内验证方向", "城市选择与岗位池更灵活")),
        new Score("考公", civil, "", List.of("稳定性高，适合保留备选窗口", "公共科目训练可阶段性推进")),
        new Score("考研", postgraduate, "", List.of("有利于中长期专业成长", "需要更高连续投入和择校风险控制"))
    ));
    sorted.sort(Comparator.comparingInt(Score::score).reversed());
    List<Score> ranked = new ArrayList<>();
    for (int index = 0; index < sorted.size(); index++) {
      String rank = switch (index) {
        case 0 -> "第一推荐";
        case 1 -> "第二推荐";
        default -> "第三推荐";
      };
      Score score = sorted.get(index);
      ranked.add(new Score(score.path(), score.score(), rank, score.reasons()));
    }
    return new AiReport(
        id,
        REPORT_VERSION,
        Instant.now().toString(),
        ranked,
        buildDimensions(employment, civil, postgraduate, answers),
        fallbackNarrativeReport(answers, ranked),
        String.valueOf(answers.getOrDefault("profileSummary", "当前学生画像仍需继续补充，报告先基于已有问卷和访谈素材生成。")),
        "当前输入显示你需要在确定性、成长性和短期执行反馈之间做平衡。系统建议以最高匹配路径为主线，同时保留分差较小路径作为备选。",
        List.of("路径分差较小时容易多线投入过散", "公开信息更新频繁，需要定期复核来源", "家庭、城市和经济约束可能改变最优排序"),
        List.of("主路径每周至少投入 4 个固定时间块", "备选路径每周保留 1 至 2 个低成本验证动作", "两周一次复核岗位/院校/考试窗口"),
        List.of(
            new ActionPlan("30 天", List.of(
                "把报告正文里的关键判断拆成一页清单：当前最想验证的主路径、暂时保留的备选路径、必须考虑的城市/家庭/经济约束各写清楚",
                "整理可直接使用的材料：成绩单、证书、项目/实习经历、竞赛/科研记录、个人作品或简历素材，并标记哪些内容还缺证据",
                "围绕主路径建立 15 至 20 个真实样本库：就业看岗位 JD 和校招要求，考研看院校专业目录和复试信息，考公看岗位表与限制条件",
                "每周至少安排 4 个固定行动时段，其中 3 个给主路径，1 个给备选路径，避免只停留在想法比较",
                "月底做一次复盘：记录哪些信息支持当前排序，哪些信息削弱当前排序，以及下一阶段需要重点验证的 3 个问题"
            )),
            new ActionPlan("60 天", List.of(
                "完成一轮真实反馈：就业至少投递或模拟投递 10 至 20 个岗位，考研完成目标院校梯度表，考公完成一轮岗位筛选和基础题型摸底",
                "把主路径所需能力转成可训练任务：例如简历项目量化、专业课章节、行测申论模块、英语/复试表达或作品集补强",
                "找 2 至 3 个外部反馈源复核判断：辅导员、专业老师、已上岸/读研/就业的学长学姐或行业从业者，重点问门槛和失败原因",
                "对备选路径保留低成本进展，不要求全面展开，但要保留材料、信息和时间窗口，防止主路径验证失败后从零开始",
                "在第 60 天重新排序三条路径：不只看兴趣，也看投入成本、反馈速度、机会窗口、家庭约束和个人状态是否匹配"
            )),
            new ActionPlan("90 天", List.of(
                "形成一份阶段性决策说明：为什么当前主路径继续推进，或者为什么需要切换主路径；每个结论都要对应真实证据",
                "把后续 3 个月排成月度节奏：主路径的关键考试/投递/材料节点，备选路径的最低维护动作，以及每周固定复盘时间",
                "完成一次接近真实场景的检验：就业做完整面试或项目讲解，考研做计时套题和择校复核，考公做模块测评和岗位条件复核",
                "清理会拖慢行动的模糊问题：城市能否接受、家庭支持边界、经济压力、是否愿意延期进入职场、失败后的退路怎么安排",
                "根据 90 天结果更新报告：把新增经历和真实反馈补进 AI 访谈，再生成新版报告，避免继续依赖最初的静态判断"
            ))
        ),
        List.of("路径专题页", "模板资源库", "社区经验帖", "辅导员/导师复核清单"),
        "AI 报告仅供辅助决策，不替代学生最终选择。",
        questionnaireVersion,
        TEMPLATE_VERSION,
        PROMPT_VERSION,
        status
    );
  }

  private String fallbackNarrativeReport(Map<String, Object> answers, List<Score> ranked) {
    String profile = String.valueOf(answers.getOrDefault("profileSummary", "目前素材还不完整，但已能形成初步判断。"));
    Score top = ranked.isEmpty() ? new Score("就业", 0, "第一推荐", List.of()) : ranked.getFirst();
    String raw = String.valueOf(answers.getOrDefault("rawNarrative", ""));
    return """
        综合来看，这份报告会先把你已经表达出的经历、偏好和现实约束放在一起判断，而不是只依据单一分数。%s

        目前系统给出的第一主线是%s。这个判断并不意味着其他路径不重要，而是表示在已有信息下，它更适合作为接下来 30 到 90 天的验证重点。你仍然需要保留备选路径，尤其是在信息还不完整、家庭或城市约束还没有完全说清楚的时候。

        接下来最重要的不是立刻做不可逆选择，而是用低成本动作验证判断：把已有项目、实习、成绩、证书、城市偏好和家庭期待整理成清单；同时对主路径做真实信息核对，例如岗位、院校、考试窗口、材料门槛或招聘反馈。%s
        """.formatted(
        profile,
        top.path(),
        StringUtils.hasText(raw) ? "我会继续保留你原始表达中的细节，后续追问可以围绕这些细节进一步修正判断。" : "如果后续补充更多个人经历，报告排序和建议也应随之更新。"
    ).strip();
  }

  private List<DimensionScore> buildDimensions(int employment, int civil, int postgraduate, Map<String, Object> answers) {
    return List.of(
        new DimensionScore("确定性", clamp(civil + 10), clamp(postgraduate - 4), clamp(employment - 6)),
        new DimensionScore("成长性", clamp(civil - 4), clamp(postgraduate + 12), clamp(employment + 8)),
        new DimensionScore("现金流", clamp(civil - 8), clamp(postgraduate - 16), clamp(employment + 12)),
        new DimensionScore("准备周期", clamp(civil + 2), clamp(postgraduate + 6), clamp(employment - 4)),
        new DimensionScore("信息透明", clamp(civil + 4), clamp(postgraduate), clamp(employment - 2))
    );
  }

  private int scoreFromAnswers(Map<String, Object> answers, String path, int fallback) {
    String text = flattenAnswerText(answers);
    int score = fallback + scoreSignals(text, path);
    Object hypotheses = answers == null ? null : answers.get("pathHypotheses");
    if (hypotheses instanceof List<?> rows) {
      for (Object row : rows) {
        if (!(row instanceof Map<?, ?> item)) continue;
        String hypothesisPath = stringFromMap(item, "path");
        if (!pathMatches(hypothesisPath, path)) continue;
        String evidence = stringFromMap(item, "evidence");
        String concern = stringFromMap(item, "concern");
        if (StringUtils.hasText(evidence)) score += 8;
        if (StringUtils.hasText(concern)) score -= textContainsAny(concern, List.of("不足", "风险", "压力", "成本", "不确定", "缺乏")) ? 5 : 2;
      }
    }
    return score;
  }

  private String stringFromMap(Map<?, ?> map, String key) {
    Object value = map.get(key);
    return value == null ? "" : String.valueOf(value);
  }

  private int scoreSignals(String text, String path) {
    if (!StringUtils.hasText(text)) return 0;
    String normalized = text.toLowerCase(Locale.ROOT);
    return switch (path) {
      case "employment" -> keywordScore(normalized,
          List.of("就业", "工作", "实习", "项目", "后端", "前端", "开发", "产品", "运营", "测试", "校招", "offer", "简历", "岗位", "高薪", "互联网", "作品集", "面试", "笔试", "尽快赚钱", "现金流", "收入"),
          List.of("不想就业", "逃避就业", "没有项目", "项目不足", "不想进厂", "不想工作"));
      case "civil" -> keywordScore(normalized,
          List.of("考公", "公务员", "事业编", "编制", "稳定", "国考", "省考", "选调", "体制", "基层", "申论", "行测", "家里希望稳定", "户口", "公共服务"),
          List.of("不想考公", "不喜欢稳定", "不接受体制", "不想刷题", "讨厌体制"));
      case "postgraduate" -> keywordScore(normalized,
          List.of("考研", "读研", "升学", "研究生", "科研", "论文", "导师", "学历", "深造", "保研", "调剂", "复试", "学硕", "专硕", "专业课", "实验室"),
          List.of("不想考研", "不想读研", "备考压力", "不想科研", "不想延期", "经济压力大"));
      default -> 0;
    };
  }

  private int keywordScore(String text, List<String> positive, List<String> negative) {
    int score = 0;
    for (String keyword : positive) {
      if (text.contains(keyword.toLowerCase(Locale.ROOT))) score += 4;
    }
    for (String keyword : negative) {
      if (text.contains(keyword.toLowerCase(Locale.ROOT))) score -= 6;
    }
    return Math.max(-18, Math.min(18, score));
  }

  private boolean pathMatches(String value, String path) {
    if (!StringUtils.hasText(value)) return false;
    return switch (path) {
      case "employment" -> value.contains("就业") || value.toLowerCase(Locale.ROOT).contains("employment");
      case "civil" -> value.contains("考公") || value.contains("公务员") || value.toLowerCase(Locale.ROOT).contains("civil");
      case "postgraduate" -> value.contains("考研") || value.contains("升学") || value.toLowerCase(Locale.ROOT).contains("postgraduate");
      default -> false;
    };
  }

  private boolean textContainsAny(String text, List<String> keywords) {
    if (!StringUtils.hasText(text)) return false;
    for (String keyword : keywords) {
      if (StringUtils.hasText(keyword) && text.contains(keyword)) return true;
    }
    return false;
  }

  private String flattenAnswerText(Object value) {
    if (value == null) return "";
    if (value instanceof Map<?, ?> map) {
      StringBuilder builder = new StringBuilder();
      map.forEach((key, item) -> builder
          .append(' ')
          .append(key == null ? "" : key)
          .append(' ')
          .append(flattenAnswerText(item)));
      return builder.toString();
    }
    if (value instanceof Iterable<?> iterable) {
      StringBuilder builder = new StringBuilder();
      for (Object item : iterable) {
        builder.append(' ').append(flattenAnswerText(item));
      }
      return builder.toString();
    }
    return String.valueOf(value);
  }

  private void validateAuth(AuthRequest request) {
    if (request == null || !StringUtils.hasText(request.email())) {
      throw new IllegalArgumentException("邮箱不能为空");
    }
    String email = normalizeEmail(request.email());
    validateEmailDomain(email);
    validatePassword(request.password());
  }

  private void validatePassword(String password) {
    if (!StringUtils.hasText(password) || password.length() < 8 || password.length() > 20) {
      throw new IllegalArgumentException("密码长度应为 8 至 20 位");
    }
    int classes = 0;
    if (password.matches(".*[A-Za-z].*")) classes++;
    if (password.matches(".*\\d.*")) classes++;
    if (password.matches(".*[^A-Za-z0-9].*")) classes++;
    if (classes < 2) {
      throw new IllegalArgumentException("密码至少包含字母、数字、特殊字符中的任意两类");
    }
  }

  private void validateProfile(long userId, ProfileRequest request, String studentNo) {
    if (request == null || !StringUtils.hasText(request.name()) || request.name().length() < 2 || request.name().length() > 20) {
      throw new IllegalArgumentException("姓名为 2 至 20 个字符");
    }
    if (!StringUtils.hasText(studentNo) || !studentNo.matches("\\d{10}")) {
      throw new IllegalArgumentException("学号必须为 10 位数字");
    }
    Integer duplicated = jdbc.queryForObject(
        "select count(*) from student_account where student_no = ? and id <> ?",
        Integer.class,
        studentNo,
        userId
    );
    if (duplicated != null && duplicated > 0) {
      throw new IllegalArgumentException("该学号已被使用");
    }
    if (!StringUtils.hasText(request.college()) || !StringUtils.hasText(request.major())) {
      throw new IllegalArgumentException("学院和专业不能为空");
    }
    List<String> majors = USST_COLLEGE_MAJORS.get(request.college());
    if (majors == null) {
      throw new IllegalArgumentException("请选择上海理工大学有效学院");
    }
    if (!majors.contains(request.major())) {
      throw new IllegalArgumentException("所选专业不属于当前学院");
    }
    if (!StringUtils.hasText(request.phone()) || !request.phone().matches("1\\d{10}")) {
      throw new IllegalArgumentException("手机号应为中国大陆 11 位手机号");
    }
  }

  private void validateAssessment(Map<String, Object> answers) {
    if (answers == null || answers.isEmpty() || answers.values().stream().noneMatch(this::hasMeaningfulAnswerValue)) {
      throw new IllegalArgumentException("访谈素材为空，请先完成 AI 访谈");
    }
  }

  private Map<String, Object> openAssessmentAnswers(Map<String, Object> answers) {
    if (answers == null || answers.isEmpty()) return Map.of();
    Map<String, Object> open = new LinkedHashMap<>();
    answers.forEach((key, value) -> {
      if (StringUtils.hasText(key) && !isLegacyQuestionnaireKey(key) && hasMeaningfulAnswerValue(value)) {
        open.put(key, value);
      }
    });
    return open;
  }

  private boolean isLegacyQuestionnaireKey(String key) {
    return List.of(
        "academic",
        "certificates",
        "project",
        "constraints",
        "city",
        "riskPreference",
        "employmentInterest",
        "civilInterest",
        "postgraduateInterest"
    ).contains(key);
  }

  private boolean hasMeaningfulAnswerValue(Object value) {
    if (value == null) return false;
    if (value instanceof String text) return StringUtils.hasText(text);
    if (value instanceof List<?> list) return !list.isEmpty();
    if (value instanceof Map<?, ?> map) return !map.isEmpty();
    return true;
  }

  private void validatePost(PostRequest request) {
    if (request == null || !StringUtils.hasText(request.title()) || request.title().length() < 5 || request.title().length() > 80) {
      throw new IllegalArgumentException("标题长度应为 5 至 80 字");
    }
    if (!StringUtils.hasText(request.body()) || request.body().length() < 10) {
      throw new IllegalArgumentException("正文长度至少 10 个字符");
    }
    String text = request.title() + request.body();
    if (List.of("代考", "包过", "广告").stream().anyMatch(text::contains)) {
      throw new IllegalArgumentException("内容命中敏感词规则，请调整后重新提交");
    }
  }

  private List<String> normalizePostImages(List<String> imageUrls) {
    if (imageUrls == null || imageUrls.isEmpty()) return List.of();
    List<String> normalized = imageUrls.stream()
        .map(value -> value == null ? "" : value.trim())
        .filter(StringUtils::hasText)
        .distinct()
        .toList();
    if (normalized.size() > MAX_COMMUNITY_IMAGES) {
      throw new IllegalArgumentException("每条内容最多添加 " + MAX_COMMUNITY_IMAGES + " 张图片");
    }
    for (String url : normalized) {
      if (!url.startsWith("/api/community/uploads/")) {
        throw new IllegalArgumentException("图片地址不合法，请重新上传");
      }
    }
    return normalized;
  }

  private String storeCommunityImage(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("图片不能为空");
    }
    if (file.getSize() > communityUploadMaxBytes) {
      throw new IllegalArgumentException("单张图片不能超过 " + (communityUploadMaxBytes / 1024 / 1024) + "MB");
    }
    String extension = imageExtension(file);
    String fileName = Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + extension;
    Path target = communityUploadDir.resolve(fileName).normalize();
    if (!target.startsWith(communityUploadDir)) {
      throw new IllegalArgumentException("图片文件名不合法");
    }
    try (InputStream inputStream = file.getInputStream()) {
      Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException exception) {
      throw new IllegalStateException("图片保存失败", exception);
    }
    return "/api/community/uploads/" + fileName;
  }

  private String imageExtension(MultipartFile file) {
    String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
    return switch (contentType) {
      case "image/jpeg", "image/jpg" -> ".jpg";
      case "image/png" -> ".png";
      case "image/webp" -> ".webp";
      case "image/gif" -> ".gif";
      default -> throw new IllegalArgumentException("仅支持 JPG、PNG、WebP、GIF 图片");
    };
  }

  private void requireConfirmed(Boolean confirmed, String operation) {
    if (!Boolean.TRUE.equals(confirmed)) {
      throw new IllegalArgumentException(operation + "需要二次确认");
    }
  }

  private void ensureQuestionnaireAllowed(AuthUser user) {
    StudentProfile profile = me(user);
    if ("注销中".equals(profile.status()) || "已注销".equals(profile.status()) || "已禁用".equals(profile.status())) {
      throw new IllegalArgumentException("当前账号状态不允许继续操作");
    }
  }

  private void ensureLlmAvailable() {
    llmClient.requireAvailable();
  }

  private void requireCompletedStudent(AuthUser user) {
    StudentProfile profile = me(user);
    if (!"已完成引导".equals(profile.status())) {
      throw new IllegalArgumentException("请先完成 AI 访谈并生成报告");
    }
  }

  private void assertLoginAllowed(Map<String, Object> row) {
    String status = String.valueOf(row.get("status"));
    if ("已禁用".equals(status) || "已注销".equals(status) || "注销中".equals(status)) {
      throw new IllegalArgumentException("当前账号状态不允许登录：" + status);
    }
  }

  private String interactionSelectColumns(Long viewerStudentId) {
    if (viewerStudentId == null || viewerStudentId <= 0) {
      return "0 as liked, 0 as favorited\n";
    }
    return """
          exists(select 1 from community_interaction ii where ii.post_id = p.id and ii.student_id = ? and ii.interaction_type = 'like') as liked,
          exists(select 1 from community_interaction ii where ii.post_id = p.id and ii.student_id = ? and ii.interaction_type = 'favorite') as favorited
        """;
  }

  private void addInteractionParams(List<Object> params, Long viewerStudentId) {
    if (viewerStudentId != null && viewerStudentId > 0) {
      params.add(viewerStudentId);
      params.add(viewerStudentId);
    }
  }

  private List<CommunityPost> queryCommunityPosts(boolean admin, String path, String type, String keyword, String sort, Long viewerStudentId) {
    StringBuilder sql = new StringBuilder(
        """
        select p.*, case when p.anonymous = 1 then '匿名用户' else coalesce(s.nickname, s.name, '未命名用户') end as author_name,
        """ + interactionSelectColumns(viewerStudentId) + """
        from community_post p join student_account s on s.id = p.student_id
        where p.deleted_at is null
        """
    );
    List<Object> params = new ArrayList<>();
    addInteractionParams(params, viewerStudentId);
    if (!admin) sql.append(" and p.status = '已通过'");
    if (StringUtils.hasText(path)) {
      sql.append(" and p.path = ?");
      params.add(path);
    }
    if (StringUtils.hasText(type)) {
      sql.append(" and p.type = ?");
      params.add(type);
    }
    if (StringUtils.hasText(keyword)) {
      sql.append(" and (p.title like ? or p.body like ?)");
      params.add("%" + keyword + "%");
      params.add("%" + keyword + "%");
    }
    sql.append(" order by ");
    if ("hot".equalsIgnoreCase(sort)) {
      sql.append("(p.likes + p.favorites + p.replies) desc, p.created_at desc");
    } else if ("featured".equalsIgnoreCase(sort)) {
      sql.append("p.featured desc, p.created_at desc");
    } else {
      sql.append("p.pinned desc, p.created_at desc");
    }
    return jdbc.query(sql.toString(), (rs, rowNum) -> mapPost(rs), params.toArray());
  }

  private long findPostAuthor(long postId) {
    Long author = jdbc.queryForObject("select student_id from community_post where id = ?", Long.class, postId);
    return author == null ? 0 : author;
  }

  private Map<String, Object> setBestAnswerInternal(BestAnswerRequest request) {
    if (request == null || request.commentId() <= 0) {
      throw new IllegalArgumentException("评论不存在");
    }
    Long postId = jdbc.queryForObject("select post_id from community_comment where id = ?", Long.class, request.commentId());
    if (postId == null) throw new IllegalArgumentException("评论不存在");
    if (request.bestAnswer()) {
      jdbc.update("update community_comment set best_answer = 0 where post_id = ?", postId);
    }
    jdbc.update("update community_comment set best_answer = ? where id = ?", request.bestAnswer(), request.commentId());
    audit("admin", "SET_BEST_ANSWER", "community_comment", String.valueOf(request.commentId()), Map.of("bestAnswer", request.bestAnswer()));
    return Map.of("commentId", request.commentId(), "postId", postId, "bestAnswer", request.bestAnswer());
  }

  private List<Map<String, Object>> recentViews(long studentId) {
    return jdbc.query(
        """
        select item_type, item_id, title, url, viewed_at
        from user_activity
        where student_id = ?
        order by viewed_at desc
        limit 10
        """,
        (rs, rowNum) -> Map.of(
            "itemType", rs.getString("item_type"),
            "itemId", rs.getString("item_id"),
            "title", rs.getString("title"),
            "url", valueOr(rs.getString("url"), ""),
            "viewedAt", toInstantString(rs.getTimestamp("viewed_at"))
        ),
        studentId
    );
  }

  private List<Map<String, Object>> buildTodos(AiReport report) {
    if (report == null) return List.of();
    return report.plan().stream()
        .flatMap(plan -> plan.actions().stream().limit(2).map(action -> Map.<String, Object>of(
            "title", action,
            "stage", plan.stage(),
            "path", report.scores().isEmpty() ? "" : report.scores().getFirst().path(),
            "status", "待完成"
        )))
        .limit(6)
        .toList();
  }

  private List<Map<String, Object>> buildTimeline(AiReport report) {
    if (report == null) return List.of();
    return report.plan().stream()
        .map(plan -> Map.<String, Object>of(
            "stage", plan.stage(),
            "description", String.join("；", plan.actions()),
            "path", report.scores().isEmpty() ? "" : report.scores().getFirst().path()
        ))
        .toList();
  }

  private boolean isReportStale(long studentId) {
    List<Map<String, Object>> rows = jdbc.queryForList(
        """
        select s.profile_updated_at, max(r.generated_at) as generated_at
        from student_account s
        left join ai_report r on r.student_id = s.id and r.generation_status = '已完成'
        where s.id = ?
        group by s.profile_updated_at
        """,
        studentId
    );
    if (rows.isEmpty()) return false;
    Object profileUpdated = rows.getFirst().get("profile_updated_at");
    Object reportGenerated = rows.getFirst().get("generated_at");
    return profileUpdated instanceof Timestamp profileTs
        && reportGenerated instanceof Timestamp reportTs
        && profileTs.toInstant().isAfter(reportTs.toInstant());
  }

  private void createMessage(long studentId, String type, String title, String body, String linkUrl) {
    if (studentId <= 0) return;
    jdbc.update(
        "insert into system_message (student_id, type, title, body, link_url) values (?, ?, ?, ?, ?)",
        studentId,
        type,
        title,
        body,
        linkUrl
    );
  }

  private int countSql(String sql) {
    Integer value = jdbc.queryForObject(sql, Integer.class);
    return value == null ? 0 : value;
  }

  private String normalizePathKey(String key) {
    if (!StringUtils.hasText(key)) return "employment";
    return switch (key.toLowerCase(Locale.ROOT)) {
      case "civil", "civil_exam", "civil-exam", "考公" -> "civil-exam";
      case "postgraduate", "postgrad", "考研" -> "postgraduate";
      default -> "employment";
    };
  }

  private PathConfigItem defaultPathConfig(String key) {
    String normalized = normalizePathKey(key);
    String name = switch (normalized) {
      case "civil-exam" -> "考公";
      case "postgraduate" -> "考研";
      default -> "就业";
    };
    String intro = switch (normalized) {
      case "civil-exam" -> "政策理解、岗位匹配与稳定备考节奏";
      case "postgraduate" -> "择校边界、科目规划与复试材料准备";
      default -> "能力证明、岗位画像与校招行动管理";
    };
    int sortOrder = switch (normalized) {
      case "civil-exam" -> 1;
      case "postgraduate" -> 2;
      default -> 3;
    };
    int matchScore = switch (normalized) {
      case "civil-exam" -> 82;
      case "postgraduate" -> 76;
      default -> 88;
    };
    return new PathConfigItem(
        normalized,
        name,
        intro,
        pathSuitable(normalized),
        pathTimeline(normalized),
        pathPitfalls(normalized),
        pathAccent(name),
        matchScore,
        sortOrder,
        "启用",
        Instant.now().toString()
    );
  }

  private String pathAccent(String path) {
    if (StringUtils.hasText(path) && path.contains("考公")) return "#2563eb";
    if (StringUtils.hasText(path) && path.contains("考研")) return "#0f766e";
    return "#b45309";
  }

  private List<String> pathSuitable(String key) {
    return switch (key) {
      case "civil-exam" -> List.of("偏好稳定职业环境", "愿意持续训练公共科目", "能接受岗位筛选约束");
      case "postgraduate" -> List.of("专业兴趣清晰", "能投入长期复习", "愿意延迟进入职场");
      default -> List.of("项目或实习经历较多", "希望尽快进入行业", "愿意高频投递与面试复盘");
    };
  }

  private List<String> pathTimeline(String key) {
    return switch (key) {
      case "civil-exam" -> List.of("岗位表拆解", "行测申论基础", "套卷模考", "结构化面试");
      case "postgraduate" -> List.of("择校边界", "公共课基础", "专业课真题", "复试材料");
      default -> List.of("简历主版本", "岗位清单", "面试题库", "Offer 对比");
    };
  }

  private List<String> pathPitfalls(String key) {
    return switch (key) {
      case "civil-exam" -> List.of("只看热门岗位", "忽视基层经历要求", "申论缺少反馈");
      case "postgraduate" -> List.of("择校只看名气", "忽略复试差额比", "专业课资料不足");
      default -> List.of("简历缺少量化结果", "只投单一岗位", "不记录面试复盘");
    };
  }

  private List<String> normalizeStringList(List<String> values, String label) {
    List<String> normalized = values == null ? List.of() : values.stream()
        .map(value -> value == null ? "" : value.trim())
        .filter(StringUtils::hasText)
        .limit(8)
        .toList();
    if (normalized.isEmpty()) {
      throw new IllegalArgumentException(label + "至少填写一项");
    }
    return normalized;
  }

  private String normalizeEmail(String email) {
    if (!StringUtils.hasText(email)) throw new IllegalArgumentException("邮箱不能为空");
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private String studentNoFromEmail(String email) {
    String normalized = normalizeEmail(email);
    int at = normalized.indexOf('@');
    String prefix = at > 0 ? normalized.substring(0, at) : normalized;
    if (!prefix.matches("\\d{10}")) {
      throw new IllegalArgumentException("学校邮箱前缀必须是 10 位数字学号");
    }
    return prefix;
  }

  private String graduationYearFromStudentNo(String studentNo) {
    if (!StringUtils.hasText(studentNo) || !studentNo.matches("\\d{10}")) {
      return "";
    }
    int admissionYear = 2000 + Integer.parseInt(studentNo.substring(0, 2));
    return String.valueOf(admissionYear + 4);
  }

  private void validateEmailDomain(String email) {
    if (!studentEmailPattern.matcher(email).matches()) {
      throw new IllegalArgumentException("仅允许使用 10 位数字学号 + @st.usst.edu.cn 的学校邮箱");
    }
  }

  private String normalizeInteraction(String type) {
    if ("like".equalsIgnoreCase(type) || "点赞".equals(type)) return "like";
    if ("favorite".equalsIgnoreCase(type) || "收藏".equals(type)) return "favorite";
    throw new IllegalArgumentException("不支持的互动类型");
  }

  private boolean chartMatchesFilters(ChartItem chart, String college, String major, String graduationYear) {
    return matchesChartFilter(chart.filters(), "college", college)
        && matchesChartFilter(chart.filters(), "major", major)
        && matchesChartFilter(chart.filters(), "graduationYear", graduationYear);
  }

  private boolean matchesChartFilter(Map<String, Object> filters, String key, String requested) {
    if (!StringUtils.hasText(requested)) return true;
    if (filters == null || !filters.containsKey(key)) return true;
    Object configured = filters.get(key);
    if (configured == null) return true;
    if (configured instanceof Iterable<?> values) {
      for (Object value : values) {
        if ("全部".equals(String.valueOf(value)) || requested.equals(String.valueOf(value))) {
          return true;
        }
      }
      return false;
    }
    String value = String.valueOf(configured);
    return "全部".equals(value) || requested.equals(value);
  }

  private boolean chartHasRows(Map<String, Object> data) {
    if (data == null) return false;
    Object rows = data.get("rows");
    if (rows instanceof List<?> values) {
      return !values.isEmpty();
    }
    return false;
  }

  private void audit(String actor, String action, String targetType, String targetId, Map<String, ?> detail) {
    jdbc.update(
        "insert into audit_log (actor, action, target_type, target_id, detail_json) values (?, ?, ?, ?, cast(? as json))",
        actor,
        action,
        targetType,
        targetId,
        toJson(detail)
    );
  }

  private void addColumn(String table, String definition) {
    try {
      jdbc.execute("alter table " + table + " add column " + definition);
    } catch (DataAccessException ignored) {
      // Existing installations already have the column.
    }
  }

  private void execute(String sql) {
    try {
      jdbc.execute(sql);
    } catch (DataAccessException ignored) {
      // Startup schema repair is best-effort and idempotent.
    }
  }

  private int clamp(int value) {
    return Math.max(0, Math.min(100, value));
  }

  private int intFromObject(Object value, int fallback) {
    if (value instanceof Number number) return number.intValue();
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private double doubleFromObject(Object value) {
    if (value instanceof Number number) return number.doubleValue();
    try {
      return Double.parseDouble(String.valueOf(value));
    } catch (Exception ignored) {
      return 0;
    }
  }

  private String valueOr(String value, String fallback) {
    return StringUtils.hasText(value) ? value : fallback;
  }

  private String toInstantString(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("JSON 序列化失败", exception);
    }
  }

  private <T> T fromJson(String json, Class<T> type) {
    try {
      return objectMapper.readValue(json, type);
    } catch (Exception exception) {
      throw new IllegalStateException("JSON 解析失败", exception);
    }
  }

  private Map<String, Object> jsonToMap(String json) {
    try {
      Map<String, Object> value = objectMapper.readValue(json, new TypeReference<>() {});
      return value == null ? Map.of() : value;
    } catch (Exception exception) {
      return Map.of();
    }
  }

  private List<String> jsonToStringList(String json) {
    try {
      List<?> values = objectMapper.readValue(json, new TypeReference<List<?>>() {});
      return values.stream()
          .map(String::valueOf)
          .filter(StringUtils::hasText)
          .toList();
    } catch (Exception exception) {
      return List.of();
    }
  }
}
