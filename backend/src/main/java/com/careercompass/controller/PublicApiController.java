package com.careercompass.controller;

import com.careercompass.model.Dtos.*;
import com.careercompass.service.CompassService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class PublicApiController {
  private final CompassService service;
  private final com.careercompass.service.SecurityService security;

  public PublicApiController(CompassService service, com.careercompass.service.SecurityService security) {
    this.service = service;
    this.security = security;
  }

  @GetMapping("/health")
  public ApiResponse<Map<String, String>> health() {
    return ApiResponse.ok(Map.of("status", "UP", "service", "career-compass"));
  }

  @PostMapping("/auth/register")
  public ApiResponse<Session> register(@RequestBody AuthRequest request) {
    return ApiResponse.message("注册成功", service.register(request));
  }

  @PostMapping("/auth/login")
  public ApiResponse<Session> login(@RequestBody AuthRequest request) {
    return ApiResponse.message("登录成功", service.login(request));
  }

  @GetMapping("/me")
  public ApiResponse<StudentProfile> me(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.me(security.requireStudent(authorization)));
  }

  @PutMapping("/profile")
  public ApiResponse<StudentProfile> saveProfile(
      @RequestHeader("Authorization") String authorization,
      @RequestBody ProfileRequest request
  ) {
    return ApiResponse.message("档案保存成功", service.saveProfile(security.requireStudent(authorization), request));
  }

  @PostMapping("/account/cancel")
  public ApiResponse<Map<String, Object>> cancelAccount(
      @RequestHeader("Authorization") String authorization,
      @RequestBody(required = false) CancelAccountRequest request
  ) {
    return ApiResponse.message("注销申请已提交", service.cancelAccount(security.requireStudent(authorization), request));
  }

  @GetMapping("/home")
  public ApiResponse<HomePayload> home() {
    return ApiResponse.ok(service.homePayload());
  }

  @GetMapping("/contents")
  public ApiResponse<List<ContentItem>> contents(@RequestParam(required = false) String category) {
    return ApiResponse.ok(service.contents(category));
  }

  @GetMapping("/path/{key}")
  public ApiResponse<PathPage> path(@PathVariable String key) {
    return ApiResponse.ok(service.pathPage(key));
  }

  @GetMapping("/paths")
  public ApiResponse<List<PathPage>> paths() {
    return ApiResponse.ok(service.pathPages());
  }

  @GetMapping("/templates")
  public ApiResponse<List<TemplateResource>> templates(@RequestParam(required = false) String category) {
    return ApiResponse.ok(service.templates(category));
  }

  @GetMapping("/workbench")
  public ApiResponse<WorkbenchResponse> workbench(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.workbench(security.requireStudent(authorization)));
  }

  @PostMapping("/activity")
  public ApiResponse<Map<String, Object>> recordActivity(
      @RequestHeader("Authorization") String authorization,
      @RequestBody ActivityRequest request
  ) {
    return ApiResponse.message("浏览记录已更新", service.recordActivity(security.requireStudent(authorization), request));
  }

  @GetMapping("/stats/trend")
  public ApiResponse<ChartBundle> trend() {
    return ApiResponse.ok(service.charts());
  }

  @GetMapping("/charts")
  public ApiResponse<List<ChartItem>> charts(
      @RequestParam(required = false) String path,
      @RequestParam(required = false) String college,
      @RequestParam(required = false) String major,
      @RequestParam(required = false) String graduationYear
  ) {
    return ApiResponse.ok(service.publicCharts(path, college, major, graduationYear));
  }

  @GetMapping("/tags")
  public ApiResponse<List<TagItem>> tags(@RequestParam(required = false) String type) {
    return ApiResponse.ok(service.tags(type, false));
  }

  @GetMapping("/assessment/draft")
  public ApiResponse<QuestionnaireDraft> latestDraft(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.latestDraft(security.requireStudent(authorization)).orElse(null));
  }

  @PutMapping("/assessment/draft")
  public ApiResponse<QuestionnaireDraft> saveDraft(
      @RequestHeader("Authorization") String authorization,
      @RequestBody AssessmentRequest request
  ) {
    return ApiResponse.message("问卷草稿已保存", service.saveDraft(security.requireStudent(authorization), request));
  }

  @PostMapping("/assessment/interview")
  public ApiResponse<InterviewResponse> interview(
      @RequestHeader("Authorization") String authorization,
      @RequestBody InterviewRequest request
  ) {
    return ApiResponse.ok(service.interviewAssessment(security.requireStudent(authorization), request));
  }

  @PostMapping("/assessment/submit")
  public ApiResponse<ReportTask> submitAssessment(
      @RequestHeader("Authorization") String authorization,
      @RequestBody AssessmentRequest request
  ) {
    return ApiResponse.message("问卷已提交", service.submitAssessment(security.requireStudent(authorization), request));
  }

  @GetMapping("/reports/{id}/task")
  public ApiResponse<ReportTask> reportTask(
      @RequestHeader("Authorization") String authorization,
      @PathVariable long id
  ) {
    return ApiResponse.ok(service.reportTask(security.requireStudent(authorization), id));
  }

  @PostMapping("/reports/{id}/retry")
  public ApiResponse<ReportTask> retryReport(
      @RequestHeader("Authorization") String authorization,
      @PathVariable long id
  ) {
    return ApiResponse.message("报告任务已重新提交", service.retryReport(security.requireStudent(authorization), id));
  }

  @GetMapping("/reports/latest")
  public ApiResponse<AiReport> latestReport(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.latestReport(security.requireStudent(authorization)).orElse(null));
  }

  @GetMapping("/reports/latest-task")
  public ApiResponse<ReportTask> latestReportTask(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.latestReportTask(security.requireStudent(authorization)).orElse(null));
  }

  @GetMapping("/reports/history")
  public ApiResponse<List<ReportHistoryItem>> reportHistory(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.reportHistory(security.requireStudent(authorization)));
  }

  @PostMapping("/ai/chat")
  public ApiResponse<AiAnswer> aiChat(
      @RequestHeader("Authorization") String authorization,
      @RequestBody AiQuestion question
  ) {
    return ApiResponse.ok(service.answer(security.requireStudent(authorization), question));
  }

  @GetMapping("/community/posts")
  public ApiResponse<List<CommunityPost>> communityPosts(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(required = false) String path,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String sort
  ) {
    return ApiResponse.ok(service.communityPosts(path, type, keyword, sort, optionalStudentId(authorization)));
  }

  @PostMapping("/community/posts")
  public ApiResponse<CommunityPost> createPost(
      @RequestHeader("Authorization") String authorization,
      @RequestBody PostRequest request
  ) {
    return ApiResponse.message("帖子已提交审核", service.createPost(security.requireStudent(authorization), request));
  }

  @PostMapping(value = "/community/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<List<String>> uploadCommunityImages(
      @RequestHeader("Authorization") String authorization,
      @RequestParam("files") List<MultipartFile> files
  ) {
    return ApiResponse.message("图片上传成功", service.storeCommunityImages(security.requireStudent(authorization), files));
  }

  @GetMapping("/community/uploads/{fileName:.+}")
  public ResponseEntity<Resource> communityImage(@PathVariable String fileName) throws IOException {
    Path path = service.communityUploadPath(fileName);
    String contentType = Files.probeContentType(path);
    MediaType mediaType = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
    return ResponseEntity.ok()
        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=604800")
        .contentType(mediaType)
        .body(new FileSystemResource(path));
  }

  @PutMapping("/community/posts/{id}")
  public ApiResponse<CommunityPost> updatePost(
      @RequestHeader("Authorization") String authorization,
      @PathVariable long id,
      @RequestBody PostRequest request
  ) {
    return ApiResponse.message("帖子已重新提交审核", service.updateOwnPost(security.requireStudent(authorization), id, request));
  }

  @DeleteMapping("/community/posts/{id}")
  public ApiResponse<Map<String, Object>> deletePost(
      @RequestHeader("Authorization") String authorization,
      @PathVariable long id
  ) {
    return ApiResponse.message("帖子已删除", service.deleteOwnPost(security.requireStudent(authorization), id));
  }

  @GetMapping("/community/posts/{id}")
  public ApiResponse<CommunityPost> communityPost(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable long id
  ) {
    return ApiResponse.ok(service.communityPost(id, optionalStudentId(authorization)).orElseThrow(() -> new IllegalArgumentException("帖子不存在")));
  }

  @GetMapping("/community/posts/{id}/comments")
  public ApiResponse<List<CommunityComment>> comments(@PathVariable long id) {
    return ApiResponse.ok(service.comments(id));
  }

  @PostMapping("/community/comments")
  public ApiResponse<Map<String, Object>> createComment(
      @RequestHeader("Authorization") String authorization,
      @RequestBody CommentRequest request
  ) {
    return ApiResponse.message("评论已提交", service.addComment(security.requireStudent(authorization), request));
  }

  @PatchMapping("/community/best-answer")
  public ApiResponse<Map<String, Object>> bestAnswer(
      @RequestHeader("Authorization") String authorization,
      @RequestBody BestAnswerRequest request
  ) {
    return ApiResponse.message("最佳回答状态已更新", service.setBestAnswer(security.requireStudent(authorization), request));
  }

  @PostMapping("/community/interaction")
  public ApiResponse<Map<String, Object>> interaction(
      @RequestHeader("Authorization") String authorization,
      @RequestBody InteractionRequest request
  ) {
    return ApiResponse.message("互动状态已更新", service.toggleInteraction(security.requireStudent(authorization), request));
  }

  @PostMapping("/community/report")
  public ApiResponse<Map<String, Object>> report(
      @RequestHeader("Authorization") String authorization,
      @RequestBody ReportAbuseRequest request
  ) {
    return ApiResponse.message("举报已提交，等待处理", service.reportAbuse(security.requireStudent(authorization), request));
  }

  @GetMapping("/user/community")
  public ApiResponse<Map<String, Object>> userCommunity(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.userCommunity(security.requireStudent(authorization)));
  }

  @GetMapping("/messages")
  public ApiResponse<List<MessageItem>> messages(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.ok(service.messages(security.requireStudent(authorization)));
  }

  @PatchMapping("/messages/{id}/read")
  public ApiResponse<Map<String, Object>> markMessageRead(
      @RequestHeader("Authorization") String authorization,
      @PathVariable long id
  ) {
    return ApiResponse.message("消息已读", service.markMessageRead(security.requireStudent(authorization), id));
  }

  @PostMapping("/messages/read-all")
  public ApiResponse<Map<String, Object>> markAllMessagesRead(@RequestHeader("Authorization") String authorization) {
    return ApiResponse.message("消息已全部标记已读", service.markAllMessagesRead(security.requireStudent(authorization)));
  }

  private Long optionalStudentId(String authorization) {
    if (authorization == null || authorization.isBlank()) {
      return null;
    }
    try {
      return security.requireStudent(authorization).id();
    } catch (RuntimeException exception) {
      return null;
    }
  }

}
