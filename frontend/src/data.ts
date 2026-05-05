import type { CommunityPost } from "./types";

export const communityPosts: CommunityPost[] = [
  {
    id: 1,
    title: "从光电专业转软件测试岗，我把项目经历这样改成简历亮点",
    type: "经验帖",
    path: "就业",
    author: "林同学",
    status: "已通过",
    summary: "围绕课程设计、实习、比赛三个材料，把经历拆成问题、动作、结果三段。",
    likes: 126,
    favorites: 58,
    replies: 18,
    createdAt: "2026-04-12"
  },
  {
    id: 2,
    title: "省考和事业单位能不能同时准备？时间怎么分配更稳",
    type: "问答",
    path: "考公",
    author: "匿名用户",
    anonymous: true,
    status: "已通过",
    summary: "公共科目可复用，但岗位表筛选、申论材料和面试准备要分开管理。",
    likes: 88,
    favorites: 41,
    replies: 24,
    createdAt: "2026-04-10"
  },
  {
    id: 3,
    title: "跨专业考研择校时，我建议先看这四个边界条件",
    type: "经验帖",
    path: "考研",
    author: "周同学",
    status: "待审核",
    summary: "报录比、专业课可获得性、复试权重、目标城市机会密度。",
    likes: 36,
    favorites: 20,
    replies: 7,
    createdAt: "2026-04-09"
  }
];

export const adminQueue = [
  { id: "R-20260413-01", item: "跨专业考研经验帖", type: "社区帖子", status: "待审核", owner: "内容审核员" },
  { id: "C-20260413-04", item: "就业趋势图表数据", type: "抓取数据", status: "待审核", owner: "数据管理员" },
  { id: "U-20260412-08", item: "重复举报处理", type: "社区举报", status: "处理中", owner: "社区管理员" }
];
