import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Compass,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Flag,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  MessagesSquare,
  PenLine,
  Plus,
  RefreshCcw,
  Route,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Save,
  Trash2,
  UserRoundCheck,
  Users,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  adminApi,
  api,
  authApi,
  communityApi,
  publicApi,
  studentApi,
  type AdminSession,
  type AiAnswer,
  type AiChatHistoryItem,
  type AiConfigItem,
  type AbuseReportItem,
  type ChartItem,
  type CommunityUserAdminItem,
  type CommunityComment,
  type ContentItem,
  type CrawlCandidateItem,
  type CrawlTaskItem,
  type AiReport,
  type CrawlSource,
  type Dashboard,
  type FavoriteItem,
  type InterviewMessage,
  type MessageItem,
  type PathConfigItem,
  type PathPage,
  type ReportTask,
  type Session,
  type StudentProfile,
  type StudentAdminItem,
  type TagItem,
  type WorkbenchResponse
} from "./api";
import { visibleFavoriteItems } from "./utils";
import {
  adminQueue
} from "./data";
import type { CommunityPost, CommunityPublicProfile, PathInfo, QuestionnaireTemplate, TemplateResource } from "./types";

type TabKey = "home" | "workspace" | "report" | "paths" | "charts" | "community" | "messages" | "me";

type PostDraft = {
  title: string;
  body: string;
  path: string;
  type: string;
  anonymous: boolean;
  imageUrls: string[];
};

type ReportDraft = {
  targetId: number;
  targetType: "post" | "comment";
  reason: string;
  detail: string;
};

type ChartForm = {
  id?: number;
  title: string;
  chartType: string;
  path: string;
  methodology: string;
  sourceName: string;
  sourceUrl: string;
  visibility: string;
  displayPosition: string;
  status: string;
  dataText: string;
  filtersText: string;
};

type ChartSeries = {
  key: string;
  name?: string;
  color?: string;
};

const aiConfigTypes = [
  "prompt",
  "questionnaire",
  "report_template",
  "disclaimer",
  "algorithm_weights",
  "model_params"
];

const aiConfigTemplates: Record<string, { version: string; title: string; content: string }> = {
  algorithm_weights: {
    version: "WEIGHT-2026.06",
    title: "三路径匹配权重",
    content: JSON.stringify({
      weights: {
        profileFit: 35,
        interviewSignals: 30,
        constraints: 20,
        dataEvidence: 15
      }
    }, null, 2)
  },
  model_params: {
    version: "MODEL-2026.06",
    title: "大模型调用参数",
    content: JSON.stringify({
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4000
    }, null, 2)
  }
};

type PathForm = {
  key: string;
  name: string;
  intro: string;
  suitableText: string;
  timelineText: string;
  pitfallsText: string;
  accent: string;
  matchScore: number;
  sortOrder: number;
  status: string;
};

const usstCollegeMajors: Record<string, string[]> = {
  "能源与动力工程学院": ["过程装备与控制工程", "能源与动力工程", "新能源科学与工程", "储能科学与工程"],
  "光电信息与计算机工程学院": ["测控技术与仪器", "电子信息工程", "电子科学与技术", "通信工程", "光电信息科学与工程", "自动化", "计算机科学与技术", "智能科学与技术", "数据科学与大数据技术"],
  "管理学院": ["税收学", "金融学", "国际经济与贸易", "系统科学与工程", "人工智能", "交通工程", "管理科学", "信息管理与信息系统", "工商管理", "会计学", "公共事业管理", "工业工程"],
  "机械工程学院": ["机械设计制造及其自动化", "车辆工程", "电气工程及其自动化", "机器人工程"],
  "外语学院": ["英语", "德语", "日语"],
  "环境与建筑学院": ["土木工程", "建筑环境与能源应用工程", "环境工程"],
  "健康科学与工程学院": ["生物医学工程", "食品科学与工程", "食品质量与安全", "康复工程", "医学信息工程", "智能医学工程", "医学影像技术", "制药工程", "生物技术"],
  "出版印刷与艺术设计学院": ["编辑出版学", "传播学", "广告学", "工业设计", "新媒体技术", "包装工程", "动画", "视觉传达设计", "环境设计", "产品设计", "包装设计"],
  "理学院": ["数学与应用数学", "应用物理学"],
  "材料与化学学院": ["材料成型及控制工程", "材料科学与工程", "应用化学"],
  "中英国际学院": ["电子信息科学与技术（中英合作）", "机械设计制造及其自动化（中英合作）", "工商管理（中英合作）", "会展经济与管理"]
};

const collegeOptions = Object.keys(usstCollegeMajors);

const emptyPostDraft: PostDraft = {
  title: "",
  body: "",
  path: "就业",
  type: "问答",
  anonymous: true,
  imageUrls: []
};

const reportReasonOptions = [
  "内容不实或误导",
  "广告引流或垃圾信息",
  "攻击谩骂或不友善",
  "泄露隐私或敏感信息",
  "与三路径规划无关",
  "其他问题"
];

const emptyChartForm: ChartForm = {
  title: "",
  chartType: "趋势图",
  path: "全部",
  methodology: "",
  sourceName: "",
  sourceUrl: "",
  visibility: "公开",
  displayPosition: "图表中心",
  status: "待审核",
  dataText: '{\n  "rows": []\n}',
  filtersText: "{}"
};

const emptyPathForm: PathForm = {
  key: "employment",
  name: "就业",
  intro: "",
  suitableText: "",
  timelineText: "",
  pitfallsText: "",
  accent: "#b45309",
  matchScore: 80,
  sortOrder: 3,
  status: "启用"
};

function draftFromPost(post: CommunityPost): PostDraft {
  return {
    title: post.title,
    body: post.body || post.summary || "",
    path: post.path || "就业",
    type: post.type || "问答",
    anonymous: post.anonymous ?? true,
    imageUrls: post.imageUrls || []
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function initialInterviewMessages(): InterviewMessage[] {
  return [
    {
      role: "assistant",
      content: "你可以从这两个入口里任选一个说起：最近让你纠结的一件事，或者一段项目、实习、课程、考证经历；如果愿意，也可以顺带说说城市、家庭、收入、成长里你最在意哪一两个因素。"
    }
  ];
}

function interviewMessagesFromAnswers(answers?: Record<string, unknown>): InterviewMessage[] {
  const rawMessages = answers?.sourceMessages;
  if (!Array.isArray(rawMessages)) return initialInterviewMessages();
  const messages = rawMessages
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      role: item.role === "user" ? "user" : item.role === "assistant" ? "assistant" : "",
      content: typeof item.content === "string" ? item.content : ""
    }))
    .filter((message): message is InterviewMessage => Boolean(message.role && message.content.trim()));
  return messages.length > 0 ? messages : initialInterviewMessages();
}

function formatAdminTime(value?: string | null) {
  if (!value) return "无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function studentNoFromEmail(email?: string) {
  const prefix = (email || "").split("@")[0];
  return /^\d{10}$/.test(prefix) ? prefix : "";
}

function majorsForCollege(college?: string) {
  return college ? usstCollegeMajors[college] ?? [] : [];
}

function pathPageToInfo(page: PathPage): PathInfo {
  return {
    key: page.key,
    name: page.name,
    subtitle: page.intro,
    accent: page.accent || pathColor(page.name),
    match: page.matchScore || 0,
    suitable: page.suitable || [],
    timeline: page.timeline || [],
    pitfalls: page.pitfalls || [],
    resources: (page.templates || []).map((template) => template.name)
  };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(values?: string[]) {
  return (values || []).join("\n");
}

function chartFormFromItem(chart: ChartItem): ChartForm {
  return {
    id: chart.id,
    title: chart.title,
    chartType: chart.chartType,
    path: chart.path,
    methodology: chart.methodology,
    sourceName: chart.sourceName,
    sourceUrl: chart.sourceUrl || "",
    visibility: chart.visibility,
    displayPosition: chart.displayPosition || "图表中心",
    status: chart.status,
    dataText: JSON.stringify(chart.data || { rows: [] }, null, 2),
    filtersText: JSON.stringify(chart.filters || {}, null, 2)
  };
}

function pathFormFromItem(path: PathConfigItem): PathForm {
  return {
    key: path.key,
    name: path.name,
    intro: path.intro,
    suitableText: joinLines(path.suitable),
    timelineText: joinLines(path.timeline),
    pitfallsText: joinLines(path.pitfalls),
    accent: path.accent || pathColor(path.name),
    matchScore: path.matchScore,
    sortOrder: path.sortOrder,
    status: path.status
  };
}

function parseJsonRecord(text: string, label: string) {
  try {
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error();
    }
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`${label} 必须是合法 JSON 对象`);
  }
}

function safeJsonRecord(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const navItems: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "home", label: "首页", icon: LayoutDashboard },
  { key: "workspace", label: "工作台", icon: ClipboardList },
  { key: "report", label: "AI 报告", icon: Sparkles },
  { key: "paths", label: "三路径", icon: Route },
  { key: "charts", label: "图表", icon: BarChart3 },
  { key: "community", label: "社区", icon: MessagesSquare },
  { key: "messages", label: "消息", icon: Bell },
  { key: "me", label: "个人", icon: UserRound }
];

const tabRoutes: Record<TabKey, string> = {
  home: "/",
  workspace: "/workspace",
  report: "/report",
  paths: "/paths",
  charts: "/charts",
  community: "/community",
  messages: "/messages",
  me: "/me"
};

function tabFromPath(pathname: string): TabKey {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = Object.entries(tabRoutes).find(([, route]) => route === normalized);
  return match ? (match[0] as TabKey) : "home";
}

const compactStats = [
  { key: "registeredStudents", label: "注册学生", value: "—", trend: "等待数据库", icon: Users },
  { key: "completionRate", label: "测评完成率", value: "—", trend: "等待数据库", icon: CheckCircle2 },
  { key: "reportCount", label: "报告生成量", value: "—", trend: "等待数据库", icon: FileText },
  { key: "pendingReviews", label: "待审核项", value: "—", trend: "等待数据库", icon: Clock3 }
];

function App() {
  const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";
  const [activeTab, setActiveTab] = useState<TabKey>(() => tabFromPath(window.location.pathname));
  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [report, setReport] = useState<AiReport | null>(null);
  const [reportTask, setReportTask] = useState<ReportTask | null>(null);
  const [chartToOpen, setChartToOpen] = useState<number | null>(null);
  const [communityPostToOpen, setCommunityPostToOpen] = useState<number | null>(null);
  const [communityDetailOnly, setCommunityDetailOnly] = useState(false);
  const [selectedPathKey, setSelectedPathKey] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTone = /失败|错误|不可|过期|繁忙|请稍后|离线/.test(notice)
    ? "error"
    : /仍在|等待|尚未|可能|提醒/.test(notice)
      ? "warning"
      : "success";

  useEffect(() => {
    let mounted = true;
    fetch("/api/health")
      .then((response) => {
        if (!mounted) return;
        setApiStatus(response.ok ? "up" : "down");
      })
      .catch(() => {
        if (mounted) setApiStatus("down");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    const token = localStorage.getItem("career-compass-token");
    if (!token) return;
    authApi.me(token)
      .then(async (profile) => {
        setSession({ token, role: "student", status: profile.status, profile });
        await refreshReportState(token);
      })
      .catch(() => localStorage.removeItem("career-compass-token"));
  }, [isAdminRoute]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), noticeTone === "error" ? 6200 : 4200);
    return () => window.clearTimeout(timer);
  }, [notice, noticeTone]);

  useEffect(() => {
    if (isAdminRoute) return;
    const syncRoute = () => {
      const nextTab = tabFromPath(window.location.pathname);
      setActiveTab(nextTab);
      setNotice("");
      resetScopedNavigation(nextTab);
    };
    window.addEventListener("popstate", syncRoute);
    syncRoute();
    return () => window.removeEventListener("popstate", syncRoute);
  }, [isAdminRoute]);

  async function refreshReportState(token: string) {
    const [latest, latestTask] = await Promise.all([
      studentApi.latestReport(token),
      studentApi.latestReportTask(token)
    ]);
    setReportTask(latestTask);
    if (latestTask?.status === "已完成" && latestTask.report) {
      setReport(latestTask.report);
      return;
    }
    if (latest) setReport(latest);
    else setReport(null);
  }

  function saveSession(next: Session) {
    localStorage.setItem("career-compass-token", next.token);
    setSession(next);
    setReport(null);
    setReportTask(null);
    setAuthOpen(false);
    setNotice(`${next.profile.nickname || next.profile.email} 已登录`);
    refreshReportState(next.token).catch(() => undefined);
  }

  function updateReportTask(task: ReportTask | null) {
    setReportTask(task);
    if (task?.status === "已完成" && task.report) {
      setReport(task.report);
    }
  }

  function resetScopedNavigation(tab: TabKey) {
    if (tab !== "charts") setChartToOpen(null);
    if (tab !== "community") {
      setCommunityPostToOpen(null);
      setCommunityDetailOnly(false);
    }
  }

  function navigateToTab(tab: TabKey, options: { keepScopedState?: boolean; replace?: boolean } = {}) {
    const nextUrl = tabRoutes[tab];
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl !== nextUrl) {
      if (options.replace) window.history.replaceState(null, "", nextUrl);
      else window.history.pushState(null, "", nextUrl);
    }
    setActiveTab(tab);
    setNotice("");
    if (!options.keepScopedState) resetScopedNavigation(tab);
  }

  function logout() {
    localStorage.removeItem("career-compass-token");
    setSession(null);
    setReport(null);
    setReportTask(null);
  }

  if (isAdminRoute) {
    return <AdminShell apiStatus={apiStatus} />;
  }

  return (
    <div className={`app-shell student-shell ${activeTab === "home" ? "home-shell" : ""}`}>
      <header className="app-header" aria-label="主导航">
        <div className="brand">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          <div>
            <strong>Career Compass</strong>
            <span>职业规划网站</span>
          </div>
        </div>
        <nav className="nav-list top-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={tabRoutes[item.key]}
                className={activeTab === item.key ? "nav-item active" : "nav-item"}
                onClick={(event) => {
                  event.preventDefault();
                  navigateToTab(item.key);
                }}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="app-header-actions">
          <button className="secondary-button header-login-button" onClick={session ? logout : () => setAuthOpen(true)}>
            {session ? <LogOut size={17} /> : <LogIn size={17} />}
            {session ? "退出" : "学生登录"}
          </button>
        </div>
      </header>

      <main className="main">
        {notice && <div className={`toast ${noticeTone}`} role="status">{notice}</div>}
        {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onSession={saveSession} />}
        {activeTab === "home" && <HomeView report={report} onNavigate={navigateToTab} />}
        {activeTab === "workspace" && <WorkspaceView session={session} onLogin={() => setAuthOpen(true)} onReport={setReport} onTask={updateReportTask} setNotice={setNotice} />}
        {activeTab === "report" && <ReportView report={report} task={reportTask} session={session} onLogin={() => setAuthOpen(true)} onReport={setReport} onTask={updateReportTask} onNavigate={navigateToTab} />}
        {activeTab === "paths" && (
          <PathsView
            report={report}
            session={session}
            onLogin={() => setAuthOpen(true)}
            selectedPathKey={selectedPathKey}
            onSelectedPathKeyChange={setSelectedPathKey}
            onOpenChart={(chart) => {
              setChartToOpen(chart.id);
              navigateToTab("charts", { keepScopedState: true });
            }}
            onOpenCommunityPost={(post) => {
              setCommunityPostToOpen(post.id);
              setCommunityDetailOnly(true);
              navigateToTab("community", { keepScopedState: true });
            }}
          />
        )}
        {activeTab === "charts" && (
          <ChartsView
            session={session}
            openChartId={chartToOpen}
            onBackToPaths={chartToOpen ? () => {
              setChartToOpen(null);
              navigateToTab("paths", { keepScopedState: true });
            } : undefined}
          />
        )}
        {activeTab === "community" && (
          <CommunityView
            session={session}
            onLogin={() => setAuthOpen(true)}
            setNotice={setNotice}
            openPostId={communityPostToOpen}
            detailOnly={communityDetailOnly}
            onOpenedPost={() => setCommunityPostToOpen(null)}
            onBackToPaths={communityDetailOnly ? () => {
              setCommunityPostToOpen(null);
              setCommunityDetailOnly(false);
              navigateToTab("paths", { keepScopedState: true });
            } : undefined}
          />
        )}
        {activeTab === "messages" && <MessagesView session={session} onLogin={() => setAuthOpen(true)} setNotice={setNotice} />}
        {activeTab === "me" && (
          <MeView
            session={session}
            onLogin={() => setAuthOpen(true)}
            setNotice={setNotice}
            onProfileUpdate={(profile) => {
              setSession((current) => current ? { ...current, status: profile.status, profile } : current);
            }}
            onLogout={() => {
              logout();
            }}
          />
        )}
      </main>
    </div>
  );
}

function AdminShell({ apiStatus }: { apiStatus: "checking" | "up" | "down" }) {
  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar admin-sidebar" aria-label="后台导航">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>Career Compass</strong>
            <span>后台管理控制台</span>
          </div>
        </div>
        <div className="admin-side-panel">
          <strong>独立后台</strong>
          <span>审核、数据源、图表、用户与 AI 配置集中在此维护。</span>
        </div>
        <div className="sidebar-note">
          <LockKeyhole size={16} />
          <span>后台使用独立管理员凭证，与学生登录态分开保存</span>
        </div>
      </aside>

      <main className="main admin-main">
        <header className="topbar admin-topbar">
          <div>
            <p className="eyebrow">Career Compass Admin</p>
            <h1>后台管理</h1>
          </div>
          <div className="topbar-actions">
            <span className={`api-status ${apiStatus}`}>
              <span />
              {apiStatus === "up" ? "API 正常" : apiStatus === "down" ? "API 离线" : "API 检查中"}
            </span>
            <a className="secondary-button" href="/">
              <ArrowLeft size={17} />
              返回用户端
            </a>
          </div>
        </header>
        <AdminView />
      </main>
    </div>
  );
}

type AuthMode = "login" | "code-login" | "register" | "reset";

