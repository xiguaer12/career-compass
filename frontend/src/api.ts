import type { CommunityPost, CommunityPublicProfile, QuestionnaireTemplate, TemplateResource } from "./types";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type StudentProfile = {
  id: number;
  email: string;
  name?: string;
  studentNo?: string;
  college?: string;
  major?: string;
  graduationYear?: string;
  phone?: string;
  nickname?: string;
  status: string;
};

export type Session = {
  token: string;
  role: string;
  status: string;
  profile: StudentProfile;
};

export type EmailCodeResult = {
  email: string;
  expiresInSeconds: number;
  cooldownSeconds: number;
};

export type AdminSession = {
  token: string;
  role: string;
  displayName: string;
};

export type AiReport = {
  id: number;
  reportVersion: string;
  generatedAt: string;
  scores: Array<{ path: string; score: number; rank: string; reasons: string[] }>;
  dimensions?: Array<{ subject: string; civil: number; postgraduate: number; employment: number }>;
  narrativeReport?: string;
  studentProfile?: string;
  summary: string;
  risks: string[];
  alternatives: string[];
  plan: Array<{ stage: string; actions: string[] }>;
  resources: string[];
  disclaimer: string;
  questionnaireVersion?: string;
  templateVersion?: string;
  promptVersion?: string;
  generationStatus?: string;
};

export type ReportTask = {
  status: string;
  reportId: number;
  report?: AiReport | null;
  message: string;
};

export type QuestionnaireDraft = {
  id?: number;
  questionnaireVersion: string;
  answers: Record<string, unknown>;
  stepKey: string;
  completionPercent: number;
  status: string;
  updatedAt: string;
};

export type InterviewMessage = {
  role: "assistant" | "user";
  content: string;
};

export type InterviewResponse = {
  assistantMessage: string;
  answers: Record<string, unknown>;
  profileSummary?: string;
  decisionSignals?: string[];
  completionPercent: number;
  readyToGenerate: boolean;
  missingFields: string[];
};

export type MessageItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  read: boolean;
  createdAt: string;
};

export type AiAnswer = {
  questionUnderstanding: string;
  factors: string[];
  pathComparison: string[];
  advice: string[];
  reminders: string[];
  answerText?: string;
};

export type AiChatHistoryItem = {
  id: number;
  reportId: number;
  question: string;
  answer: AiAnswer;
  createdAt: string;
};

export type FavoriteItem = {
  id: number;
  itemType: string;
  itemId: string;
  title: string;
  url?: string;
  createdAt: string;
};

export type Dashboard = {
  registeredUsers: number;
  activeUsers: number;
  assessmentCompletionRate: number;
  reportCount: number;
  postCount: number;
  questionCount: number;
  dataSourceCount: number;
  crawlTaskCount: number;
  pendingCrawlCount: number;
  pendingReviews: number;
  updatedAt: string;
  queue: Array<{ id: string; item: string; type: string; status: string }>;
};

export type ContentItem = {
  id: number;
  title: string;
  category: string;
  body?: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  tags?: string;
  displayPosition?: string;
  sortOrder?: number;
  updatedAt: string;
  status: string;
};

export type HomeMetric = {
  key: string;
  label: string;
  value: string;
  trend: string;
  tone?: string;
};

export type HomePayload = {
  metrics: HomeMetric[];
  notices: ContentItem[];
  faqs: ContentItem[];
  charts: ChartItem[];
  featuredPosts: CommunityPost[];
};

export type PathPage = {
  key: string;
  name: string;
  intro: string;
  suitable: string[];
  timeline: string[];
  pitfalls: string[];
  accent: string;
  matchScore: number;
  sortOrder: number;
  status: string;
  updatedAt: string;
  templates: TemplateResource[];
  highlights: ContentItem[];
};

export type PathConfigItem = Omit<PathPage, "templates" | "highlights">;

export type CommunityComment = {
  id: number;
  postId: number;
  parentCommentId?: number | null;
  body: string;
  authorDisplay: string;
  bestAnswer: boolean;
  status: string;
  createdAt: string;
};

