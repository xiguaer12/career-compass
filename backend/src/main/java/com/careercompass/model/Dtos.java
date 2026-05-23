package com.careercompass.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class Dtos {
  private Dtos() {}

  public record ApiResponse<T>(boolean success, String message, T data) {
    public static <T> ApiResponse<T> ok(T data) {
      return new ApiResponse<>(true, "ok", data);
    }

    public static <T> ApiResponse<T> message(String message, T data) {
      return new ApiResponse<>(true, message, data);
    }
  }

  public record AuthRequest(
      String email,
      String password,
      String verificationCode,
      String name,
      String studentNo,
      String college,
      String major,
      String graduationYear,
      String phone,
      String nickname
  ) {}

  public record EmailCodeRequest(String email) {}

  public record EmailCodeResult(String email, int expiresInSeconds, int cooldownSeconds) {}

  public record CancelAccountRequest(String reason, Boolean confirmed) {}

  public record ProfileRequest(
      String name,
      String studentNo,
      String college,
      String major,
      String graduationYear,
      String phone,
      String nickname,
      Map<String, Object> privacy
  ) {}

  public record StudentProfile(
      long id,
      String email,
      String name,
      String studentNo,
      String college,
      String major,
      String graduationYear,
      String phone,
      String nickname,
      String status
  ) {}

  public record Session(String token, String role, String status, StudentProfile profile) {}

  public record AdminLoginRequest(String username, String password) {}

  public record AdminSession(String token, String role, String displayName) {}

  public record ContentItem(
      long id,
      String title,
      String category,
      String body,
      String summary,
      String source,
      String sourceUrl,
      String tags,
      String displayPosition,
      int sortOrder,
      String updatedAt,
      String status
  ) {}

  public record ContentSaveRequest(
      Long id,
      String title,
      String category,
      String body,
      String summary,
      String sourceName,
      String sourceUrl,
      String tags,
      String displayPosition,
      Integer sortOrder,
      String status
  ) {}

  public record HomeMetric(
      String key,
      String label,
      String value,
      String trend,
      String tone
  ) {}

  public record HomePayload(
      List<HomeMetric> metrics,
      List<ContentItem> notices,
      List<ContentItem> faqs,
      List<ChartItem> charts,
      List<CommunityPost> featuredPosts
  ) {}

  public record ActivityRequest(String itemType, String itemId, String title, String url) {}

  public record WorkbenchResponse(
      StudentProfile profile,
      AiReport latestReport,
      List<ReportHistoryItem> reportHistory,
      List<MessageItem> messages,
      List<Map<String, Object>> recentViews,
      List<Map<String, Object>> todos,
      List<Map<String, Object>> timeline,
      List<CommunityPost> favorites,
      String mainPath,
      List<String> alternativePaths,
      boolean staleReport
  ) {}

  public record PathPage(
      String key,
      String name,
      String intro,
      List<String> suitable,
      List<String> timeline,
      List<String> pitfalls,
      String accent,
      int matchScore,
      int sortOrder,
      String status,
      String updatedAt,
      List<TemplateResource> templates,
      List<ContentItem> highlights
  ) {}

  public record PathConfigItem(
      String key,
      String name,
      String intro,
      List<String> suitable,
      List<String> timeline,
      List<String> pitfalls,
      String accent,
      int matchScore,
      int sortOrder,
      String status,
      String updatedAt
  ) {}

  public record PathConfigSaveRequest(
      String key,
      String name,
      String intro,
      List<String> suitable,
      List<String> timeline,
      List<String> pitfalls,
      String accent,
      Integer matchScore,
      Integer sortOrder,
      String status
  ) {}

  public record TemplateResource(long id, String name, String path, String format, String url, String updatedAt) {}

  public record TrendPoint(String year, double civilExam, double postgraduate, double employment) {}

  public record ChartBundle(
      List<TrendPoint> trend,
      String source,
      String methodology,
      String updatedAt
  ) {}

  public record AssessmentRequest(String questionnaireVersion, Map<String, Object> answers, String stepKey, Integer completionPercent) {}

  public record InterviewRequest(List<Map<String, String>> messages) {}

  public record InterviewResponse(
      String assistantMessage,
      Map<String, Object> answers,
      String profileSummary,
      List<String> decisionSignals,
      int completionPercent,
      boolean readyToGenerate,
      List<String> missingFields
  ) {}

  public record QuestionnaireDraft(
      Long id,
      String questionnaireVersion,
      Map<String, Object> answers,
      String stepKey,
      int completionPercent,
      String status,
      String updatedAt
  ) {}

  public record ReportTask(String status, Long reportId, AiReport report, String message) {}

  public record ReportHistoryItem(long id, String reportVersion, String generatedAt, String topPath, int topScore) {}

  public record Score(String path, int score, String rank, List<String> reasons) {}

  public record DimensionScore(String subject, int civil, int postgraduate, int employment) {}

  public record ActionPlan(String stage, List<String> actions) {}

  public record AiReport(
      long id,
      String reportVersion,
      String generatedAt,
      List<Score> scores,
      List<DimensionScore> dimensions,
      String narrativeReport,
      String studentProfile,
      String summary,
      List<String> risks,
      List<String> alternatives,
      List<ActionPlan> plan,
      List<String> resources,
      String disclaimer,
      String questionnaireVersion,
      String templateVersion,
      String promptVersion,
      String generationStatus
  ) {}

  public record AiQuestion(String reportId, String question, List<Map<String, String>> history) {}

  public record AiAnswer(
      String questionUnderstanding,
      List<String> factors,
      List<String> pathComparison,
      List<String> advice,
      List<String> reminders,
      String answerText
  ) {}

  public record CommunityPost(
      long id,
      String title,
      String body,
      String type,
      String path,
      String authorDisplay,
      boolean anonymous,
      String status,
      int likes,
      int favorites,
      boolean liked,
      boolean favorited,
      int replies,
      List<String> imageUrls,
      Instant createdAt
  ) {}

  public record PostRequest(String title, String body, String type, String path, boolean anonymous, List<String> imageUrls) {}

  public record CommentRequest(long postId, String body, Long parentCommentId) {}

  public record BestAnswerRequest(long commentId, boolean bestAnswer) {}

  public record CommunityComment(
      long id,
      long postId,
      String body,
      String authorDisplay,
      boolean bestAnswer,
      String status,
      Instant createdAt
  ) {}

  public record InteractionRequest(long postId, String type) {}

  public record ReportAbuseRequest(long targetId, String targetType, String reason) {}

  public record AdminStatusRequest(long id, String status, String reason) {}

  public record CommunityUser(String name, String studentNo, int posts, int reports, String status) {}

  public record StudentAdminItem(
      long id,
      String email,
      String name,
      String studentNo,
      String college,
      String major,
      String graduationYear,
      String phone,
      String nickname,
      String status,
      String createdAt,
      String lastLoginAt
  ) {}

  public record CrawlSource(
      long id,
      String name,
      String url,
      String type,
      String path,
      String frequency,
      String trustLevel,
      String status,
      String lastRunAt,
      String passRate,
      String updatedAt,
      String lastTaskStatus,
      String lastTaskMessage,
      String lastTaskAt,
      Map<String, Object> parserRule
  ) {}

  public record CrawlSourceSaveRequest(
      Long id,
      String name,
      String url,
      String type,
      String path,
      String frequency,
      String trustLevel,
      String status,
      Map<String, Object> parserRule
  ) {}

  public record CrawlCandidateItem(
      long id,
      long sourceId,
      String sourceName,
      String rawUrl,
      String title,
      String summary,
      String path,
      String reviewStatus,
      String failureReason,
      String crawledAt,
      String parsedAt,
      String publishedAt,
      int qualityScore,
      String reason,
      String tags
  ) {}

  public record CrawlCandidateReviewRequest(
      long id,
      String action,
      String title,
      String summary,
      String category,
      String tags,
      String displayPosition,
      String reason
  ) {}

  public record ChartItem(
      long id,
      String title,
      String chartType,
      String path,
      Map<String, Object> data,
      String methodology,
      String sourceName,
      String sourceUrl,
      Map<String, Object> filters,
      String visibility,
      String displayPosition,
      String status,
      String updatedAt
  ) {}

  public record ChartSaveRequest(
      Long id,
      String title,
      String chartType,
      String path,
      Map<String, Object> data,
      String methodology,
      String sourceName,
      String sourceUrl,
      Map<String, Object> filters,
      String visibility,
      String displayPosition,
      String status
  ) {}

  public record TagItem(long id, String name, String type, String status, int sortOrder, String createdAt) {}

  public record TagSaveRequest(Long id, String name, String type, String status, Integer sortOrder) {}

  public record AiConfigItem(
      long id,
      String configType,
      String version,
      String title,
      String content,
      String status,
      String createdAt,
      String publishedAt
  ) {}

  public record AiConfigSaveRequest(Long id, String configType, String version, String title, String content, String status) {}

  public record AbuseReportItem(
      long id,
      long reporterStudentId,
      String targetType,
      long targetId,
      String reason,
      String status,
      String handledBy,
      String handledResult,
      String handledAt,
      String createdAt
  ) {}

  public record AdminDashboard(
      int registeredUsers,
      int activeUsers,
      double assessmentCompletionRate,
      int reportCount,
      int postCount,
      int questionCount,
      int dataSourceCount,
      int crawlTaskCount,
      int pendingCrawlCount,
      int pendingReviews,
      String updatedAt,
      List<Map<String, Object>> queue
  ) {}

  public record MessageItem(long id, String type, String title, String body, String linkUrl, boolean read, Instant createdAt) {}

  public record AuditItem(long id, String actor, String action, String targetType, String targetId, String detail, Instant createdAt) {}
}