function AuthPanel({ onClose, onSession }: { onClose: () => void; onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registerProfile, setRegisterProfile] = useState({
    name: "",
    college: "",
    major: "",
    phone: "",
    nickname: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMessage, setCodeMessage] = useState("");
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const registerMajors = majorsForCollege(registerProfile.college);
  const requiresCode = mode === "register" || mode === "code-login" || mode === "reset";
  const requiresPassword = mode === "login" || mode === "register" || mode === "reset";
  const modalTitle = mode === "register" ? "学校邮箱注册" : mode === "code-login" ? "邮箱验证码登录" : mode === "reset" ? "找回密码" : "学生登录";

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setTimeout(() => setCodeCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCooldown]);

  function updateRegisterProfile(patch: Partial<typeof registerProfile>) {
    setRegisterProfile((current) => ({ ...current, ...patch }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setCodeMessage("");
    setCodeCooldown(0);
    setVerificationCode("");
    setPassword("");
    setConfirmPassword("");
  }

  async function sendAuthCode() {
    setError("");
    setCodeMessage("");
    setCodeLoading(true);
    try {
      const result = mode === "register"
        ? await authApi.sendRegisterCode(email)
        : mode === "code-login"
          ? await authApi.sendLoginCode(email)
          : await authApi.sendPasswordResetCode(email);
      setCodeCooldown(result.cooldownSeconds || 60);
      setCodeMessage(`验证码已发送至 ${result.email}，${Math.floor((result.expiresInSeconds || 600) / 60)} 分钟内有效。`);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "验证码发送失败");
    } finally {
      setCodeLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        onSession(await authApi.login(email, password));
      } else if (mode === "code-login") {
        onSession(await authApi.loginByCode(email, verificationCode));
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          setPassword("");
          setConfirmPassword("");
          setError("两次输入的新密码不一致，请重新输入");
          return;
        }
        await authApi.resetPassword(email, verificationCode, password);
        setError("");
        setCodeMessage("密码已重置，请使用新密码登录。");
        setPassword("");
        setConfirmPassword("");
        setVerificationCode("");
        setMode("login");
      } else {
        if (password !== confirmPassword) {
          setPassword("");
          setConfirmPassword("");
          setError("密码不一致，请重新输入");
          return;
        }
        onSession(await authApi.register({
          email,
          password,
          verificationCode,
          ...registerProfile
        }));
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className={`auth-modal ${mode === "register" ? "register-auth-modal" : ""}`}>
        <div className="section-title">
          <div>
            <UserRoundCheck size={18} />
            <h3>{modalTitle}</h3>
          </div>
          <button className="text-button" onClick={onClose}>关闭</button>
        </div>
        <div className="segmented auth-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>密码登录</button>
          <button className={mode === "code-login" ? "active" : ""} onClick={() => switchMode("code-login")}>验证码登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>注册</button>
        </div>
        <label>
          <span>学校邮箱</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {requiresPassword && (
          <label>
            <span>{mode === "reset" ? "新密码" : "密码"}</span>
            <div className="inline-control">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="icon-button"
                title={showPassword ? "隐藏密码" : "显示密码"}
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        )}
        {requiresCode && mode !== "register" && (
          <label>
            <span>邮箱验证码</span>
            <div className="inline-control verification-code-control">
              <input value={verificationCode} maxLength={6} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button className="secondary-button" type="button" onClick={sendAuthCode} disabled={codeLoading || codeCooldown > 0}>
                {codeLoading ? "发送中" : codeCooldown > 0 ? `${codeCooldown}s` : "发送验证码"}
              </button>
            </div>
            {codeMessage && <small className="field-hint">{codeMessage}</small>}
          </label>
        )}
        {mode === "reset" && (
          <label>
            <span>确认新密码</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        )}
        {mode === "register" && (
          <div className="register-profile-grid">
            <label className="full-span">
              <span>确认密码</span>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <label className="full-span">
              <span>邮箱验证码</span>
              <div className="inline-control verification-code-control">
                <input value={verificationCode} maxLength={6} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                <button className="secondary-button" type="button" onClick={sendAuthCode} disabled={codeLoading || codeCooldown > 0}>
                  {codeLoading ? "发送中" : codeCooldown > 0 ? `${codeCooldown}s` : "发送验证码"}
                </button>
              </div>
              {codeMessage && <small className="field-hint">{codeMessage}</small>}
            </label>
            <label>
              <span>姓名</span>
              <input value={registerProfile.name} onChange={(event) => updateRegisterProfile({ name: event.target.value })} />
            </label>
            <label>
              <span>手机号</span>
              <input value={registerProfile.phone} onChange={(event) => updateRegisterProfile({ phone: event.target.value.replace(/\D/g, "").slice(0, 11) })} />
            </label>
            <label>
              <span>学院</span>
              <select value={registerProfile.college} onChange={(event) => updateRegisterProfile({ college: event.target.value, major: "" })}>
                <option value="">请选择学院</option>
                {collegeOptions.map((college) => <option value={college} key={college}>{college}</option>)}
              </select>
            </label>
            <label>
              <span>专业</span>
              <select value={registerProfile.major} onChange={(event) => updateRegisterProfile({ major: event.target.value })} disabled={!registerProfile.college}>
                <option value="">请选择专业</option>
                {registerMajors.map((major) => <option value={major} key={major}>{major}</option>)}
              </select>
            </label>
            <label className="full-span">
              <span>昵称</span>
              <input value={registerProfile.nickname} placeholder="可选，不填写则前台显示匿名用户" onChange={(event) => updateRegisterProfile({ nickname: event.target.value })} />
            </label>
          </div>
        )}
        {mode === "login" && (
          <button className="text-button auth-help-button" type="button" onClick={() => switchMode("reset")}>
            忘记密码？
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" onClick={submit} disabled={loading}>
          {loading ? "处理中..." : mode === "login" ? "登录" : mode === "code-login" ? "验证码登录" : mode === "reset" ? "重置密码" : "验证注册并开始访谈"}
        </button>
      </section>
    </div>
  );
}

function HomeView({ report, onNavigate }: { report: AiReport | null; onNavigate: (tab: TabKey) => void }) {
  const [homePaths, setHomePaths] = useState<PathInfo[]>([]);
  const [homeError, setHomeError] = useState("");

  useEffect(() => {
    publicApi.paths()
      .then((pages) => setHomePaths(pages.map(pathPageToInfo)))
      .catch(() => {
        setHomeError("内容加载失败，请刷新重试");
      });
  }, []);

  const displayHomePaths = homePaths.map((path) => ({
    ...path,
    match: reportScoreForPath(report, path.name) ?? path.match
  }));
  const guideSteps = [
    {
      icon: ClipboardList,
      title: "注册并填写档案",
      description: "注册时填写学院、专业和联系方式，学号由学校邮箱自动识别。",
      target: "workspace" as TabKey,
      action: "开始注册"
    },
    {
      icon: Sparkles,
      title: "进行 AI 访谈",
      description: "用开放对话整理你的课程、实习、家庭约束和真实顾虑。",
      target: "workspace" as TabKey,
      action: "开始整理"
    },
    {
      icon: FileText,
      title: "查看规划报告",
      description: "报告会基于访谈素材生成完整正文，综合整理适配点、风险和下一步建议。",
      target: "report" as TabKey,
      action: "查看报告"
    }
  ];
  const capabilityItems = [
    { icon: Bot, title: "AI 访谈", text: "通过追问和归纳，减少学生自己描述不清导致的信息缺口。" },
    { icon: Route, title: "三路径资料", text: "集中查看考研、考公、就业的模板、资讯、图表和经验问答。" },
    { icon: ShieldCheck, title: "后台审核", text: "资讯抓取和社区内容先进入审核，再展示给学生参考。" }
  ];

  return (
    <TechParticleBlock className="home-space-background">
      <div className="page-stack home-page-content">
      {homeError && <p className="form-error">{homeError}</p>}
      <section className="hero-panel home-intro-panel">
        <div className="hero-copy">
          <p className="eyebrow">Career Compass</p>
          <h2>面向本科应届毕业生的三路径规划平台。</h2>
          <p>
            平台围绕考研、考公、就业三个方向，把个人信息、AI 访谈、规划报告、资料模板、真实资讯和社区经验整合在一起，帮助学生更早看清选择条件和下一步行动。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate("workspace")}>
              <ClipboardList size={17} />
              开始 AI 访谈
            </button>
            <button type="button" className="secondary-button" onClick={() => onNavigate("paths")}>
              <Route size={17} />
              查看三路径资料
            </button>
          </div>
        </div>
        <div className="home-step-list" aria-label="推荐开始方式">
          {guideSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button type="button" className="home-step-item" key={step.title} onClick={() => onNavigate(step.target)}>
                <span className="home-step-index">{index + 1}</span>
                <Icon size={18} />
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
                <b>{step.action}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="content-grid three home-capability-grid">
        {capabilityItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className="home-capability-card" key={item.title}>
              <div className="metric-icon">
                <Icon size={19} />
              </div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          );
        })}
      </section>

      <section className="content-grid split home-guide-layout">
        <div className="surface">
          <SectionTitle icon={Route} title="三条路径怎么用" />
          <div className="home-path-grid">
            {displayHomePaths.map((path) => (
              <HomePathIntroCard key={path.key} path={path} />
            ))}
            {displayHomePaths.length === 0 && (
              <div className="empty-state">敬请期待</div>
            )}
          </div>
        </div>
        <div className="surface home-use-card">
          <SectionTitle icon={Flag} title="建议使用顺序" />
          <div className="notice-list">
            <div className="notice-item">
              <CheckCircle2 size={16} />
              <span><strong>注册时填档案</strong>学院、专业等信息会直接绑定个人档案，学号由学校邮箱识别。</span>
            </div>
            <div className="notice-item">
              <CheckCircle2 size={16} />
              <span><strong>再做 AI 访谈</strong>把不确定、说不清的想法交给 AI 帮你整理。</span>
            </div>
            <div className="notice-item">
              <CheckCircle2 size={16} />
              <span><strong>最后查资料验证</strong>用三路径资料、图表和社区经验补足信息差。</span>
            </div>
          </div>
        </div>
      </section>
      </div>
    </TechParticleBlock>
  );
}

type TechParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  drift: number;
  opacity: number;
};