export type WorkbenchResponse = {
  profile: StudentProfile;
  latestReport?: AiReport;
  reportHistory: Array<{ id: number; reportVersion: string; generatedAt: string; topPath: string; topScore: number }>;
  messages: MessageItem[];
  recentViews: Array<{ itemType: string; itemId: string; title: string; url?: string; viewedAt: string }>;
  todos: Array<{ title: string; stage: string; path: string; status: string }>;
  timeline: Array<{ stage: string; description: string; path: string }>;
  favorites: CommunityPost[];
  mainPath?: string;
  alternativePaths: string[];
  staleReport: boolean;
};

export type CrawlSource = {
  id: number;
  name: string;
  url: string;
  type: string;
  path: string;
  frequency: string;
  trustLevel?: string;
  status: string;
  lastRunAt: string;
  passRate: string;
  updatedAt?: string;
  lastTaskStatus?: string;
  lastTaskMessage?: string;
  lastTaskAt?: string;
  parserRule?: Record<string, unknown>;
};

export type StudentAdminItem = {
  id: number;
  email: string;
  name?: string;
  studentNo?: string;
  college?: string;
  major?: string;
  graduationYear?: string;
  phone?: string;
  nickname?: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
};

export type CommunityUserAdminItem = {
  id: number;
  name: string;
  studentNo: string;
  posts: number;
  comments: number;
  reports: number;
  status: string;
  punishmentReason?: string;
  mutedUntil?: string;
  bannedUntil?: string;
};

export type CrawlCandidateItem = {
  id: number;
  sourceId: number;
  sourceName: string;
  rawUrl: string;
  title: string;
  summary: string;
  path: string;
  reviewStatus: string;
  failureReason?: string;
  crawledAt: string;
  parsedAt?: string;
  publishedAt?: string;
  qualityScore?: number;
  reason?: string;
  tags?: string;
};

export type CrawlTaskItem = {
  id: number;
  sourceId: number;
  sourceName: string;
  triggerType: string;
  status: string;
  resultMessage?: string;
  failureType: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
};

export type ChartItem = {
  id: number;
  title: string;
  chartType: string;
  path: string;
  data: Record<string, unknown>;
  methodology: string;
  sourceName: string;
  sourceUrl?: string;
  filters: Record<string, unknown>;
  visibility: string;
  displayPosition?: string;
  status: string;
  updatedAt: string;
};

export type ChartImportError = {
  row: number;
  reason: string;
};

export type ChartImportResult = {
  importedRows: number;
  data: Record<string, unknown>;
  errors: ChartImportError[];
};

export type AiConfigItem = {
  id: number;
  configType: string;
  version: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
};

export type AbuseReportItem = {
  id: number;
  reporterStudentId: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  handledBy?: string;
  handledResult?: string;
  handledAt?: string;
  createdAt: string;
};

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = text ? JSON.parse(text) as ApiResponse<T> : { success: response.ok, message: "", data: undefined as T };
  } catch {
    throw new Error(text || `请求失败：HTTP ${response.status}`);
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `请求失败：HTTP ${response.status}`);
  }
  return payload.data;
}

export const authApi = {
  sendRegisterCode: (email: string) =>
    api<EmailCodeResult>("/api/auth/register-code", { method: "POST", body: JSON.stringify({ email }) }),
  sendLoginCode: (email: string) =>
    api<EmailCodeResult>("/api/auth/login-code", { method: "POST", body: JSON.stringify({ email }) }),
  sendPasswordResetCode: (email: string) =>
    api<EmailCodeResult>("/api/auth/password-reset-code", { method: "POST", body: JSON.stringify({ email }) }),
  register: (profile: Partial<StudentProfile> & { email: string; password: string; verificationCode?: string }) =>
    api<Session>("/api/auth/register", { method: "POST", body: JSON.stringify(profile) }),
  login: (email: string, password: string) =>
    api<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  loginByCode: (email: string, verificationCode: string) =>
    api<Session>("/api/auth/login-by-code", { method: "POST", body: JSON.stringify({ email, verificationCode }) }),
  resetPassword: (email: string, verificationCode: string, newPassword: string) =>
    api<Record<string, unknown>>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, verificationCode, newPassword }) }),
  me: (token: string) => api<StudentProfile>("/api/me", {}, token)
};

