package com.careercompass.service;

import com.careercompass.model.Dtos.ActionPlan;
import com.careercompass.model.Dtos.AiAnswer;
import com.careercompass.model.Dtos.AiQuestion;
import com.careercompass.model.Dtos.AiReport;
import com.careercompass.model.Dtos.DimensionScore;
import com.careercompass.model.Dtos.InterviewResponse;
import com.careercompass.model.Dtos.Score;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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
    if (!available()) return fallback;
    Map<String, Object> payload = chatJson(
        "你是高校毕业路径规划系统的 AI 报告生成器。必须只输出 JSON，不要输出 Markdown。",
        """
        请基于学生深度问卷输入生成三路径辅助决策报告。
        固定要求：
        1. 覆盖考公、考研、就业三条路径，score 为 0-100 整数。
        2. scores 必须按分数从高到低排序，rank 依次为第一推荐、第二推荐、第三推荐。
        3. 第一推荐至少 3 条 reasons，其余路径至少 2 条 reasons，分别体现机会和约束。
        4. dimensions 输出 4-6 个维度，subject 使用中文短语，civil/postgraduate/employment 都是 0-100 整数。
        5. risks 输出 2-5 条。
        6. alternatives 输出 1-3 条。
        7. plan 必须包含 30 天、60 天、90 天三个阶段，每阶段至少 3 项 actions。
        8. resources 至少 3 项。
        9. disclaimer 使用给定免责声明。

        输出 JSON schema：
        {
          "summary": "string",
          "scores": [{"path":"考公|考研|就业","score":0,"rank":"第一推荐","reasons":["string"]}],
          "dimensions": [{"subject":"确定性","civil":0,"postgraduate":0,"employment":0}],
          "risks": ["string"],
          "alternatives": ["string"],
          "plan": [{"stage":"30 天","actions":["string"]}],
          "resources": ["string"],
          "disclaimer": "string"
        }

        报告模板：
        %s

        提示词模板：
        %s

        免责声明：
        %s

        问卷输入 JSON：
        %s
        """.formatted(reportTemplate, promptTemplate, disclaimer, toJson(answers))
    );
    return reportFromPayload(id, payload, questionnaireVersion, templateVersion, promptVersion, fallback);
  }

  public AiAnswer answer(AiReport report, AiQuestion question, String promptTemplate, AiAnswer fallback) {
    if (!available() || report == null) return fallback;
    String asked = question == null || !StringUtils.hasText(question.question()) ? "如何安排下一步行动" : question.question();
    Map<String, Object> payload = chatJson(
        "你是高校毕业路径规划系统的报告追问助手。必须只输出 JSON，不要输出 Markdown。",
        """
        请围绕已有 AI 报告回答学生追问。回答必须结构化、克制，不承诺录取、上岸或就业结果。

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

  public InterviewResponse interview(List<Map<String, String>> messages, InterviewResponse fallback) {
    if (!available()) return fallback;
    Map<String, Object> payload = chatJson(
        "你是高校职业路径开放访谈助手。你要像耐心的咨询老师一样接住学生表达，整理其中和职业选择有关的信号，再给出轻量引导。必须只输出 JSON，不要输出 Markdown。",
        """
        请根据已有对话继续访谈学生。目标是替代传统问卷，通过自然对话整理足够素材来生成考公、考研、就业三路径报告。

        访谈原则：
        1. 你的问题只是思维发散引导，不是必须逐题回答的问卷。学生说到问题之外的家庭、情绪、经历、城市、资源、担忧、偏好，都要主动加工整理进 answers。
        2. 开场和早期追问要给出轻量入口，例如“最近纠结的一件事”“一段项目/实习/课程/考证经历”“城市、家庭、收入、成长里最在意的因素”，但这些入口都只是可选引导。
        3. 不要因为某个字段没被正面回答就换个问法反复追问；先总结已获得的信息，再顺势抛出 1 个开放问题，最多 2 个。
        4. 可以用例子、选择项和追问帮助表达，但不要要求学生给考公、考研、就业三条路打分，也不要直接问“三选一”。
        5. 不要承诺录取、上岸或就业结果。
        6. 当已有素材能生成有价值的初版报告时 readyToGenerate=true，并给出一句“可以先生成草案，后续还能继续补充”的确认说明；不要求所有字段完整。
        7. answers 必须保持 requiredKeys 兼容；未知文本字段可用空字符串，三条路径意愿分只能根据叙述软推断，无法判断时填 3。
        8. missingFields 字段不是缺失项，而是“可以继续探索的方向”，请输出中文短语，例如“项目和实习经历”“城市与家庭约束”，不要输出 requiredKeys 英文字段名。

        requiredKeys：
        academic, certificates, project, constraints, city, riskPreference,
        employmentInterest, civilInterest, postgraduateInterest

        answers 字段含义：
        academic=学业成绩/排名/挂科情况描述；
        certificates=英语、证书、技能证书；
        project=科研/项目/实习/竞赛；
        constraints=家庭、经济、时间、地域等现实约束；
        city=目标城市或地域偏好；
        riskPreference=风险偏好，低/中/高或具体说明；
        employmentInterest/civilInterest/postgraduateInterest=1-5 的路径倾向软推断整数；只能从学生叙述中推断，禁止要求学生打分。

        输出 JSON schema：
        {
          "assistantMessage": "string",
          "answers": {
            "academic": "string",
            "certificates": "string",
            "project": "string",
            "constraints": "string",
            "city": "string",
            "riskPreference": "string",
            "employmentInterest": 3,
            "civilInterest": 3,
            "postgraduateInterest": 3
          },
          "completionPercent": 0,
          "readyToGenerate": false,
          "missingFields": ["string"]
        }

        当前对话 JSON：
        %s
        """.formatted(toJson(messages == null ? List.of() : messages))
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
    if (!available()) return fallback;
    Map<String, Object> payload = chatJson(
        "你是高校毕业路径信息差分析助手。必须只输出 JSON，不要输出 Markdown。",
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

  private AiReport reportFromPayload(
      long id,
      Map<String, Object> payload,
      String questionnaireVersion,
      String templateVersion,
      String promptVersion,
      AiReport fallback
  ) {
    List<Score> scores = scoreList(payload.get("scores"), fallback.scores());
    List<DimensionScore> dimensions = dimensionList(payload.get("dimensions"), fallback.dimensions());
    List<ActionPlan> plan = planList(payload.get("plan"), fallback.plan());
    return new AiReport(
        id,
        fallback.reportVersion(),
        Instant.now().toString(),
        scores,
        dimensions,
        stringValue(payload.get("summary"), fallback.summary()),
        stringList(payload.get("risks"), fallback.risks(), 5),
        stringList(payload.get("alternatives"), fallback.alternatives(), 3),
        plan,
        stringList(payload.get("resources"), fallback.resources(), 6),
        stringValue(payload.get("disclaimer"), fallback.disclaimer()),
        questionnaireVersion,
        templateVersion,
        promptVersion,
        "已完成"
    );
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
        ? normalizeInterviewAnswers(raw)
        : fallback.answers();
    List<String> missing = explorationList(payload.get("missingFields"), fallback.missingFields(), 12);
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
        percent,
        ready,
        missing
    );
  }

  private Map<String, Object> normalizeInterviewAnswers(Map<?, ?> raw) {
    return Map.of(
        "academic", stringValue(raw.get("academic"), ""),
        "certificates", stringValue(raw.get("certificates"), ""),
        "project", stringValue(raw.get("project"), ""),
        "constraints", stringValue(raw.get("constraints"), ""),
        "city", stringValue(raw.get("city"), ""),
        "riskPreference", stringValue(raw.get("riskPreference"), ""),
        "employmentInterest", Math.max(1, Math.min(5, intValue(raw.get("employmentInterest"), 3))),
        "civilInterest", Math.max(1, Math.min(5, intValue(raw.get("civilInterest"), 3))),
        "postgraduateInterest", Math.max(1, Math.min(5, intValue(raw.get("postgraduateInterest"), 3)))
    );
  }

  private List<Score> scoreList(Object value, List<Score> fallback) {
    if (!(value instanceof List<?> rows) || rows.isEmpty()) return fallback;
    List<Score> scores = new ArrayList<>();
    for (Object row : rows) {
      if (!(row instanceof Map<?, ?> map)) continue;
      String path = stringValue(map.get("path"), "");
      if (!List.of("考公", "考研", "就业").contains(path)) continue;
      int score = Math.max(0, Math.min(100, intValue(map.get("score"), 0)));
      List<String> reasons = stringList(map.get("reasons"), List.of(), 5);
      scores.add(new Score(path, score, "", reasons.isEmpty() ? List.of("基于问卷输入形成该路径评分") : reasons));
    }
    if (scores.size() != 3) return fallback;
    scores.sort(Comparator.comparingInt(Score::score).reversed());
    List<Score> ranked = new ArrayList<>();
    for (int index = 0; index < scores.size(); index++) {
      Score score = scores.get(index);
      String rank = index == 0 ? "第一推荐" : index == 1 ? "第二推荐" : "第三推荐";
      ranked.add(new Score(score.path(), score.score(), rank, score.reasons()));
    }
    return ranked;
  }

  private List<DimensionScore> dimensionList(Object value, List<DimensionScore> fallback) {
    if (!(value instanceof List<?> rows) || rows.isEmpty()) return fallback;
    List<DimensionScore> dimensions = new ArrayList<>();
    for (Object row : rows) {
      if (!(row instanceof Map<?, ?> map)) continue;
      String subject = stringValue(map.get("subject"), "");
      if (!StringUtils.hasText(subject)) continue;
      int civil = dimensionValue(map, "civil", "考公");
      int postgraduate = dimensionValue(map, "postgraduate", "考研");
      int employment = dimensionValue(map, "employment", "就业");
      dimensions.add(new DimensionScore(subject, civil, postgraduate, employment));
    }
    return dimensions.size() >= 3 ? dimensions.stream().limit(6).toList() : fallback;
  }

  private int dimensionValue(Map<?, ?> map, String key, String chineseKey) {
    return Math.max(0, Math.min(100, intValue(map.containsKey(key) ? map.get(key) : map.get(chineseKey), 0)));
  }

  private List<ActionPlan> planList(Object value, List<ActionPlan> fallback) {
    if (!(value instanceof List<?> rows) || rows.isEmpty()) return fallback;
    List<ActionPlan> plans = new ArrayList<>();
    for (Object row : rows) {
      if (!(row instanceof Map<?, ?> map)) continue;
      String stage = stringValue(map.get("stage"), "");
      List<String> actions = stringList(map.get("actions"), List.of(), 6);
      if (StringUtils.hasText(stage) && actions.size() >= 3) {
        plans.add(new ActionPlan(stage, actions));
      }
    }
    return plans.size() >= 3 ? plans : fallback;
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
    return switch (topic) {
      case "academic" -> "学业基础";
      case "certificates" -> "证书和技能";
      case "project" -> "项目、实习或竞赛经历";
      case "constraints" -> "家庭、经济和时间约束";
      case "city" -> "城市和地域偏好";
      case "riskPreference" -> "稳定性、成长和收入的取舍";
      case "employmentInterest" -> "对就业路径的真实顾虑";
      case "civilInterest" -> "对体制内路径的真实顾虑";
      case "postgraduateInterest" -> "对继续升学的真实顾虑";
      default -> topic;
    };
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
