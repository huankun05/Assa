/**
 * @file standaloneTabPrefetch.ts
 * @description 独立窗 Tab chunk 预取（与 Viewport 组件拆分，避免 Fast Refresh 因导出不兼容而失效）
 * @author 鸡哥
 */

import type { WindowTab } from '../config/standaloneWindowConfig';

/**
 * 预取目标 Tab 的懒加载 chunk
 */
export function prefetchStandaloneTab(tab: WindowTab): void {
  switch (tab) {
    case 'todo': void import('../states/maxExpand/components/todo/components/TodoTab'); break;
    case 'countdown': void import('../states/maxExpand/components/countdown'); break;
    case 'urlFavorites': void import('../states/maxExpand/components/urlFavorites'); break;
    case 'mail': void import('../states/maxExpand/components/mail'); break;
    case 'localFileSearch': void import('../states/maxExpand/components/localFileSearch/components/LocalFileSearchTab'); break;
    case 'clipboardHistory': void import('../states/maxExpand/components/clipBoardHistory'); break;
    case 'memo': void import('../states/maxExpand/components/memo/components/MemoTab'); break;
    case 'alarm': void import('../states/maxExpand/components/alarm/components/AlarmTab'); break;
    case 'toolbox': void import('../states/maxExpand/components/ToolboxTab'); break;
    case 'chat': void import('../states/maxExpand/components/agent'); break;
    case 'translate': void import('../states/expand/components/TranslationTab'); break;
    case 'customPages': void import('../states/maxExpand/components/customPages/CustomPageManager'); break;
    default: break;
  }
}
