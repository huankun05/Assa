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
 * @file ChatMessageRow.tsx
 * @description 单条聊天消息行：拆分自 AiChatTab，用于 memo 优化。
 * @author 鸡哥
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SvgIcon, resolveDevIconByFileName } from '../../../../../../utils/SvgIcon';
import type { AiChatMessage, AiConfig } from '../../../../../../store/types';
import { AssistantMarkdown } from './AssistantMarkdown';
import { MessageTimeline } from './MessageTimeline';
import { normalizeMarkdownCodeFences } from '../utils/chatUtils';

interface ChatMessageRowProps {
  msg: AiChatMessage;
  absoluteIndex: number;
  totalMessages: number;
  isStreaming: boolean;
  agentMode: string;
  aiConfig: AiConfig;
  userAvatarUrl: string | null;
  onQuote: (quote: string) => void;
  onReportIssue: (traceId: string, finalAnswer: string) => void;
  onNavigateToSettingsTab: (tab: string) => void;
}

const ChatMessageRow = React.memo(function ChatMessageRow({
  msg,
  absoluteIndex,
  totalMessages,
  isStreaming,
  agentMode,
  aiConfig,
  userAvatarUrl,
  onQuote,
  onReportIssue,
  onNavigateToSettingsTab,
}: ChatMessageRowProps): React.ReactElement {
  const { t } = useTranslation();

  const isLatest = absoluteIndex === totalMessages - 1;
  const isEmptyAssistant = msg.role === 'assistant' && !msg.content
    && (!Array.isArray(msg.todoSnapshots) || msg.todoSnapshots.length === 0)
    && (!Array.isArray(msg.thinkBlocks) || msg.thinkBlocks.length === 0)
    && (!Array.isArray(msg.toolCalls) || msg.toolCalls.filter(tc => tc.tool !== 'agent.todo.write').length === 0)
    && !(isStreaming && absoluteIndex === totalMessages - 1);
  if (isEmptyAssistant) return <></>;

  const handleQuoteClick = useCallback((seg: string) => {
    onQuote(seg.trim());
  }, [onQuote]);

  const handleReportIssueClick = useCallback(() => {
    const traceId = typeof msg.traceId === 'string' ? msg.traceId.trim() : '';
    onReportIssue(traceId, msg.content || '');
  }, [msg.traceId, msg.content, onReportIssue]);

  if (agentMode === 'r1pxc' && msg.role === 'assistant') {
    const r1pxcAvatarRaw = typeof aiConfig.r1pxcAvatar === 'string' ? aiConfig.r1pxcAvatar.trim() : '';
    const r1pxcAvatarUrl = r1pxcAvatarRaw.startsWith('data:image/') ? r1pxcAvatarRaw : '';
    const rawSegments = msg.content
      ? msg.content.split(/\n\n+/).filter((s) => s.trim().length > 0)
      : [];
    const segments: string[] = [];
    for (let si = 0; si < rawSegments.length; si++) {
      if (/^>\s*引用:/.test(rawSegments[si]) && si + 1 < rawSegments.length) {
        segments.push(rawSegments[si] + '\n' + rawSegments[si + 1]);
        si++;
      } else {
        segments.push(rawSegments[si]);
      }
    }

    if (segments.length === 0 && isStreaming && isLatest) {
      return (
        <div className="max-expand-chat-agent-row r1pxc-chat">
          {r1pxcAvatarUrl ? (
            <img className="max-expand-chat-agent-avatar max-expand-chat-avatar--clickable" src={r1pxcAvatarUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} onClick={() => onNavigateToSettingsTab('ai')} />
          ) : (
            <img className="max-expand-chat-agent-avatar max-expand-chat-agent-avatar--placeholder max-expand-chat-avatar--clickable" src={SvgIcon.USER} alt="" onClick={() => onNavigateToSettingsTab('ai')} />
          )}
          <div className="max-expand-chat-bubble ai r1pxc-chat">
            <div className="max-expand-chat-loading-row">
              <span className="max-expand-chat-generating-dots"><i /><i /><i /></span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-expand-chat-agent-row r1pxc-chat">
        {r1pxcAvatarUrl ? (
          <img className="max-expand-chat-agent-avatar max-expand-chat-avatar--clickable" src={r1pxcAvatarUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} onClick={() => onNavigateToSettingsTab('ai')} />
        ) : (
          <img className="max-expand-chat-agent-avatar max-expand-chat-agent-avatar--placeholder max-expand-chat-avatar--clickable" src={SvgIcon.USER} alt="" onClick={() => onNavigateToSettingsTab('ai')} />
        )}
        <div className="max-expand-chat-agent-bubbles">
          {segments.map((seg, si) => {
            const quoteMatch = seg.match(/^>\s*引用:\s*(.*)/);
            const quoteText = quoteMatch ? quoteMatch[1].trim() : null;
            const bodyText = quoteMatch ? seg.replace(/^>\s*引用:\s*.*\n?/, '').trim() : seg;
            return (
              <div
                key={`${absoluteIndex}-${si}`}
                className="max-expand-chat-bubble ai r1pxc-chat max-expand-chat-bubble--hoverable"
              >
                {quoteText && (
                  <div className="max-expand-chat-quote-block">
                    <span className="max-expand-chat-quote-block-text">{quoteText.length > 80 ? quoteText.slice(0, 80) + '…' : quoteText}</span>
                  </div>
                )}
                {bodyText && <AssistantMarkdown content={normalizeMarkdownCodeFences(bodyText)} />}
                <span className="max-expand-chat-bubble-actions">
                  <button type="button" onClick={() => handleQuoteClick(seg.trim())}>{t('aiChat.actions.quote', { defaultValue: '引用' })}</button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(seg.trim()).catch(() => {}); }}>{t('aiChat.actions.copy', { defaultValue: '复制' })}</button>
                </span>
              </div>
            );
          })}
          {isStreaming && isLatest && (
            <div key={`${absoluteIndex}-dots`} className="max-expand-chat-bubble ai r1pxc-chat">
              <div className="max-expand-chat-loading-row">
                <span className="max-expand-chat-generating-dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'user') {
    return (
      <div className={`max-expand-chat-user-row${agentMode === 'r1pxc' ? ' r1pxc-chat' : ''}`}>
        <div className={`max-expand-chat-bubble user${agentMode === 'r1pxc' ? ' r1pxc-chat' : ''}`}>
          {msg.quote && agentMode === 'r1pxc' && (
            <div className="max-expand-chat-quote-block">
              <span className="max-expand-chat-quote-block-text">{msg.quote.length > 80 ? msg.quote.slice(0, 80) + '…' : msg.quote}</span>
            </div>
          )}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className="max-expand-chat-bubble-attachments">
              {msg.attachments.map((a) => (
                <span key={a.name} className="max-expand-chat-bubble-attachment-tag">
                  {resolveDevIconByFileName(a.name) ? (
                    <img className="max-expand-chat-bubble-attachment-icon" src={resolveDevIconByFileName(a.name)} alt="" aria-hidden="true" />
                  ) : (
                    <span className="max-expand-chat-bubble-attachment-icon-fallback" aria-hidden="true" />
                  )}
                  <span>{a.name}</span>
                </span>
              ))}
            </div>
          )}
          {msg.content.replace(/^(?:<attachment name="[^"]*">\n[\s\S]*?\n<\/attachment>\n*)+/, '').replace(/^> 引用: [\s\S]*?\n\n/, '').trim()}
        </div>
        {userAvatarUrl ? (
          <img className="max-expand-chat-user-avatar" src={userAvatarUrl} alt="" />
        ) : (
          <span className="max-expand-chat-user-avatar max-expand-chat-user-avatar--placeholder" />
        )}
      </div>
    );
  }

  return (
    <div className={`max-expand-chat-bubble ai${agentMode === 'r1pxc' ? ' r1pxc-chat' : ''}`}>
      <MessageTimeline
        msg={msg}
        absoluteIndex={absoluteIndex}
        totalMessages={totalMessages}
        isStreaming={isStreaming}
        showThinking={Boolean(aiConfig.deepseekThinking)}
        onReportIssue={handleReportIssueClick}
      />
    </div>
  );
});

export { ChatMessageRow };
export type { ChatMessageRowProps };
