package com.careercompass.service;

import com.careercompass.model.Dtos.AiAnswer;
import com.careercompass.model.Dtos.AiQuestion;
import com.careercompass.model.Dtos.AiReport;
import com.careercompass.model.Dtos.InterviewResponse;
import com.careercompass.model.Dtos.StudentProfile;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class LlmClient {
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final boolean enabled;
  private final String apiKey;
  private final String baseUrl;
  private final String model;
  private final int timeoutSeconds;

  public LlmClient(
      ObjectMapper objectMapper,
      @Value("${app.llm.enabled:false}") boolean enabled,
      @Value("${app.llm.api-key:}") String apiKey,
      @Value("${app.llm.base-url:https://api.openai.com/v1}") String baseUrl,
      @Value("${app.llm.model:gpt-4o-mini}") String model,
      @Value("${app.llm.timeout-seconds:60}") int timeoutSeconds
  ) {
    this.objectMapper = objectMapper;
    this.enabled = enabled;
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.baseUrl = trimTrailingSlash(StringUtils.hasText(baseUrl) ? baseUrl : "https://api.openai.com/v1");
    this.model = StringUtils.hasText(model) ? model : "gpt-4o-mini";
    this.timeoutSeconds = Math.max(10, timeoutSeconds);
    this.httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(Math.min(this.timeoutSeconds, 20)))
        .build();
  }

  public boolean available() {
    return enabled && StringUtils.hasText(apiKey);
  }

  public void requireAvailable() {
    if (!available()) {
      throw new IllegalStateException("大模型服务未启用或未配置 API Key");
    }
  }

  public AiReport generateReport(
      long id,
      Map<String, Object> answers,
      String questionnaireVersion,
      String templateVersion,
      String promptVersion,
      String reportTemplate,
      String promptTemplate,
      String disclaimer,
      AiReport fallback
  ) {
    requireAvailable();
    String reportText = chatText(
        """
        你是高校毕业路径规划系统的 AI 报告生成器。
        你的任务不是填写结构化问卷，也不是按固定维度打分，而是像一位认真读完访谈记录的咨询老师，直接写出一篇给学生阅读的自然语言报告。
        可以使用小标题、段落、列表或 Markdown，但不要输出 JSON，不要输出字段名，不要为了适配系统而压缩判断。
        """,
        """
        请基于学生开放访谈素材，直接生成一篇完整报告。

        写作目标：
        1. 先理解学生表达的全部上下文，包括经历、学业、项目/实习、家庭与经济约束、城市偏好、性格、情绪压力、资源条件、价值排序、隐含顾虑和未说透的矛盾。
        2. 你可以比较考公、考研、就业，也可以提出更适合学生语境的判断框架；不要被固定路径、固定字段或固定分数限制。
        3. 报告应该像真实咨询后的判断：有综合画像，有推理依据，有不确定性提醒，有下一步建议，但表达方式由你根据材料自由组织。
        4. 不要承诺录取、上岸、就业结果；不要假装知道学生没有提到的事实。
        5. 如果素材不足，请明确说明哪些判断只是初步假设，并自然地提出后续需要补充的信息。
        6. 末尾保留免责声明，但不要为了免责声明牺牲报告正文的可读性。

        报告模板（仅作可选参考，不构成字段或结构约束；如果其中要求评分、表格或固定模块，请忽略这些格式约束）：
        %s

        提示词模板（仅作写作方向参考；如果与“自由生成完整报告”冲突，以自由报告为准）：
        %s

        免责声明：
        %s

        开放访谈素材 JSON：
        %s
        """.formatted(reportTemplate, promptTemplate, disclaimer, toJson(answers))
    );
    String summary = summaryFromReport(reportText);
    return new AiReport(
        id,
        fallback.reportVersion(),
        Instant.now().toString(),
        List.of(),
        List.of(),
        reportText,
        "",
        summary,
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        disclaimer,
        questionnaireVersion,
        templateVersion,
        promptVersion,
        "已完成"
    );
  }

  public AiAnswer answer(AiReport report, AiQuestion question, String promptTemplate, AiAnswer fallback) {
    requireAvailable();
    if (report == null) return fallback;
    String asked = question == null || !StringUtils.hasText(question.question()) ? "如何安排下一步行动" : question.question();
    Map<String, Object> payload = chatJson(
        "你是高校毕业路径规划系统的报告追问助手。为了让前端解析追问结果，请输出一个 JSON 对象；JSON 只用于接口传输，不代表报告正文需要结构化。不要在 JSON 外输出 Markdown。",
        """
        请围绕已有 AI 报告回答学生追问。回答要清晰、克制，不承诺录取、上岸或就业结果。

        输出 JSON schema：
        {
          "questionUnderstanding": "string",
          "factors": ["string"],
          "pathComparison": ["string"],
          "advice": ["string"],
          "reminders": ["string"]
        }

        提示词模板：
        %s

        学生问题：
        %s

        已有报告 JSON：
        %s

        最近对话历史 JSON：
        %s
        """.formatted(promptTemplate, asked, toJson(report), toJson(question == null ? List.of() : question.history()))
    );
    return answerFromPayload(payload, fallback);
  }

  public InterviewResponse interview(List<Map<String, String>> messages, StudentProfile profile, InterviewResponse fallback) {
    requireAvailable();
    String studentContext = studentContext(profile);
    Map<String, Object> payload = chatJson(
        "你是高校职业路径开放访谈助手。你要像耐心的咨询老师一样接住学生表达，整理其中和职业选择有关的信号，再给出轻量引导。为了让前端保存对话状态，请输出一个 JSON 对象；JSON 只用于接口传输，answers 必须是开放素材，不是固定问卷。",
        """
        请根据已有对话继续访谈学生。目标是替代传统问卷，通过自然对话整理足够素材来生成考公、考研、就业三路径报告。
        你需要自己理解学生提到的各方面情况，包括学业、项目、实习、家庭、城市、经济、性格、情绪、价值排序、机会资源、隐含顾虑和未说透的矛盾，再做综合整理。

        学生基础档案（系统上下文，必须纳入理解，不要要求学生重复提供）：
        %s

        访谈原则：
        1. 你的问题只是思维发散引导，不是必须逐题回答的问卷。学生说到问题之外的家庭、情绪、经历、城市、资源、担忧、偏好，都要主动加工整理进 answers。
        2. 开场和早期追问要给出轻量入口，例如“最近纠结的一件事”“一段项目/实习/课程/考证经历”“城市、家庭、收入、成长里最在意的因素”，但这些入口都只是可选引导。
        3. 不要因为某个字段没被正面回答就换个问法反复追问；先总结已获得的信息，再顺势抛出 1 个开放问题，最多 2 个。
        4. 可以用例子、选择项和追问帮助表达，但不要要求学生给考公、考研、就业三条路打分，也不要直接问“三选一”。
        5. 不要承诺录取、上岸或就业结果。
        6. 当已有素材能生成有价值的初版报告时 readyToGenerate=true，并给出一句“可以先生成草案，后续还能继续补充”的确认说明；不要求所有字段完整。
        7. answers 是开放素材对象，不要按固定问卷字段填写，也不要输出 academic/certificates/project/city/riskPreference/employmentInterest 这类固定问卷键。
        8. answers 可以由你自由组织字段，例如 rawNarrative、profileSummary、keyExperiences、valuesAndMotivation、constraintsAndEmotions、decisionSignals、pathHypotheses、openQuestions、openNotes；字段名可以按语义自行增加。
        9. pathHypotheses 可以表达你对考公、考研、就业的初步假设和证据，但不要要求学生给路径打分，也不要把判断压成 1-5 分。
        10. missingFields 字段不是缺失项，而是“可以继续探索的方向”，请输出中文短语，例如“项目和实习经历”“城市与家庭约束”，不要输出英文字段名。

        输出 JSON schema：
        {
          "assistantMessage": "string",
          "profileSummary": "string",
          "decisionSignals": ["string"],
          "answers": {
            "rawNarrative": "string",
            "profileSummary": "string",
            "keyExperiences": ["string"],
            "valuesAndMotivation": ["string"],
            "constraintsAndEmotions": ["string"],
            "decisionSignals": ["string"],
            "pathHypotheses": [{"path": "考公|考研|就业", "evidence": "string", "concern": "string"}],
            "openNotes": {"任意中文键": "string"}
          },
          "completionPercent": 0,
          "readyToGenerate": false,
          "missingFields": ["string"]
        }

        当前对话 JSON：
        %s
        """.formatted(studentContext, toJson(messages == null ? List.of() : messages))
    );
    return interviewFromPayload(payload, fallback);
  }

  public Map<String, Object> summarizeCrawlCandidate(
      String sourceName,
      String sourceType,
      String preferredPath,
      String url,
      String rawTitle,
      String rawText,
      Map<String, Object> fallback
  ) {
    requireAvailable();
    Map<String, Object> payload = chatJson(
        "你是高校毕业路径信息差分析助手。为了让后台审核队列解析候选资讯，请输出一个 JSON 对象，不要在 JSON 外输出 Markdown。",
        """
        请把公开网页内容加工为三路径页面的待审核候选资讯，目标是帮助学生打破信息差，而不是写泛泛新闻摘要。要求：
        1. 只根据原文内容提炼，不编造政策、时间、数字或结论。
        2. path 只能是 考公、考研、就业 三者之一；如果难以判断，优先使用来源配置路径。
        3. title 要具体，优先体现“岗位表/报名时间/资格条件/复试调剂/专业目录/招聘会/劳动权益”等可行动信息。
        4. summary 控制在 100-220 个中文字符，必须说明学生能从这条信息中获得什么实用判断。
        5. body 控制在 260-700 个中文字符，按“关键信息、学生应核对字段、下一步动作、风险提醒”组织；如果原文是门户首页，也要说明这个源适合查什么，不要硬编具体结论。
        6. tags 输出 2-5 个短标签，优先使用 报名时间、岗位表、专业目录、调剂、复试、招聘会、劳动合同、薪酬福利、资格复审 等。
        7. qualityScore 为 0-100，综合来源可信度、时效性、内容完整度；门户首页或信息过泛要降分并在 reason 说明。

        输出 JSON schema：
        {
          "title": "string",
          "summary": "string",
          "body": "string",
          "path": "考公|考研|就业",
          "tags": ["string"],
          "qualityScore": 0,
          "reason": "string"
        }

        来源名称：%s
        来源类型：%s
        来源配置路径：%s
        URL：%s
        原始标题：%s
        原文清洗文本：
        %s
        """.formatted(sourceName, sourceType, preferredPath, url, rawTitle, trimForPrompt(rawText, 6000))
    );
    return crawlCandidateFromPayload(payload, fallback, preferredPath);
  }

  private String studentContext(StudentProfile profile) {
    if (profile == null) return "未提供基础档案。";
    return """
        学院：%s
        专业：%s
        """.formatted(
        stringValue(profile.college(), "未填写"),
        stringValue(profile.major(), "未填写")
    ).strip();
  }

  private String chatText(String systemPrompt, String userPrompt) {
    try {
      Map<String, Object> requestBody = Map.of(
          "model", model,
          "temperature", 0.7,
          "messages", List.of(
              Map.of("role", "system", "content", systemPrompt),
              Map.of("role", "user", "content", userPrompt)
          )
      );
      HttpRequest request = HttpRequest.newBuilder()
          .uri(URI.create(baseUrl + "/chat/completions"))
          .timeout(Duration.ofSeconds(timeoutSeconds))
          .header("Authorization", "Bearer " + apiKey)
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(toJson(requestBody)))
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException("大模型接口返回 HTTP " + response.statusCode());
      }
      JsonNode root = objectMapper.readTree(response.body());
      String content = root.path("choices").path(0).path("message").path("content").asText("");
      if (!StringUtils.hasText(content)) {
        throw new IllegalStateException("大模型未返回有效内容");
      }
      return content.trim();
    } catch (Exception exception) {
      throw new IllegalStateException("大模型调用失败：" + exception.getMessage(), exception);
    }
  }

  private Map<String, Object> chatJson(String systemPrompt, String userPrompt) {
    try {
      Map<String, Object> requestBody = Map.of(
          "model", model,
          "temperature", 0.2,
          "response_format", Map.of("type", "json_object"),
          "messages", List.of(
              Map.of("role", "system", "content", systemPrompt),
              Map.of("role", "user", "content", userPrompt)
          )
      );
      HttpRequest request = HttpRequest.newBuilder()
          .uri(URI.create(baseUrl + "/chat/completions"))
          .timeout(Duration.ofSeconds(timeoutSeconds))
          .header("Authorization", "Bearer " + apiKey)
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(toJson(requestBody)))
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException("大模型接口返回 HTTP " + response.statusCode());
      }
      JsonNode root = objectMapper.readTree(response.body());
      String content = root.path("choices").path(0).path("message").path("content").asText("");
      if (!StringUtils.hasText(content)) {
        throw new IllegalStateException("大模型未返回有效内容");
      }
      return objectMapper.readValue(extractJson(content), new TypeReference<>() {});
    } catch (Exception exception) {
      throw new IllegalStateException("大模型调用失败：" + exception.getMessage(), exception);
    }
  }

  private AiAnswer answerFromPayload(Map<String, Object> payload, AiAnswer fallback) {
    return new AiAnswer(
        stringValue(payload.get("questionUnderstanding"), fallback.questionUnderstanding()),
        stringList(payload.get("factors"), fallback.factors(), 8),
        stringList(payload.get("pathComparison"), fallback.pathComparison(), 8),
        stringList(payload.get("advice"), fallback.advice(), 8),
        stringList(payload.get("reminders"), fallback.reminders(), 6)
    );
  }

  private InterviewResponse interviewFromPayload(Map<String, Object> payload, InterviewResponse fallback) {
    Map<String, Object> answers = payload.get("answers") instanceof Map<?, ?> raw
        ? normalizeInterviewAnswers(raw, fallback.answers())
        : fallback.answers();
    List<String> missing = explorationList(payload.get("missingFields"), fallback.missingFields(), 12);
    List<String> decisionSignals = stringList(payload.get("decisionSignals"), stringList(answers.get("decisionSignals"), fallback.decisionSignals(), 12), 12);
    String profileSummary = stringValue(payload.get("profileSummary"), stringValue(answers.get("profileSummary"), fallback.profileSummary()));
    int llmPercent = Math.max(0, Math.min(100, intValue(payload.get("completionPercent"), fallback.completionPercent())));
    int percent = Math.max(fallback.completionPercent(), llmPercent);
    boolean ready = booleanValue(payload.get("readyToGenerate"), fallback.readyToGenerate()) || fallback.readyToGenerate();
    String assistantMessage = stringValue(payload.get("assistantMessage"), fallback.assistantMessage());
    if (asksForPathScore(assistantMessage)) {
      assistantMessage = fallback.assistantMessage();
    }
    return new InterviewResponse(
        assistantMessage,
        answers,
        profileSummary,
        decisionSignals,
        percent,
        ready,
        missing
    );
  }

  private Map<String, Object> normalizeInterviewAnswers(Map<?, ?> raw, Map<String, Object> fallbackAnswers) {
    Map<String, Object> answers = new LinkedHashMap<>(fallbackAnswers == null ? Map.of() : fallbackAnswers);
    for (Map.Entry<?, ?> entry : raw.entrySet()) {
      if (entry.getKey() == null || entry.getValue() == null) continue;
      String key = String.valueOf(entry.getKey());
      if (!isLegacyQuestionnaireKey(key)) {
        answers.put(key, entry.getValue());
      }
    }
    return answers;
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

  private Map<String, Object> crawlCandidateFromPayload(Map<String, Object> payload, Map<String, Object> fallback, String preferredPath) {
    String path = stringValue(payload.get("path"), stringValue(fallback.get("path"), preferredPath));
    if (!List.of("考公", "考研", "就业").contains(path)) {
      path = List.of("考公", "考研", "就业").contains(preferredPath) ? preferredPath : "就业";
    }
    List<String> tags = stringList(payload.get("tags"), List.of(), 5);
    return Map.of(
        "title", trimToLength(stringValue(payload.get("title"), stringValue(fallback.get("title"), "抓取候选内容")), 120),
        "summary", trimToLength(stringValue(payload.get("summary"), stringValue(fallback.get("summary"), "公开来源抓取内容")), 500),
        "body", trimToLength(stringValue(payload.get("body"), stringValue(fallback.get("body"), stringValue(fallback.get("summary"), ""))), 2000),
        "path", path,
        "tags", tags.isEmpty() ? List.of(path, "公开来源") : tags,
        "qualityScore", Math.max(0, Math.min(100, intValue(payload.get("qualityScore"), intValue(fallback.get("qualityScore"), 60)))),
        "reason", trimToLength(stringValue(payload.get("reason"), "AI 已完成摘要和路径分类，等待管理员审核。"), 300)
    );
  }

  private List<String> stringList(Object value, List<String> fallback, int limit) {
    if (!(value instanceof List<?> rows) || rows.isEmpty()) return fallback;
    List<String> values = rows.stream()
        .map(item -> stringValue(item, ""))
        .filter(StringUtils::hasText)
        .limit(limit)
        .toList();
    return values.isEmpty() ? fallback : values;
  }

  private List<String> explorationList(Object value, List<String> fallback, int limit) {
    return stringList(value, fallback, limit).stream()
        .map(this::displayExplorationTopic)
        .distinct()
        .limit(limit)
        .toList();
  }

  private String displayExplorationTopic(String topic) {
    return topic;
  }

  private boolean asksForPathScore(String message) {
    String text = message == null ? "" : message.replace(" ", "");
    return text.contains("打分")
        || text.contains("评分")
        || text.contains("1到5")
        || text.contains("1-5")
        || text.contains("一到五");
  }

  private int intValue(Object value, int fallback) {
    if (value instanceof Number number) return number.intValue();
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private boolean booleanValue(Object value, boolean fallback) {
    if (value instanceof Boolean bool) return bool;
    if (value == null) return fallback;
    return "true".equalsIgnoreCase(String.valueOf(value));
  }

  private String stringValue(Object value, String fallback) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : fallback;
  }

  private String trimForPrompt(String value, int limit) {
    if (value == null) return "";
    String normalized = value.replaceAll("\\s+", " ").trim();
    return normalized.length() <= limit ? normalized : normalized.substring(0, limit);
  }

  private String trimToLength(String value, int limit) {
    String normalized = value == null ? "" : value.replaceAll("\\s+", " ").trim();
    return normalized.length() <= limit ? normalized : normalized.substring(0, limit);
  }

  private String summaryFromReport(String reportText) {
    String normalized = trimToLength(reportText, 220);
    return StringUtils.hasText(normalized) ? normalized : "AI 已生成开放式职业路径报告，请进入报告正文查看完整判断。";
  }

  private String extractJson(String content) {
    String trimmed = content.trim();
    int start = trimmed.indexOf('{');
    int end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return trimmed.substring(start, end + 1);
    }
    return trimmed;
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("JSON 序列化失败", exception);
    }
  }

  private String trimTrailingSlash(String value) {
    String next = value.trim();
    while (next.endsWith("/")) {
      next = next.substring(0, next.length() - 1);
    }
    return next;
  }
}