export const publicApi = {
  home: () => api<HomePayload>("/api/home"),
  paths: () => api<PathPage[]>("/api/paths"),
  path: (key: string) => api<PathPage>(`/api/path/${encodeURIComponent(key)}`),
  assessmentTemplate: () => api<QuestionnaireTemplate>("/api/assessment/template"),
  templates: (category = "") =>
    api<TemplateResource[]>(`/api/templates${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  charts: (params: Record<string, string> = {}) => {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value))).toString();
    return api<ChartItem[]>(`/api/charts${search ? `?${search}` : ""}`);
  }
};

export const studentApi = {
  saveProfile: (token: string, profile: Partial<StudentProfile> & { privacy?: Record<string, unknown> }) =>
    api<StudentProfile>("/api/profile", { method: "PUT", body: JSON.stringify(profile) }, token),
  workbench: (token: string) => api<WorkbenchResponse>("/api/workbench", {}, token),
  recordActivity: (token: string, itemType: string, itemId: string, title: string, url = "") =>
    api<Record<string, unknown>>("/api/activity", { method: "POST", body: JSON.stringify({ itemType, itemId, title, url }) }, token),
  latestDraft: (token: string) => api<QuestionnaireDraft | null>("/api/assessment/draft", {}, token),
  saveDraft: (token: string, answers: Record<string, unknown>, completionPercent: number, stepKey = "questionnaire", questionnaireVersion = "QNR-2026.05") =>
    api<QuestionnaireDraft>(
      "/api/assessment/draft",
      { method: "PUT", body: JSON.stringify({ questionnaireVersion, answers, completionPercent, stepKey }) },
      token
    ),
  interview: (token: string, messages: InterviewMessage[]) =>
    api<InterviewResponse>("/api/assessment/interview", { method: "POST", body: JSON.stringify({ messages }) }, token),
  submitAssessment: (token: string, answers: Record<string, unknown>, questionnaireVersion = "QNR-2026.05") =>
    api<ReportTask>(
      "/api/assessment/submit",
      { method: "POST", body: JSON.stringify({ questionnaireVersion, answers, completionPercent: 100 }) },
      token
    ),
  latestReport: (token: string) => api<AiReport | null>("/api/reports/latest", {}, token),
  latestReportTask: (token: string) => api<ReportTask | null>("/api/reports/latest-task", {}, token),
  reportHistory: (token: string) => api<Array<{ id: number; reportVersion: string; generatedAt: string; topPath: string; topScore: number }>>("/api/reports/history", {}, token),
  reportTask: (token: string, reportId: number) => api<ReportTask>(`/api/reports/${reportId}/task`, {}, token),
  retryReport: (token: string, reportId: number) => api<ReportTask>(`/api/reports/${reportId}/retry`, { method: "POST" }, token),
  chat: (token: string, reportId: number | string, question: string, history: Array<Record<string, string>> = []) =>
    api<AiAnswer>("/api/ai/chat", { method: "POST", body: JSON.stringify({ reportId: String(reportId), question, history }) }, token),
  chatHistory: (token: string, reportId: number | string) =>
    api<AiChatHistoryItem[]>(`/api/ai/chat/history?reportId=${encodeURIComponent(String(reportId))}`, {}, token),
  favorites: (token: string) => api<FavoriteItem[]>("/api/favorites", {}, token),
  toggleFavorite: (token: string, itemType: string, itemId: string, title: string, url = "") =>
    api<Record<string, unknown>>("/api/favorites", { method: "POST", body: JSON.stringify({ itemType, itemId, title, url }) }, token),
  recordTemplateDownload: (token: string, id: number) =>
    api<{ templateId: number; name: string; url: string; format: string; loggedAt: string }>(`/api/templates/${id}/download`, { method: "POST" }, token),
  messages: (token: string) => api<MessageItem[]>("/api/messages", {}, token),
  readMessage: (token: string, id: number) => api<Record<string, unknown>>(`/api/messages/${id}/read`, { method: "PATCH" }, token),
  readAllMessages: (token: string) => api<Record<string, unknown>>("/api/messages/read-all", { method: "POST" }, token),
  cancelAccount: (token: string, reason: string) =>
    api<Record<string, unknown>>("/api/account/cancel", { method: "POST", body: JSON.stringify({ reason, confirmed: true }) }, token)
};

export const communityApi = {
  list: (params: Record<string, string> = {}, token?: string) => {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value))).toString();
    return api<CommunityPost[]>(`/api/community/posts${search ? `?${search}` : ""}`, {}, token);
  },
  detail: (id: number, token?: string) => api<CommunityPost>(`/api/community/posts/${id}`, {}, token),
  userProfile: (id: number, token?: string) => api<CommunityPublicProfile>(`/api/community/users/${id}`, {}, token),
  comments: (id: number) => api<CommunityComment[]>(`/api/community/posts/${id}/comments`),
  uploadImages: async (token: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await fetch("/api/community/uploads", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const text = await response.text();
    let payload: ApiResponse<string[]>;
    try {
      payload = text ? JSON.parse(text) as ApiResponse<string[]> : { success: response.ok, message: "", data: [] };
    } catch {
      throw new Error(text || `请求失败：HTTP ${response.status}`);
    }
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "图片上传失败");
    }
    return payload.data || [];
  },
  create: (token: string, title: string, body: string, path = "就业", type = "问答", anonymous = true, imageUrls: string[] = []) =>
    api<CommunityPost>(
      "/api/community/posts",
      { method: "POST", body: JSON.stringify({ title, body, type, path, anonymous, imageUrls }) },
      token
    ),
  update: (token: string, id: number, title: string, body: string, path = "就业", type = "问答", anonymous = true, imageUrls: string[] = []) =>
    api<CommunityPost>(
      `/api/community/posts/${id}`,
      { method: "PUT", body: JSON.stringify({ title, body, type, path, anonymous, imageUrls }) },
      token
    ),
  remove: (token: string, id: number) =>
    api<Record<string, unknown>>(`/api/community/posts/${id}`, { method: "DELETE" }, token),
  interact: (token: string, postId: number, type: "like" | "favorite") =>
    api<Record<string, unknown>>("/api/community/interaction", { method: "POST", body: JSON.stringify({ postId, type }) }, token),
  report: (token: string, targetId: number, reason: string, targetType = "post") =>
    api<Record<string, unknown>>("/api/community/report", { method: "POST", body: JSON.stringify({ targetId, targetType, reason }) }, token),
  comment: (token: string, postId: number, body: string, parentCommentId?: number | null) =>
    api<Record<string, unknown>>("/api/community/comments", { method: "POST", body: JSON.stringify({ postId, body, parentCommentId }) }, token),
  bestAnswer: (token: string, commentId: number, bestAnswer: boolean) =>
    api<Record<string, unknown>>("/api/community/best-answer", { method: "PATCH", body: JSON.stringify({ commentId, bestAnswer }) }, token)
};

export const adminApi = {
  login: (username: string, password: string) =>
    api<AdminSession>("/admin/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  dashboard: (token?: string) => api<Dashboard>("/admin/dashboard", {}, token),
  contents: (token: string) => api<ContentItem[]>("/admin/contents", {}, token),
  saveContent: (token: string, content: Partial<ContentItem> & { body?: string; sourceName?: string; sourceUrl?: string; tags?: string; displayPosition?: string; sortOrder?: number }) =>
    api<Record<string, unknown>>("/admin/content/save", { method: "POST", body: JSON.stringify(content) }, token),
  deleteContent: (token: string, id: number) =>
    api<Record<string, unknown>>(`/admin/contents/${id}`, { method: "DELETE" }, token),
  sources: (token?: string) => api<CrawlSource[]>("/admin/sources", {}, token),
  saveSource: (token: string, source: Partial<CrawlSource> & { frequency?: string; trustLevel?: string; parserRule?: Record<string, unknown> }) =>
    api<Record<string, unknown>>(
      "/admin/sources/save",
      {
        method: "POST",
        body: JSON.stringify({
          id: source.id,
          name: source.name,
          url: source.url,
          type: source.type,
          path: source.path,
          frequency: source.frequency ?? source.frequency,
          trustLevel: source.trustLevel ?? "中",
          status: source.status,
          parserRule: source.parserRule ?? {}
        })
      },
      token
    ),
  posts: (token?: string) => api<CommunityPost[]>("/admin/community/posts", {}, token),
  updatePostStatus: (token: string, id: number, status: string, reason = "后台操作", expectedStatus?: string) =>
    api<Record<string, unknown>>(
      "/admin/community/post/status",
      { method: "POST", body: JSON.stringify({ id, status, reason, expectedStatus }) },
      token
    ),
  comments: (token: string, status = "") =>
    api<CommunityComment[]>(`/admin/community/comments${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, token),
  updateCommentStatus: (token: string, id: number, status: string, reason = "后台评论审核", expectedStatus?: string) =>
    api<Record<string, unknown>>(
      "/admin/community/comment/status",
      { method: "POST", body: JSON.stringify({ id, status, reason, expectedStatus }) },
      token
    ),
  triggerCrawl: (token: string, id: number) => api<Record<string, unknown>>(`/admin/sources/${id}/crawl`, { method: "POST" }, token),
  paths: (token: string) => api<PathConfigItem[]>("/admin/paths", {}, token),
  savePath: (token: string, path: Partial<PathConfigItem>) =>
    api<Record<string, unknown>>("/admin/paths/save", { method: "POST", body: JSON.stringify(path) }, token),
  students: (token: string, params: Record<string, string> = {}) => {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value))).toString();
    return api<StudentAdminItem[]>(`/admin/users${search ? `?${search}` : ""}`, {}, token);
  },
  updateStudentStatus: (token: string, id: number, status: string, reason = "后台操作", expectedStatus?: string) =>
    api<Record<string, unknown>>("/admin/users/status", { method: "POST", body: JSON.stringify({ id, status, reason, expectedStatus }) }, token),
  communityUsers: (token: string) => api<CommunityUserAdminItem[]>("/admin/community/users", {}, token),
  banCommunityUser: (token: string, id: number, status: string, reason = "社区违规处理", expectedStatus?: string) =>
    api<Record<string, unknown>>("/admin/community/user/ban", { method: "POST", body: JSON.stringify({ id, status, reason, expectedStatus }) }, token),
  candidates: (token: string, status = "") =>
    api<CrawlCandidateItem[]>(`/admin/crawl/candidates${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, token),
  crawlTasks: (token: string, params: Record<string, string> = {}) => {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value))).toString();
    return api<CrawlTaskItem[]>(`/admin/crawl/tasks${search ? `?${search}` : ""}`, {}, token);
  },
  reviewCandidate: (token: string, id: number, action: string, patch: Record<string, unknown> = {}) =>
    api<Record<string, unknown>>("/admin/crawl/candidates/review", { method: "POST", body: JSON.stringify({ id, action, ...patch }) }, token),
  charts: (token: string) => api<ChartItem[]>("/admin/charts", {}, token),
  saveChart: (token: string, chart: Partial<ChartItem>) =>
    api<Record<string, unknown>>("/admin/charts/save", { method: "POST", body: JSON.stringify(chart) }, token),
  importChart: async (token: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/admin/charts/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body
    });
    const text = await response.text();
    let payload: ApiResponse<ChartImportResult>;
    try {
      payload = text
        ? JSON.parse(text) as ApiResponse<ChartImportResult>
        : { success: response.ok, message: "", data: undefined as unknown as ChartImportResult };
    } catch {
      throw new Error(text || `请求失败：HTTP ${response.status}`);
    }
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `请求失败：HTTP ${response.status}`);
    }
    return payload.data;
  },
  refreshCharts: (token: string) =>
    api<Record<string, unknown>>("/admin/charts/refresh", { method: "POST" }, token),
  aiConfigs: (token: string, type = "") =>
    api<AiConfigItem[]>(`/admin/ai/configs${type ? `?type=${encodeURIComponent(type)}` : ""}`, {}, token),
  saveAiConfig: (token: string, config: Partial<AiConfigItem>) =>
    api<Record<string, unknown>>(
      "/admin/ai/configs/save",
      {
        method: "POST",
        body: JSON.stringify({
          id: config.id,
          configType: config.configType,
          version: config.version,
          title: config.title,
          content: config.content,
          status: config.status
        })
      },
      token
    ),
  reports: (token: string, status = "") =>
    api<AbuseReportItem[]>(`/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, token),
  handleReport: (token: string, id: number, status: string, reason: string, expectedStatus?: string) =>
    api<Record<string, unknown>>("/admin/reports/handle", { method: "POST", body: JSON.stringify({ id, status, reason, expectedStatus }) }, token),
  audits: (token: string) => api<Array<{ id: number; actor: string; action: string; targetType: string; targetId: string; detail: string; createdAt: string }>>("/admin/audits", {}, token)
};

export type { TemplateResource };