function TechParticleBlock({ children, className = "" }: { children: ReactNode; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false, burst: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const drawingCanvas = canvas;
    const drawingContext = context;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let particles: TechParticle[] = [];

    function createParticles(nextWidth: number, nextHeight: number) {
      const count = Math.min(2200, Math.max(760, Math.floor((nextWidth * nextHeight) / 240)));
      particles = [];
      for (let index = 0; index < count; index++) {
        particles.push({
          x: Math.random() * nextWidth,
          y: Math.random() * nextHeight,
          vx: (Math.random() - 0.5) * 0.38,
          vy: (Math.random() - 0.5) * 0.38,
          size: 0.35 + Math.random() * 0.9,
          drift: 0.035 + Math.random() * 0.095,
          opacity: 0.34 + Math.random() * 0.5
        });
      }
    }

    function resize() {
      const rect = drawingCanvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      drawingCanvas.width = Math.floor(width * dpr);
      drawingCanvas.height = Math.floor(height * dpr);
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles(width, height);
    }

    function draw() {
      drawingContext.clearRect(0, 0, width, height);
      const gradient = drawingContext.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(2, 6, 23, 0.96)");
      gradient.addColorStop(0.46, "rgba(14, 35, 69, 0.92)");
      gradient.addColorStop(1, "rgba(5, 62, 74, 0.92)");
      drawingContext.fillStyle = gradient;
      drawingContext.fillRect(0, 0, width, height);

      const pointer = pointerRef.current;
      particles.forEach((particle) => {
        particle.vx += (Math.random() - 0.5) * particle.drift;
        particle.vy += (Math.random() - 0.5) * particle.drift;

        if (pointer.active && pointer.burst > 0.02) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          const radius = Math.min(118, Math.max(72, width * 0.12));
          if (distance < radius) {
            const scatter = (1 - distance / radius) * pointer.burst;
            const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
            const impulse = (0.42 + Math.random() * 1.18) * scatter;
            particle.vx += Math.cos(angle) * impulse;
            particle.vy += Math.sin(angle) * impulse;
          }
        }

        const speed = Math.hypot(particle.vx, particle.vy);
        const maxSpeed = pointer.active ? 2.7 : 0.86;
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }
        particle.vx *= 0.982;
        particle.vy *= 0.982;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -0.82;
          particle.x = Math.max(0, Math.min(width, particle.x));
        }
        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -0.82;
          particle.y = Math.max(0, Math.min(height, particle.y));
        }
      });

      particles.forEach((particle) => {
        const pointerDistance = pointer.active ? Math.hypot(particle.x - pointer.x, particle.y - pointer.y) : 999;
        const glow = pointer.active && pointer.burst > 0.02 && pointerDistance < 84 ? 0.28 : 0;
        drawingContext.beginPath();
        drawingContext.fillStyle = `rgba(255, 255, 255, ${Math.min(0.96, particle.opacity + glow)})`;
        drawingContext.arc(particle.x, particle.y, particle.size + glow * 0.9, 0, Math.PI * 2);
        drawingContext.fill();
      });

      if (pointer.active) {
        pointer.burst *= 0.68;
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(drawingCanvas);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function updatePointer(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
      burst: 1
    };
  }

  return (
    <div
      className={`home-particle-block ${className}`}
      onPointerMove={updatePointer}
      onPointerEnter={updatePointer}
      onPointerLeave={() => {
        pointerRef.current.active = false;
        pointerRef.current.burst = 0;
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="交互式职业路径信号图"
      />
      <div className="home-particle-content">
        {children}
      </div>
    </div>
  );
}

function WorkspaceView({
  session,
  onLogin,
  onReport,
  onTask,
  setNotice
}: {
  session: Session | null;
  onLogin: () => void;
  onReport: (report: AiReport) => void;
  onTask: (task: ReportTask | null) => void;
  setNotice: (message: string) => void;
}) {
  const [assessment, setAssessment] = useState<Record<string, unknown>>({});
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>(initialInterviewMessages);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewProgress, setInterviewProgress] = useState(0);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [interviewExploreTopics, setInterviewExploreTopics] = useState<string[]>([]);
  const [interviewProfileSummary, setInterviewProfileSummary] = useState("");
  const [interviewDecisionSignals, setInterviewDecisionSignals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [workbench, setWorkbench] = useState<WorkbenchResponse | null>(null);
  const [reportMessage, setReportMessage] = useState("");
  const [questionnaireTemplate, setQuestionnaireTemplate] = useState<QuestionnaireTemplate | null>(null);

  useEffect(() => {
    publicApi.assessmentTemplate().then(setQuestionnaireTemplate).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session) {
      setAssessment({});
      setInterviewMessages(initialInterviewMessages());
      setInterviewProgress(0);
      setReadyToGenerate(false);
      setInterviewExploreTopics([]);
      setInterviewProfileSummary("");
      setInterviewDecisionSignals([]);
      return;
    }
    studentApi.latestDraft(session.token)
      .then((draft) => {
        if (draft?.answers) {
          setAssessment(draft.answers);
          setInterviewProgress(draft.completionPercent || 0);
          setInterviewMessages(interviewMessagesFromAnswers(draft.answers));
          setReadyToGenerate((draft.completionPercent || 0) >= 45);
          setInterviewExploreTopics([]);
          setInterviewProfileSummary(typeof draft.answers.profileSummary === "string" ? draft.answers.profileSummary : "");
          setInterviewDecisionSignals(Array.isArray(draft.answers.decisionSignals) ? draft.answers.decisionSignals.map(String) : []);
        } else {
          setAssessment({});
          setInterviewMessages(initialInterviewMessages());
          setInterviewProgress(0);
          setReadyToGenerate(false);
          setInterviewExploreTopics([]);
          setInterviewProfileSummary("");
          setInterviewDecisionSignals([]);
        }
      })
      .catch(() => undefined);
    studentApi.workbench(session.token).then(setWorkbench).catch(() => undefined);
  }, [session?.token]);

  async function submitAssessment() {
    if (!session) {
      onLogin();
      return;
    }
    setSaving(true);
    setReportMessage("报告生成任务提交中...");
    try {
      const task = await studentApi.submitAssessment(session.token, assessment, questionnaireTemplate?.version);
      onTask(task);
      setReportMessage(task.message || "AI 报告正在生成");
      if (task.status === "已完成" && task.report) {
        onReport(task.report);
        onTask(task);
        studentApi.workbench(session.token).then(setWorkbench).catch(() => undefined);
        setNotice("访谈素材和 AI 报告已保存，可进入 AI 报告页查看");
        return;
      }
      for (let index = 0; index < 12; index++) {
        await wait(1500);
        const next = await studentApi.reportTask(session.token, task.reportId);
        onTask(next);
        setReportMessage(next.message);
        if (next.status === "已完成" && next.report) {
          onReport(next.report);
          studentApi.workbench(session.token).then(setWorkbench).catch(() => undefined);
          setNotice("AI 报告已生成，可进入 AI 报告页查看");
          return;
        }
        if (next.status === "失败") {
          setNotice(next.message);
          return;
        }
      }
      setNotice("报告仍在后台生成中，完成后会出现在消息中心");
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "报告生成失败");
    } finally {
      setSaving(false);
    }
  }

  async function sendInterviewMessage() {
    if (!session) {
      onLogin();
      return;
    }
    if (!interviewInput.trim()) return;
    const nextMessages: InterviewMessage[] = [
      ...interviewMessages,
      { role: "user", content: interviewInput.trim() }
    ];
    setInterviewMessages(nextMessages);
    setInterviewInput("");
    setInterviewLoading(true);
    try {
      const response = await studentApi.interview(session.token, nextMessages);
      setAssessment(response.answers);
      setInterviewProgress(response.completionPercent);
      setReadyToGenerate(response.readyToGenerate);
      setInterviewExploreTopics(response.missingFields);
      setInterviewProfileSummary(response.profileSummary || (typeof response.answers.profileSummary === "string" ? response.answers.profileSummary : ""));
      setInterviewDecisionSignals(response.decisionSignals || (Array.isArray(response.answers.decisionSignals) ? response.answers.decisionSignals.map(String) : []));
      setInterviewMessages([
        ...nextMessages,
        { role: "assistant", content: response.assistantMessage }
      ]);
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "AI 访谈失败");
    } finally {
      setInterviewLoading(false);
    }
  }

  async function generateFromInterview() {
    if (!session) {
      onLogin();
      return;
    }
    if (!readyToGenerate && !window.confirm("当前素材可以生成一版草案，但继续聊几句会更细。现在生成报告草案吗？")) return;
    await submitAssessment();
  }

  async function restartInterview() {
    if (!session) {
      onLogin();
      return;
    }
    if (interviewMessages.length > 1 && !window.confirm("确认重新开始一段新的 AI 访谈？当前未生成报告的访谈草稿会被清空。")) return;
    setSaving(true);
    try {
      const emptyAnswers: Record<string, unknown> = { sourceMessages: [] };
      await studentApi.saveDraft(session.token, emptyAnswers, 0, "ai-interview", questionnaireTemplate?.version);
      setAssessment({});
      setInterviewMessages(initialInterviewMessages());
      setInterviewInput("");
      setInterviewProgress(0);
      setReadyToGenerate(false);
      setInterviewExploreTopics([]);
      setInterviewProfileSummary("");
      setInterviewDecisionSignals([]);
      setReportMessage("");
      setNotice("已开启新的 AI 访谈，可以从一个新的问题重新聊起");
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "重新开始访谈失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      {!session && (
        <section className="disclaimer">
          <AlertTriangle size={18} />
          <span>请先登录或注册学校邮箱账号。登录后档案、AI 访谈素材和报告会真实保存到数据库。</span>
          <button className="secondary-button" onClick={onLogin}>登录</button>
        </section>
      )}
      <section className="surface status-surface">
          <SectionTitle icon={Bot} title="AI 路径访谈" />
          {questionnaireTemplate && (
            <p className="helper-text">
              当前访谈模板：{questionnaireTemplate.title}（{questionnaireTemplate.version}） · {questionnaireTemplate.content}
            </p>
          )}
          <div className="stepper">
            {["账号", "AI 访谈", "AI 报告"].map((step, index) => (
              <div className={index === 0 || (index === 1 && interviewProgress > 0) ? "step done" : "step"} key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
          <div className="progress-block">
            <div>
              <span>访谈素材整理度</span>
              <strong>{interviewProgress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${interviewProgress}%` }} />
            </div>
          </div>
          <div className="interview-panel">
            <div className="chat-history interview-history">
              {interviewMessages.map((message, index) => (
                <div className={message.role === "user" ? "message user" : "message assistant"} key={`${message.role}-${index}`}>
                  {message.content}
                </div>
              ))}
              {interviewLoading && <div className="message assistant">正在整理你的回答...</div>}
            </div>
            <div className="chat-input">
              <input
                value={interviewInput}
                aria-label="AI 访谈输入"
                autoComplete="off"
                onChange={(event) => setInterviewInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendInterviewMessage();
                }}
              />
              <button className="primary-button" onClick={sendInterviewMessage} disabled={interviewLoading}>
                <Send size={17} />
                发送
              </button>
            </div>
            {interviewExploreTopics.length > 0 && (
              <p className="helper-text">可以继续聊：{interviewExploreTopics.join("、")}</p>
            )}
            {(interviewProfileSummary || interviewDecisionSignals.length > 0) && (
              <div className="interview-insight-box">
                {interviewProfileSummary && <p>{interviewProfileSummary}</p>}
                {interviewDecisionSignals.length > 0 && (
                  <div>
                    {interviewDecisionSignals.slice(0, 4).map((signal) => <span key={signal}>{signal}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={restartInterview} disabled={saving || interviewLoading}>
              <RefreshCcw size={17} />
              重新开始访谈
            </button>
            <button className="primary-button" onClick={generateFromInterview} disabled={saving || interviewLoading}>
              <Sparkles size={17} />
              {saving ? "生成中..." : readyToGenerate ? "生成报告" : "生成报告草案"}
            </button>
          </div>
          {reportMessage && <p className="helper-text">{reportMessage}</p>}
      </section>

      <section className="content-grid two">
        <div className="surface">
          <SectionTitle icon={Clock3} title="待办清单" />
          <div className="task-list">
            {(workbench?.todos || []).map((item) => (
              <div className="task-item" key={`${item.stage}-${item.title}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.path}</span>
                </div>
                <em>{item.stage}</em>
              </div>
            ))}
            {!workbench?.todos.length && <div className="empty-state">生成 AI 报告后，可以围绕报告正文继续拆解待办。</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={Sparkles} title="当前主路径" />
          <div className="workbench-summary">
            <strong>{workbench?.mainPath || "完成 AI 访谈后生成"}</strong>
            <span>备选：{workbench?.alternativePaths?.join(" / ") || (workbench?.latestReport?.narrativeReport ? "可在报告正文中查看" : "考公 / 考研 / 就业")}</span>
            {workbench?.staleReport && <p className="form-error">个人信息已更新，建议重新生成报告。</p>}
          </div>
          <div className="queue-list">
            {(workbench?.timeline.length ? workbench.timeline : []).map((item) => (
              <div className="queue-item" key={item.stage}>
                <div>
                  <strong>{item.stage}</strong>
                  <span>{item.description}</span>
                </div>
              </div>
            ))}
            {!workbench?.timeline.length && <ResourceTable session={session} onLogin={onLogin} />}
          </div>
        </div>
      </section>

      <section className="content-grid three">
        <div className="surface">
          <SectionTitle icon={Clock3} title="最近浏览" />
          <div className="queue-list">
            {workbench?.recentViews.map((item) => (
              <div className="queue-item" key={`${item.itemType}-${item.itemId}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.itemType} · {item.viewedAt}</span>
                </div>
              </div>
            ))}
            {!workbench?.recentViews.length && <div className="empty-state">暂无浏览记录</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={Star} title="收藏内容" />
          <PostList posts={workbench?.favorites || []} />
        </div>
        <div className="surface">
          <SectionTitle icon={Bell} title="未读提醒" />
          <div className="queue-list">
            {workbench?.messages.map((message) => (
              <div className="queue-item" key={message.id}>
                <div>
                  <strong>{message.title}</strong>
                  <span>{message.type} · {message.body}</span>
                </div>
              </div>
            ))}
            {!workbench?.messages.length && <div className="empty-state">暂无未读消息</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportView({
  report,
  task,
  session,
  onLogin,
  onReport,
  onTask,
  onNavigate
}: {
  report: AiReport | null;
  task: ReportTask | null;
  session: Session | null;
  onLogin: () => void;
  onReport: (report: AiReport) => void;
  onTask: (task: ReportTask | null) => void;
  onNavigate: (tab: TabKey) => void;
}) {
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswers, setChatAnswers] = useState<Array<{ question: string; answer: AiAnswer }>>([]);
  const [reportThreads, setReportThreads] = useState<Array<{ id: number; reportVersion: string; generatedAt: string; topPath: string; topScore: number }>>([]);
  const [activeReport, setActiveReport] = useState<AiReport | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [threadLoadingId, setThreadLoadingId] = useState<number | null>(null);
  const [threadError, setThreadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [exportError, setExportError] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const reportExportRef = useRef<HTMLDivElement | null>(null);
  const currentReport = activeReport ?? report;
  const scoreRows = (currentReport?.scores ?? []).map((score) => ({ name: score.path, score: score.score, rank: score.rank, color: pathColor(score.path), reasons: score.reasons ?? [] }));
  const dimensionRows = reportDimensionRows(currentReport);
  const planRows = currentReport?.plan ?? [];
  const riskRows = currentReport?.risks ?? [];
  const alternativeRows = currentReport?.alternatives ?? [];
  const narrativeReport = currentReport?.narrativeReport?.trim();
  const studentProfile = currentReport?.studentProfile?.trim();
  const hasStructuredReport = scoreRows.length > 0 || dimensionRows.length > 0 || planRows.length > 0 || riskRows.length > 0 || alternativeRows.length > 0;
  const reportChartMissing = Boolean(currentReport && hasStructuredReport && dimensionRows.length === 0);

  useEffect(() => {
    if (!session) {
      setReportThreads([]);
      setActiveReport(null);
      return;
    }
    studentApi.reportHistory(session.token)
      .then((items) => {
        setReportThreads(items);
        setThreadError("");
      })
      .catch((exception) => setThreadError(exception instanceof Error ? exception.message : "历史报告加载失败"));
  }, [session?.token, report?.id]);

  useEffect(() => {
    if (!session || !currentReport) {
      setChatAnswers([]);
      return;
    }
    setChatError("");
    studentApi.chatHistory(session.token, currentReport.id)
      .then((history: AiChatHistoryItem[]) => setChatAnswers(history.map((item) => ({ question: item.question, answer: item.answer }))))
      .catch((exception) => setChatError(exception instanceof Error ? exception.message : "报告追问记录加载失败"));
  }, [session?.token, currentReport?.id]);

  async function openReportThread(reportId: number) {
    if (!session) {
      onLogin();
      return;
    }
    setThreadLoadingId(reportId);
    setThreadError("");
    try {
      const next = await studentApi.reportTask(session.token, reportId);
      if (next.report) {
        setActiveReport(next.report);
        onTask(next);
      } else {
        setThreadError(next.message || "这份报告尚未生成完成");
      }
    } catch (exception) {
      setThreadError(exception instanceof Error ? exception.message : "报告线程加载失败");
    } finally {
      setThreadLoadingId(null);
    }
  }

  async function askReport() {
    if (!session) {
      onLogin();
      return;
    }
    if (!currentReport || !chatQuestion.trim()) return;
    setChatLoading(true);
    setChatError("");
    try {
      const answer = await studentApi.chat(session.token, currentReport.id, chatQuestion, chatAnswers.map((item) => ({ role: "user", content: item.question })));
      setChatAnswers([...chatAnswers, { question: chatQuestion, answer }]);
      setChatQuestion("");
    } catch (exception) {
      setChatError(exception instanceof Error ? exception.message : "追问发送失败");
    } finally {
      setChatLoading(false);
    }
  }

  function confirmReportExport() {
    if (!reportChartMissing) return true;
    return window.confirm("报告图表尚未加载完成，继续导出可能缺少图表。是否继续？");
  }

  function exportPdf() {
    if (!confirmReportExport()) return;
    setExportError("");
    window.print();
  }

  async function exportLongImage() {
    const node = reportExportRef.current;
    if (!node) return;
    setExportError("");
    if (!confirmReportExport()) return;
    const rect = node.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(node.scrollHeight);
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.width = `${width}px`;
    clone.style.background = "#ffffff";
    clone.style.padding = "24px";
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 48}" height="${height + 48}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div></foreignObject></svg>`;
    const image = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("长图生成失败"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width + 48;
      canvas.height = height + 48;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持长图导出");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `career-compass-report-${currentReport?.id || "latest"}.png`;
      link.click();
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : "长图导出失败");
    }
  }

  async function refreshTask() {
    if (!session || !task) {
      onLogin();
      return;
    }
    setTaskBusy(true);
    try {
      const next = await studentApi.reportTask(session.token, task.reportId);
      onTask(next);
      setTaskMessage(next.message);
      if (next.status === "已完成" && next.report) onReport(next.report);
    } finally {
      setTaskBusy(false);
    }
  }

  async function retryTask() {
    if (!session || !task) {
      onLogin();
      return;
    }
    setTaskBusy(true);
    try {
      const retrying = await studentApi.retryReport(session.token, task.reportId);
      onTask(retrying);
      setTaskMessage(retrying.message);
      for (let index = 0; index < 12; index++) {
        await wait(1500);
        const next = await studentApi.reportTask(session.token, retrying.reportId);
        onTask(next);
        setTaskMessage(next.message);
        if (next.status === "已完成" && next.report) {
          onReport(next.report);
          return;
        }
        if (next.status === "失败") return;
      }
      setTaskMessage("报告仍在后台生成中，完成后会在消息中心提醒你。");
    } finally {
      setTaskBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="disclaimer">
        <AlertTriangle size={18} />
        <span>{currentReport?.disclaimer || "AI 报告仅供辅助决策，不替代学生最终选择。报告会基于你完成的 AI 访谈生成。"}</span>
        {!session && <button className="secondary-button" onClick={onLogin}>登录生成真实报告</button>}
        {currentReport && (
          <div className="button-row compact-actions report-actions">
            <button className="secondary-button" onClick={exportPdf}>
              <FileText size={16} />
              导出 PDF
            </button>
            <button className="secondary-button" onClick={exportLongImage}>
              <Download size={16} />
              导出长图
            </button>
          </div>
        )}
      </section>
      {reportChartMissing && (
        <p className="form-error">报告图表尚未加载完成，导出前建议刷新或重新生成报告。</p>
      )}
      {session && task && task.status !== "已完成" && (
        <section className="surface">
          <SectionTitle icon={Clock3} title="最近报告任务" />
          <div className="queue-item">
            <div>
              <strong>报告 #{task.reportId} · {task.status}</strong>
              <span>{taskMessage || task.message}</span>
            </div>
            <div className="button-row compact-actions">
              <button className="secondary-button" onClick={refreshTask} disabled={taskBusy}>
                <RefreshCcw size={16} />
                刷新状态
              </button>
              {task.status === "失败" && (
                <button className="primary-button" onClick={retryTask} disabled={taskBusy}>
                  <Sparkles size={16} />
                  重新生成
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      {!currentReport && (
        <section className="surface">
          <SectionTitle icon={Sparkles} title="暂无 AI 报告" />
          <div className="empty-state">当前账号还没有已完成的 AI 报告。完成工作台里的 AI 访谈并生成报告后，这里会显示完整报告正文和报告追问。</div>
        </section>
      )}
      {currentReport && (
        <section className="report-thread-layout">
          <aside className="report-thread-sidebar">
            <div className="thread-sidebar-head">
              <strong>报告线程</strong>
              <span>{reportThreads.length} 份历史报告</span>
            </div>
            <button className="primary-button full-width" onClick={() => onNavigate("workspace")}>
              <Plus size={16} />
              新建报告
            </button>
            <div className="thread-list">
              {task && task.status !== "已完成" && (
                <button className="thread-item pending" onClick={refreshTask} disabled={taskBusy}>
                  <span>报告 #{task.reportId} · {task.status}</span>
                  <small>{taskMessage || task.message || "后台生成中"}</small>
                </button>
              )}
              {reportThreads.map((thread) => (
                <button
                  key={thread.id}
                  className={currentReport.id === thread.id ? "thread-item active" : "thread-item"}
                  onClick={() => openReportThread(thread.id)}
                  disabled={threadLoadingId === thread.id}
                >
                  <span>{thread.topPath || "AI 报告"}{thread.topScore > 0 ? ` · ${thread.topScore}` : ""}</span>
                  <small>{thread.reportVersion} · {formatAdminTime(thread.generatedAt)}</small>
                </button>
              ))}
              {reportThreads.length === 0 && <div className="empty-state compact-empty">暂无历史线程</div>}
            </div>
            {threadError && <p className="form-error">{threadError}</p>}
          </aside>
          <div className="report-thread-main">
        <div ref={reportExportRef} className="report-export-area report-thread-message">
          <section className="report-export-cover">
            <span>Career Compass AI Report</span>
            <h2>本科应届毕业生三路径规划报告</h2>
            <div className="report-export-meta">
              <b>报告编号 #{currentReport.id}</b>
              <b>{currentReport.reportVersion}</b>
              <b>生成 {formatAdminTime(currentReport.generatedAt)}</b>
              <b>最高匹配 {scoreRows[0]?.name || "待综合判断"} {scoreRows[0]?.score ? `${scoreRows[0].score} 分` : ""}</b>
            </div>
            <p>{currentReport.summary}</p>
          </section>
      {(narrativeReport || studentProfile) && (
        <section className="surface report-narrative">
          <SectionTitle icon={FileText} title="综合报告正文" />
          {studentProfile && (
            <div className="report-profile-box">
              <strong>学生画像</strong>
              <p>{studentProfile}</p>
            </div>
          )}
          {narrativeReport && <p>{narrativeReport}</p>}
        </section>
      )}
      {hasStructuredReport && (
        <>
      <section className="content-grid split">
        <div className="surface">
          <SectionTitle icon={Sparkles} title="路径评分与推荐排序" />
          <div className="score-list">
            {scoreRows.map((item) => (
              <div className="score-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.rank}</span>
                </div>
                <div className="score-track">
                  <span style={{ width: `${item.score}%`, background: item.color }} />
                </div>
                <b>{item.score}</b>
              </div>
            ))}
            {scoreRows.length === 0 && <div className="empty-state">这份报告暂未返回路径评分，请重新生成报告。</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={BarChart3} title="维度对比" />
          <div className="chart-box">
            {dimensionRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={dimensionRows}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <Radar name="就业" dataKey="就业" stroke="#b45309" fill="#b45309" fillOpacity={0.2} />
                  <Radar name="考公" dataKey="考公" stroke="#2563eb" fill="#2563eb" fillOpacity={0.16} />
                  <Radar name="考研" dataKey="考研" stroke="#0f766e" fill="#0f766e" fillOpacity={0.16} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">这份报告暂未包含维度对比数据，请重新生成报告后查看。</div>
            )}
          </div>
        </div>
      </section>
      <section className="surface">
        <SectionTitle icon={ClipboardList} title="30/60/90 天行动计划" />
        {planRows.length > 0 ? (
          <div className="plan-grid">
            {planRows.map((item) => (
              <article className="plan-item" key={item.stage}>
                <strong>{item.stage}</strong>
                <ul className="plan-action-list">
                  {item.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">这份报告暂未返回行动计划，请重新生成报告。</div>
        )}
      </section>
      <section className="content-grid split">
        <div className="surface">
          <SectionTitle icon={AlertTriangle} title="主要风险" />
          <div className="info-list">
            {riskRows.map((risk) => <p key={risk}>{risk}</p>)}
            {riskRows.length === 0 && <div className="empty-state">这份报告暂未返回风险提醒。</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={Route} title="备选方案" />
          <div className="info-list">
            {alternativeRows.map((item) => <p key={item}>{item}</p>)}
            {alternativeRows.length === 0 && <div className="empty-state">这份报告暂未返回备选方案。</div>}
          </div>
        </div>
      </section>
        </>
      )}
          <section className="report-export-footer">
            <strong>免责声明</strong>
            <p>{currentReport.disclaimer || "AI 报告仅供辅助决策，不替代学生最终选择。"}</p>
            <span>导出时间：{new Date().toLocaleString("zh-CN")}</span>
          </section>
        </div>
        {exportError && <p className="form-error">{exportError}</p>}
      <section className="surface ai-chat">
        <SectionTitle icon={Bot} title="报告追问" />
        <div className="chat-history">
          {chatAnswers.length === 0 && (
            <div className="message assistant">围绕当前报告继续追问，我会结合报告正文和你的补充问题继续分析。</div>
          )}
          {chatAnswers.map((item) => {
            const answerText = item.answer.answerText?.trim()
              || [item.answer.questionUnderstanding, item.answer.advice?.join("；"), item.answer.reminders?.join("；")]
                .filter(Boolean)
                .join("\n\n");
            return (
              <div className="chat-pair" key={item.question}>
                <div className="message user">{item.question}</div>
                <div className="message assistant report-chat-answer">
                  {answerText}
                </div>
              </div>
            );
          })}
        </div>
        {chatError && <p className="form-error">{chatError}</p>}
        <div className="chat-input">
          <input value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="围绕当前报告继续追问" />
          <button className="primary-button" title="发送" onClick={askReport} disabled={chatLoading || !currentReport}>
            <Send size={17} />
            {chatLoading ? "发送中" : "发送"}
          </button>
        </div>
      </section>
          </div>
        </section>
      )}
    </div>
  );
}

function PathsView({
  report,
  session,
  onLogin,
  selectedPathKey,
  onSelectedPathKeyChange,
  onOpenChart,
  onOpenCommunityPost
}: {
  report: AiReport | null;
  session: Session | null;
  onLogin: () => void;
  selectedPathKey: string;
  onSelectedPathKeyChange: (key: string) => void;
  onOpenChart: (chart: ChartItem) => void;
  onOpenCommunityPost: (post: CommunityPost) => void;
}) {
  const [paths, setPaths] = useState<PathInfo[]>([]);
  const [pathPage, setPathPage] = useState<PathPage | null>(null);
  const [pathCharts, setPathCharts] = useState<ChartItem[]>([]);
  const [pathPosts, setPathPosts] = useState<CommunityPost[]>([]);
  const [contentFavoriteIds, setContentFavoriteIds] = useState<Set<string>>(new Set());
  const [pathSection, setPathSection] = useState<"overview" | "info" | "plan" | "templates" | "experience">("overview");
  const [pathError, setPathError] = useState("");
  const selected = paths.find((path) => path.key === selectedPathKey) || paths[0] || null;
  const selectedScore = selected ? reportScoreForPath(report, selected.name) ?? selected.match : 0;
  const reportScoreRows = pathScoreRows(report, paths);
  const scoreRadarRows = reportScoreRows.map((item) => ({ path: item.name, score: item.score }));
  const selectedReportScore = selected ? reportScoreRows.find((item) => item.name === selected.name) : null;

  useEffect(() => {
    publicApi.paths()
      .then((pages) => {
        const next = pages.map(pathPageToInfo);
        setPaths(next);
        if (!selectedPathKey && next[0]) onSelectedPathKeyChange(next[0].key);
      })
      .catch(() => setPathError("内容加载失败，请刷新重试"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPathError("");
    publicApi.path(selected.key).then(setPathPage).catch(() => {
      setPathPage(null);
      setPathError("内容加载失败，请刷新重试");
    });
    api<ChartItem[]>(`/api/charts?path=${encodeURIComponent(selected.name)}`).then(setPathCharts).catch(() => setPathCharts([]));
    communityApi.list({ path: selected.name }).then(setPathPosts).catch(() => setPathPosts([]));
    if (session?.token) {
      studentApi.recordActivity(session.token, "path", selected.key, `${selected.name}路径页`, `/paths/${selected.key}`).catch(() => undefined);
    }
  }, [selected?.key, selected?.name, session?.token]);

  useEffect(() => {
    if (!session?.token) {
      setContentFavoriteIds(new Set());
      return;
    }
    studentApi.favorites(session.token)
      .then((items) => setContentFavoriteIds(new Set(items.filter((item) => item.itemType === "content").map((item) => item.itemId))))
      .catch(() => undefined);
  }, [session?.token]);

  async function toggleContentFavorite(item: ContentItem) {
    if (!session?.token) {
      onLogin();
      return;
    }
    const result = await studentApi.toggleFavorite(session.token, "content", String(item.id), item.title, item.sourceUrl || `/paths/${selected?.key || ""}`);
    setContentFavoriteIds((current) => {
      const next = new Set(current);
      if (result.active) next.add(String(item.id));
      else next.delete(String(item.id));
      return next;
    });
  }

  if (!selected) {
    return (
      <div className="page-stack">
        {pathError && <p className="form-error">{pathError}</p>}
        <section className="surface">
          <SectionTitle icon={Route} title="三路径配置" />
          <div className="empty-state">敬请期待</div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {pathError && <p className="form-error">{pathError}</p>}
      <section className="segmented" aria-label="路径切换">
        {paths.map((path) => (
          <button
            key={path.key}
            className={selected.key === path.key ? "active" : ""}
            onClick={() => onSelectedPathKeyChange(path.key)}
          >
            {path.name}
          </button>
        ))}
      </section>
      <section className="path-focus-bar" style={{ borderLeftColor: selected.accent }}>
        <div className="path-heading">
          <div>
            <p className="eyebrow">当前路线</p>
            <h2>{selected.name}</h2>
          </div>
          <div className="match-badge" style={{ color: selected.accent }}>
            {selectedScore}
            <small>{report ? "报告评分" : "匹配度"}</small>
          </div>
        </div>
      </section>
      <section className="segmented path-subtabs" aria-label="路径子页面">
        {[
          ["overview", "首页"],
          ["info", selected.name === "考研" ? "院校专业" : selected.name === "考公" ? "招考信息" : "行业岗位"],
          ["plan", selected.name === "考研" ? "择校复习" : selected.name === "考公" ? "岗位备考" : "求职准备"],
          ["templates", "资料下载"],
          ["experience", "经验交流"]
        ].map(([key, label]) => (
          <button key={key} className={pathSection === key ? "active" : ""} onClick={() => setPathSection(key as typeof pathSection)}>{label}</button>
        ))}
      </section>
      {(pathSection === "overview" || pathSection === "plan") && (
        <section className="content-grid three path-overview-grid">
          <InfoList title="适合人群" items={pathPage?.suitable || selected.suitable} />
          <InfoList title="流程概览" items={pathPage?.timeline || selected.timeline} />
          <InfoList title="常见风险" items={pathPage?.pitfalls || selected.pitfalls} />
        </section>
      )}
      {pathSection === "templates" && (
      <section className="surface path-template-spotlight">
        <SectionTitle icon={Download} title={`${selected.name}路线资料模板`} />
        <ResourceTable filter={selected.name} session={session} onLogin={onLogin} />
      </section>
      )}
      {(pathSection === "overview" || pathSection === "info") && (
      <section className="content-grid path-news-layout">
        <div className="surface path-news-main">
          <SectionTitle icon={FileText} title={`${selected.name}最新审核资讯`} />
          <div className="queue-list">
            {(pathPage?.highlights || []).slice(0, 12).map((item) => (
              <div className="queue-item path-news-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.source || "公开来源"} · 更新 {formatAdminTime(item.updatedAt)}</span>
                  <p>{item.summary}</p>
                </div>
                {item.sourceUrl && (
                  <div className="button-row compact-actions">
                    <button className="icon-button" title={contentFavoriteIds.has(String(item.id)) ? "已收藏" : "收藏资讯"} onClick={() => toggleContentFavorite(item)}>
                      <Star size={16} fill={contentFavoriteIds.has(String(item.id)) ? "currentColor" : "none"} />
                    </button>
                    <button className="icon-button" title="查看来源" onClick={() => window.open(item.sourceUrl, "_blank", "noopener,noreferrer")}>
                      <ExternalLink size={16} />
                    </button>
                  </div>
                )}
                {!item.sourceUrl && (
                  <button className="icon-button" title={contentFavoriteIds.has(String(item.id)) ? "已收藏" : "收藏资讯"} onClick={() => toggleContentFavorite(item)}>
                    <Star size={16} fill={contentFavoriteIds.has(String(item.id)) ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            ))}
            {(!pathPage?.highlights || pathPage.highlights.length === 0) && <div className="empty-state">敬请期待</div>}
          </div>
        </div>
        <aside className="path-side-stack">
          <div className="surface path-report-panel">
            <SectionTitle icon={Sparkles} title="AI 报告推荐评分" />
            <div className="chart-box compact path-score-radar">
              {scoreRadarRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={scoreRadarRows}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="path" />
                    <Radar name={report ? "报告评分" : "基础匹配"} dataKey="score" stroke="#172033" fill="#172033" fillOpacity={0.16} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">生成 AI 报告后会显示动态推荐评分。</div>
              )}
            </div>
            <div className="score-list compact-score-list">
              {reportScoreRows.map((item) => (
                <div className={item.name === selected.name ? "score-row selected-score-row" : "score-row"} key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.rank}</span>
                  </div>
                  <div className="score-track">
                    <span style={{ width: `${item.score}%`, background: item.color }} />
                  </div>
                  <b>{item.score}</b>
                </div>
              ))}
            </div>
            {selectedReportScore?.reasons.length ? (
              <div className="path-score-reasons">
                {selectedReportScore.reasons.slice(0, 3).map((reason) => <span key={reason}>{reason}</span>)}
              </div>
            ) : (
              <p className="helper-text">完成 AI 访谈后，这里会随报告内容变化。</p>
            )}
          </div>
          <div className="surface">
            <SectionTitle icon={BarChart3} title="相关图表" />
            <div className="queue-list">
              {pathCharts.slice(0, 5).map((chart) => (
                <div
                  className="queue-item clickable-row"
                  key={chart.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenChart(chart)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onOpenChart(chart);
                  }}
                >
                  <div>
                    <strong>{chart.title}</strong>
                    <span>{chart.chartType} · {chart.sourceName}</span>
                    <small>{chart.methodology}</small>
                  </div>
                  <Search size={16} />
                </div>
              ))}
              {pathCharts.length === 0 && <div className="empty-state">敬请期待</div>}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={MessagesSquare} title="路径经验与问答" />
            <PostList posts={pathPosts.slice(0, 3)} onOpen={onOpenCommunityPost} showActions={false} clickable emptyLabel="敬请期待" />
          </div>
        </aside>
      </section>
      )}
      {pathSection === "experience" && (
        <section className="surface">
          <SectionTitle icon={MessagesSquare} title={`${selected.name}经验交流`} />
          <PostList posts={pathPosts} onOpen={onOpenCommunityPost} showActions={false} clickable emptyLabel="敬请期待" />
        </section>
      )}
    </div>
  );
}

function ChartsView({
  session,
  openChartId,
  onBackToPaths
}: {
  session: Session | null;
  openChartId?: number | null;
  onBackToPaths?: () => void;
}) {
  const [chartItems, setChartItems] = useState<ChartItem[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null);
  const [pathFilter, setPathFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [majorFilter, setMajorFilter] = useState("");

  useEffect(() => {
    if (!openChartId) {
      setSelectedChartId(null);
      return;
    }
    setSelectedChartId(openChartId);
    setPathFilter("");
    setTypeFilter("");
    setCollegeFilter("");
    setMajorFilter("");
  }, [openChartId]);

  useEffect(() => {
    publicApi.charts({
      path: pathFilter,
      college: collegeFilter,
      major: majorFilter
    }).then(setChartItems).catch(() => undefined);
    if (session?.token) {
      studentApi.recordActivity(session.token, "chart", pathFilter || "all", `${pathFilter || "全部"}图表中心`, "/charts").catch(() => undefined);
    }
  }, [pathFilter, collegeFilter, majorFilter, session?.token]);

  const visibleCharts = useMemo(
    () => chartItems.filter((chart) => !typeFilter || chart.chartType === typeFilter),
    [chartItems, typeFilter]
  );
  const selectedChart = selectedChartId ? chartItems.find((chart) => chart.id === selectedChartId) || null : null;

  const sourceCount = useMemo(
    () => new Set(visibleCharts.map((chart) => chart.sourceName).filter(Boolean)).size,
    [visibleCharts]
  );

  const latestUpdated = useMemo(() => {
    const timestamps = visibleCharts
      .map((chart) => new Date(chart.updatedAt).getTime())
      .filter((time) => !Number.isNaN(time));
    if (timestamps.length === 0) return "无记录";
    return formatAdminTime(new Date(Math.max(...timestamps)).toISOString());
  }, [visibleCharts]);

  function rowsOf(chart: ChartItem) {
    const rows = chart.data?.rows;
    return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
  }

  function xKeyOf(chart: ChartItem, fallback: string) {
    return typeof chart.data?.xKey === "string" ? chart.data.xKey : fallback;
  }

  function chartSeriesOf(chart: ChartItem, fallbackKeys: string[]): ChartSeries[] {
    const declared = chart.data?.series;
    if (Array.isArray(declared)) {
      const series = declared
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.key === "string")
        .map((item, index) => ({
          key: String(item.key),
          name: typeof item.name === "string" ? item.name : String(item.key),
          color: typeof item.color === "string" ? item.color : chartPalette[index % chartPalette.length]
        }));
      if (series.length > 0) return series;
    }
    return fallbackKeys.map((key, index) => ({
      key,
      name: key,
      color: pathColor(key) || chartPalette[index % chartPalette.length]
    }));
  }

  function chartInsights(chart: ChartItem) {
    const insights = chart.data?.insights;
    return Array.isArray(insights)
      ? insights.map((item) => String(item)).filter(Boolean).slice(0, 4)
      : [];
  }

  function renderChart(chart: ChartItem) {
    const rows = rowsOf(chart);
    if (rows.length === 0) return null;
    if (chart.chartType.includes("趋势")) {
      const series = chartSeriesOf(chart, ["就业", "考研", "考公"]);
      return (
        <LineChart data={rows} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
          <XAxis dataKey={xKeyOf(chart, "year")} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((item) => (
            <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={3} />
          ))}
        </LineChart>
      );
    }
    if (chart.chartType.includes("柱")) {
      const series = chartSeriesOf(chart, ["就业", "考研", "考公"]);
      return (
        <BarChart data={rows} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
          <XAxis dataKey={xKeyOf(chart, "label")} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
    }
    if (chart.chartType.includes("环") || chart.chartType.includes("饼")) {
      const nameKey = typeof chart.data?.nameKey === "string" ? chart.data.nameKey : "path";
      const valueKey = typeof chart.data?.valueKey === "string" ? chart.data.valueKey : "score";
      const data = rows.map((row) => ({
        name: String(row[nameKey] || row.name || "未命名"),
        value: Number(row[valueKey] || row.value || 0),
        color: typeof row.color === "string" ? row.color : pathColor(String(row[nameKey] || row.name || ""))
      }));
      return (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={110} innerRadius={58} paddingAngle={4}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      );
    }
    if (chart.chartType.includes("雷达")) {
      const series = chartSeriesOf(chart, ["就业", "考研", "考公"]);
      return (
        <RadarChart data={rows}>
          <PolarGrid />
          <PolarAngleAxis dataKey={xKeyOf(chart, "subject")} />
          {series.map((item) => (
            <Radar key={item.key} name={item.name} dataKey={item.key} stroke={item.color} fill={item.color} fillOpacity={0.16} />
          ))}
          <Legend />
          <Tooltip />
        </RadarChart>
      );
    }
    return null;
  }

  function renderChartCard(chart: ChartItem, detail = false) {
    const rows = rowsOf(chart);
    const chartNode = renderChart(chart);
    const insights = chartInsights(chart);
    return (
      <div className="surface" key={chart.id}>
        <SectionTitle icon={BarChart3} title={chart.title} />
        {chart.chartType.includes("时间线") ? (
          <div className="queue-list timeline-chart">
            {rows.map((row) => (
              <div className="queue-item" key={String(row.stage)}>
                <div>
                  <strong>{String(row.stage)}</strong>
                  <span>{String(row.description)}</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="empty-state">这张时间线暂无 data.rows。</div>}
          </div>
        ) : (
          <div className={detail ? "chart-box detail-chart-box" : "chart-box"}>
            {chartNode ? (
              <ResponsiveContainer width="100%" height={detail ? 420 : 330}>
                {chartNode}
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">这张图表暂无可渲染数据，请在后台补充 data.rows。</div>
            )}
          </div>
        )}
        {insights.length > 0 && (
          <div className="chart-insights">
            {insights.map((insight) => <span key={insight}>{insight}</span>)}
          </div>
        )}
        <p className="source-line">
          来源：
          {chart.sourceUrl ? (
            <a className="source-link" href={chart.sourceUrl} target="_blank" rel="noreferrer">{chart.sourceName}<ExternalLink size={12} /></a>
          ) : chart.sourceName}
          ；口径：{chart.methodology}；更新：{formatAdminTime(chart.updatedAt)}。
        </p>
      </div>
    );
  }

  if (selectedChartId) {
    return (
      <div className="page-stack">
        <section className="surface">
          {onBackToPaths && (
            <div className="detail-toolbar">
              <button className="secondary-button" onClick={onBackToPaths}>
                <ArrowLeft size={16} />
                返回三路径
              </button>
            </div>
          )}
          <SectionTitle icon={BarChart3} title="图表详情" />
          {selectedChart ? (
            <div className="chart-detail-meta">
              <span>{selectedChart.chartType}</span>
              <span>{selectedChart.path}</span>
              <span>{selectedChart.sourceName}</span>
            </div>
          ) : (
            <div className="empty-state">正在加载图表详情...</div>
          )}
        </section>
        {selectedChart && renderChartCard(selectedChart, true)}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <SectionTitle icon={SlidersHorizontal} title="图表筛选" />
        <div className="filter-row">
          <select value={pathFilter} onChange={(event) => setPathFilter(event.target.value)}>
            <option value="">全部路径</option>
            <option value="就业">就业</option>
            <option value="考公">考公</option>
            <option value="考研">考研</option>
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">全部图表类型</option>
            <option value="趋势图">趋势图</option>
            <option value="柱状图">柱状图</option>
            <option value="环图">饼图/环图</option>
            <option value="雷达图">雷达图</option>
            <option value="时间线图">时间线图</option>
          </select>
          <input value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)} placeholder="学院筛选" />
          <input value={majorFilter} onChange={(event) => setMajorFilter(event.target.value)} placeholder="专业筛选" />
        </div>
        <div className="chart-summary-strip">
          <span>当前展示 {visibleCharts.length} 张图表</span>
          <span>覆盖 {sourceCount} 个真实数据源</span>
          <span>最近更新 {latestUpdated}</span>
        </div>
      </section>
      <section className="content-grid two">
        {visibleCharts.map((chart) => renderChartCard(chart))}
      </section>
      <section className="surface">
        <SectionTitle icon={Database} title="已发布图表配置" />
        <div className="queue-list">
          {visibleCharts.map((chart) => (
            <div className="queue-item" key={chart.id}>
              <div>
                <strong>{chart.title}</strong>
                <span>{chart.chartType} · {chart.path} · {chart.sourceName} · {chart.updatedAt}</span>
              </div>
              <StatusPill status={chart.status} />
            </div>
          ))}
          {visibleCharts.length === 0 && <div className="empty-state">当前筛选条件下暂无图表，来源与口径会在有数据时同步展示。</div>}
        </div>
      </section>
    </div>
  );
}

function CommunityView({
  session,
  onLogin,
  setNotice,
  openPostId,
  detailOnly = false,
  onOpenedPost,
  onBackToPaths
}: {
  session: Session | null;
  onLogin: () => void;
  setNotice: (message: string) => void;
  openPostId?: number | null;
  detailOnly?: boolean;
  onOpenedPost?: () => void;
  onBackToPaths?: () => void;
}) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [composePath, setComposePath] = useState("就业");
  const [composeType, setComposeType] = useState("问答");
  const [path, setPath] = useState("");
  const [type, setType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("latest");
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyToComment, setReplyToComment] = useState<CommunityComment | null>(null);
  const [ownPosts, setOwnPosts] = useState<CommunityPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PostDraft>(emptyPostDraft);
  const [editSaving, setEditSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [publicProfile, setPublicProfile] = useState<CommunityPublicProfile | null>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState("");
  const [error, setError] = useState("");
  const ownPostIds = useMemo(() => new Set(ownPosts.map((post) => post.id)), [ownPosts]);

  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);

  useEffect(() => {
    communityApi.list({ path, type, keyword, sort }, session?.token).then(setPosts).catch(() => undefined);
  }, [path, type, keyword, sort, session?.token]);

  useEffect(() => {
    if (!session?.token) {
      setOwnPosts([]);
      setEditingPostId(null);
      return;
    }
    refreshOwnPosts(session.token).catch(() => undefined);
  }, [session?.token]);

  useEffect(() => {
    if (!openPostId) return;
    openPostById(openPostId).finally(() => onOpenedPost?.());
  }, [openPostId]);

  async function refreshOwnPosts(token = session?.token) {
    if (!token) return;
    const next = await api<Record<string, CommunityPost[]>>("/api/user/community", {}, token);
    setOwnPosts(next.posts || []);
  }

  async function openPost(post: CommunityPost) {
    await openPostById(post.id, post.title);
  }

  async function openAuthorProfile(authorId?: number) {
    if (!authorId) return;
    try {
      const profile = await communityApi.userProfile(authorId, session?.token);
      setPublicProfile(profile);
      setSelectedPost(null);
      setComments([]);
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "用户主页暂不可用");
    }
  }

  async function openPostById(postId: number, fallbackTitle = "社区内容") {
    const detail = await communityApi.detail(postId, session?.token);
    setSelectedPost(detail);
    setPublicProfile(null);
    setComments(await communityApi.comments(postId));
    if (session?.token) {
      studentApi.recordActivity(session.token, "post", String(postId), detail.title || fallbackTitle, `/community/${postId}`).catch(() => undefined);
    }
  }

  function addImageFiles(files: FileList | null) {
    if (!files) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const nextFiles = Array.from(files);
    if (imageFiles.length + nextFiles.length > 3) {
      setError("每条内容最多添加 3 张图片");
      return;
    }
    const invalid = nextFiles.find((file) => !allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setError("图片仅支持 JPG、PNG、WebP、GIF，单张不超过 5MB");
      return;
    }
    setError("");
    setImageFiles((current) => [...current, ...nextFiles]);
  }

  function removeImageFile(index: number) {
    setImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function addPost() {
    if (!session) {
      onLogin();
      return;
    }
    if (!title.trim() || !body.trim()) return;
    setError("");
    setUploadingImages(true);
    try {
      const imageUrls = imageFiles.length ? await communityApi.uploadImages(session.token, imageFiles) : [];
      const next = await communityApi.create(session.token, title, body, composePath, composeType, true, imageUrls);
      setPosts(await communityApi.list({ path, type, keyword, sort }, session.token));
      setOwnPosts((current) => [next, ...current.filter((post) => post.id !== next.id)]);
      setSelectedPost(next);
      setTitle("");
      setBody("");
      setImageFiles([]);
      setNotice("内容已提交审核，审核通过后会公开展示");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "发布失败");
    } finally {
      setUploadingImages(false);
    }
  }

  function beginEdit(post: CommunityPost) {
    if (!session) {
      onLogin();
      return;
    }
    setSelectedPost(post);
    setEditDraft(draftFromPost(post));
    setEditingPostId(post.id);
    setError("");
  }

  function cancelEdit() {
    setEditingPostId(null);
    setEditDraft(emptyPostDraft);
  }

  function closePostDetail() {
    setSelectedPost(null);
    setPublicProfile(null);
    setComments([]);
    setCommentBody("");
    setReplyToComment(null);
    cancelEdit();
  }

  async function saveEdit() {
    if (!session || editingPostId === null) {
      onLogin();
      return;
    }
    if (!editDraft.title.trim() || !editDraft.body.trim()) {
      setError("标题和正文不能为空");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      const updated = await communityApi.update(
        session.token,
        editingPostId,
        editDraft.title,
        editDraft.body,
        editDraft.path,
        editDraft.type,
        editDraft.anonymous,
        editDraft.imageUrls
      );
      setOwnPosts((current) => [updated, ...current.filter((post) => post.id !== updated.id)]);
      setPosts(await communityApi.list({ path, type, keyword, sort }, session.token));
      setSelectedPost(updated);
      setEditingPostId(null);
      setNotice("内容已重新提交审核，审核通过后会再次公开展示");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "保存失败");
    } finally {
      setEditSaving(false);
    }
  }

  async function deletePost(post: CommunityPost) {
    if (!session) {
      onLogin();
      return;
    }
    if (!window.confirm("确认删除这条内容？删除后前台不再展示，后台会保留审计记录。")) return;
    await communityApi.remove(session.token, post.id);
    setPosts((current) => current.filter((item) => item.id !== post.id));
    setOwnPosts((current) => current.filter((item) => item.id !== post.id));
    if (selectedPost?.id === post.id) setSelectedPost(null);
    if (editingPostId === post.id) cancelEdit();
    setNotice("内容已删除，审计记录已保留");
  }

  async function interact(postId: number, action: "like" | "favorite") {
    if (!session) {
      onLogin();
      return;
    }
    const result = await communityApi.interact(session.token, postId, action);
    const active = Boolean(result.active);
    const patchInteraction = (post: CommunityPost) => {
      if (post.id !== postId) return post;
      if (action === "like") {
        const delta = Boolean(post.liked) === active ? 0 : active ? 1 : -1;
        return { ...post, liked: active, likes: Math.max(0, post.likes + delta) };
      }
      const delta = Boolean(post.favorited) === active ? 0 : active ? 1 : -1;
      return { ...post, favorited: active, favorites: Math.max(0, post.favorites + delta) };
    };
    setPosts((current) => current.map(patchInteraction));
    setOwnPosts((current) => current.map(patchInteraction));
    setSelectedPost((current) => current ? patchInteraction(current) : current);
  }

  function report(targetId: number, targetType: "post" | "comment" = "post") {
    if (!session) {
      onLogin();
      return;
    }
    setReportError("");
    setReportDraft({
      targetId,
      targetType,
      reason: reportReasonOptions[0],
      detail: ""
    });
  }

  async function submitReport() {
    if (!session || !reportDraft) {
      onLogin();
      return;
    }
    const detail = reportDraft.detail.trim();
    if (!reportDraft.reason || !detail) {
      setReportError("请选择举报原因，并填写补充说明");
      return;
    }
    setReportSaving(true);
    setReportError("");
    try {
      await communityApi.report(
        session.token,
        reportDraft.targetId,
        `${reportDraft.reason}：${detail}`,
        reportDraft.targetType
      );
      setReportDraft(null);
      setNotice("举报已提交，后台会保留处理记录");
    } catch (exception) {
      setReportError(exception instanceof Error ? exception.message : "举报提交失败");
    } finally {
      setReportSaving(false);
    }
  }

  async function addComment() {
    if (!session) {
      onLogin();
      return;
    }
    if (!selectedPost || !commentBody.trim()) return;
    await communityApi.comment(session.token, selectedPost.id, commentBody, replyToComment?.id);
    setCommentBody("");
    setReplyToComment(null);
    setComments(await communityApi.comments(selectedPost.id));
    setNotice("回复已发布");
  }

  async function bestAnswer(commentId: number, active: boolean) {
    if (!session || !selectedPost) {
      onLogin();
      return;
    }
    await communityApi.bestAnswer(session.token, commentId, active);
    setComments(await communityApi.comments(selectedPost.id));
    setNotice("最佳回答已更新");
  }

  return (
    <div className="page-stack community-page">
      {reportDraft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !reportSaving) setReportDraft(null);
        }}>
          <section className="auth-modal report-modal" role="dialog" aria-modal="true" aria-label="提交举报">
            <div className="modal-title-row">
              <SectionTitle icon={Flag} title={reportDraft.targetType === "comment" ? "举报评论" : "举报帖子"} />
              <button className="icon-button" title="关闭" onClick={() => setReportDraft(null)} disabled={reportSaving}>
                <X size={16} />
              </button>
            </div>
            <label>
              <span>举报原因</span>
              <select value={reportDraft.reason} onChange={(event) => setReportDraft({ ...reportDraft, reason: event.target.value })}>
                {reportReasonOptions.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>补充说明</span>
              <textarea
                value={reportDraft.detail}
                onChange={(event) => setReportDraft({ ...reportDraft, detail: event.target.value })}
                placeholder="请说明你看到的问题，便于后台审核处理"
                rows={4}
              />
            </label>
            {reportError && <p className="form-error">{reportError}</p>}
            <div className="button-row">
              <button className="primary-button" onClick={submitReport} disabled={reportSaving}>
                <Flag size={16} />
                {reportSaving ? "提交中..." : "提交举报"}
              </button>
              <button className="secondary-button" onClick={() => setReportDraft(null)} disabled={reportSaving}>取消</button>
            </div>
          </section>
        </div>
      )}
      {!detailOnly && !selectedPost && !publicProfile && (
        <>
          <section className="surface community-composer">
            <SectionTitle icon={Plus} title="发布帖子或提问" />
            <div className="community-composer-layout">
              <div className="community-compose-fields">
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入标题，发布后进入审核流程" />
                <textarea
                  className="community-body-input"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="输入正文，至少 10 个字符"
                  rows={7}
                />
                <div className="image-upload-panel">
                  <label className="image-upload-button">
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => {
                      addImageFiles(event.target.files);
                      event.target.value = "";
                    }} />
                    <Plus size={16} />
                    添加图片
                  </label>
                  <span>最多 3 张，单张不超过 5MB</span>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="image-preview-grid">
                    {imagePreviews.map((src, index) => (
                      <div className="image-preview-item" key={src}>
                        <img src={src} alt={`待上传图片 ${index + 1}`} />
                        <button type="button" className="image-remove-button" title="移除图片" onClick={() => removeImageFile(index)}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="community-compose-meta">
                <label>
                  <span>路径</span>
                  <select value={composePath} onChange={(event) => setComposePath(event.target.value)}>
                    <option value="就业">就业</option>
                    <option value="考公">考公</option>
                    <option value="考研">考研</option>
                  </select>
                </label>
                <label>
                  <span>类型</span>
                  <select value={composeType} onChange={(event) => setComposeType(event.target.value)}>
                    <option value="问答">问答</option>
                    <option value="经验帖">经验帖</option>
                  </select>
                </label>
                <button className="primary-button full-width" onClick={addPost} disabled={uploadingImages}>
                  <Plus size={17} />
                  {uploadingImages ? "上传中" : session ? "发布" : "登录后发布"}
                </button>
              </div>
            </div>
            {error && <p className="form-error">{error}</p>}
          </section>
          <section className="surface community-feed">
            <div className="community-feed-head">
              <SectionTitle icon={MessagesSquare} title="社区内容" />
              <span>{posts.length} 条内容</span>
            </div>
            <div className="filter-row community-filter-row">
              <select value={path} onChange={(event) => setPath(event.target.value)}>
                <option value="">全部路径</option>
                <option value="就业">就业</option>
                <option value="考公">考公</option>
                <option value="考研">考研</option>
              </select>
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">全部类型</option>
                <option value="经验帖">经验帖</option>
                <option value="问答">问答</option>
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="latest">最新</option>
                <option value="hot">热度</option>
                <option value="featured">精选</option>
              </select>
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题或正文" />
            </div>
            <PostList
              posts={posts}
              interactive
              manageableIds={ownPostIds}
              clickable
              onOpen={openPost}
              onLike={(id) => interact(id, "like")}
              onFavorite={(id) => interact(id, "favorite")}
              onReport={report}
              onEdit={beginEdit}
              onDelete={deletePost}
              onAuthor={openAuthorProfile}
            />
          </section>
        </>
      )}
      {publicProfile && (
        <section className="surface community-detail">
          <div className="detail-toolbar">
            <button className="secondary-button" onClick={closePostDetail}>
              <ArrowLeft size={16} />
              返回社区
            </button>
          </div>
          <SectionTitle icon={UserRound} title="用户主页" />
          <div className="profile-summary-grid">
            <div>
              <h2>{publicProfile.displayName}</h2>
              <small>加入时间 {publicProfile.joinedAt}</small>
            </div>
            <span>公开帖子 {publicProfile.posts}</span>
            <span>评论 {publicProfile.comments}</span>
            <span>获赞 {publicProfile.likes}</span>
          </div>
          <PostList
            posts={publicProfile.recentPosts}
            clickable
            onOpen={openPost}
            onAuthor={openAuthorProfile}
            showActions={false}
          />
        </section>
      )}
      {detailOnly && !selectedPost && (
        <section className="surface community-detail">
          {onBackToPaths && (
            <div className="detail-toolbar">
              <button className="secondary-button" onClick={onBackToPaths}>
                <ArrowLeft size={16} />
                返回三路径
              </button>
            </div>
          )}
          <SectionTitle icon={MessagesSquare} title="内容详情" />
          <div className="empty-state">正在加载内容详情...</div>
        </section>
      )}
      {selectedPost && (
        <section className="surface community-detail">
          {(detailOnly ? onBackToPaths : closePostDetail) && (
            <div className="detail-toolbar">
              <button className="secondary-button" onClick={detailOnly ? onBackToPaths : closePostDetail}>
                <ArrowLeft size={16} />
                {detailOnly ? "返回三路径" : "返回社区"}
              </button>
            </div>
          )}
          <SectionTitle icon={MessagesSquare} title="内容详情" />
          <div className="detail-head">
            <div>
              <div className="post-meta">
                <span>{selectedPost.type}</span>
                <span>{selectedPost.path}</span>
                <StatusPill status={selectedPost.status} />
              </div>
              <h2>{selectedPost.title}</h2>
              <p className="community-detail-body">{selectedPost.body}</p>
              <PostImageGrid imageUrls={selectedPost.imageUrls} detail />
              <small>
                {selectedPost.authorId ? (
                  <button type="button" className="text-button inline-author-link" onClick={() => openAuthorProfile(selectedPost.authorId)}>
                    {selectedPost.authorDisplay || "匿名用户"}
                  </button>
                ) : (selectedPost.authorDisplay || "匿名用户")}
                {" · "}{selectedPost.createdAt}
              </small>
              <div className="post-actions detail-actions">
                <button
                  className={selectedPost.liked ? "icon-button active-interaction" : "icon-button"}
                  title={selectedPost.liked ? "已点赞" : "点赞"}
                  aria-pressed={Boolean(selectedPost.liked)}
                  onClick={() => interact(selectedPost.id, "like")}
                >
                  <Heart size={16} fill={selectedPost.liked ? "currentColor" : "none"} />
                  <span>{selectedPost.likes}</span>
                </button>
                <button
                  className={selectedPost.favorited ? "icon-button active-interaction" : "icon-button"}
                  title={selectedPost.favorited ? "已收藏" : "收藏"}
                  aria-pressed={Boolean(selectedPost.favorited)}
                  onClick={() => interact(selectedPost.id, "favorite")}
                >
                  <Star size={16} fill={selectedPost.favorited ? "currentColor" : "none"} />
                  <span>{selectedPost.favorites}</span>
                </button>
              </div>
              {ownPostIds.has(selectedPost.id) && (
                <div className="button-row compact-actions">
                  <button className="secondary-button" onClick={() => beginEdit(selectedPost)}>
                    <PenLine size={16} />
                    编辑
                  </button>
                  <button className="secondary-button danger-button" onClick={() => deletePost(selectedPost)}>
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              )}
            </div>
          </div>
          {editingPostId === selectedPost.id && (
            <PostEditor
              draft={editDraft}
              onChange={setEditDraft}
              onSave={saveEdit}
              onCancel={cancelEdit}
              saving={editSaving}
            />
          )}
          <div className="comment-box">
            {replyToComment && (
              <span className="reply-target">
                回复 {replyToComment.authorDisplay}
                <button className="text-button" onClick={() => setReplyToComment(null)}>取消</button>
              </span>
            )}
            <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="写下回复，问答作者可设置最佳回答" />
            <button className="primary-button" onClick={addComment}>回复</button>
          </div>
          <div className="queue-list">
            {comments.map((comment) => (
              <div className="queue-item" key={comment.id}>
                <div>
                  <strong>{comment.authorDisplay}{comment.bestAnswer ? " · 最佳回答" : ""}</strong>
                  <span>{comment.parentCommentId ? `回复 #${comment.parentCommentId}：` : ""}{comment.body}</span>
                </div>
                <div className="button-row compact-actions">
                  <button className="secondary-button" onClick={() => setReplyToComment(comment)}>回复</button>
                  <button className="secondary-button" onClick={() => report(comment.id, "comment")}>
                    <Flag size={15} />
                    举报
                  </button>
                  {selectedPost.type === "问答" && (
                    <button className="secondary-button" onClick={() => bestAnswer(comment.id, !comment.bestAnswer)}>
                      {comment.bestAnswer ? "取消最佳" : "设为最佳"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="empty-state">暂无回复</div>}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminView() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [students, setStudents] = useState<StudentAdminItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [candidates, setCandidates] = useState<CrawlCandidateItem[]>([]);
  const [crawlTasks, setCrawlTasks] = useState<CrawlTaskItem[]>([]);
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [pathConfigs, setPathConfigs] = useState<PathConfigItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [aiConfigs, setAiConfigs] = useState<AiConfigItem[]>([]);
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
  const [reviewComments, setReviewComments] = useState<CommunityComment[]>([]);
  const [communityUsers, setCommunityUsers] = useState<CommunityUserAdminItem[]>([]);
  const [admin, setAdmin] = useState<AdminSession | null>(() => {
    const token = localStorage.getItem("career-compass-admin-token");
    return token ? { token, role: "admin", displayName: "系统管理员" } : null;
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [adminBusy, setAdminBusy] = useState("");
  const [adminTab, setAdminTab] = useState<"overview" | "users" | "contents" | "review" | "sources" | "paths" | "charts" | "tags" | "ai">("overview");
  const [sourceForm, setSourceForm] = useState({ id: undefined as number | undefined, name: "", url: "", type: "公开权威数据", path: "就业", frequency: "每日", trustLevel: "中", status: "启用", fallbackUrlsText: "" });
  const [contentForm, setContentForm] = useState({ id: undefined as number | undefined, title: "首页公告", category: "公告", summary: "请完成 AI 访谈并生成报告。", body: "请完成 AI 访谈并生成报告。", sourceName: "后台维护", sourceUrl: "", tags: "公告", displayPosition: "首页", sortOrder: 1, status: "已发布" });
  const [tagForm, setTagForm] = useState({ id: undefined as number | undefined, name: "校招", type: "内容标签", status: "启用", sortOrder: 9 });
  const [chartForm, setChartForm] = useState<ChartForm>(emptyChartForm);
  const [pathForm, setPathForm] = useState<PathForm>(emptyPathForm);
  const [aiForm, setAiForm] = useState({ id: undefined as number | undefined, configType: "prompt", version: "PROMPT-2026.06", title: "追问提示词", content: "围绕报告正文和访谈素材回答追问，不输出录取、上岸、就业结果承诺。", status: "草稿" });
  const [candidateStatus, setCandidateStatus] = useState("待审核");
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const [crawlTaskStatus, setCrawlTaskStatus] = useState("全部");
  const [crawlTaskType, setCrawlTaskType] = useState("全部");
  const [contentKeyword, setContentKeyword] = useState("");
  const [sourceKeyword, setSourceKeyword] = useState("");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [postReviewStatus, setPostReviewStatus] = useState("待审核");
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const adminNoticeTone = /失败|错误|不可|过期|请重新/.test(adminNotice) ? "error" : "success";

  async function refreshAdmin(token = admin?.token) {
    if (!token) return;
    const [nextDashboard, nextSources, nextPosts, nextStudents, nextCommunityUsers, nextContents, nextCandidates, nextCrawlTasks, nextCharts, nextPaths, nextTags, nextAiConfigs, nextReports, nextComments] = await Promise.all([
      adminApi.dashboard(token),
      adminApi.sources(token),
      adminApi.posts(token),
      adminApi.students(token),
      adminApi.communityUsers(token),
      adminApi.contents(token),
      adminApi.candidates(token),
      adminApi.crawlTasks(token),
      adminApi.charts(token),
      adminApi.paths(token),
      adminApi.tags(token),
      adminApi.aiConfigs(token),
      adminApi.reports(token, "待处理"),
      adminApi.comments(token)
    ]);
    setDashboard(nextDashboard);
    setSources(nextSources);
    setPosts(nextPosts);
    setStudents(nextStudents);
    setCommunityUsers(nextCommunityUsers);
    setContents(nextContents);
    setCandidates(nextCandidates);
    setCrawlTasks(nextCrawlTasks);
    setCharts(nextCharts);
    setPathConfigs(nextPaths);
    setTags(nextTags);
    setAiConfigs(nextAiConfigs);
    setReports(nextReports);
    setReviewComments(nextComments);
  }

  function clearAdminData() {
    setDashboard(null);
    setSources([]);
    setPosts([]);
    setStudents([]);
    setCommunityUsers([]);
    setContents([]);
    setCandidates([]);
    setCrawlTasks([]);
    setCharts([]);
    setPathConfigs([]);
    setTags([]);
    setAiConfigs([]);
    setReports([]);
    setReviewComments([]);
  }

  function isAdminAuthError(exception: unknown) {
    const message = exception instanceof Error ? exception.message : String(exception ?? "");
    return message.includes("401")
      || message.includes("未登录")
      || message.includes("登录已过期")
      || message.includes("登录凭证")
      || message.includes("未经授权");
  }

  function handleAdminException(exception: unknown, fallback: string) {
    if (isAdminAuthError(exception)) {
      localStorage.removeItem("career-compass-admin-token");
      setAdmin(null);
      clearAdminData();
      setAdminError("后台登录已过期，请重新登录后台。");
      return;
    }
    setAdminError(exception instanceof Error ? exception.message : fallback);
  }

  useEffect(() => {
    if (!admin?.token) return;
    refreshAdmin(admin.token).catch((exception) => handleAdminException(exception, "后台数据加载失败"));
  }, [admin?.token]);

  useEffect(() => {
    if (!adminNotice) return;
    const timer = window.setTimeout(() => setAdminNotice(""), adminNoticeTone === "error" ? 6200 : 4200);
    return () => window.clearTimeout(timer);
  }, [adminNotice, adminNoticeTone]);

  const adminWorking = Boolean(adminBusy);
  const busyLabel = (key: string, label: string) => adminBusy === key ? "处理中" : label;

  async function runAdminAction(key: string, task: () => Promise<string | void>) {
    setAdminError("");
    setAdminNotice("");
    setAdminBusy(key);
    try {
      const message = await task();
      if (message) setAdminNotice(message);
      await refreshAdmin();
    } catch (exception) {
      handleAdminException(exception, "后台操作失败");
    } finally {
      setAdminBusy("");
    }
  }

  async function adminLogin() {
    if (adminBusy) return;
    setAdminError("");
    setAdminBusy("admin-login");
    try {
      const next = await adminApi.login(username, password);
      localStorage.setItem("career-compass-admin-token", next.token);
      setAdmin(next);
      await refreshAdmin(next.token);
    } catch (exception) {
      setAdminError(exception instanceof Error ? exception.message : "后台登录失败");
    } finally {
      setAdminBusy("");
    }
  }

  function adminLogout() {
    localStorage.removeItem("career-compass-admin-token");
    setAdmin(null);
    clearAdminData();
    setAdminNotice("");
    setAdminError("");
  }

  async function updateStatus(id: number, status: string, expectedStatus?: string) {
    if (!admin) return;
    if ((status === "已驳回" || status === "已下架") && !window.confirm("确认执行该审核处置？")) return;
    await runAdminAction(`post-${id}-${status}`, async () => {
      await adminApi.updatePostStatus(admin.token, id, status, status === "已驳回" ? "内容不符合公开展示要求" : "后台审核", expectedStatus);
      return `社区内容已更新为：${status}`;
    });
  }

  async function triggerCrawl(id: number) {
    if (!admin) return;
    await runAdminAction(`crawl-${id}`, async () => {
      const result = await adminApi.triggerCrawl(admin.token, id);
      return result.taskStatus === "已完成" ? "抓取完成，已生成待审核候选" : `抓取失败：${result.message || "请检查来源地址"}`;
    });
  }

  async function saveSource() {
    if (!admin) return;
    await runAdminAction("save-source", async () => {
      await adminApi.saveSource(admin.token, {
        ...sourceForm,
        parserRule: { fallbackUrls: splitLines(sourceForm.fallbackUrlsText) }
      });
      return sourceForm.id ? "数据源已更新" : "数据源已保存";
    });
  }

  async function saveContent() {
    if (!admin) return;
    await runAdminAction("save-content", async () => {
      await adminApi.saveContent(admin.token, contentForm);
      return contentForm.id ? "内容配置已更新" : "内容配置已保存并进入对应展示位";
    });
  }

  async function deleteContent(id: number) {
    if (!admin) return;
    if (!window.confirm("确认删除这条内容？删除后前台不再展示。")) return;
    await runAdminAction(`delete-content-${id}`, async () => {
      await adminApi.deleteContent(admin.token, id);
      return "内容已删除";
    });
  }

  async function reviewCandidate(id: number, action: string, candidate?: CrawlCandidateItem) {
    if (!admin) return;
    if (action === "驳回" && !window.confirm("确认驳回这条抓取资讯？如果它已经发布，前台对应资讯也会同步下架。")) return;
    await runAdminAction(`candidate-${id}-${action}`, async () => {
      const result = await adminApi.reviewCandidate(admin.token, id, action, action.includes("发布") && candidate ? {
        title: candidate.title,
        summary: candidate.summary,
        category: candidate.path || "就业",
        tags: candidate.tags || candidate.path,
        displayPosition: "路径页",
        expectedStatus: candidate.reviewStatus
      } : { reason: "来源或内容暂不适合发布", expectedStatus: candidate?.reviewStatus });
      if (action === "驳回") {
        return `抓取候选已驳回，已同步下架 ${result.offlineContentCount ?? 0} 条前台资讯`;
      }
      return `抓取候选已${action}`;
    });
  }

  function editSource(source: CrawlSource) {
    setSourceForm({
      id: source.id,
      name: source.name,
      url: source.url,
      type: source.type,
      path: source.path,
      frequency: source.frequency,
      trustLevel: source.trustLevel || "中",
      status: source.status,
      fallbackUrlsText: Array.isArray(source.parserRule?.fallbackUrls)
        ? source.parserRule.fallbackUrls.map((item) => String(item)).join("\n")
        : ""
    });
    setAdminTab("sources");
  }

  function newSource() {
    setSourceForm({ id: undefined, name: "", url: "", type: "公开权威数据", path: "就业", frequency: "每日", trustLevel: "中", status: "启用", fallbackUrlsText: "" });
  }

  function editContent(content: ContentItem) {
    setContentForm({
      id: content.id,
      title: content.title,
      category: content.category,
      summary: content.summary || "",
      body: content.body || content.summary || "",
      sourceName: content.source || "后台维护",
      sourceUrl: content.sourceUrl || "",
      tags: content.tags || content.category,
      displayPosition: content.displayPosition || "路径页",
      sortOrder: content.sortOrder ?? 1,
      status: content.status
    });
    setAdminTab("contents");
  }

  function newContent() {
    setContentForm({ id: undefined, title: "", category: "公告", summary: "", body: "", sourceName: "后台维护", sourceUrl: "", tags: "", displayPosition: "首页", sortOrder: 1, status: "待审核" });
  }

  function appendContentMarkup(prefix: string, suffix = "") {
    setContentForm((current) => ({ ...current, body: `${current.body}${current.body ? "\n" : ""}${prefix}${suffix}` }));
  }

  async function updateUser(id: number, status: string) {
    if (!admin) return;
    if (!window.confirm(`确认将用户状态改为 ${status}？`)) return;
    await runAdminAction(`user-${id}-${status}`, async () => {
      await adminApi.updateStudentStatus(admin.token, id, status, "后台用户管理操作");
      return "用户状态已更新";
    });
  }

  async function punishCommunityUser(user: CommunityUserAdminItem, status: string) {
    if (!admin) return;
    const reason = window.prompt(`请输入${status}原因`, "社区违规处理") || "社区违规处理";
    await runAdminAction(`community-user-${user.id}-${status}`, async () => {
      await adminApi.banCommunityUser(admin.token, user.id, status, reason, user.status);
      return "社区用户处罚状态已更新";
    });
  }

  async function updateComment(id: number, status: string, expectedStatus?: string) {
    if (!admin) return;
    await runAdminAction(`comment-${id}-${status}`, async () => {
      await adminApi.updateCommentStatus(admin.token, id, status, status === "已下架" ? "后台评论审核下架" : "后台评论审核", expectedStatus);
      return `评论已更新为：${status}`;
    });
  }

  function applyImportedChartData(result: { importedRows: number; data: Record<string, unknown>; errors: Array<{ row: number; reason: string }> }) {
    if (result.errors.length > 0) {
      setAdminError(result.errors.slice(0, 5).map((error) => `第 ${error.row} 行：${error.reason}`).join("；"));
      return;
    }
    setChartForm((current) => ({
      ...current,
      dataText: JSON.stringify(result.data, null, 2)
    }));
    setAdminNotice(`后端已解析并校验 ${result.importedRows} 行数据，请补齐图表标题后保存`);
  }

  function chartFormCanAutoSaveImport(form: ChartForm) {
    return Boolean(form.title.trim() && form.chartType.trim() && form.path.trim());
  }

  async function importChartFile(file: File | null) {
    if (!file || !admin) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xls")) {
      setAdminError("暂不支持旧版 .xls，请另存为 .xlsx 或 CSV 后导入");
      return;
    }
    try {
      setAdminError("");
      const result = await adminApi.importChart(admin.token, file);
      if (result.errors.length > 0 || !chartFormCanAutoSaveImport(chartForm)) {
        applyImportedChartData(result);
        return;
      }
      const dataText = JSON.stringify(result.data, null, 2);
      setChartForm((current) => ({
        ...current,
        dataText
      }));
      await runAdminAction("import-chart", async () => {
        const filters = parseJsonRecord(chartForm.filtersText, "筛选条件");
        const saved = await adminApi.saveChart(admin.token, {
          id: chartForm.id,
          title: chartForm.title,
          chartType: chartForm.chartType,
          path: chartForm.path,
          methodology: chartForm.methodology || `由 ${file.name} 导入，后端已校验 ${result.importedRows} 行数据`,
          sourceName: chartForm.sourceName || "后台导入数据",
          sourceUrl: chartForm.sourceUrl,
          visibility: chartForm.visibility,
          displayPosition: chartForm.displayPosition,
          status: chartForm.status,
          data: result.data,
          filters
        });
        if (typeof saved.id === "number") {
          setChartForm((current) => ({ ...current, id: saved.id as number }));
        }
        return `数据导入成功，已保存 ${result.importedRows} 行图表数据`;
      });
    } catch (exception) {
      setAdminError(exception instanceof Error ? exception.message : "导入文件解析失败");
    }
  }

  async function saveTag() {
    if (!admin) return;
    await runAdminAction("save-tag", async () => {
      await adminApi.saveTag(admin.token, tagForm);
      return tagForm.id ? "标签已更新" : "标签已保存";
    });
  }

  async function saveChart() {
    if (!admin) return;
    await runAdminAction("save-chart", async () => {
      const data = parseJsonRecord(chartForm.dataText, "图表数据");
      const rows = data.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("图表数据至少需要在 rows 中填写一行真实数据");
      }
      const filters = parseJsonRecord(chartForm.filtersText, "筛选条件");
      await adminApi.saveChart(admin.token, {
        id: chartForm.id,
        title: chartForm.title,
        chartType: chartForm.chartType,
        path: chartForm.path,
        methodology: chartForm.methodology,
        sourceName: chartForm.sourceName,
        sourceUrl: chartForm.sourceUrl,
        visibility: chartForm.visibility,
        displayPosition: chartForm.displayPosition,
        status: chartForm.status,
        data,
        filters
      });
      return "图表配置已保存";
    });
  }

  async function refreshOfficialCharts() {
    if (!admin) return;
    await runAdminAction("refresh-charts", async () => {
      const result = await adminApi.refreshCharts(admin.token);
      return String(result.message || "官方图表数据已刷新");
    });
  }

  async function savePath() {
    if (!admin) return;
    await runAdminAction("save-path", async () => {
      await adminApi.savePath(admin.token, {
        key: pathForm.key,
        name: pathForm.name,
        intro: pathForm.intro,
        suitable: splitLines(pathForm.suitableText),
        timeline: splitLines(pathForm.timelineText),
        pitfalls: splitLines(pathForm.pitfallsText),
        accent: pathForm.accent,
        matchScore: pathForm.matchScore,
        sortOrder: pathForm.sortOrder,
        status: pathForm.status
      });
      return "路径配置已保存，前台三路径页面会动态读取";
    });
  }

  async function saveAiConfig() {
    if (!admin) return;
    await runAdminAction("save-ai", async () => {
      await adminApi.saveAiConfig(admin.token, aiForm);
      return aiForm.id ? "AI 配置已更新" : "AI 配置已保存";
    });
  }

  function updateAiConfigType(configType: string) {
    const template = aiConfigTemplates[configType];
    setAiForm((current) => ({
      ...current,
      configType,
      version: template && !current.id ? template.version : current.version,
      title: template && !current.id ? template.title : current.title,
      content: template && !current.id ? template.content : current.content
    }));
  }

  function newTag() {
    setTagForm({ id: undefined, name: "", type: "内容标签", status: "启用", sortOrder: 0 });
  }

  function newAiConfig() {
    setAiForm({ id: undefined, configType: "prompt", version: "", title: "", content: "", status: "草稿" });
  }

  function updateAiJsonPayload(nextPayload: Record<string, unknown>) {
    setAiForm((current) => ({
      ...current,
      content: JSON.stringify(nextPayload, null, 2)
    }));
  }

  function updateAiWeight(key: string, value: number) {
    const payload = safeJsonRecord(aiForm.content);
    const weights = (payload.weights && typeof payload.weights === "object" && !Array.isArray(payload.weights))
      ? payload.weights as Record<string, unknown>
      : {};
    updateAiJsonPayload({
      ...payload,
      weights: {
        ...weights,
        [key]: value
      }
    });
  }

  function updateModelParam(key: string, value: number) {
    updateAiJsonPayload({
      ...safeJsonRecord(aiForm.content),
      [key]: value
    });
  }

  async function handleReport(id: number, status: string, expectedStatus?: string) {
    if (!admin) return;
    await runAdminAction(`report-${id}-${status}`, async () => {
      await adminApi.handleReport(admin.token, id, status, status === "已处理" ? "已完成核查与处置" : "暂不处理", expectedStatus);
      setExpandedReportId(null);
      setReports((current) => current.filter((report) => report.id !== id));
      return "举报处理结果已记录，已从待处理列表移除";
    });
  }

  const stats = dashboard
    ? [
        { label: "注册学生", value: String(dashboard.registeredUsers), trend: "数据库", icon: Users },
        { label: "30日活跃", value: String(dashboard.activeUsers), trend: "登录", icon: UserRoundCheck },
        { label: "测评完成率", value: `${dashboard.assessmentCompletionRate}%`, trend: "实时", icon: CheckCircle2 },
        { label: "报告生成量", value: String(dashboard.reportCount), trend: "已完成", icon: FileText },
        { label: "待审核项", value: String(dashboard.pendingReviews), trend: "需处理", icon: Clock3 },
        { label: "数据源", value: String(dashboard.dataSourceCount), trend: `${dashboard.crawlTaskCount} 任务`, icon: Database }
      ]
    : compactStats;
  const pendingCandidates = candidates.filter((item) => item.reviewStatus === "待审核");
  const visibleCandidates = candidates.filter((candidate) => {
    const keyword = candidateKeyword.trim().toLowerCase();
    const matchesStatus = candidateStatus === "全部" || candidate.reviewStatus === candidateStatus;
    const matchesKeyword = !keyword || [candidate.title, candidate.summary, candidate.sourceName, candidate.path, candidate.tags || ""]
      .some((value) => value.toLowerCase().includes(keyword));
    return matchesStatus && matchesKeyword;
  });
  const visibleCrawlTasks = crawlTasks.filter((task) => {
    const matchesStatus = crawlTaskStatus === "全部" || task.status === crawlTaskStatus;
    const matchesType = crawlTaskType === "全部" || task.failureType === crawlTaskType;
    return matchesStatus && matchesType;
  });
  const crawlTaskTypes = ["全部", ...Array.from(new Set(crawlTasks.map((task) => task.failureType).filter(Boolean)))];
  const failedCrawlTasks = crawlTasks.filter((task) => task.status === "失败").length;
  const certificateCrawlTasks = crawlTasks.filter((task) => task.failureType.includes("证书")).length;
  const degradedCrawlTasks = crawlTasks.filter((task) => task.failureType.includes("降级")).length;
  const successfulCrawlTasks = crawlTasks.filter((task) => task.status === "已完成").length;
  const visibleSources = sources.filter((source) => {
    const keyword = sourceKeyword.trim().toLowerCase();
    return !keyword || [source.name, source.url, source.type, source.path, source.status].some((value) => value.toLowerCase().includes(keyword));
  });
  const visibleContents = contents.filter((content) => {
    const keyword = contentKeyword.trim().toLowerCase();
    return !keyword || [content.title, content.category, content.summary, content.source, content.status].some((value) => value.toLowerCase().includes(keyword));
  });
  const visibleStudents = students.filter((student) => {
    const keyword = studentKeyword.trim().toLowerCase();
    return !keyword || [
      student.email,
      student.name || "",
      student.studentNo || "",
      student.college || "",
      student.major || "",
      student.status
    ].some((value) => value.toLowerCase().includes(keyword));
  });
  const visibleCommunityUsers = communityUsers.filter((user) => {
    const keyword = studentKeyword.trim().toLowerCase();
    return !keyword || [user.name, user.studentNo || "", user.status, user.punishmentReason || ""]
      .some((value) => value.toLowerCase().includes(keyword));
  });
  const visibleReviewPosts = posts.filter((post) => postReviewStatus === "全部" || post.status === postReviewStatus);
  const aiJsonPayload = safeJsonRecord(aiForm.content);
  const aiWeightsPayload = aiJsonPayload.weights && typeof aiJsonPayload.weights === "object" && !Array.isArray(aiJsonPayload.weights)
    ? aiJsonPayload.weights as Record<string, unknown>
    : {};
  const aiWeightRows = [
    { key: "profileFit", label: "档案匹配", value: Number(aiWeightsPayload.profileFit ?? 35) },
    { key: "interviewSignals", label: "访谈信号", value: Number(aiWeightsPayload.interviewSignals ?? 30) },
    { key: "constraints", label: "现实约束", value: Number(aiWeightsPayload.constraints ?? 20) },
    { key: "dataEvidence", label: "数据证据", value: Number(aiWeightsPayload.dataEvidence ?? 15) }
  ];
  const aiWeightTotal = aiWeightRows.reduce((sum, row) => sum + (Number.isFinite(row.value) ? row.value : 0), 0);
  const modelTemperature = Number(aiJsonPayload.temperature ?? 0.7);
  const modelTopP = Number(aiJsonPayload.topP ?? aiJsonPayload.top_p ?? 0.9);
  const modelMaxTokens = Number(aiJsonPayload.maxTokens ?? aiJsonPayload.max_tokens ?? 4000);

  if (!admin) {
    return (
      <section className="surface auth-modal inline-admin">
        <SectionTitle icon={ShieldCheck} title="后台登录" />
        <label>
          <span>管理员账号</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          <span>密码</span>
          <div className="inline-control">
            <input
              type={showAdminPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              className="icon-button"
              title={showAdminPassword ? "隐藏密码" : "显示密码"}
              type="button"
              onClick={() => setShowAdminPassword(!showAdminPassword)}
            >
              {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {adminError && <p className="form-error">{adminError}</p>}
        <button className="primary-button full-width" onClick={adminLogin} disabled={adminWorking}>
          {busyLabel("admin-login", "登录后台")}
        </button>
      </section>
    );
  }

  return (
    <div className="page-stack">
      {adminNotice && <div className={`toast ${adminNoticeTone}`} role="status">{adminNotice}</div>}
      {adminError && <div className="form-error admin-error">{adminError}</div>}
      {adminBusy && <div className="admin-feedback"><RefreshCcw size={15} />正在处理后台操作，请稍候</div>}
      <section className="metric-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="metric-card" key={stat.label}>
              <div className="metric-icon">
                <Icon size={19} />
              </div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.trend}</em>
            </article>
          );
        })}
      </section>
      <section className="admin-brief">
        <span>当前管理员：{admin.displayName}</span>
        <span>后台数据更新时间：{formatAdminTime(dashboard?.updatedAt)}</span>
        <span>待抓取审核：{dashboard?.pendingCrawlCount ?? pendingCandidates.length} 条</span>
        <span>内容审核：{posts.filter((post) => post.status === "待审核").length} 条</span>
        <button className="secondary-button" onClick={() => refreshAdmin().catch((exception) => handleAdminException(exception, "后台数据刷新失败"))} disabled={adminWorking}>
          <RefreshCcw size={16} />
          刷新
        </button>
        <button className="secondary-button" onClick={adminLogout} disabled={adminWorking}>
          退出后台
        </button>
      </section>
      <section className="segmented admin-tabs" aria-label="后台模块切换">
        {[
          ["overview", "总览"],
          ["users", "用户"],
          ["contents", "内容"],
          ["review", "审核"],
          ["sources", "数据源"],
          ["paths", "路径"],
          ["charts", "图表"],
          ["tags", "标签"],
          ["ai", "AI 配置"]
        ].map(([key, label]) => (
          <button key={key} className={adminTab === key ? "active" : ""} onClick={() => setAdminTab(key as typeof adminTab)}>{label}</button>
        ))}
      </section>
      <section className="admin-command-strip" aria-label="后台快捷管理">
        <button type="button" onClick={() => setAdminTab("review")}>
          <ShieldCheck size={17} />
          <span><strong>{posts.filter((post) => post.status === "待审核").length}</strong> 社区待审</span>
        </button>
        <button type="button" onClick={() => {
          setCandidateStatus("待审核");
          setAdminTab("sources");
        }}>
          <Database size={17} />
          <span><strong>{pendingCandidates.length}</strong> 抓取候选</span>
        </button>
        <button type="button" onClick={() => setAdminTab("contents")}>
          <FileText size={17} />
          <span><strong>{contents.length}</strong> 内容条目</span>
        </button>
        <button type="button" onClick={() => setAdminTab("charts")}>
          <BarChart3 size={17} />
          <span><strong>{charts.length}</strong> 图表配置</span>
        </button>
      </section>

      {adminTab === "overview" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={ShieldCheck} title="审核队列" />
            <div className="queue-list">
              {(dashboard?.queue ?? adminQueue).map((item) => (
                <div className="queue-item" key={item.id}>
                  <div>
                    <strong>{item.item}</strong>
                    <span>{item.id} · {item.type} · 更新 {formatAdminTime(dashboard?.updatedAt)}</span>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={Database} title="最新抓取候选" />
            <div className="queue-list">
              {pendingCandidates.slice(0, 5).map((candidate) => (
                <div className="queue-item" key={candidate.id}>
                  <div>
                    <strong>{candidate.title}</strong>
                    <span>{candidate.sourceName} · {candidate.path} · 抓取 {formatAdminTime(candidate.crawledAt)}</span>
                  </div>
                  <StatusPill status={candidate.reviewStatus} />
                </div>
              ))}
              {pendingCandidates.length === 0 && <div className="empty-state">暂无待审核抓取候选</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "users" && (
        <section className="surface">
          <SectionTitle icon={Users} title="学生用户管理" />
          <div className="admin-filter-bar">
            <input
              value={studentKeyword}
              placeholder="按邮箱、姓名、学号、学院、专业或状态搜索"
              onChange={(event) => setStudentKeyword(event.target.value)}
            />
            <span>{visibleStudents.length} / {students.length} 人</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>账号</th><th>认证信息</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.email}<br /><small>{student.nickname || "未设置昵称"} · 创建 {formatAdminTime(student.createdAt)}</small></td>
                    <td>{student.name || "未填写"} · {student.studentNo || "未填写"}<br /><small>{student.college || "未填写"} / {student.major || "未填写"} · 最近登录 {formatAdminTime(student.lastLoginAt)}</small></td>
                    <td><StatusPill status={student.status} /></td>
                    <td>
                      <div className="button-row compact-actions">
                        <button className="secondary-button" onClick={() => updateUser(student.id, "已禁用")} disabled={adminWorking}>{busyLabel(`user-${student.id}-已禁用`, "禁用")}</button>
                        <button className="secondary-button" onClick={() => updateUser(student.id, "已完成引导")} disabled={adminWorking}>{busyLabel(`user-${student.id}-已完成引导`, "恢复")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleStudents.length === 0 && (
                  <tr>
                    <td colSpan={4}>没有匹配的学生账号</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-subsection">
            <SectionTitle icon={MessagesSquare} title="社区用户处罚" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>用户</th><th>社区数据</th><th>处罚状态</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {visibleCommunityUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}<br /><small>{user.studentNo || "未绑定学号"}</small></td>
                      <td>{user.posts} 帖 · {user.comments} 评 · {user.reports} 次举报</td>
                      <td>
                        <StatusPill status={user.status} />
                        {(user.punishmentReason || user.mutedUntil || user.bannedUntil) && (
                          <small>{user.punishmentReason || "处罚中"} {user.mutedUntil ? `禁言至 ${formatAdminTime(user.mutedUntil)}` : ""} {user.bannedUntil ? `封禁至 ${formatAdminTime(user.bannedUntil)}` : ""}</small>
                        )}
                      </td>
                      <td>
                        <div className="button-row compact-actions">
                          <button className="secondary-button" onClick={() => punishCommunityUser(user, "禁言中")} disabled={adminWorking}>禁言</button>
                          <button className="secondary-button danger-button" onClick={() => punishCommunityUser(user, "封禁中")} disabled={adminWorking}>封禁</button>
                          <button className="secondary-button" onClick={() => punishCommunityUser(user, "已完成引导")} disabled={adminWorking}>解除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleCommunityUsers.length === 0 && (
                    <tr>
                      <td colSpan={4}>没有匹配的社区用户</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {adminTab === "contents" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={FileText} title={contentForm.id ? "编辑内容" : "新增内容"} action="新建" onAction={newContent} />
            <div className="form-grid compact-form">
              <label><span>标题</span><input value={contentForm.title} onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })} /></label>
              <label>
                <span>分类</span>
                <select value={contentForm.category} onChange={(event) => setContentForm({ ...contentForm, category: event.target.value })}>
                  {["公告", "FAQ", "考公", "考研", "就业"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label><span>摘要</span><input value={contentForm.summary} onChange={(event) => setContentForm({ ...contentForm, summary: event.target.value })} /></label>
              <label><span>来源</span><input value={contentForm.sourceName} onChange={(event) => setContentForm({ ...contentForm, sourceName: event.target.value })} /></label>
              <label><span>来源链接</span><input value={contentForm.sourceUrl} onChange={(event) => setContentForm({ ...contentForm, sourceUrl: event.target.value })} /></label>
              <label><span>标签</span><input value={contentForm.tags} onChange={(event) => setContentForm({ ...contentForm, tags: event.target.value })} /></label>
              <label>
                <span>展示位</span>
                <select value={contentForm.displayPosition} onChange={(event) => setContentForm({ ...contentForm, displayPosition: event.target.value })}>
                  {["首页", "路径页", "图表中心", "社区"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select value={contentForm.status} onChange={(event) => setContentForm({ ...contentForm, status: event.target.value })}>
                  {["待审核", "已发布", "已下架"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>排序</span>
                <input type="number" value={contentForm.sortOrder} onChange={(event) => setContentForm({ ...contentForm, sortOrder: Number(event.target.value) })} />
              </label>
            </div>
            <label>
              <span>正文</span>
              <div className="button-row compact-actions rich-toolbar">
                <button type="button" className="icon-button" title="加粗" onClick={() => appendContentMarkup("**加粗文字**")}>B</button>
                <button type="button" className="icon-button" title="列表" onClick={() => appendContentMarkup("- 列表项")}>L</button>
                <button type="button" className="icon-button" title="链接" onClick={() => appendContentMarkup("[链接文字](https://)")}>@</button>
              </div>
              <textarea value={contentForm.body} onChange={(event) => setContentForm({ ...contentForm, body: event.target.value })} />
            </label>
            <div className="content-preview-box">
              <span>内容预览</span>
              <strong>{contentForm.title || "未填写标题"}</strong>
              <small>{contentForm.summary || "未填写摘要"}</small>
              <p>{contentForm.body || "正文会在这里预览。"}</p>
            </div>
            <button className="primary-button" onClick={saveContent} disabled={adminWorking}>{busyLabel("save-content", "保存内容")}</button>
          </div>
          <div className="surface">
            <SectionTitle icon={FileText} title="已维护内容" />
            <div className="admin-filter-bar">
              <input value={contentKeyword} placeholder="搜索标题、分类、来源或状态" onChange={(event) => setContentKeyword(event.target.value)} />
              <span>{visibleContents.length} / {contents.length} 条</span>
            </div>
            <div className="queue-list">
              {visibleContents.map((content) => (
                <div className="queue-item" key={content.id}>
                  <div>
                    <strong>{content.title}</strong>
                    <span>{content.category} · {content.source} · {content.displayPosition || "未设置展示位"} · 更新 {formatAdminTime(content.updatedAt)}</span>
                    <small>{content.summary}</small>
                  </div>
                  <div className="button-row compact-actions">
                    <StatusPill status={content.status} />
                    <button className="secondary-button" onClick={() => editContent(content)}>编辑</button>
                    <button className="secondary-button danger-button" onClick={() => deleteContent(content.id)} disabled={adminWorking}>{busyLabel(`delete-content-${content.id}`, "删除")}</button>
                  </div>
                </div>
              ))}
              {visibleContents.length === 0 && <div className="empty-state">暂无匹配内容</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "review" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={ShieldCheck} title="社区内容审核" />
            <div className="admin-filter-bar">
              <div className="mini-segmented">
                {["待审核", "已通过", "已驳回", "已下架", "精选", "全部"].map((status) => (
                  <button type="button" key={status} className={postReviewStatus === status ? "active" : ""} onClick={() => setPostReviewStatus(status)}>
                    {status}
                  </button>
                ))}
              </div>
              <span>{visibleReviewPosts.length} 条</span>
            </div>
            <div className="queue-list">
              {visibleReviewPosts.slice(0, 20).map((post) => (
                <div className="queue-item" key={post.id}>
                  <div>
                    <strong>{post.title}</strong>
                    <span>{post.type} · {post.path} · {post.status} · 发布 {formatAdminTime(post.createdAt)}</span>
                  </div>
                  <div className="button-row compact-actions">
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已通过", post.status)} disabled={adminWorking}>{busyLabel(`post-${post.id}-已通过`, "通过")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已驳回", post.status)} disabled={adminWorking}>{busyLabel(`post-${post.id}-已驳回`, "驳回")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已下架", post.status)} disabled={adminWorking}>{busyLabel(`post-${post.id}-已下架`, "下架")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "精选", post.status)} disabled={adminWorking}>{busyLabel(`post-${post.id}-精选`, "精选")}</button>
                  </div>
                </div>
              ))}
              {visibleReviewPosts.length === 0 && <div className="empty-state">暂无该状态的社区内容</div>}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={Flag} title="举报处理" />
            <div className="queue-list">
              {reports.map((report) => {
                const targetPost = report.targetType === "post" ? posts.find((post) => post.id === report.targetId) : null;
                const expanded = expandedReportId === report.id;
                return (
                  <div className="queue-item report-review-item" key={report.id}>
                    <div>
                      <strong>{targetPost?.title || `${report.targetType} #${report.targetId}`}</strong>
                      <span>{report.reason} · {report.status} · 提交 {formatAdminTime(report.createdAt)}</span>
                      {targetPost && <small>{targetPost.type} · {targetPost.path} · 内容状态 {targetPost.status}</small>}
                      {expanded && (
                        <div className="report-detail-box">
                          <div><b>举报编号</b><span>#{report.id}</span></div>
                          <div><b>举报人</b><span>学生 #{report.reporterStudentId}</span></div>
                          <div><b>举报对象</b><span>{report.targetType} #{report.targetId}</span></div>
                          <div><b>举报原因</b><span>{report.reason}</span></div>
                          <div><b>提交时间</b><span>{formatAdminTime(report.createdAt)}</span></div>
                          {targetPost && (
                            <div className="report-detail-content">
                              <b>被举报内容</b>
                              <span>{targetPost.summary || targetPost.body || "暂无正文摘要"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="button-row compact-actions">
                      <button className="secondary-button" onClick={() => setExpandedReportId(expanded ? null : report.id)} disabled={adminWorking}>
                        {expanded ? "收起" : "详情"}
                      </button>
                      <button className="secondary-button" onClick={() => handleReport(report.id, "已处理", report.status)} disabled={adminWorking}>{busyLabel(`report-${report.id}-已处理`, "处理")}</button>
                      <button className="secondary-button danger-button" onClick={() => handleReport(report.id, "已驳回", report.status)} disabled={adminWorking}>{busyLabel(`report-${report.id}-已驳回`, "驳回")}</button>
                    </div>
                  </div>
                );
              })}
              {reports.length === 0 && <div className="empty-state">暂无待处理举报</div>}
            </div>
            <SectionTitle icon={MessagesSquare} title="评论审核" />
            <div className="queue-list">
              {reviewComments.slice(0, 20).map((comment) => (
                <div className="queue-item" key={comment.id}>
                  <div>
                    <strong>{comment.authorDisplay} · 帖子 #{comment.postId}</strong>
                    <span>{comment.body}</span>
                    <small>{comment.status} · {formatAdminTime(comment.createdAt)}</small>
                  </div>
                  <div className="button-row compact-actions">
                    <button className="secondary-button" onClick={() => updateComment(comment.id, "已通过", comment.status)} disabled={adminWorking}>通过</button>
                    <button className="secondary-button danger-button" onClick={() => updateComment(comment.id, "已下架", comment.status)} disabled={adminWorking}>下架</button>
                  </div>
                </div>
              ))}
              {reviewComments.length === 0 && <div className="empty-state">暂无评论记录</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "sources" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={Database} title={sourceForm.id ? "编辑数据源" : "新增数据源"} action="新建" onAction={newSource} />
            <div className="form-grid compact-form">
              <label><span>来源名称</span><input value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} /></label>
              <label><span>来源地址</span><input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} /></label>
              <label className="full-span">
                <span>备用来源地址</span>
                <textarea
                  className="compact-textarea"
                  value={sourceForm.fallbackUrlsText}
                  placeholder="遇到 403/429 时按行依次尝试备用公开入口"
                  onChange={(event) => setSourceForm({ ...sourceForm, fallbackUrlsText: event.target.value })}
                />
              </label>
              <label>
                <span>来源类型</span>
                <select value={sourceForm.type} onChange={(event) => setSourceForm({ ...sourceForm, type: event.target.value })}>
                  {["公开权威数据", "政策公告", "学校就业信息", "考试招生", "招聘服务"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>适用路径</span>
                <select value={sourceForm.path} onChange={(event) => setSourceForm({ ...sourceForm, path: event.target.value })}>
                  {["就业", "考公", "考研"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>抓取频率</span>
                <select value={sourceForm.frequency} onChange={(event) => setSourceForm({ ...sourceForm, frequency: event.target.value })}>
                  {["每日", "每周", "每月", "手动"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>可信级别</span>
                <select value={sourceForm.trustLevel} onChange={(event) => setSourceForm({ ...sourceForm, trustLevel: event.target.value })}>
                  {["高", "中", "低"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select value={sourceForm.status} onChange={(event) => setSourceForm({ ...sourceForm, status: event.target.value })}>
                  {["启用", "停用"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button className="primary-button" onClick={saveSource} disabled={adminWorking}>{busyLabel("save-source", "保存数据源")}</button>
            </div>
            <div className="admin-filter-bar source-filter">
              <input value={sourceKeyword} placeholder="搜索数据源名称、路径、状态或 URL" onChange={(event) => setSourceKeyword(event.target.value)} />
              <span>{visibleSources.length} / {sources.length} 个数据源</span>
            </div>
            <div className="queue-list admin-source-list">
              {visibleSources.map((source) => (
                <div className="queue-item" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.path} · {source.type} · {source.status} · 通过率 {source.passRate}</span>
                    <small>
                      最近任务：{source.lastTaskStatus || "暂无"} · {formatAdminTime(source.lastTaskAt)}
                      {source.lastTaskMessage ? ` · ${source.lastTaskMessage}` : ""}
                    </small>
                  </div>
                  <div className="button-row compact-actions">
                    <button className="icon-button" title="手动抓取" onClick={() => triggerCrawl(source.id)} disabled={adminWorking}>
                      <RefreshCcw size={17} />
                    </button>
                    <button className="secondary-button" onClick={() => editSource(source)}>编辑</button>
                  </div>
                </div>
              ))}
              {visibleSources.length === 0 && <div className="empty-state">暂无匹配数据源</div>}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={RefreshCcw} title="抓取与候选审核" />
            <div className="crawl-diagnostic-grid">
              <div>
                <strong>{successfulCrawlTasks}</strong>
                <span>成功任务</span>
              </div>
              <div>
                <strong>{failedCrawlTasks}</strong>
                <span>失败任务</span>
              </div>
              <div>
                <strong>{certificateCrawlTasks}</strong>
                <span>证书异常</span>
              </div>
              <div>
                <strong>{degradedCrawlTasks}</strong>
                <span>降级解析</span>
              </div>
            </div>
            <div className="admin-filter-bar">
              <div className="mini-segmented">
                {["全部", "已完成", "失败", "抓取中"].map((status) => (
                  <button type="button" key={status} className={crawlTaskStatus === status ? "active" : ""} onClick={() => setCrawlTaskStatus(status)}>
                    {status}
                  </button>
                ))}
              </div>
              <select value={crawlTaskType} onChange={(event) => setCrawlTaskType(event.target.value)}>
                {crawlTaskTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <span>{visibleCrawlTasks.length} / {crawlTasks.length} 个任务</span>
            </div>
            <div className="queue-list crawl-task-list">
              {visibleCrawlTasks.slice(0, 8).map((task) => (
                <div className="queue-item crawl-task-item" key={task.id}>
                  <div>
                    <strong>{task.sourceName}</strong>
                    <span>{task.triggerType} · {task.failureType} · 开始 {formatAdminTime(task.startedAt || task.createdAt)}</span>
                    <small>{task.resultMessage || "暂无结果消息"}</small>
                  </div>
                  <StatusPill status={task.status} />
                </div>
              ))}
              {visibleCrawlTasks.length === 0 && <div className="empty-state">暂无匹配抓取任务</div>}
            </div>
            <div className="admin-filter-bar">
              <div className="mini-segmented">
                {["待审核", "已发布", "已驳回", "全部"].map((status) => (
                  <button type="button" key={status} className={candidateStatus === status ? "active" : ""} onClick={() => setCandidateStatus(status)}>
                    {status}
                  </button>
                ))}
              </div>
              <input value={candidateKeyword} placeholder="搜索标题、来源、路径或标签" onChange={(event) => setCandidateKeyword(event.target.value)} />
            </div>
            <div className="queue-list">
              {visibleCandidates.map((candidate) => (
                <div className="queue-item" key={`candidate-${candidate.id}`}>
                  <div>
                    <strong>{candidate.title}</strong>
                    <span>{candidate.sourceName} · {candidate.path} · 质量 {candidate.qualityScore ?? 0} · {candidate.reviewStatus} · 抓取 {formatAdminTime(candidate.crawledAt)}</span>
                    <p>{candidate.summary}</p>
                    {candidate.reason && <small>{candidate.reason}</small>}
                    {candidate.failureReason && <small>驳回原因：{candidate.failureReason}</small>}
                  </div>
                  <div className="button-row compact-actions">
                    <button className="icon-button" title="查看来源" onClick={() => window.open(candidate.rawUrl, "_blank", "noopener,noreferrer")}>
                      <ExternalLink size={16} />
                    </button>
                    <StatusPill status={candidate.reviewStatus} />
                    <button className="secondary-button" onClick={() => reviewCandidate(candidate.id, "发布", candidate)} disabled={adminWorking || candidate.reviewStatus === "已发布"}>{busyLabel(`candidate-${candidate.id}-发布`, "发布")}</button>
                    <button className="secondary-button danger-button" onClick={() => reviewCandidate(candidate.id, "驳回")} disabled={adminWorking || candidate.reviewStatus === "已驳回"}>{busyLabel(`candidate-${candidate.id}-驳回`, "驳回")}</button>
                  </div>
                </div>
              ))}
              {visibleCandidates.length === 0 && <div className="empty-state">暂无匹配的抓取候选</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "paths" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={Route} title="三路径页面配置" />
            <div className="form-grid compact-form">
              <label>
                <span>路径标识</span>
                <select value={pathForm.key} onChange={(event) => setPathForm({ ...pathForm, key: event.target.value })}>
                  <option value="employment">employment · 就业</option>
                  <option value="civil-exam">civil-exam · 考公</option>
                  <option value="postgraduate">postgraduate · 考研</option>
                </select>
              </label>
              <label>
                <span>路径名称</span>
                <input value={pathForm.name} onChange={(event) => setPathForm({ ...pathForm, name: event.target.value })} />
              </label>
              <label>
                <span>色值</span>
                <input value={pathForm.accent} onChange={(event) => setPathForm({ ...pathForm, accent: event.target.value })} />
              </label>
              <label>
                <span>默认匹配度</span>
                <input type="number" min={0} max={100} value={pathForm.matchScore} onChange={(event) => setPathForm({ ...pathForm, matchScore: Number(event.target.value) })} />
              </label>
              <label>
                <span>排序</span>
                <input type="number" value={pathForm.sortOrder} onChange={(event) => setPathForm({ ...pathForm, sortOrder: Number(event.target.value) })} />
              </label>
              <label>
                <span>状态</span>
                <select value={pathForm.status} onChange={(event) => setPathForm({ ...pathForm, status: event.target.value })}>
                  <option value="启用">启用</option>
                  <option value="停用">停用</option>
                </select>
              </label>
            </div>
            <label>
              <span>路径简介</span>
              <textarea value={pathForm.intro} onChange={(event) => setPathForm({ ...pathForm, intro: event.target.value })} />
            </label>
            <div className="form-grid compact-form">
              <label>
                <span>适合人群（一行一项）</span>
                <textarea value={pathForm.suitableText} onChange={(event) => setPathForm({ ...pathForm, suitableText: event.target.value })} />
              </label>
              <label>
                <span>准备时间线（一行一项）</span>
                <textarea value={pathForm.timelineText} onChange={(event) => setPathForm({ ...pathForm, timelineText: event.target.value })} />
              </label>
              <label>
                <span>常见误区（一行一项）</span>
                <textarea value={pathForm.pitfallsText} onChange={(event) => setPathForm({ ...pathForm, pitfallsText: event.target.value })} />
              </label>
            </div>
            <div className="button-row">
              <button className="primary-button" onClick={savePath} disabled={adminWorking}>{busyLabel("save-path", "保存路径配置")}</button>
              <button className="secondary-button" onClick={() => setPathForm(emptyPathForm)} disabled={adminWorking}>清空</button>
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={Route} title="前台路径配置列表" />
            <div className="queue-list">
              {pathConfigs.map((path) => (
                <div className="queue-item" key={path.key}>
                  <div>
                    <strong>{path.name}</strong>
                    <span>{path.key} · 匹配度 {path.matchScore} · 排序 {path.sortOrder} · 更新 {formatAdminTime(path.updatedAt)}</span>
                    <p>{path.intro}</p>
                  </div>
                  <div className="button-row compact-actions">
                    <StatusPill status={path.status} />
                    <button className="secondary-button" onClick={() => setPathForm(pathFormFromItem(path))}>编辑</button>
                  </div>
                </div>
              ))}
              {pathConfigs.length === 0 && <div className="empty-state">暂无路径配置</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "charts" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={BarChart3} title={chartForm.id ? "编辑图表" : "新增图表"} />
            <div className="form-grid compact-form">
              <label><span>图表标题</span><input value={chartForm.title} onChange={(event) => setChartForm({ ...chartForm, title: event.target.value })} /></label>
              <label>
                <span>图表类型</span>
                <select value={chartForm.chartType} onChange={(event) => setChartForm({ ...chartForm, chartType: event.target.value })}>
                  <option value="趋势图">趋势图</option>
                  <option value="柱状图">柱状图</option>
                  <option value="环图">环图</option>
                  <option value="雷达图">雷达图</option>
                  <option value="时间线图">时间线图</option>
                </select>
              </label>
              <label>
                <span>路径</span>
                <select value={chartForm.path} onChange={(event) => setChartForm({ ...chartForm, path: event.target.value })}>
                  <option value="全部">全部</option>
                  {pathConfigs.map((path) => <option key={path.key} value={path.name}>{path.name}</option>)}
                </select>
              </label>
              <label><span>来源</span><input value={chartForm.sourceName} onChange={(event) => setChartForm({ ...chartForm, sourceName: event.target.value })} /></label>
              <label><span>来源链接</span><input value={chartForm.sourceUrl} onChange={(event) => setChartForm({ ...chartForm, sourceUrl: event.target.value })} /></label>
              <label>
                <span>展示位</span>
                <select value={chartForm.displayPosition} onChange={(event) => setChartForm({ ...chartForm, displayPosition: event.target.value })}>
                  <option value="首页">首页</option>
                  <option value="图表中心">图表中心</option>
                  <option value="路径页">路径页</option>
                </select>
              </label>
              <label>
                <span>可见性</span>
                <select value={chartForm.visibility} onChange={(event) => setChartForm({ ...chartForm, visibility: event.target.value })}>
                  <option value="公开">公开</option>
                  <option value="后台可见">后台可见</option>
                </select>
              </label>
              <label>
                <span>状态</span>
                <select value={chartForm.status} onChange={(event) => setChartForm({ ...chartForm, status: event.target.value })}>
                  <option value="待审核">待审核</option>
                  <option value="已发布">已发布</option>
                  <option value="已下架">已下架</option>
                </select>
              </label>
              <label><span>统计口径</span><textarea value={chartForm.methodology} onChange={(event) => setChartForm({ ...chartForm, methodology: event.target.value })} /></label>
              <label><span>筛选条件 JSON</span><textarea value={chartForm.filtersText} onChange={(event) => setChartForm({ ...chartForm, filtersText: event.target.value })} /></label>
            </div>
            <label>
              <span>图表数据 JSON，需要包含 rows 数组</span>
              <textarea className="code-textarea" value={chartForm.dataText} onChange={(event) => setChartForm({ ...chartForm, dataText: event.target.value })} />
            </label>
            <label className="file-import-line">
              <span>导入 Excel/CSV</span>
              <input type="file" accept=".xlsx,.csv,text/csv" onChange={(event) => {
                importChartFile(event.target.files?.[0] || null);
                event.target.value = "";
              }} />
            </label>
            <div className="helper-text">先填写图表标题、类型和路径后导入，系统会在后端校验通过后直接保存并刷新缓存；图表数据可声明 xKey、series、insights。</div>
            <div className="button-row">
              <button className="primary-button" onClick={saveChart} disabled={adminWorking}>{busyLabel("save-chart", "保存图表")}</button>
              <button className="secondary-button" onClick={refreshOfficialCharts} disabled={adminWorking}>
                <RefreshCcw size={16} />
                {busyLabel("refresh-charts", "刷新官方数据")}
              </button>
              <button className="secondary-button" onClick={() => setChartForm(emptyChartForm)} disabled={adminWorking}>新建</button>
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={BarChart3} title="图表列表" />
            <div className="queue-list">
              {charts.map((chart) => (
                <div className="queue-item" key={chart.id}>
                  <div>
                    <strong>{chart.title}</strong>
                    <span>{chart.chartType} · {chart.path} · {chart.sourceName} · {chart.displayPosition || "未设置展示位"} · 更新 {formatAdminTime(chart.updatedAt)}</span>
                    <small>数据 {Array.isArray(chart.data?.rows) ? chart.data.rows.length : 0} 行 · 可见性 {chart.visibility}</small>
                  </div>
                  <div className="button-row compact-actions">
                    <StatusPill status={chart.status} />
                    <button className="secondary-button" onClick={() => setChartForm(chartFormFromItem(chart))}>编辑</button>
                  </div>
                </div>
              ))}
              {charts.length === 0 && <div className="empty-state">暂无图表配置</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "tags" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={SlidersHorizontal} title={tagForm.id ? "编辑标签" : "新增标签"} action="新建" onAction={newTag} />
            <div className="form-grid compact-form">
              <label><span>标签名</span><input value={tagForm.name} onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })} /></label>
              <label>
                <span>类型</span>
                <select value={tagForm.type} onChange={(event) => setTagForm({ ...tagForm, type: event.target.value })}>
                  {["内容标签", "路径标签", "学院标签", "专业标签"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select value={tagForm.status} onChange={(event) => setTagForm({ ...tagForm, status: event.target.value })}>
                  {["启用", "停用"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label><span>排序</span><input type="number" value={tagForm.sortOrder} onChange={(event) => setTagForm({ ...tagForm, sortOrder: Number(event.target.value) })} /></label>
            </div>
            <div className="button-row">
              <button className="primary-button" onClick={saveTag} disabled={adminWorking}>{busyLabel("save-tag", "保存标签")}</button>
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={SlidersHorizontal} title="统一标签" />
            <div className="queue-list">
              {tags.map((tag) => (
                <div className="queue-item" key={tag.id}>
                  <div>
                    <strong>{tag.name}</strong>
                    <span>{tag.type} · 排序 {tag.sortOrder} · 创建 {formatAdminTime(tag.createdAt)}</span>
                  </div>
                  <div className="button-row compact-actions">
                    <StatusPill status={tag.status} />
                    <button className="secondary-button" onClick={() => setTagForm({ id: tag.id, name: tag.name, type: tag.type, status: tag.status, sortOrder: tag.sortOrder })}>编辑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {adminTab === "ai" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={Bot} title={aiForm.id ? "编辑 AI 配置" : "新增 AI 配置"} action="新建" onAction={newAiConfig} />
            <div className="form-grid compact-form">
              <label>
                <span>类型</span>
                <select value={aiForm.configType} onChange={(event) => updateAiConfigType(event.target.value)}>
                  {aiConfigTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label><span>版本</span><input value={aiForm.version} onChange={(event) => setAiForm({ ...aiForm, version: event.target.value })} /></label>
              <label><span>标题</span><input value={aiForm.title} onChange={(event) => setAiForm({ ...aiForm, title: event.target.value })} /></label>
              <label>
                <span>状态</span>
                <select value={aiForm.status} onChange={(event) => setAiForm({ ...aiForm, status: event.target.value })}>
                  {["草稿", "已发布", "已停用"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            {aiForm.configType === "algorithm_weights" && (
              <div className="ai-config-controls">
                <div className="config-total-line">
                  <strong>权重合计 {aiWeightTotal}%</strong>
                  <span className={aiWeightTotal === 100 ? "ok-text" : "warn-text"}>{aiWeightTotal === 100 ? "可保存" : "需等于 100%"}</span>
                </div>
                {aiWeightRows.map((row) => (
                  <label className="slider-row" key={row.key}>
                    <span>{row.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Number.isFinite(row.value) ? row.value : 0}
                      onChange={(event) => updateAiWeight(row.key, Number(event.target.value))}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Number.isFinite(row.value) ? row.value : 0}
                      onChange={(event) => updateAiWeight(row.key, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            )}
            {aiForm.configType === "model_params" && (
              <div className="ai-config-controls model-param-controls">
                <label className="slider-row">
                  <span>temperature</span>
                  <input type="range" min={0} max={2} step={0.1} value={Number.isFinite(modelTemperature) ? modelTemperature : 0.7} onChange={(event) => updateModelParam("temperature", Number(event.target.value))} />
                  <input type="number" min={0} max={2} step={0.1} value={Number.isFinite(modelTemperature) ? modelTemperature : 0.7} onChange={(event) => updateModelParam("temperature", Number(event.target.value))} />
                </label>
                <label className="slider-row">
                  <span>topP</span>
                  <input type="range" min={0} max={1} step={0.05} value={Number.isFinite(modelTopP) ? modelTopP : 0.9} onChange={(event) => updateModelParam("topP", Number(event.target.value))} />
                  <input type="number" min={0} max={1} step={0.05} value={Number.isFinite(modelTopP) ? modelTopP : 0.9} onChange={(event) => updateModelParam("topP", Number(event.target.value))} />
                </label>
                <label className="slider-row">
                  <span>maxTokens</span>
                  <input type="range" min={256} max={16000} step={128} value={Number.isFinite(modelMaxTokens) ? modelMaxTokens : 4000} onChange={(event) => updateModelParam("maxTokens", Number(event.target.value))} />
                  <input type="number" min={256} max={16000} step={128} value={Number.isFinite(modelMaxTokens) ? modelMaxTokens : 4000} onChange={(event) => updateModelParam("maxTokens", Number(event.target.value))} />
                </label>
              </div>
            )}
            <textarea value={aiForm.content} onChange={(event) => setAiForm({ ...aiForm, content: event.target.value })} />
            <button className="primary-button" onClick={saveAiConfig} disabled={adminWorking}>{busyLabel("save-ai", "保存配置")}</button>
          </div>
          <div className="surface">
            <SectionTitle icon={Bot} title="版本列表" />
            <div className="queue-list">
              {aiConfigs.map((config) => (
                <div className="queue-item" key={config.id}>
                  <div>
                    <strong>{config.title}</strong>
                    <span>{config.configType} · {config.version} · 创建 {formatAdminTime(config.createdAt)}{config.publishedAt ? ` · 发布 ${formatAdminTime(config.publishedAt)}` : ""}</span>
                  </div>
                  <div className="button-row compact-actions">
                    <StatusPill status={config.status} />
                    <button className="secondary-button" onClick={() => setAiForm({ id: config.id, configType: config.configType, version: config.version, title: config.title, content: config.content, status: config.status })}>编辑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MessagesView({
  session,
  onLogin,
  setNotice
}: {
  session: Session | null;
  onLogin: () => void;
  setNotice: (message: string) => void;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [readingId, setReadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    studentApi.messages(session.token).then(setMessages).catch(() => undefined);
  }, [session?.token]);

  async function readAll() {
    if (!session) {
      onLogin();
      return;
    }
    await studentApi.readAllMessages(session.token);
    setMessages(await studentApi.messages(session.token));
    setNotice("消息已全部标记为已读");
  }

  async function readOne(id: number) {
    if (!session) {
      onLogin();
      return;
    }
    setReadingId(id);
    try {
      await studentApi.readMessage(session.token, id);
      setMessages((current) => current.map((message) => (
        message.id === id ? { ...message, read: true } : message
      )));
      setNotice("消息已标记为已读");
    } finally {
      setReadingId(null);
    }
  }

  if (!session) {
    return (
      <section className="disclaimer">
        <AlertTriangle size={18} />
        <span>登录后可查看报告生成、审核结果、互动回复和系统提醒。</span>
        <button className="secondary-button" onClick={onLogin}>登录</button>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <SectionTitle icon={Bell} title="消息中心" action="全部已读" onAction={readAll} />
        <div className="queue-list">
          {messages.length === 0 && <div className="empty-state">暂无消息</div>}
          {messages.map((message) => (
            <div className={message.read ? "queue-item read" : "queue-item"} key={message.id}>
              <div>
                <strong>{message.title}</strong>
                <span>{message.type} · {message.body}</span>
              </div>
              <div className="button-row compact-actions">
                <StatusPill status={message.read ? "已读" : "未读"} />
                {!message.read && (
                  <button className="icon-button" title="标记已读" onClick={() => readOne(message.id)} disabled={readingId === message.id}>
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MeView({
  session,
  onLogin,
  setNotice,
  onProfileUpdate,
  onLogout
}: {
  session: Session | null;
  onLogin: () => void;
  setNotice: (message: string) => void;
  onProfileUpdate: (profile: StudentProfile) => void;
  onLogout: () => void;
}) {
  const emptyProfileForm = {
    name: "",
    college: "",
    major: "",
    phone: "",
    nickname: ""
  };
  const [history, setHistory] = useState<Array<{ id: number; reportVersion: string; generatedAt: string; topPath: string; topScore: number }>>([]);
  const [community, setCommunity] = useState<Record<string, CommunityPost[]>>({ posts: [], favorites: [] });
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PostDraft>(emptyPostDraft);
  const [editSaving, setEditSaving] = useState(false);
  const [postError, setPostError] = useState("");
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const profileMajors = majorsForCollege(profileForm.college);

  useEffect(() => {
    if (!session) return;
    setProfileForm({
      name: session.profile.name || "",
      college: session.profile.college || "",
      major: session.profile.major || "",
      phone: session.profile.phone || "",
      nickname: session.profile.nickname === "Compass 用户" ? "" : session.profile.nickname || ""
    });
    studentApi.reportHistory(session.token).then(setHistory).catch(() => undefined);
    studentApi.favorites(session.token).then((items) => setFavoriteItems(visibleFavoriteItems(items))).catch(() => undefined);
    refreshCommunity(session.token).catch(() => undefined);
  }, [session?.token]);

  async function refreshCommunity(token = session?.token) {
    if (!token) return;
    const next = await api<Record<string, CommunityPost[]>>("/api/user/community", {}, token);
    setCommunity(next);
  }

  function beginEdit(post: CommunityPost) {
    setEditingPostId(post.id);
    setEditDraft(draftFromPost(post));
    setPostError("");
  }

  function cancelEdit() {
    setEditingPostId(null);
    setEditDraft(emptyPostDraft);
    setPostError("");
  }

  async function saveEdit() {
    if (!session || editingPostId === null) {
      onLogin();
      return;
    }
    if (!editDraft.title.trim() || !editDraft.body.trim()) {
      setPostError("标题和正文不能为空");
      return;
    }
    setEditSaving(true);
    setPostError("");
    try {
      await communityApi.update(
        session.token,
        editingPostId,
        editDraft.title,
        editDraft.body,
        editDraft.path,
        editDraft.type,
        editDraft.anonymous,
        editDraft.imageUrls
      );
      await refreshCommunity(session.token);
      cancelEdit();
      setNotice("内容已重新提交审核，审核通过后会公开展示");
    } catch (exception) {
      setPostError(exception instanceof Error ? exception.message : "保存失败");
    } finally {
      setEditSaving(false);
    }
  }

  async function deletePost(post: CommunityPost) {
    if (!session) {
      onLogin();
      return;
    }
    if (!window.confirm("确认删除这条内容？删除后前台不再展示，后台会保留审计记录。")) return;
    await communityApi.remove(session.token, post.id);
    await refreshCommunity(session.token);
    if (editingPostId === post.id) cancelEdit();
    setNotice("内容已删除，审计记录已保留");
  }

  async function saveProfileEdit() {
    if (!session) {
      onLogin();
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      const next = await studentApi.saveProfile(session.token, {
        ...profileForm,
        privacy: { hideSensitive: true }
      });
      onProfileUpdate(next);
      setProfileForm({
        name: next.name || "",
        college: next.college || "",
        major: next.major || "",
        phone: next.phone || "",
        nickname: next.nickname === "Compass 用户" ? "" : next.nickname || ""
      });
      setEditingProfile(false);
      setNotice("个人信息已更新，后续 AI 访谈会使用新的学院和专业上下文");
    } catch (exception) {
      setProfileError(exception instanceof Error ? exception.message : "保存失败");
    } finally {
      setProfileSaving(false);
    }
  }

  async function cancel() {
    if (!session) {
      onLogin();
      return;
    }
    if (!window.confirm("确认申请注销账号？提交后账号会进入注销中状态。")) return;
    await studentApi.cancelAccount(session.token, "用户在个人中心发起注销申请");
    setNotice("注销申请已提交，账号进入注销中状态");
    onLogout();
  }

  if (!session) {
    return (
      <section className="disclaimer">
        <AlertTriangle size={18} />
        <span>登录后可维护个人资料、查看历史报告、我的帖子和收藏。</span>
        <button className="secondary-button" onClick={onLogin}>登录</button>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="content-grid two">
        <div className="surface">
          <SectionTitle
            icon={UserRound}
            title="个人资料"
            action={editingProfile ? "收起" : "编辑"}
            onAction={() => {
              setEditingProfile(!editingProfile);
              setProfileError("");
            }}
          />
          {!editingProfile ? (
            <div className="profile-lines">
              <span>邮箱：{session.profile.email}</span>
              <span>学号：{studentNoFromEmail(session.profile.email) || session.profile.studentNo || "未识别"}</span>
              <span>姓名：{session.profile.name || "未填写"}</span>
              <span>手机号：{session.profile.phone || "未填写"}</span>
              <span>学院：{session.profile.college || "未填写"}</span>
              <span>专业：{session.profile.major || "未填写"}</span>
              <span>昵称：{session.profile.nickname || "未填写"}</span>
              <span>状态：{session.profile.status}</span>
            </div>
          ) : (
            <div className="profile-edit-panel">
              <div className="form-grid">
                <label>
                  <span>姓名</span>
                  <input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} />
                </label>
                <label>
                  <span>手机号</span>
                  <input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value.replace(/\D/g, "").slice(0, 11) })} />
                </label>
                <label>
                  <span>学院</span>
                  <select value={profileForm.college} onChange={(event) => setProfileForm({ ...profileForm, college: event.target.value, major: "" })}>
                    <option value="">请选择学院</option>
                    {collegeOptions.map((college) => (
                      <option value={college} key={college}>{college}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>专业</span>
                  <select value={profileForm.major} onChange={(event) => setProfileForm({ ...profileForm, major: event.target.value })} disabled={!profileForm.college}>
                    <option value="">请选择专业</option>
                    {profileMajors.map((major) => (
                      <option value={major} key={major}>{major}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>昵称</span>
                  <input value={profileForm.nickname} placeholder="可选，不填写则前台显示匿名用户" onChange={(event) => setProfileForm({ ...profileForm, nickname: event.target.value })} />
                </label>
              </div>
              <div className="readonly-line">
                学号：{studentNoFromEmail(session.profile.email) || session.profile.studentNo || "未识别"}；学校邮箱不可在此修改
              </div>
              {profileError && <p className="form-error">{profileError}</p>}
              <div className="button-row">
                <button className="primary-button" onClick={saveProfileEdit} disabled={profileSaving}>
                  {profileSaving ? "保存中..." : "保存个人信息"}
                </button>
                <button className="secondary-button" onClick={() => setEditingProfile(false)} disabled={profileSaving}>取消</button>
              </div>
            </div>
          )}
          <button className="secondary-button" onClick={cancel}>申请注销账号</button>
        </div>
        <div className="surface">
          <SectionTitle icon={FileText} title="历史报告" />
          <div className="queue-list">
            {history.map((item) => (
              <div className="queue-item" key={item.id}>
                <div>
                  <strong>{item.topScore > 0 ? `${item.topPath} · ${item.topScore}` : item.topPath}</strong>
                  <span>{item.reportVersion} · {item.generatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="content-grid two">
        <div className="surface">
          <SectionTitle icon={MessagesSquare} title="我的帖子/提问" />
          {editingPostId !== null && (
            <>
              <PostEditor
                draft={editDraft}
                onChange={setEditDraft}
                onSave={saveEdit}
                onCancel={cancelEdit}
                saving={editSaving}
              />
              {postError && <p className="form-error">{postError}</p>}
            </>
          )}
          <PostList posts={community.posts || []} manageable onEdit={beginEdit} onDelete={deletePost} />
        </div>
        <div className="surface">
          <SectionTitle icon={Star} title="我的收藏" />
          <div className="queue-list favorite-resource-list">
            {favoriteItems.map((item) => (
              <div className="queue-item" key={`${item.itemType}-${item.itemId}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.itemType === "report" ? "AI 报告" : "资讯内容"} · {formatAdminTime(item.createdAt)}</span>
                </div>
                {item.url && (
                  <button className="icon-button" title="打开" onClick={() => {
                    if (item.url?.startsWith("http")) window.open(item.url, "_blank", "noopener,noreferrer");
                  }}>
                    <ExternalLink size={16} />
                  </button>
                )}
              </div>
            ))}
            {favoriteItems.length === 0 && (community.favorites || []).length === 0 && <div className="empty-state">暂无收藏</div>}
          </div>
          <PostList posts={community.favorites || []} />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  action,
  onAction
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function PathMiniCard({ path }: { path: PathInfo }) {
  return (
    <article className="path-card" style={{ borderTopColor: path.accent }}>
      <strong>{path.name}</strong>
      <span>{path.subtitle}</span>
      <div className="mini-score">
        <b>{path.match}</b>
        <small>匹配度</small>
      </div>
    </article>
  );
}

function HomePathIntroCard({ path }: { path: PathInfo }) {
  return (
    <article className="home-path-card" style={{ borderLeftColor: path.accent }}>
      <div>
        <strong>{path.name}</strong>
        <p>{path.subtitle}</p>
      </div>
      <div className="home-path-tags">
        {(path.suitable.length ? path.suitable : ["资料模板", "资讯图表", "经验问答"]).slice(0, 3).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </article>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-list">
      <h3>{title}</h3>
      {items.length === 0 && <p>敬请期待</p>}
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function ResourceTable({ filter, session, onLogin }: { filter?: string; session?: Session | null; onLogin?: () => void }) {
  const [resources, setResources] = useState<TemplateResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    publicApi.templates(filter || "")
      .then(setResources)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [filter]);

  async function downloadResource(resource: TemplateResource) {
    if (!session?.token) {
      onLogin?.();
      return;
    }
    if (!resource.url) return;
    try {
      if (resource.id) {
        await studentApi.recordTemplateDownload(session.token, Number(resource.id));
      }
    } catch (exception) {
      window.alert(exception instanceof Error ? exception.message : "该资源暂不可下载");
      return;
    }
    const link = document.createElement("a");
    link.href = `${resource.url}?t=${Date.now()}`;
    link.download = `${resource.name}.${resource.format.toLowerCase()}`;
    link.click();
  }

  const rows = resources;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>模板名称</th>
            <th>路径</th>
            <th>格式</th>
            <th>更新</th>
            <th>下载</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5}>正在加载模板...</td>
            </tr>
          )}
          {!loading && failed && (
            <tr>
              <td colSpan={5}>内容加载失败，请刷新重试</td>
            </tr>
          )}
          {!loading && !failed && rows.length === 0 && (
            <tr>
              <td colSpan={5}>敬请期待</td>
            </tr>
          )}
          {rows.map((resource) => (
            <tr key={resource.id ?? resource.name}>
              <td>{resource.name}</td>
              <td>{resource.path}</td>
              <td>{resource.format}</td>
              <td>{resource.updatedAt}</td>
              <td>
                {resource.url ? (
                  <button
                    className="icon-button"
                    title={`下载${resource.name}`}
                    onClick={() => downloadResource(resource)}
                    aria-label={`下载${resource.name}`}
                  >
                    <Download size={16} />
                  </button>
                ) : (
                  <button className="icon-button" title="暂无下载文件" disabled>
                    <Download size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostList({
  posts,
  interactive = false,
  manageable = false,
  manageableIds,
  showActions = true,
  clickable = false,
  onOpen,
  onLike,
  onFavorite,
  onReport,
  onEdit,
  onDelete,
  onAuthor,
  emptyLabel = "暂无内容"
}: {
  posts: CommunityPost[];
  interactive?: boolean;
  manageable?: boolean;
  manageableIds?: Set<number>;
  showActions?: boolean;
  clickable?: boolean;
  onOpen?: (post: CommunityPost) => void;
  onLike?: (id: number) => void;
  onFavorite?: (id: number) => void;
  onReport?: (id: number) => void;
  onEdit?: (post: CommunityPost) => void;
  onDelete?: (post: CommunityPost) => void;
  onAuthor?: (authorId?: number) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="post-list">
      {posts.length === 0 && <div className="empty-state">{emptyLabel}</div>}
      {posts.map((post) => {
        const canManage = manageable || Boolean(manageableIds?.has(post.id));
        const clickablePost = clickable && Boolean(onOpen);
        return (
          <article
            className={clickablePost ? "post-item clickable-row" : "post-item"}
            key={post.id}
          >
            <div
              className="post-main"
              role={clickablePost ? "button" : undefined}
              tabIndex={clickablePost ? 0 : undefined}
              onClick={clickablePost ? () => onOpen?.(post) : undefined}
              onKeyDown={clickablePost ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen?.(post);
                }
              } : undefined}
            >
              <div className="post-meta">
                <span>{post.type}</span>
                <span>{post.path}</span>
                <StatusPill status={post.status} />
              </div>
              <h3>{post.title}</h3>
              <p>{post.summary || post.body}</p>
              <PostImageGrid imageUrls={post.imageUrls} />
              <small>
                {post.authorId && onAuthor ? (
                  <button type="button" className="text-button inline-author-link" onClick={(event) => {
                    event.stopPropagation();
                    onAuthor(post.authorId);
                  }}>
                    {post.author || post.authorDisplay || "匿名用户"}
                  </button>
                ) : (post.author || post.authorDisplay || "匿名用户")}
                {" · "}{post.createdAt}
              </small>
            </div>
            {showActions && (
              <div className="post-actions">
                <button
                  className={post.liked ? "icon-button active-interaction" : "icon-button"}
                  title={post.liked ? "已点赞" : "点赞"}
                  aria-pressed={Boolean(post.liked)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onLike?.(post.id);
                  }}
                >
                  <Heart size={16} fill={post.liked ? "currentColor" : "none"} />
                  <span>{post.likes}</span>
                </button>
                <button
                  className={post.favorited ? "icon-button active-interaction" : "icon-button"}
                  title={post.favorited ? "已收藏" : "收藏"}
                  aria-pressed={Boolean(post.favorited)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFavorite?.(post.id);
                  }}
                >
                  <Star size={16} fill={post.favorited ? "currentColor" : "none"} />
                  <span>{post.favorites}</span>
                </button>
              {interactive && (
                <button className="icon-button" title="举报" onClick={(event) => {
                  event.stopPropagation();
                  onReport?.(post.id);
                }}>
                  <Flag size={16} />
                </button>
              )}
              {canManage && onEdit && (
                <button className="icon-button" title="编辑" onClick={(event) => {
                  event.stopPropagation();
                  onEdit(post);
                }}>
                  <PenLine size={16} />
                </button>
              )}
              {canManage && onDelete && (
                <button className="icon-button danger-icon" title="删除" onClick={(event) => {
                  event.stopPropagation();
                  onDelete(post);
                }}>
                  <Trash2 size={16} />
                </button>
              )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PostImageGrid({ imageUrls, detail = false }: { imageUrls?: string[]; detail?: boolean }) {
  const urls = (imageUrls || []).filter(Boolean);
  if (urls.length === 0) return null;
  return (
    <div className={detail ? "post-image-grid detail-image-grid" : "post-image-grid"}>
      {urls.map((url, index) => (
        <a href={url} target="_blank" rel="noreferrer" key={`${url}-${index}`}>
          <img src={url} alt={`帖子图片 ${index + 1}`} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function PostEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving
}: {
  draft: PostDraft;
  onChange: (draft: PostDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="post-editor">
      <div className="form-grid compact-form">
        <label>
          <span>标题</span>
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
        <label>
          <span>路径</span>
          <select value={draft.path} onChange={(event) => onChange({ ...draft, path: event.target.value })}>
            <option value="就业">就业</option>
            <option value="考公">考公</option>
            <option value="考研">考研</option>
          </select>
        </label>
        <label>
          <span>类型</span>
          <select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value })}>
            <option value="问答">问答</option>
            <option value="经验帖">经验帖</option>
          </select>
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={draft.anonymous} onChange={(event) => onChange({ ...draft, anonymous: event.target.checked })} />
          匿名发布
        </label>
      </div>
      <textarea value={draft.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} />
      {draft.imageUrls.length > 0 && (
        <div className="edit-image-list">
          {draft.imageUrls.map((url, index) => (
            <div className="edit-image-item" key={`${url}-${index}`}>
              <img src={url} alt={`已添加图片 ${index + 1}`} />
              <button className="secondary-button" onClick={() => onChange({ ...draft, imageUrls: draft.imageUrls.filter((_, itemIndex) => itemIndex !== index) })}>
                移除
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="button-row">
        <button className="primary-button" onClick={onSave} disabled={saving}>
          <Save size={16} />
          {saving ? "保存中..." : "保存并提交审核"}
        </button>
        <button className="secondary-button" onClick={onCancel} disabled={saving}>
          <X size={16} />
          取消
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const kind = status.includes("通过") || status === "启用" || status === "正常" ? "ok" : status.includes("待") || status.includes("处理") ? "warn" : "muted";
  return <span className={`status-pill ${kind}`}>{status}</span>;
}

function pathScoreRows(report: AiReport | null, paths: PathInfo[]) {
  const rankLabels = ["第一推荐", "第二推荐", "第三推荐"];
  if (report?.scores?.length) {
    return report.scores.map((score, index) => ({
      name: score.path,
      score: score.score,
      rank: score.rank || rankLabels[index] || "备选路径",
      color: pathColor(score.path),
      reasons: score.reasons || []
    }));
  }
  return [...paths]
    .sort((left, right) => right.match - left.match)
    .map((path, index) => ({
      name: path.name,
      score: path.match,
      rank: rankLabels[index] || "基础匹配",
      color: path.accent || pathColor(path.name),
      reasons: path.suitable || []
    }));
}

function reportDimensionRows(report: AiReport | null) {
  return report?.dimensions?.map((item) => ({
    subject: item.subject,
    考公: item.civil,
    考研: item.postgraduate,
    就业: item.employment
  })) ?? [];
}

function reportScoreForPath(report: AiReport | null, pathName: string) {
  if (!report?.scores?.length) return null;
  const score = report.scores.find((item) => item.path === pathName || item.path.includes(pathName) || pathName.includes(item.path));
  return score?.score ?? null;
}

const chartPalette = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#475569"];

function pathColor(path: string) {
  if (path.includes("考公")) return "#2563eb";
  if (path.includes("考研")) return "#0f766e";
  return "#b45309";
}

export default App;
