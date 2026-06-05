package com.careercompass.controller;

import com.careercompass.model.Dtos.*;
import com.careercompass.service.CompassService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/admin")
public class AdminApiController {
  private final CompassService service;

  public AdminApiController(CompassService service) {
    this.service = service;
  }

  @PostMapping("/auth/login")
  public ApiResponse<AdminSession> login(@RequestBody AdminLoginRequest request) {
    return ApiResponse.message("后台登录成功", service.adminLogin(request));
  }

  @GetMapping("/dashboard")
  public ApiResponse<AdminDashboard> dashboard() {
    return ApiResponse.ok(service.adminDashboard());
  }

  @GetMapping("/contents")
  public ApiResponse<List<ContentItem>> contents() {
    return ApiResponse.ok(service.contents(null));
  }

  @PostMapping("/content/save")
  public ApiResponse<Map<String, Object>> saveContent(@RequestBody ContentSaveRequest item) {
    return ApiResponse.message("内容保存成功", service.saveContent(item));
  }

  @DeleteMapping("/contents/{id}")
  public ApiResponse<Map<String, Object>> deleteContent(@PathVariable long id) {
    return ApiResponse.message("内容已删除", service.deleteContent(id));
  }

  @GetMapping("/community/posts")
  public ApiResponse<List<CommunityPost>> posts() {
    return ApiResponse.ok(service.adminCommunityPosts());
  }

  @PostMapping("/community/post/status")
  public ApiResponse<Map<String, Object>> updatePostStatus(@RequestBody AdminStatusRequest request) {
    return ApiResponse.message("状态已更新", service.updatePostStatus(request));
  }

  @PostMapping("/community/best-answer")
  public ApiResponse<Map<String, Object>> bestAnswer(@RequestBody BestAnswerRequest request) {
    return ApiResponse.message("最佳回答状态已更新", service.adminSetBestAnswer(request));
  }

  @GetMapping("/community/comments")
  public ApiResponse<List<CommunityComment>> comments(@RequestParam(required = false) String status) {
    return ApiResponse.ok(service.adminComments(status));
  }

  @PostMapping("/community/comment/status")
  public ApiResponse<Map<String, Object>> updateCommentStatus(@RequestBody AdminStatusRequest request) {
    return ApiResponse.message("评论状态已更新", service.updateCommentStatus(request));
  }

  @GetMapping("/community/users")
  public ApiResponse<List<CommunityUser>> users() {
    return ApiResponse.ok(service.communityUsers());
  }

  @GetMapping("/users")
  public ApiResponse<List<StudentAdminItem>> studentUsers(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword
  ) {
    return ApiResponse.ok(service.adminStudents(status, keyword));
  }

  @PostMapping("/users/status")
  public ApiResponse<Map<String, Object>> updateStudentStatus(@RequestBody AdminStatusRequest request) {
    return ApiResponse.message("用户状态已更新", service.updateStudentStatus(request));
  }

  @PostMapping("/community/user/ban")
  public ApiResponse<Map<String, Object>> banUser(@RequestBody AdminStatusRequest request) {
    return ApiResponse.message("用户处罚状态已更新", service.banUser(request));
  }

  @GetMapping("/sources")
  public ApiResponse<List<CrawlSource>> sources() {
    return ApiResponse.ok(service.sources());
  }

  @PostMapping("/sources/save")
  public ApiResponse<Map<String, Object>> saveSource(@RequestBody CrawlSourceSaveRequest request) {
    return ApiResponse.message("数据源已保存", service.saveSource(request));
  }

  @PostMapping("/sources/{id}/crawl")
  public ApiResponse<Map<String, Object>> crawl(@PathVariable long id) {
    return ApiResponse.message("抓取任务已创建", service.triggerCrawl(id));
  }

  @GetMapping("/crawl/candidates")
  public ApiResponse<List<CrawlCandidateItem>> crawlCandidates(@RequestParam(required = false) String status) {
    return ApiResponse.ok(service.crawlCandidates(status));
  }

  @GetMapping("/crawl/tasks")
  public ApiResponse<List<CrawlTaskItem>> crawlTasks(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long sourceId
  ) {
    return ApiResponse.ok(service.crawlTasks(status, sourceId));
  }

  @PostMapping("/crawl/candidates/review")
  public ApiResponse<Map<String, Object>> reviewCandidate(@RequestBody CrawlCandidateReviewRequest request) {
    return ApiResponse.message("抓取候选审核完成", service.reviewCandidate(request));
  }

  @GetMapping("/charts")
  public ApiResponse<List<ChartItem>> charts() {
    return ApiResponse.ok(service.adminCharts());
  }

  @PostMapping("/charts/save")
  public ApiResponse<Map<String, Object>> saveChart(@RequestBody ChartSaveRequest request) {
    return ApiResponse.message("图表已保存", service.saveChart(request));
  }

  @PostMapping("/charts/import")
  public ApiResponse<ChartImportResult> importChart(@RequestParam("file") MultipartFile file) {
    return ApiResponse.message("图表数据导入解析完成", service.importChart(file));
  }

  @PostMapping("/charts/refresh")
  public ApiResponse<Map<String, Object>> refreshCharts() {
    return ApiResponse.message("官方图表数据已刷新", service.refreshOfficialCharts());
  }

  @GetMapping("/paths")
  public ApiResponse<List<PathConfigItem>> paths() {
    return ApiResponse.ok(service.adminPaths());
  }

  @PostMapping("/paths/save")
  public ApiResponse<Map<String, Object>> savePath(@RequestBody PathConfigSaveRequest request) {
    return ApiResponse.message("路径配置已保存", service.savePath(request));
  }

  @GetMapping("/tags")
  public ApiResponse<List<TagItem>> tags(@RequestParam(required = false) String type) {
    return ApiResponse.ok(service.tags(type, true));
  }

  @PostMapping("/tags/save")
  public ApiResponse<Map<String, Object>> saveTag(@RequestBody TagSaveRequest request) {
    return ApiResponse.message("标签已保存", service.saveTag(request));
  }

  @GetMapping("/ai/configs")
  public ApiResponse<List<AiConfigItem>> aiConfigs(@RequestParam(required = false) String type) {
    return ApiResponse.ok(service.aiConfigs(type));
  }

  @PostMapping("/ai/configs/save")
  public ApiResponse<Map<String, Object>> saveAiConfig(@RequestBody AiConfigSaveRequest request) {
    return ApiResponse.message("AI 配置已保存", service.saveAiConfig(request));
  }

  @GetMapping("/reports")
  public ApiResponse<List<AbuseReportItem>> abuseReports(@RequestParam(required = false) String status) {
    return ApiResponse.ok(service.abuseReports(status));
  }

  @PostMapping("/reports/handle")
  public ApiResponse<Map<String, Object>> handleAbuse(@RequestBody AdminStatusRequest request) {
    return ApiResponse.message("举报已处理", service.handleAbuse(request));
  }

  @GetMapping("/audits")
  public ApiResponse<List<AuditItem>> audits(String targetType, String action) {
    return ApiResponse.ok(service.audits(targetType, action));
  }
}
