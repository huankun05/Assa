/**
 * 通行证权限说明卡（数据层，供设置页 UI 使用）。
 * 命名与 docs/产品定位讨论报告_v1.0.md §2.4 / §3.10 对齐。
 * 内部代号 L0–L3 仅供代码；用户可见一律用中文名。
 */

export type TrustLevelInternal = 0 | 1 | 2 | 3;

export interface PermissionCard {
  level: TrustLevelInternal;
  name: string;
  summary: string;
  canAct: string;
  canSee: string;
  confirmPolicy: string;
  riskNote: string;
  isDefault?: boolean;
}

export interface DataClassCard {
  id: 'D0' | 'D1' | 'D2' | 'D3';
  name: string;
  examples: string;
  defaultAccess: string;
}

export const TRUST_LEVEL_CARDS: readonly PermissionCard[] = [
  {
    level: 0,
    name: '静默观察',
    summary: '只聊，几乎不动手、几乎不看私有数据',
    canAct: '只读类也需你确认；几乎不自动改系统',
    canSee: '仅 D0 公开信息（时间、天气、系统音量等）',
    confirmPolicy: '动手前一律询问',
    riskNote: '最安全；能力最弱，不能帮你操作电脑',
  },
  {
    level: 1,
    name: '谨慎助手',
    summary: '读起来方便，动手要问',
    canAct: '只读工具可自动；写/删/执行/发消息需每次确认',
    canSee: 'D0–D1；碰 D2 需确认；D3 永拦',
    confirmPolicy: '敏感操作弹出说明框确认',
    riskNote: '她可能误读你指定目录内的普通文件；不会擅自改电脑',
    isDefault: true,
  },
  {
    level: 2,
    name: '熟练助手',
    summary: '日常杂事少打扰',
    canAct: '低风险写（音量亮度、安全区整理等）可自动；中高风险仍确认',
    canSee: 'D0–D2；D3 仍拦',
    confirmPolicy: '中高风险弹确认；删除等仍必问',
    riskNote: '她可以在你较少注视时改动文件结构；依赖回收站与整理撤销',
  },
  {
    level: 3,
    name: '完全托管',
    summary: '你信她，她放手干',
    canAct: '高风险也可自动；删除确认可经专项授权关闭（仍进回收站+全日志）',
    canSee: 'D0–D2；D3 仍拦（无全开档）',
    confirmPolicy: '仅专项免责子开关可关删除确认；需二次确认',
    riskNote: '误删/误移动可能影响工作；由此产生的损失需由你自行承担',
  },
] as const;

export const DATA_CLASS_CARDS: readonly DataClassCard[] = [
  {
    id: 'D0',
    name: '公开',
    examples: '天气、时间、系统音量',
    defaultAccess: '所有通行证可读',
  },
  {
    id: 'D1',
    name: '个人工作区',
    examples: '指定目录文档、待办、普通剪贴板',
    defaultAccess: '谨慎助手及以上',
  },
  {
    id: 'D2',
    name: '私密',
    examples: '记忆库、备忘正文、账号类截图',
    defaultAccess: '熟练助手及以上，读取常需确认',
  },
  {
    id: 'D3',
    name: '机密',
    examples: '密钥、助记词、支付信息',
    defaultAccess: '永不进入模型上下文（规则拦截）',
  },
] as const;

export const DEFAULT_TRUST_LEVEL: TrustLevelInternal = 1;

export function getTrustLevelCard(level: number): PermissionCard | undefined {
  const n = Math.max(0, Math.min(3, Math.floor(level)));
  return TRUST_LEVEL_CARDS.find((c) => c.level === n);
}
