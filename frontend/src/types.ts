export type PathKey = string;

export type PathInfo = {
  key: PathKey;
  name: string;
  subtitle: string;
  accent: string;
  match: number;
  suitable: string[];
  timeline: string[];
  pitfalls: string[];
  resources: string[];
};

export type CommunityPost = {
  id: number;
  title: string;
  body?: string;
  type: "经验帖" | "问答" | "资料";
  path: string;
  authorId?: number;
  author?: string;
  authorDisplay?: string;
  anonymous?: boolean;
  status: string;
  summary?: string;
  likes: number;
  favorites: number;
  liked?: boolean;
  favorited?: boolean;
  replies: number;
  imageUrls?: string[];
  createdAt: string;
};

export type CommunityPublicProfile = {
  id: number;
  displayName: string;
  joinedAt: string;
  posts: number;
  comments: number;
  likes: number;
  recentPosts: CommunityPost[];
};

export type QuestionnaireTemplate = {
  version: string;
  title: string;
  content: string;
  publishedAt?: string;
};

export type TemplateResource = {
  id?: number;
  name: string;
  path: string;
  format: string;
  url?: string;
  updatedAt: string;
  downloads?: number;
};
