/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file xiyueMoodConfig.ts
 * @description Hover 汐月 AI 页的「状态 + 文案」配置层。
 *
 * 设计要点：
 * 1. 状态（mood）驱动三件事：头像表情、主行状态词、副行文案。后续接 agent 真实状态时，
 *    只需把 mood 从 store 里读出来即可，组件不用改。
 * 2. 副行文案走「预设池 + 时段驱动」，**不调用大模型**：hover 页是常驻高频出现的，
 *    每次渲染都请求 LLM 会带来延迟、成本、离线不可用、内容不可控四个问题，而问候语
 *    属于装饰性信息，收益远低于代价。
 * 3. 头像资源通过 AVATAR_IMAGE_MAP 做「图片模式 / SVG 模式」双轨，后续替换为正式
 *    美术资源时只改这一张表。
 *
 * @author 鸡哥
 */

/** AI 情绪 / 工作状态 */
export type AgentMood = 'calm' | 'happy' | 'thinking' | 'tool' | 'listening' | 'confuse' | 'speaking';

/** 状态中文词（主行「汐月·开心」的后半段） */
export const MOOD_LABEL: Record<AgentMood, string> = {
  calm: '待机',
  happy: '开心',
  thinking: '思考中',
  tool: '操作中',
  listening: '聆听中',
  confuse: '困惑',
  speaking: '说话中',
};

/** 一天中的时段 */
export type DayPart = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

/** 时段顺序（用于计算随机种子，保证同一时段内文案稳定不闪烁） */
const DAY_PART_ORDER: DayPart[] = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'];

/**
 * 按时段的问候语预设池
 * @description 纯本地预设，无网络请求。每个时段 2 条，按日期 + 时段取模轮换。
 *              后续若要接入 i18n，把这里的字符串换成 t() 调用即可。
 */
export const GREETING_POOL: Record<DayPart, string[]> = {
  dawn: ['清晨好，新的一天开始了', '早，今天想先处理什么？'],
  morning: ['早上好，有什么可以帮你？', '早安，今天也一起加油吧'],
  noon: ['中午好，记得休息一下', '午间好，需要我帮忙整理什么吗？'],
  afternoon: ['下午好，有什么可以帮你？', '午后好，需要我协助吗？'],
  evening: ['晚上好，今天过得如何？', '夜色渐浓，还有什么要处理的？'],
  night: ['夜深了，注意休息哦', '这么晚还在忙？我陪着你'],
};

/**
 * 非 happy 状态的固定副标题
 * @description 这些状态有明确语义（正在推理 / 需要澄清 / 正在收音），
 *              文案必须准确，因此固定不随机。
 */
export const MOOD_SUBTITLE: Record<Exclude<AgentMood, 'happy'>, string> = {
  calm: '随时为你服务',
  thinking: '正在理解你的问题…',
  tool: '正在执行操作…',
  listening: '我在听，请说话…',
  confuse: '能再说得具体点吗？',
  speaking: '…',
};

/**
 * 判断当前所处时段
 * @param d - 目标时间，默认当前
 * @returns 时段标识
 */
export function getDayPart(d: Date = new Date()): DayPart {
  const h = d.getHours();
  if (h < 5) return 'night';
  if (h < 8) return 'dawn';
  if (h < 11) return 'morning';
  if (h < 13) return 'noon';
  if (h < 18) return 'afternoon';
  if (h < 23) return 'evening';
  return 'night';
}

/**
 * 取副行文案
 * @description happy 态按时段从预设池选（种子 = 日 + 时段序号，保证同一时段内稳定不闪烁、跨天有变化）；
 *              其余状态返回固定语义文案。
 * @param mood - 当前状态
 * @param d - 目标时间，默认当前
 * @returns 副行文案
 */
export function getSubtitle(mood: AgentMood, d: Date = new Date()): string {
  if (mood !== 'happy') return MOOD_SUBTITLE[mood];
  const part = getDayPart(d);
  const pool = GREETING_POOL[part];
  const seed = d.getDate() + DAY_PART_ORDER.indexOf(part);
  return pool[seed % pool.length];
}

/**
 * 头像资源映射表（图片模式开关）
 *
 * @description 配置了路径的状态使用图片模式（彩色二次元头像），
 *              未配置的状态回退到 SVG 模式（单色 currentColor，可被主题适配）。
 *              7 种状态全部配置了正式美术资源，512x512 PNG，透明底。
 *
 * 头像差分图设计：
 * - calm:      双手交叠，中性平静，待机
 * - happy:     挥手，开心微笑
 * - thinking:  手托下巴，视线偏上，思考中
 * - tool:      食指指下方，视线向下，操作中
 * - listening: 手放耳边，头侧倾，聆听中
 * - confuse:   挠头，眉一高一低，困惑
 * - speaking:  手张开解释，嘴张开，说话中
 */
export const AVATAR_IMAGE_MAP: Partial<Record<AgentMood, string>> = {
  calm: 'image/agent/xiyue_calm.png',
  happy: 'image/agent/xiyue_happy.png',
  thinking: 'image/agent/xiyue_thinking.png',
  tool: 'image/agent/xiyue_tool.png',
  listening: 'image/agent/xiyue_listening.png',
  confuse: 'image/agent/xiyue_confuse.png',
  speaking: 'image/agent/xiyue_speaking.png',
};
