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
import { useEffect, useMemo, useRef, useState } from "react";
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
  type AiConfigItem,
  type AbuseReportItem,
  type ChartItem,
  type CommunityComment,
  type ContentItem,
  type CrawlCandidateItem,
  type AiReport,
  type CrawlSource,
  type Dashboard,
  type HomePayload,
  type InterviewMessage,
  type MessageItem,
  type PathConfigItem,
  type PathPage,
  type ReportTask,
  type Session,
  type StudentAdminItem,
  type TagItem,
  type WorkbenchResponse
} from "./api";
import {
  adminQueue
} from "./data";
import type { CommunityPost, PathInfo, TemplateResource } from "./types";

type TabKey = "home" | "workspace" | "report" | "paths" | "charts" | "community" | "messages" | "me" | "admin";

type PostDraft = {
  title: string;
  body: string;
  path: string;
  type: string;
  anonymous: boolean;
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

const collegeOptions = ["外语学院", "光电学院", "管理学院", "能动学院", "沪江学院", "马克思主义学院", "机械学院"];

const emptyPostDraft: PostDraft = {
  title: "",
  body: "",
  path: "就业",
  type: "问答",
  anonymous: true
};

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
    anonymous: post.anonymous ?? true
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function onlyChinese(value: string) {
  return value.replace(/[^\u4e00-\u9fa5]/g, "");
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

const navItems: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "home", label: "首页", icon: LayoutDashboard },
  { key: "workspace", label: "工作台", icon: ClipboardList },
  { key: "report", label: "AI 报告", icon: Sparkles },
  { key: "paths", label: "三路径", icon: Route },
  { key: "charts", label: "图表", icon: BarChart3 },
  { key: "community", label: "社区", icon: MessagesSquare },
  { key: "messages", label: "消息", icon: Bell },
  { key: "me", label: "个人", icon: UserRound },
  { key: "admin", label: "后台", icon: ShieldCheck }
];

const compactStats = [
  { key: "registeredStudents", label: "注册学生", value: "—", trend: "等待数据库", icon: Users },
  { key: "completionRate", label: "测评完成率", value: "—", trend: "等待数据库", icon: CheckCircle2 },
  { key: "reportCount", label: "报告生成量", value: "—", trend: "等待数据库", icon: FileText },
  { key: "pendingReviews", label: "待审核项", value: "—", trend: "等待数据库", icon: Clock3 }
];

const metricIconMap = {
  registeredStudents: Users,
  completionRate: CheckCircle2,
  reportCount: FileText,
  pendingReviews: Clock3
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
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
  const pathScrollYRef = useRef(0);
  const pendingPathScrollYRef = useRef<number | null>(null);

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
    const token = localStorage.getItem("career-compass-token");
    if (!token) return;
    authApi.me(token)
      .then(async (profile) => {
        setSession({ token, role: "student", status: profile.status, profile });
        await refreshReportState(token);
      })
      .catch(() => localStorage.removeItem("career-compass-token"));
  }, []);

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

  function logout() {
    localStorage.removeItem("career-compass-token");
    setSession(null);
    setReport(null);
    setReportTask(null);
  }

  function rememberPathScrollPosition() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    pathScrollYRef.current = y;
    console.log("[scroll] SAVE", { windowScrollY: window.scrollY, docScrollTop: document.documentElement.scrollTop, saved: y });
  }

  function returnToPathsWithScroll() {
    pendingPathScrollYRef.current = pathScrollYRef.current;
    console.log("[scroll] RETURN", { pending: pendingPathScrollYRef.current });
    setActiveTab("paths");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          <div>
            <strong>Career Compass</strong>
            <span>职业规划网站</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={activeTab === item.key ? "nav-item active" : "nav-item"}
                onClick={() => {
                  if (item.key === "charts") setChartToOpen(null);
                  if (item.key === "community") {
                    setCommunityPostToOpen(null);
                    setCommunityDetailOnly(false);
                  }
                  setActiveTab(item.key);
                }}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <LockKeyhole size={16} />
          <span>学生与后台均使用登录凭证，关键操作留痕</span>
        </div>
      </aside>

      <main className="main">
        <Topbar
          activeTab={activeTab}
          apiStatus={apiStatus}
          session={session}
          onLogin={() => setAuthOpen(true)}
          onLogout={logout}
        />
        {notice && <div className="toast">{notice}</div>}
        {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onSession={saveSession} />}
        {activeTab === "home" && <HomeView report={report} />}
        {activeTab === "workspace" && <WorkspaceView session={session} onLogin={() => setAuthOpen(true)} onReport={setReport} onTask={updateReportTask} setNotice={setNotice} />}
        {activeTab === "report" && <ReportView report={report} task={reportTask} session={session} onLogin={() => setAuthOpen(true)} onReport={setReport} onTask={updateReportTask} />}
        {activeTab === "paths" && (
          <PathsView
            report={report}
            session={session}
            selectedPathKey={selectedPathKey}
            onSelectedPathKeyChange={setSelectedPathKey}
            pendingScrollRef={pendingPathScrollYRef}
            onOpenChart={(chart) => {
              rememberPathScrollPosition();
              setChartToOpen(chart.id);
              setActiveTab("charts");
            }}
            onOpenCommunityPost={(post) => {
              rememberPathScrollPosition();
              setCommunityPostToOpen(post.id);
              setCommunityDetailOnly(true);
              setActiveTab("community");
            }}
          />
        )}
        {activeTab === "charts" && (
          <ChartsView
            session={session}
            openChartId={chartToOpen}
            onBackToPaths={chartToOpen ? () => {
              setChartToOpen(null);
              returnToPathsWithScroll();
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
              returnToPathsWithScroll();
            } : undefined}
          />
        )}
        {activeTab === "messages" && <MessagesView session={session} onLogin={() => setAuthOpen(true)} setNotice={setNotice} />}
        {activeTab === "me" && <MeView session={session} onLogin={() => setAuthOpen(true)} setNotice={setNotice} onLogout={() => {
          logout();
        }} />}
        {activeTab === "admin" && <AdminView />}
      </main>
    </div>
  );
}

function Topbar({
  activeTab,
  apiStatus,
  session,
  onLogin,
  onLogout
}: {
  activeTab: TabKey;
  apiStatus: "checking" | "up" | "down";
  session: Session | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const label = navItems.find((item) => item.key === activeTab)?.label ?? "首页";
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">本科应届毕业生未来路径规划平台</p>
        <h1>{label}</h1>
      </div>
      <div className="topbar-actions">
        <span className={`api-status ${apiStatus}`}>
          <span />
          {apiStatus === "up" ? "API 正常" : apiStatus === "down" ? "API 离线" : "API 检查中"}
        </span>
        <button className="icon-button" title="搜索">
          <Search size={18} />
        </button>
        <button className="secondary-button" onClick={session ? onLogout : onLogin}>
          <LogIn size={17} />
          {session ? "退出" : "学生登录"}
        </button>
      </div>
    </header>
  );
}

