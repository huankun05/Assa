/**
 * 设置七大类与子项映射（UI 壳；逻辑仍复用原 tab/page 组件）
 */
import { SvgIcon } from '../../../../../../utils/SvgIcon';
import type {
  AppSettingsPageKey,
  MusicSettingsPageKey,
  NetworkSettingsPageKey,
  SettingsSidebarTabKey,
} from '../utils/settingsConfig';
import { SETTINGS_TAB_ICONS } from '../utils/settingsConfig';

export type SettingsCategoryId =
  | 'home'
  | 'appearance'
  | 'interaction'
  | 'aiPrivacy'
  | 'media'
  | 'system'
  | 'account';

export interface SettingsCategoryDest {
  tab: SettingsSidebarTabKey;
  appPage?: AppSettingsPageKey;
  musicPage?: MusicSettingsPageKey;
  networkPage?: NetworkSettingsPageKey;
}

export interface SettingsCategoryItem {
  id: string;
  label: string;
  desc: string;
  icon?: string;
  dest: SettingsCategoryDest;
}

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  desc: string;
  icon: string;
  items?: SettingsCategoryItem[];
}

function item(
  id: string,
  label: string,
  desc: string,
  dest: SettingsCategoryDest,
  icon?: string,
): SettingsCategoryItem {
  return { id, label, desc, icon, dest };
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: 'home',
    label: '主页',
    desc: '搜索设置，或从常用入口进入',
    icon: SvgIcon.LAYOUT,
  },
  {
    id: 'appearance',
    label: '外观',
    desc: '主题、布局、位置与动效',
    icon: SvgIcon.THEME,
    items: [
      item('theme', '主题外观', '深色 / 浅色 / 跟随系统，壁纸与透明度', { tab: 'app', appPage: 'theme' }, SETTINGS_TAB_ICONS.theme),
      item('animation', '软件动画', '弹性、速度与启动画面', { tab: 'app', appPage: 'animation' }, SETTINGS_TAB_ICONS.animation),
      item('position', '位置校准', '多显示器与岛位置微调', { tab: 'app', appPage: 'position' }, SETTINGS_TAB_ICONS.position),
      item('album', '相册配置', '总览相册轮播与点击行为', { tab: 'app', appPage: 'album' }, SETTINGS_TAB_ICONS.album),
      item('layout-preview', '布局预览', 'Expand 总览控件与时钟样式', { tab: 'app', appPage: 'layout-preview' }, SETTINGS_TAB_ICONS['layout-preview']),
      item('expand-layout', '展开布局', '展开态页面顺序与可见性', { tab: 'app', appPage: 'expand-layout' }, SETTINGS_TAB_ICONS['expand-layout']),
      item('maxexpand-layout', '全展开布局', '最大展开态页面顺序与可见性', { tab: 'app', appPage: 'maxexpand-layout' }, SETTINGS_TAB_ICONS['maxexpand-layout']),
      item('control-center', '控制中心按钮', 'Hover 时间页按钮排序', { tab: 'app', appPage: 'control-center' }, SETTINGS_TAB_ICONS['control-center']),
      item('pluginMarket', '壁纸市场', '浏览与贡献壁纸', { tab: 'pluginMarket' }, SETTINGS_TAB_ICONS.pluginMarket),
    ],
  },
  {
    id: 'interaction',
    label: '交互',
    desc: '行为、提醒与快捷键',
    icon: SvgIcon.INTERACTION,
    items: [
      item('behavior', '交互行为', '形态、鼠标移开、番茄钟时长', { tab: 'app', appPage: 'behavior' }, SETTINGS_TAB_ICONS.behavior),
      item('break-reminder', '休息提醒', '定时休息与喝水提醒', { tab: 'app', appPage: 'break-reminder' }, SETTINGS_TAB_ICONS['break-reminder']),
      item('alarm', '闹钟配置', '提示音、贪睡与系统通知', { tab: 'app', appPage: 'alarm' }, SETTINGS_TAB_ICONS.alarm),
      item('shortcut', '快捷键', '隐藏、关闭、截图等全局键', { tab: 'shortcut' }, SETTINGS_TAB_ICONS.shortcut),
    ],
  },
  {
    id: 'aiPrivacy',
    label: 'AI 与隐私',
    desc: '信任等级、窗口隐藏与数据边界',
    icon: SvgIcon.AI,
    items: [
      item('ai-security', 'AI 信任与审计', 'L0–L3 信任档与工具调用记录', { tab: 'app', appPage: 'ai-security' }, SETTINGS_TAB_ICONS['ai-security']),
      item('hide-process-list', '隐藏窗口', '全屏自动隐藏与进程黑名单', { tab: 'app', appPage: 'hide-process-list' }, SETTINGS_TAB_ICONS['hide-process-list']),
      item('url-parser', '剪贴板 URL 黑名单', '链接识别与域名排除', { tab: 'app', appPage: 'url-parser' }, SETTINGS_TAB_ICONS['url-parser']),
      item('clipboard-history', '剪贴板历史', '条数上限与清空', { tab: 'app', appPage: 'clipboard-history' }, SETTINGS_TAB_ICONS['clipboard-history']),
    ],
  },
  {
    id: 'media',
    label: '媒体',
    desc: '歌曲、歌词与天气',
    icon: SvgIcon.MUSIC,
    items: [
      item('music', '歌曲设置', '白名单、歌词源、SMTC', { tab: 'music' }, SETTINGS_TAB_ICONS.music),
      item('weather', '天气配置', '定位、接口与预警', { tab: 'weather' }, SETTINGS_TAB_ICONS.weather),
    ],
  },
  {
    id: 'system',
    label: '系统',
    desc: '声音、通知、性能与网络',
    icon: SvgIcon.SETTING,
    items: [
      item('sound', '声音设置', '全局 / 闹钟 / 音效音量', { tab: 'app', appPage: 'sound' }, SETTINGS_TAB_ICONS.sound),
      item('notification', '通知设置', '岛通知与 Agent 通知', { tab: 'app', appPage: 'notification' }, SETTINGS_TAB_ICONS.notification),
      item('performance', '性能设置', '延迟加载与帧率', { tab: 'app', appPage: 'performance' }, SETTINGS_TAB_ICONS.performance),
      item('performance-monitor', '性能监控', 'CPU / GPU / 磁盘图表', { tab: 'app', appPage: 'performance-monitor' }, SETTINGS_TAB_ICONS['performance-monitor']),
      item('network', '网络配置', '超时与静态资源节点', { tab: 'network' }, SETTINGS_TAB_ICONS.network),
      item('autostart', '实用工具', '自启、重启与日志', { tab: 'app', appPage: 'autostart' }, SETTINGS_TAB_ICONS.autostart),
      item('language', '语言', '界面显示语言', { tab: 'app', appPage: 'language' }, SETTINGS_TAB_ICONS.language),
      item('screenshot-settings', '截图', '截图与翻译语言', { tab: 'app', appPage: 'screenshot-settings' }, SETTINGS_TAB_ICONS['screenshot-settings']),
    ],
  },
  {
    id: 'account',
    label: '账号与更新',
    desc: '邮箱、更新与关于',
    icon: SvgIcon.ABOUT,
    items: [
      item('mail', '邮箱配置', 'IMAP 与收信参数', { tab: 'mail' }, SETTINGS_TAB_ICONS.mail),
      item('update', '更新设置', '检查更新与下载源', { tab: 'update' }, SETTINGS_TAB_ICONS.update),
      item('about', '关于软件', '版本、反馈与致谢', { tab: 'about' }, SETTINGS_TAB_ICONS.about),
    ],
  },
] as const;

export function getSettingsCategory(id: SettingsCategoryId): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find((c) => c.id === id);
}