function AuthPanel({ onClose, onSession }: { onClose: () => void; onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "codeLogin" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function sendCode() {
    setLoading(true);
    setError("");
    try {
      const purpose = mode === "register" ? "register" : mode === "reset" ? "reset_password" : "login";
      const response = await authApi.sendCode(email, purpose);
      setCodeHint(response.debugCode ? `开发模式验证码：${response.debugCode}` : "验证码已发送，请查收邮箱");
      if (response.debugCode) setCode(response.debugCode);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "验证码发送失败");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        onSession(await authApi.login(email, password));
      } else if (mode === "register") {
        onSession(await authApi.registerWithCode(email, password, code));
      } else if (mode === "codeLogin") {
        onSession(await authApi.loginByCode(email, code));
      } else {
        if (!window.confirm("确认重置该账号密码？")) return;
        await authApi.resetPassword(email, code, password);
        setMode("login");
        setError("密码已重置，请使用新密码登录");
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="auth-modal">
        <div className="section-title">
          <div>
            <UserRoundCheck size={18} />
            <h3>{mode === "login" ? "学生登录" : mode === "register" ? "学校邮箱注册" : mode === "codeLogin" ? "验证码登录" : "找回密码"}</h3>
          </div>
          <button className="text-button" onClick={onClose}>关闭</button>
        </div>
        <div className="segmented auth-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>注册</button>
          <button className={mode === "codeLogin" ? "active" : ""} onClick={() => setMode("codeLogin")}>验证码</button>
          <button className={mode === "reset" ? "active" : ""} onClick={() => setMode("reset")}>找回</button>
        </div>
        <label>
          <span>学校邮箱</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {mode !== "codeLogin" && (
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
        {mode !== "login" && (
          <label>
            <span>邮箱验证码</span>
            <div className="inline-control">
              <input value={code} onChange={(event) => setCode(event.target.value)} />
              <button className="secondary-button" onClick={sendCode} disabled={loading}>发送</button>
            </div>
          </label>
        )}
        {codeHint && <p className="helper-text">{codeHint}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" onClick={submit} disabled={loading}>
          {loading ? "处理中..." : mode === "login" ? "登录" : mode === "register" ? "注册" : mode === "codeLogin" ? "验证码登录" : "重置密码"}
        </button>
      </section>
    </div>
  );
}

function HomeView({ report }: { report: AiReport | null }) {
  const [home, setHome] = useState<HomePayload | null>(null);
  const [homePaths, setHomePaths] = useState<PathInfo[]>([]);
  const [homeError, setHomeError] = useState("");

  useEffect(() => {
    publicApi.home().then(setHome).catch((exception) => {
      setHomeError(exception instanceof Error ? exception.message : "首页数据加载失败");
    });
    publicApi.paths()
      .then((pages) => setHomePaths(pages.map(pathPageToInfo)))
      .catch((exception) => {
        setHomeError(exception instanceof Error ? exception.message : "路径配置加载失败");
      });
  }, []);

  const primaryChart = home?.charts.find((chart) => chart.displayPosition === "首页")
    || home?.charts.find((chart) => chart.chartType.includes("趋势"))
    || home?.charts[0];
  const primaryChartRows = Array.isArray(primaryChart?.data?.rows)
    ? primaryChart.data.rows as Array<Record<string, unknown>>
    : [];
  const stats = home?.metrics?.length
    ? home.metrics.map((metric) => ({
        ...metric,
        icon: metricIconMap[metric.key as keyof typeof metricIconMap] || Users
      }))
    : compactStats;
  const featuredPosts = home?.featuredPosts?.length
    ? home.featuredPosts
    : [];
  const noticeItems = home?.notices?.length
    ? home.notices.map((item) => ({ key: `notice-${item.id}`, title: item.title, summary: item.summary }))
    : [
        { key: "notice-local-1", title: "完成基础档案后可进入深度问卷", summary: "问卷和报告会保存到个人账号。" },
        { key: "notice-local-2", title: "公开权威数据先审核后发布", summary: "所有抓取候选均需管理员确认。" }
      ];
  const faqItems = home?.faqs?.length
    ? home.faqs.map((item) => ({ key: `faq-${item.id}`, title: item.title, summary: item.summary }))
    : [
        { key: "faq-local-1", title: "问卷草稿会保存多久？", summary: "草稿会保留最近一次填写进度。" },
        { key: "faq-local-2", title: "AI 报告能替我做决定吗？", summary: "仅供辅助决策，不替代最终选择。" }
      ];
  const latestChartRow = primaryChartRows.length
    ? primaryChartRows[primaryChartRows.length - 1] as Record<string, unknown>
    : {};
  const displayHomePaths = homePaths.map((path) => ({
    ...path,
    match: reportScoreForPath(report, path.name) ?? path.match
  }));
  const reportCompassItems = report?.scores?.length
    ? report.scores.map((score) => ({
        name: score.path,
        color: pathColor(score.path),
        score: score.score
      }))
    : null;
  const compassItems = reportCompassItems ?? displayHomePaths.map((item) => ({
    name: item.name,
    color: item.accent,
    score: Number(latestChartRow[item.name] || item.match || 0)
  }));
  const strongestCompass = compassItems.reduce(
    (best, item) => item.score > best.score ? item : best,
    compassItems[0] || { name: "", color: "#172033", score: 0 }
  );
  const strongestCompassValue = strongestCompass && strongestCompass.score > 0
    ? strongestCompass.score.toFixed(Number.isInteger(strongestCompass.score) ? 0 : 1)
    : "—";

  return (
    <div className="page-stack">
      {homeError && <p className="form-error">{homeError}</p>}
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">三路径均衡覆盖</p>
          <h2>把自我评估、路径比较和行动计划收进同一个工作台。</h2>
          <p>
            面向本校本科应届毕业生，围绕考公、考研、就业完成从测评到社区经验参考的闭环。
          </p>
        </div>
        <div className="compass-visual" aria-label="路径匹配概览">
          <div className="compass-ring">
            {compassItems.map((item, index) => (
              <div className={`orbit orbit-${index + 1}`} key={item.name}>
                <span style={{ background: item.color }}>{item.name}</span>
              </div>
            ))}
            <div className="compass-core">
              <Compass size={34} />
              <strong>{strongestCompassValue}</strong>
              <span>{reportCompassItems ? "个人最高匹配" : "最新最高占比"}</span>
            </div>
          </div>
        </div>
      </section>

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

      <section className="content-grid two">
        <div className="surface">
          <SectionTitle icon={Route} title="三路径入口" />
          <div className="path-strip">
            {displayHomePaths.map((path) => (
              <PathMiniCard key={path.key} path={path} />
            ))}
            {displayHomePaths.length === 0 && <div className="empty-state">路径配置加载中，后台启用后会展示在这里。</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={BarChart3} title="热门图表" />
          <div className="chart-box compact">
            {primaryChartRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={primaryChartRows} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="employmentArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#b45309" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#b45309" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="就业" stroke="#b45309" fill="url(#employmentArea)" strokeWidth={2} />
                  <Line type="monotone" dataKey="考研" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="考公" stroke="#2563eb" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">暂无已发布趋势图，请在后台图表维护中发布。</div>
            )}
          </div>
          <p className="source-line">
            {primaryChart ? `${primaryChart.title} · ${primaryChart.chartType} · 来源：${primaryChart.sourceName}；口径：${primaryChart.methodology}；更新：${primaryChart.updatedAt}` : "等待后台发布首页图表"}
          </p>
          <div className="config-grid compact-config">
            {(home?.charts || []).slice(0, 3).map((chart) => (
              <div className="config-item" key={chart.id}>{chart.title} · {chart.chartType}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid two">
        <div className="surface">
          <SectionTitle icon={MessagesSquare} title="精选经验与问答" />
          <PostList posts={featuredPosts} />
        </div>
        <div className="surface">
          <SectionTitle icon={Flag} title="公告与 FAQ" />
          <div className="notice-list">
            {[...noticeItems, ...faqItems].map((notice) => (
              <div className="notice-item" key={notice.key}>
                <CheckCircle2 size={16} />
                <span><strong>{notice.title}</strong>{notice.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
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
  const emptyProfile = {
    name: "",
    studentNo: "",
    college: "",
    major: "",
    graduationYear: "",
    phone: "",
    nickname: ""
  };
  const [profile, setProfile] = useState({
    name: session?.profile.name || "",
    studentNo: studentNoFromEmail(session?.profile.email) || session?.profile.studentNo || "",
    college: session?.profile.college || "",
    major: session?.profile.major || "",
    graduationYear: session?.profile.graduationYear || "",
    phone: session?.profile.phone || "",
    nickname: session?.profile.nickname === "Compass 用户" ? "" : session?.profile.nickname || ""
  });
  const [assessment, setAssessment] = useState<Record<string, unknown>>({});
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([
    {
      role: "assistant",
      content: "你可以从这两个入口里任选一个说起：最近让你纠结的一件事，或者一段项目、实习、课程、考证经历；如果愿意，也可以顺带说说城市、家庭、收入、成长里你最在意哪一两个因素。"
    }
  ]);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewProgress, setInterviewProgress] = useState(0);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [interviewExploreTopics, setInterviewExploreTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [workbench, setWorkbench] = useState<WorkbenchResponse | null>(null);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    if (!session) {
      setProfile(emptyProfile);
      return;
    }
    setProfile({
      name: session.profile.name || "",
      studentNo: studentNoFromEmail(session.profile.email) || session.profile.studentNo || "",
      college: session.profile.college || "",
      major: session.profile.major || "",
      graduationYear: session.profile.graduationYear || "",
      phone: session.profile.phone || "",
      nickname: session.profile.nickname === "Compass 用户" ? "" : session.profile.nickname || ""
    });
    studentApi.latestDraft(session.token)
      .then((draft) => {
        if (draft?.answers) {
          setAssessment(draft.answers);
          setInterviewProgress(draft.completionPercent || 0);
        }
      })
      .catch(() => undefined);
    studentApi.workbench(session.token).then(setWorkbench).catch(() => undefined);
  }, [session?.token]);

  async function saveProfile() {
    if (!session) {
      onLogin();
      return;
    }
    setSaving(true);
    try {
      await studentApi.saveProfile(session.token, {
        ...profile,
        studentNo: studentNoFromEmail(session.profile.email),
        privacy: { hideSensitive: true }
      });
      setNotice("档案已写入数据库，账号状态进入问卷阶段");
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function submitAssessment() {
    if (!session) {
      onLogin();
      return;
    }
    setSaving(true);
    setReportMessage("报告生成任务提交中...");
    try {
      const task = await studentApi.submitAssessment(session.token, assessment);
      onTask(task);
      setReportMessage(task.message || "AI 报告正在生成");
      if (task.status === "已完成" && task.report) {
        onReport(task.report);
        onTask(task);
        studentApi.workbench(session.token).then(setWorkbench).catch(() => undefined);
        setNotice("问卷快照和 AI 报告已保存，可进入 AI 报告页查看");
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

  async function saveDraft() {
    if (!session) {
      onLogin();
      return;
    }
    setSaving(true);
    try {
      await studentApi.saveDraft(session.token, assessment, interviewProgress, "ai-interview");
      setNotice("访谈快照已保存，下次进入可继续补充");
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : "草稿保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      {!session && (
        <section className="disclaimer">
          <AlertTriangle size={18} />
          <span>请先登录或注册学校邮箱账号。登录后档案、问卷和报告会真实保存到数据库。</span>
          <button className="secondary-button" onClick={onLogin}>登录</button>
        </section>
      )}
      <section className="content-grid split">
        <div className="surface">
          <SectionTitle icon={UserRoundCheck} title="基础档案" />
          <div className="form-grid">
            {[
              ["姓名", "name"],
              ["毕业年份", "graduationYear"],
              ["手机号", "phone"]
            ].map(([label, key]) => (
              <label key={label}>
                <span>{label}</span>
                <input
                  value={profile[key as keyof typeof profile]}
                  onChange={(event) => setProfile({ ...profile, [key]: event.target.value })}
                />
              </label>
            ))}
            <label>
              <span>专业</span>
              <input
                value={profile.major}
                placeholder="仅限中文"
                onChange={(event) => setProfile({ ...profile, major: onlyChinese(event.target.value) })}
              />
            </label>
            <label>
              <span>学院</span>
              <select value={profile.college} onChange={(event) => setProfile({ ...profile, college: event.target.value })}>
                <option value="">请选择学院</option>
                {collegeOptions.map((college) => (
                  <option value={college} key={college}>{college}</option>
                ))}
              </select>
            </label>
            <label>
              <span>昵称</span>
              <input value={profile.nickname} placeholder="可选，不填写则前台显示匿名用户" onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} />
            </label>
          </div>
          <div className="readonly-line">
            学号：{session ? studentNoFromEmail(session.profile.email) || "无法从邮箱识别" : "登录后从学校邮箱自动识别"}
          </div>
          <div className="privacy-row">
            <label>
              <input type="checkbox" defaultChecked />
              默认不公开真实姓名、学号、手机号
            </label>
            <button className="primary-button" onClick={saveProfile} disabled={saving}>保存档案</button>
          </div>
        </div>

        <div className="surface status-surface">
          <SectionTitle icon={Bot} title="AI 路径访谈" />
          <div className="stepper">
            {["邮箱验证", "基础档案", "AI 访谈", "AI 报告"].map((step, index) => (
              <div className={index < 2 || (index === 2 && interviewProgress > 0) ? "step done" : "step"} key={step}>
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
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={saveDraft} disabled={saving}>保存访谈快照</button>
            <button className="primary-button" onClick={generateFromInterview} disabled={saving || interviewLoading}>
              <Sparkles size={17} />
              {saving ? "生成中..." : readyToGenerate ? "生成报告" : "生成报告草案"}
            </button>
          </div>
          {reportMessage && <p className="helper-text">{reportMessage}</p>}
        </div>
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
            {!workbench?.todos.length && <div className="empty-state">生成 AI 报告后，会从行动计划里生成你的待办。</div>}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={Sparkles} title="当前主路径" />
          <div className="workbench-summary">
            <strong>{workbench?.mainPath || "完成问卷后生成"}</strong>
            <span>备选：{workbench?.alternativePaths?.join(" / ") || "考公 / 考研 / 就业"}</span>
            {workbench?.staleReport && <p className="form-error">档案已更新，建议重新生成报告。</p>}
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
            {!workbench?.timeline.length && <ResourceTable />}
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
  onTask
}: {
  report: AiReport | null;
  task: ReportTask | null;
  session: Session | null;
  onLogin: () => void;
  onReport: (report: AiReport) => void;
  onTask: (task: ReportTask | null) => void;
}) {
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswers, setChatAnswers] = useState<Array<{ question: string; answer: AiAnswer }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const scoreRows = (report?.scores ?? []).map((score) => ({ name: score.path, score: score.score, rank: score.rank, color: pathColor(score.path), reasons: score.reasons ?? [] }));
  const dimensionRows = reportDimensionRows(report);
  const planRows = report?.plan ?? [];
  const riskRows = report?.risks ?? [];
  const alternativeRows = report?.alternatives ?? [];

  async function askReport() {
    if (!session) {
      onLogin();
      return;
    }
    if (!report || !chatQuestion.trim()) return;
    setChatLoading(true);
    try {
      const answer = await studentApi.chat(session.token, report.id, chatQuestion);
      setChatAnswers([...chatAnswers, { question: chatQuestion, answer }]);
      setChatQuestion("");
    } finally {
      setChatLoading(false);
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
        <span>{report?.disclaimer || "AI 报告仅供辅助决策，不替代学生最终选择。报告会基于你完成的 AI 访谈生成。"}</span>
        {!session && <button className="secondary-button" onClick={onLogin}>登录生成真实报告</button>}
      </section>
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
      {!report && (
        <section className="surface">
          <SectionTitle icon={Sparkles} title="暂无 AI 报告" />
          <div className="empty-state">当前账号还没有已完成的 AI 报告。完成工作台里的 AI 访谈并生成报告后，这里会显示路径评分、维度对比、行动计划和报告追问。</div>
        </section>
      )}
      {report && (
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
          <div className="reason-box">
            <strong>现状摘要</strong>
            <p>{report.summary || "这份报告暂未返回现状摘要，请重新生成报告。"}</p>
          </div>
          {scoreRows[0]?.reasons.length > 0 && (
            <div className="reason-box">
              <strong>{scoreRows[0].name} 推荐依据</strong>
              <p>{scoreRows[0].reasons.join("；")}</p>
            </div>
          )}
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
                <p>{item.actions.join("；")}</p>
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
      <section className="surface ai-chat">
        <SectionTitle icon={Bot} title="报告追问" />
        <div className="chat-history">
          {chatAnswers.length === 0 && (
            <div className="message assistant">围绕当前报告继续追问，系统会按问题理解、影响因素、路径比较、建议和提醒结构化回答。</div>
          )}
          {chatAnswers.map((item) => (
            <div className="chat-pair" key={item.question}>
              <div className="message user">{item.question}</div>
              <div className="message assistant">
                <strong>{item.answer.questionUnderstanding}</strong>
                <p>{item.answer.advice.join("；")}</p>
                <small>{item.answer.reminders.join("；")}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="围绕当前报告继续追问" />
          <button className="primary-button" title="发送" onClick={askReport} disabled={chatLoading || !report}>
            <Send size={17} />
            {chatLoading ? "发送中" : "发送"}
          </button>
        </div>
      </section>
        </>
      )}
    </div>
  );
}

function PathsView({
  report,
  session,
  selectedPathKey,
  onSelectedPathKeyChange,
  pendingScrollRef,
  onOpenChart,
  onOpenCommunityPost
}: {
  report: AiReport | null;
  session: Session | null;
  selectedPathKey: string;
  onSelectedPathKeyChange: (key: string) => void;
  pendingScrollRef: React.MutableRefObject<number | null>;
  onOpenChart: (chart: ChartItem) => void;
  onOpenCommunityPost: (post: CommunityPost) => void;
}) {
  const [paths, setPaths] = useState<PathInfo[]>([]);
  const [pathPage, setPathPage] = useState<PathPage | null>(null);
  const [pathCharts, setPathCharts] = useState<ChartItem[]>([]);
  const [pathPosts, setPathPosts] = useState<CommunityPost[]>([]);
  const [pathError, setPathError] = useState("");
  const selected = paths.find((path) => path.key === selectedPathKey) || paths[0] || null;
  const selectedScore = selected ? reportScoreForPath(report, selected.name) ?? selected.match : 0;

  useEffect(() => {
    publicApi.paths()
      .then((pages) => {
        const next = pages.map(pathPageToInfo);
        setPaths(next);
        if (!selectedPathKey && next[0]) onSelectedPathKeyChange(next[0].key);
      })
      .catch((exception) => setPathError(exception instanceof Error ? exception.message : "路径配置加载失败"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPathError("");
    publicApi.path(selected.key).then(setPathPage).catch((exception) => {
      setPathPage(null);
      setPathError(exception instanceof Error ? exception.message : "路径详情加载失败");
    });
    api<ChartItem[]>(`/api/charts?path=${encodeURIComponent(selected.name)}`).then(setPathCharts).catch(() => setPathCharts([]));
    communityApi.list({ path: selected.name }).then(setPathPosts).catch(() => setPathPosts([]));
    if (session?.token) {
      studentApi.recordActivity(session.token, "path", selected.key, `${selected.name}路径页`, `/paths/${selected.key}`).catch(() => undefined);
    }
  }, [selected?.key, selected?.name, session?.token]);

  // 从图表/问答返回时恢复滚动位置，等数据加载完 DOM 落位后再滚
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    console.log("[scroll] RESTORE effect firing", {
      hasSelected: !!selected,
      hasPathPage: !!pathPage,
      pendingScroll: pendingScrollRef.current,
      alreadyRestored: scrollRestoredRef.current,
      scrollHeight: document.documentElement.scrollHeight,
      currentScrollY: window.scrollY,
    });

    if (!selected || !pathPage || pendingScrollRef.current === null) return;
    if (scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;

    const scrollY = pendingScrollRef.current;
    console.log("[scroll] RESTORE starting", { target: scrollY });

    const restore = () => {
      const before = window.scrollY;
      if (document.documentElement.scrollHeight > scrollY) {
        window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
        console.log("[scroll] RESTORE attempt", { target: scrollY, before, after: window.scrollY, scrollHeight: document.documentElement.scrollHeight });
      } else {
        console.log("[scroll] RESTORE skipped (page too short)", { target: scrollY, scrollHeight: document.documentElement.scrollHeight });
      }
    };

    restore();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      restore();
      raf2 = window.requestAnimationFrame(() => {
        restore();
        // consume the ref after the DOM has settled
        pendingScrollRef.current = null;
        console.log("[scroll] RESTORE complete, ref consumed");
      });
    });
    const t1 = window.setTimeout(restore, 160);
    const t2 = window.setTimeout(restore, 420);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      scrollRestoredRef.current = false;
    };
  }, [selected, pathPage, pendingScrollRef]);

  if (!selected) {
    return (
      <div className="page-stack">
        {pathError && <p className="form-error">{pathError}</p>}
        <section className="surface">
          <SectionTitle icon={Route} title="三路径配置" />
          <div className="empty-state">暂无启用路径，请先在后台维护三路径配置。</div>
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
      <section className="surface path-template-spotlight">
        <SectionTitle icon={Download} title={`${selected.name}路线资料模板`} />
        <ResourceTable filter={selected.name} />
      </section>
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
                  <button className="icon-button" title="查看来源" onClick={() => window.open(item.sourceUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink size={16} />
                  </button>
                )}
              </div>
            ))}
            {(!pathPage?.highlights || pathPage.highlights.length === 0) && <div className="empty-state">暂无审核资讯</div>}
          </div>
        </div>
        <aside className="path-side-stack">
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
              {pathCharts.length === 0 && <div className="empty-state">暂无相关图表</div>}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={MessagesSquare} title="路径经验与问答" />
            <PostList posts={pathPosts.slice(0, 3)} onOpen={onOpenCommunityPost} showActions={false} clickable />
          </div>
        </aside>
      </section>
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
  const [graduationYearFilter, setGraduationYearFilter] = useState("");

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
    setGraduationYearFilter("");
  }, [openChartId]);

  useEffect(() => {
    publicApi.charts({
      path: pathFilter,
      college: collegeFilter,
      major: majorFilter,
      graduationYear: graduationYearFilter
    }).then(setChartItems).catch(() => undefined);
    if (session?.token) {
      studentApi.recordActivity(session.token, "chart", pathFilter || "all", `${pathFilter || "全部"}图表中心`, "/charts").catch(() => undefined);
    }
  }, [pathFilter, collegeFilter, majorFilter, graduationYearFilter, session?.token]);

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
        color: pathColor(String(row[nameKey] || row.name || ""))
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
          <select value={graduationYearFilter} onChange={(event) => setGraduationYearFilter(event.target.value)}>
            <option value="">全部毕业年份</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
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
  const [path, setPath] = useState("");
  const [type, setType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("latest");
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [ownPosts, setOwnPosts] = useState<CommunityPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PostDraft>(emptyPostDraft);
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const ownPostIds = useMemo(() => new Set(ownPosts.map((post) => post.id)), [ownPosts]);

  useEffect(() => {
    communityApi.list({ path, type, keyword, sort }).then(setPosts).catch(() => undefined);
  }, [path, type, keyword, sort]);

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

  async function openPostById(postId: number, fallbackTitle = "社区内容") {
    const detail = await communityApi.detail(postId);
    setSelectedPost(detail);
    setComments(await communityApi.comments(postId));
    if (session?.token) {
      studentApi.recordActivity(session.token, "post", String(postId), detail.title || fallbackTitle, `/community/${postId}`).catch(() => undefined);
    }
  }

  async function addPost() {
    if (!session) {
      onLogin();
      return;
    }
    if (!title.trim() || !body.trim()) return;
    setError("");
    try {
      const next = await communityApi.create(session.token, title, body, path || "就业", type || "问答", true);
      setPosts([next, ...posts]);
      setOwnPosts((current) => [next, ...current.filter((post) => post.id !== next.id)]);
      setSelectedPost(next);
      setTitle("");
      setBody("");
      setNotice("内容已提交审核，审核通过后会公开展示");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "发布失败");
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
        editDraft.anonymous
      );
      setOwnPosts((current) => [updated, ...current.filter((post) => post.id !== updated.id)]);
      setPosts(await communityApi.list({ path, type, keyword, sort }));
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
    await communityApi.interact(session.token, postId, action);
    setPosts(await communityApi.list({ path, type, keyword, sort }));
  }

  async function report(postId: number) {
    if (!session) {
      onLogin();
      return;
    }
    await communityApi.report(session.token, postId, "内容不实或不适合公开展示");
    setNotice("举报已提交，后台会保留处理记录");
  }

  async function addComment() {
    if (!session) {
      onLogin();
      return;
    }
    if (!selectedPost || !commentBody.trim()) return;
    await communityApi.comment(session.token, selectedPost.id, commentBody);
    setCommentBody("");
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
    <div className="page-stack">
      {!detailOnly && (
        <>
          <section className="surface composer">
            <SectionTitle icon={Plus} title="发布帖子或提问" />
            <div className="filter-row">
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
            <div className="composer-row">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入标题，发布后进入审核流程" />
              <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="输入正文，至少 10 个字符" />
              <button className="primary-button" onClick={addPost}>
                <Plus size={17} />
                {session ? "发布" : "登录后发布"}
              </button>
            </div>
            {error && <p className="form-error">{error}</p>}
          </section>
          <section className="surface">
            <SectionTitle icon={MessagesSquare} title="社区内容" />
            <PostList
              posts={posts}
              interactive
              manageableIds={ownPostIds}
              onOpen={openPost}
              onLike={(id) => interact(id, "like")}
              onFavorite={(id) => interact(id, "favorite")}
              onReport={report}
              onEdit={beginEdit}
              onDelete={deletePost}
            />
          </section>
        </>
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
          {detailOnly && onBackToPaths && (
            <div className="detail-toolbar">
              <button className="secondary-button" onClick={onBackToPaths}>
                <ArrowLeft size={16} />
                返回三路径
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
              <p>{selectedPost.body}</p>
              <small>{selectedPost.authorDisplay || "匿名用户"} · {selectedPost.createdAt}</small>
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
            <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="写下回复，问答作者可设置最佳回答" />
            <button className="primary-button" onClick={addComment}>回复</button>
          </div>
          <div className="queue-list">
            {comments.map((comment) => (
              <div className="queue-item" key={comment.id}>
                <div>
                  <strong>{comment.authorDisplay}{comment.bestAnswer ? " · 最佳回答" : ""}</strong>
                  <span>{comment.body}</span>
                </div>
                {selectedPost.type === "问答" && (
                  <button className="secondary-button" onClick={() => bestAnswer(comment.id, !comment.bestAnswer)}>
                    {comment.bestAnswer ? "取消最佳" : "设为最佳"}
                  </button>
                )}
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
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [pathConfigs, setPathConfigs] = useState<PathConfigItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [aiConfigs, setAiConfigs] = useState<AiConfigItem[]>([]);
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
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
  const [sourceForm, setSourceForm] = useState({ name: "", url: "", type: "公开权威数据", path: "就业", frequency: "每日", trustLevel: "中", status: "启用" });
  const [contentForm, setContentForm] = useState({ title: "首页公告", category: "公告", summary: "请完成基础档案和深度问卷。", body: "请完成基础档案和深度问卷。", sourceName: "后台维护", sourceUrl: "", tags: "公告", displayPosition: "首页", sortOrder: 1, status: "已发布" });
  const [tagForm, setTagForm] = useState({ name: "校招", type: "内容标签", status: "启用", sortOrder: 9 });
  const [chartForm, setChartForm] = useState<ChartForm>(emptyChartForm);
  const [pathForm, setPathForm] = useState<PathForm>(emptyPathForm);
  const [aiForm, setAiForm] = useState({ configType: "prompt", version: "PROMPT-2026.06", title: "追问提示词", content: "围绕报告输入快照给出结构化追问回答。", status: "草稿" });

  async function refreshAdmin(token = admin?.token) {
    if (!token) return;
    const [nextDashboard, nextSources, nextPosts, nextStudents, nextContents, nextCandidates, nextCharts, nextPaths, nextTags, nextAiConfigs, nextReports] = await Promise.all([
      adminApi.dashboard(token),
      adminApi.sources(token),
      adminApi.posts(token),
      adminApi.students(token),
      adminApi.contents(token),
      adminApi.candidates(token),
      adminApi.charts(token),
      adminApi.paths(token),
      adminApi.tags(token),
      adminApi.aiConfigs(token),
      adminApi.reports(token)
    ]);
    setDashboard(nextDashboard);
    setSources(nextSources);
    setPosts(nextPosts);
    setStudents(nextStudents);
    setContents(nextContents);
    setCandidates(nextCandidates);
    setCharts(nextCharts);
    setPathConfigs(nextPaths);
    setTags(nextTags);
    setAiConfigs(nextAiConfigs);
    setReports(nextReports);
  }

  useEffect(() => {
    if (!admin?.token) return;
    refreshAdmin(admin.token).catch(() => undefined);
  }, [admin?.token]);

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
      setAdminError(exception instanceof Error ? exception.message : "后台操作失败");
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

  async function updateStatus(id: number, status: string) {
    if (!admin) return;
    if ((status === "已驳回" || status === "已下架") && !window.confirm("确认执行该审核处置？")) return;
    await runAdminAction(`post-${id}-${status}`, async () => {
      await adminApi.updatePostStatus(admin.token, id, status, status === "已驳回" ? "内容不符合公开展示要求" : "后台审核");
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
      await adminApi.saveSource(admin.token, sourceForm);
      return "数据源已保存";
    });
  }

  async function saveContent() {
    if (!admin) return;
    await runAdminAction("save-content", async () => {
      await adminApi.saveContent(admin.token, contentForm);
      return "内容配置已保存并进入对应展示位";
    });
  }

  async function reviewCandidate(id: number, action: string, candidate?: CrawlCandidateItem) {
    if (!admin) return;
    await runAdminAction(`candidate-${id}-${action}`, async () => {
      await adminApi.reviewCandidate(admin.token, id, action, action.includes("发布") && candidate ? {
        title: candidate.title,
        summary: candidate.summary,
        category: candidate.path || "就业",
        tags: candidate.tags || candidate.path,
        displayPosition: "路径页"
      } : { reason: "来源或内容暂不适合发布" });
      return `抓取候选已${action}`;
    });
  }

  async function updateUser(id: number, status: string) {
    if (!admin) return;
    if (!window.confirm(`确认将用户状态改为 ${status}？`)) return;
    await runAdminAction(`user-${id}-${status}`, async () => {
      await adminApi.updateStudentStatus(admin.token, id, status, "后台用户管理操作");
      return "用户状态已更新";
    });
  }

  async function resetUser(id: number) {
    if (!admin) return;
    await runAdminAction(`user-${id}-reset`, async () => {
      await adminApi.resetStudentLogin(admin.token, id);
      return "登录异常状态已重置";
    });
  }

  async function saveTag() {
    if (!admin) return;
    await runAdminAction("save-tag", async () => {
      await adminApi.saveTag(admin.token, tagForm);
      return "标签已保存";
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
      return "AI 配置已保存";
    });
  }

  async function handleReport(id: number, status: string) {
    if (!admin) return;
    await runAdminAction(`report-${id}-${status}`, async () => {
      await adminApi.handleReport(admin.token, id, status, status === "已处理" ? "已完成核查与处置" : "暂不处理");
      return "举报处理结果已记录";
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
      {adminNotice && <div className="toast">{adminNotice}</div>}
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
        <span>后台数据更新时间：{formatAdminTime(dashboard?.updatedAt)}</span>
        <span>待抓取审核：{dashboard?.pendingCrawlCount ?? candidates.filter((item) => item.reviewStatus === "待审核").length} 条</span>
        <span>内容审核：{posts.filter((post) => post.status === "待审核").length} 条</span>
        <button className="secondary-button" onClick={() => refreshAdmin().catch(() => setAdminError("后台数据刷新失败"))} disabled={adminWorking}>
          <RefreshCcw size={16} />
          刷新
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
              {candidates.slice(0, 5).map((candidate) => (
                <div className="queue-item" key={candidate.id}>
                  <div>
                    <strong>{candidate.title}</strong>
                    <span>{candidate.sourceName} · {candidate.path} · 抓取 {formatAdminTime(candidate.crawledAt)}</span>
                  </div>
                  <StatusPill status={candidate.reviewStatus} />
                </div>
              ))}
              {candidates.length === 0 && <div className="empty-state">暂无抓取候选</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "users" && (
        <section className="surface">
          <SectionTitle icon={Users} title="学生用户管理" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>账号</th><th>认证信息</th><th>状态</th><th>登录异常</th><th>操作</th></tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.email}<br /><small>{student.nickname || "未设置昵称"} · 创建 {formatAdminTime(student.createdAt)}</small></td>
                    <td>{student.name || "未填写"} · {student.studentNo || "未填写"}<br /><small>{student.college || "未填写"} / {student.major || "未填写"} · 最近登录 {formatAdminTime(student.lastLoginAt)}</small></td>
                    <td><StatusPill status={student.status} /></td>
                    <td>{student.loginFailures} 次{student.lockedUntil ? ` · 锁定至 ${student.lockedUntil}` : ""}</td>
                    <td>
                      <div className="button-row compact-actions">
                        <button className="secondary-button" onClick={() => updateUser(student.id, "已禁用")} disabled={adminWorking}>{busyLabel(`user-${student.id}-已禁用`, "禁用")}</button>
                        <button className="secondary-button" onClick={() => updateUser(student.id, "已完成引导")} disabled={adminWorking}>{busyLabel(`user-${student.id}-已完成引导`, "恢复")}</button>
                        <button className="secondary-button" onClick={() => resetUser(student.id)} disabled={adminWorking}>{busyLabel(`user-${student.id}-reset`, "重置")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminTab === "contents" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={FileText} title="内容维护" />
            <div className="form-grid compact-form">
              {[
                ["标题", "title"],
                ["分类", "category"],
                ["摘要", "summary"],
                ["来源", "sourceName"],
                ["标签", "tags"],
                ["展示位", "displayPosition"],
                ["状态", "status"]
              ].map(([label, key]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input value={String(contentForm[key as keyof typeof contentForm])} onChange={(event) => setContentForm({ ...contentForm, [key]: event.target.value })} />
                </label>
              ))}
              <label>
                <span>排序</span>
                <input type="number" value={contentForm.sortOrder} onChange={(event) => setContentForm({ ...contentForm, sortOrder: Number(event.target.value) })} />
              </label>
            </div>
            <textarea value={contentForm.body} onChange={(event) => setContentForm({ ...contentForm, body: event.target.value })} />
            <button className="primary-button" onClick={saveContent} disabled={adminWorking}>{busyLabel("save-content", "保存内容")}</button>
          </div>
          <div className="surface">
            <SectionTitle icon={FileText} title="已维护内容" />
            <div className="queue-list">
              {contents.map((content) => (
                <div className="queue-item" key={content.id}>
                  <div>
                    <strong>{content.title}</strong>
                    <span>{content.category} · {content.source} · 更新 {formatAdminTime(content.updatedAt)}</span>
                  </div>
                  <StatusPill status={content.status} />
                </div>
              ))}
              {contents.length === 0 && <div className="empty-state">暂无内容</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "review" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={ShieldCheck} title="社区内容审核" />
            <div className="queue-list">
              {posts.slice(0, 10).map((post) => (
                <div className="queue-item" key={post.id}>
                  <div>
                    <strong>{post.title}</strong>
                    <span>{post.type} · {post.path} · {post.status} · 发布 {formatAdminTime(post.createdAt)}</span>
                  </div>
                  <div className="button-row compact-actions">
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已通过")} disabled={adminWorking}>{busyLabel(`post-${post.id}-已通过`, "通过")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已驳回")} disabled={adminWorking}>{busyLabel(`post-${post.id}-已驳回`, "驳回")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "已下架")} disabled={adminWorking}>{busyLabel(`post-${post.id}-已下架`, "下架")}</button>
                    <button className="secondary-button" onClick={() => updateStatus(post.id, "精选")} disabled={adminWorking}>{busyLabel(`post-${post.id}-精选`, "精选")}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={Flag} title="举报处理" />
            <div className="queue-list">
              {reports.map((report) => (
                <div className="queue-item" key={report.id}>
                  <div>
                    <strong>{report.targetType} #{report.targetId}</strong>
                    <span>{report.reason} · {report.status} · 提交 {formatAdminTime(report.createdAt)}{report.handledAt ? ` · 处理 ${formatAdminTime(report.handledAt)}` : ""}</span>
                  </div>
                  <div className="button-row compact-actions">
                    <button className="secondary-button" onClick={() => handleReport(report.id, "已处理")} disabled={adminWorking}>{busyLabel(`report-${report.id}-已处理`, "处理")}</button>
                    <button className="secondary-button" onClick={() => handleReport(report.id, "已驳回")} disabled={adminWorking}>{busyLabel(`report-${report.id}-已驳回`, "驳回")}</button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && <div className="empty-state">暂无举报</div>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "sources" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={Database} title="数据源维护" />
            <div className="form-grid compact-form">
              {[
                ["来源名称", "name"],
                ["来源地址", "url"],
                ["来源类型", "type"],
                ["适用路径", "path"],
                ["抓取频率", "frequency"],
                ["可信级别", "trustLevel"]
              ].map(([label, key]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input value={sourceForm[key as keyof typeof sourceForm]} onChange={(event) => setSourceForm({ ...sourceForm, [key]: event.target.value })} />
                </label>
              ))}
            </div>
            <div className="button-row">
              <button className="primary-button" onClick={saveSource} disabled={adminWorking}>{busyLabel("save-source", "保存数据源")}</button>
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={RefreshCcw} title="抓取与候选审核" />
            <div className="queue-list">
              {sources.map((source) => (
                <div className="queue-item" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.path} · 抓取 {formatAdminTime(source.lastRunAt)} · 配置 {formatAdminTime(source.updatedAt)} · 通过率 {source.passRate}</span>
                    <small>
                      最近任务：{source.lastTaskStatus || "暂无"} · {formatAdminTime(source.lastTaskAt)}
                      {source.lastTaskMessage ? ` · ${source.lastTaskMessage}` : ""}
                    </small>
                  </div>
                  <button className="icon-button" title="手动抓取" onClick={() => triggerCrawl(source.id)} disabled={adminWorking}>
                    <RefreshCcw size={17} />
                  </button>
                </div>
              ))}
              {candidates.slice(0, 8).map((candidate) => (
                <div className="queue-item" key={`candidate-${candidate.id}`}>
                  <div>
                    <strong>{candidate.title}</strong>
                    <span>{candidate.sourceName} · {candidate.path} · 质量 {candidate.qualityScore ?? 0} · {candidate.reviewStatus} · 抓取 {formatAdminTime(candidate.crawledAt)}</span>
                    <p>{candidate.summary}</p>
                    {candidate.reason && <small>{candidate.reason}</small>}
                  </div>
                  <div className="button-row compact-actions">
                    <button className="icon-button" title="查看来源" onClick={() => window.open(candidate.rawUrl, "_blank", "noopener,noreferrer")}>
                      <ExternalLink size={16} />
                    </button>
                    <button className="secondary-button" onClick={() => reviewCandidate(candidate.id, "发布", candidate)} disabled={adminWorking}>{busyLabel(`candidate-${candidate.id}-发布`, "发布")}</button>
                    <button className="secondary-button" onClick={() => reviewCandidate(candidate.id, "驳回")} disabled={adminWorking}>{busyLabel(`candidate-${candidate.id}-驳回`, "驳回")}</button>
                  </div>
                </div>
              ))}
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
            <div className="helper-text">图表数据可声明 xKey、series、insights；趋势图/柱状图会按 series 动态渲染，时间线使用 stage/description。</div>
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
            <SectionTitle icon={SlidersHorizontal} title="标签维护" />
            <div className="form-grid compact-form">
              <label><span>标签名</span><input value={tagForm.name} onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })} /></label>
              <label><span>类型</span><input value={tagForm.type} onChange={(event) => setTagForm({ ...tagForm, type: event.target.value })} /></label>
              <label><span>状态</span><input value={tagForm.status} onChange={(event) => setTagForm({ ...tagForm, status: event.target.value })} /></label>
              <label><span>排序</span><input type="number" value={tagForm.sortOrder} onChange={(event) => setTagForm({ ...tagForm, sortOrder: Number(event.target.value) })} /></label>
            </div>
            <div className="button-row">
              <button className="primary-button" onClick={saveTag} disabled={adminWorking}>{busyLabel("save-tag", "保存标签")}</button>
            </div>
          </div>
          <div className="surface">
            <SectionTitle icon={SlidersHorizontal} title="统一标签" />
            <div className="config-grid">
              {tags.map((tag) => (
                <div className="config-item" key={tag.id}>{tag.type} · {tag.name} · {tag.status} · 创建 {formatAdminTime(tag.createdAt)}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {adminTab === "ai" && (
        <section className="content-grid two">
          <div className="surface">
            <SectionTitle icon={Bot} title="AI 与模板配置" />
            <div className="form-grid compact-form">
              <label><span>类型</span><input value={aiForm.configType} onChange={(event) => setAiForm({ ...aiForm, configType: event.target.value })} /></label>
              <label><span>版本</span><input value={aiForm.version} onChange={(event) => setAiForm({ ...aiForm, version: event.target.value })} /></label>
              <label><span>标题</span><input value={aiForm.title} onChange={(event) => setAiForm({ ...aiForm, title: event.target.value })} /></label>
              <label><span>状态</span><input value={aiForm.status} onChange={(event) => setAiForm({ ...aiForm, status: event.target.value })} /></label>
            </div>
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
                  <StatusPill status={config.status} />
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
  onLogout
}: {
  session: Session | null;
  onLogin: () => void;
  setNotice: (message: string) => void;
  onLogout: () => void;
}) {
  const [history, setHistory] = useState<Array<{ id: number; reportVersion: string; generatedAt: string; topPath: string; topScore: number }>>([]);
  const [community, setCommunity] = useState<Record<string, CommunityPost[]>>({ posts: [], favorites: [] });
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PostDraft>(emptyPostDraft);
  const [editSaving, setEditSaving] = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    if (!session) return;
    studentApi.reportHistory(session.token).then(setHistory).catch(() => undefined);
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
        editDraft.anonymous
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
          <SectionTitle icon={UserRound} title="个人资料" />
          <div className="profile-lines">
            <span>邮箱：{session.profile.email}</span>
            <span>姓名：{session.profile.name || "未填写"}</span>
            <span>学院：{session.profile.college || "未填写"}</span>
            <span>专业：{session.profile.major || "未填写"}</span>
            <span>状态：{session.profile.status}</span>
          </div>
          <button className="secondary-button" onClick={cancel}>申请注销账号</button>
        </div>
        <div className="surface">
          <SectionTitle icon={FileText} title="历史报告" />
          <div className="queue-list">
            {history.map((item) => (
              <div className="queue-item" key={item.id}>
                <div>
                  <strong>{item.topPath} · {item.topScore}</strong>
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

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-list">
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function ResourceTable({ filter }: { filter?: string }) {
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
              <td colSpan={5}>模板加载失败，请稍后重试</td>
            </tr>
          )}
          {!loading && !failed && rows.length === 0 && (
            <tr>
              <td colSpan={5}>暂无模板</td>
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
                  <a
                    className="icon-button"
                    title={`下载${resource.name}`}
                    href={`${resource.url}?t=${Date.now()}`}
                    download={`${resource.name}.${resource.format.toLowerCase()}`}
                    aria-label={`下载${resource.name}`}
                  >
                    <Download size={16} />
                  </a>
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
  onDelete
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
}) {
  return (
    <div className="post-list">
      {posts.length === 0 && <div className="empty-state">暂无内容</div>}
      {posts.map((post) => {
        const canManage = manageable || Boolean(manageableIds?.has(post.id));
        const clickablePost = clickable && Boolean(onOpen);
        return (
          <article
            className={clickablePost ? "post-item clickable-row" : "post-item"}
            key={post.id}
            role={clickablePost ? "button" : undefined}
            tabIndex={clickablePost ? 0 : undefined}
            onClick={clickablePost ? () => onOpen?.(post) : undefined}
            onKeyDown={clickablePost ? (event) => {
              if (event.key === "Enter" || event.key === " ") onOpen?.(post);
            } : undefined}
          >
            <div className="post-main">
              <div className="post-meta">
                <span>{post.type}</span>
                <span>{post.path}</span>
                <StatusPill status={post.status} />
              </div>
              <h3>{post.title}</h3>
              <p>{post.summary || post.body}</p>
              <small>{post.author || post.authorDisplay || "匿名用户"} · {post.createdAt}</small>
            </div>
            {showActions && (
              <div className="post-actions">
              {onOpen && (
                <button className="icon-button" title="查看详情" onClick={() => onOpen(post)}>
                  <Search size={16} />
                </button>
              )}
              <button className="icon-button" title="点赞" onClick={() => onLike?.(post.id)}>
                <Heart size={16} />
                <span>{post.likes}</span>
              </button>
              <button className="icon-button" title="收藏" onClick={() => onFavorite?.(post.id)}>
                <Star size={16} />
                <span>{post.favorites}</span>
              </button>
              {interactive && (
                <button className="icon-button" title="举报" onClick={() => onReport?.(post.id)}>
                  <Flag size={16} />
                </button>
              )}
              {canManage && onEdit && (
                <button className="icon-button" title="编辑" onClick={() => onEdit(post)}>
                  <PenLine size={16} />
                </button>
              )}
              {canManage && onDelete && (
                <button className="icon-button danger-icon" title="删除" onClick={() => onDelete(post)}>
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
