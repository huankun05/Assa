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
 * @file AiChatTab.tsx
 * @description 最大展开模式 — AI 对话 Tab（OpenAI 兼容 API + 流式输出）
 * @author 鸡哥
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SvgIcon } from '../../../../../../utils/SvgIcon';
import { SESSION_STREAMING_IDS } from '../hooks/useChatState';
import { useChatState } from '../hooks/useChatState';
import { useChatSend } from '../hooks/useChatSend';
import { ChatMessageRow } from './ChatMessageRow';
import { WebAccessPanel, LocalToolAccessPanel } from './WebAccessPanel';
import { ChatInputBar } from './ChatInputBar';

/**
 * AI 对话 Tab
 * @description 包含消息列表和输入栏的聊天界面，调用 OpenAI 兼容 API
 */
export function AiChatTab(): React.ReactElement {
  const { t } = useTranslation();
  const state = useChatState();
  const send = useChatSend({ state });

  const {
    isProUser,
    chatRootRef, chatEndRef, inputRef,
    agentMode,
    showSessionSidebar,
    userAvatarUrl,
    currentAgentModeConfig,
    setVisibleWindowStart,
    hasUpperHiddenMessages, hasLowerHiddenMessages,
    emptyGreeting, visibleMessages, visibleStartIndex,
    orderedSessions, getSessionCardState,
    aiChatMessages, aiChatStreaming, activeAiChatSessionId,
    aiWebAccessPrompt, aiLocalToolAccessPrompt,
    aiConfig,
    setAiChatStreaming,
    switchAiChatSession,
    deleteAiChatSession,
    dominantColor,
    VISIBLE_CHAT_WINDOW_SIZE, VISIBLE_CHAT_WINDOW_STEP,
  } = state;

  const {
    handleSend,
    handleResolveWebAccess,
    handleResolveLocalToolAccess,
    handleDomainPolicyChange,
    handleAttachFiles,
    handleAttachmentDragEnter,
    handleAttachmentDragOver,
    handleAttachmentDragLeave,
    handleAttachmentDropEvent,
    handleReportIssueFromFinalAnswer,
    navigateToSettingsTab,
  } = send;

  /** 回车发送 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="max-expand-chat" ref={chatRootRef} style={{ '--chat-dominant-r': Math.max(dominantColor[0], 140), '--chat-dominant-g': Math.max(dominantColor[1], 140), '--chat-dominant-b': Math.max(dominantColor[2], 140) } as React.CSSProperties}>
      {/* 标题 */}
      <div className="max-expand-chat-header">
        <span className="max-expand-chat-header-title">{currentAgentModeConfig.label} Agent</span>
        <div className="max-expand-chat-header-actions">
          <span className="max-expand-chat-header-model">{state.selectedModel || t('aiChat.notConfigured', { defaultValue: '未配置' })}</span>
          <button className="max-expand-chat-clear" onClick={state.handleCreateNewChat} type="button">
            {t('aiChat.actions.newChat', { defaultValue: '新建对话' })}
          </button>
        </div>
      </div>
      <div className="max-expand-chat-body">
        <aside
          className={`max-expand-chat-session-sidebar ${showSessionSidebar ? 'is-open' : 'is-closed'}`}
          aria-hidden={!showSessionSidebar}
        >
          <div className="max-expand-chat-session-sidebar-inner">
            <div className="max-expand-chat-session-sidebar-title">
              {t('aiChat.session.historyTitle', { defaultValue: '历史会话' })}
            </div>
            <div className="max-expand-chat-session-list">
              {orderedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`max-expand-chat-session-item ${session.id === activeAiChatSessionId ? 'active' : ''} status-${getSessionCardState(session.id)}`}
                  onClick={() => {
                    if (session.id === activeAiChatSessionId) return;
                    switchAiChatSession(session.id);
                    setAiChatStreaming(SESSION_STREAMING_IDS.has(session.id));
                    setVisibleWindowStart(0);
                    state.setResolvingWebAccessDecision(false);
                    state.setResolvingLocalToolAccessDecision(false);
                    state.setPendingQuote(null);
                  }}
                >
                  <span className="max-expand-chat-session-item-main">
                    <span className="max-expand-chat-session-item-title">{session.title || t('aiChat.session.untitled', { defaultValue: '新对话' })}</span>
                    <span className="max-expand-chat-session-item-time">{new Date(session.updatedAt).toLocaleString()}</span>
                  </span>
                  <span className="max-expand-chat-session-item-actions">
                    <span
                      className="max-expand-chat-session-delete"
                      role="button"
                      aria-label={t('aiChat.actions.deleteSession', { defaultValue: '删除会话' })}
                      title={t('aiChat.actions.deleteSession', { defaultValue: '删除会话' })}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteAiChatSession(session.id);
                      }}
                    >
                      <img src={SvgIcon.DELETE} alt="" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <div className="max-expand-chat-content">
          {/* 消息列表 */}
          <div className="max-expand-chat-messages" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 800px' }}>
            {hasUpperHiddenMessages && (
              <div className="max-expand-chat-history-tip">
                <button
                  type="button"
                  className="max-expand-chat-history-load-more"
                  onClick={() => {
                    setVisibleWindowStart(prev => Math.max(0, prev - VISIBLE_CHAT_WINDOW_STEP));
                  }}
                >
                  {t('aiChat.actions.loadMoreHistory', { defaultValue: '加载更多对话' })}
                </button>
              </div>
            )}
            {aiChatMessages.length === 0 && (
              <div className="max-expand-chat-empty">
                <div>{emptyGreeting}</div>
                <div className="max-expand-chat-empty-disclaimer">
                  {t('aiChat.messages.aiGeneratedDisclaimer', { defaultValue: '内容由 AI 生成，请仔细甄别。' })}
                </div>
              </div>
            )}
            {visibleMessages.map((msg, i) => {
              const absoluteIndex = visibleStartIndex + i;
              return (
                <ChatMessageRow
                  key={absoluteIndex}
                  msg={msg}
                  absoluteIndex={absoluteIndex}
                  totalMessages={aiChatMessages.length}
                  isStreaming={aiChatStreaming}
                  agentMode={agentMode}
                  aiConfig={aiConfig}
                  userAvatarUrl={userAvatarUrl}
                  onQuote={state.setPendingQuote}
                  onReportIssue={handleReportIssueFromFinalAnswer}
                  onNavigateToSettingsTab={navigateToSettingsTab}
                />
              );
            })}
            {hasLowerHiddenMessages && (
              <div className="max-expand-chat-history-tip">
                <button
                  type="button"
                  className="max-expand-chat-history-load-more"
                  onClick={() => {
                    const maxStart = Math.max(0, aiChatMessages.length - VISIBLE_CHAT_WINDOW_SIZE);
                    setVisibleWindowStart(prev => Math.min(maxStart, prev + VISIBLE_CHAT_WINDOW_STEP));
                  }}
                >
                  {t('aiChat.actions.loadMoreHistory', { defaultValue: '加载更多对话' })}
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {/* 网页访问授权面板 */}
          {aiWebAccessPrompt?.sessionId === activeAiChatSessionId && (
            <WebAccessPanel
              iconUrl={aiWebAccessPrompt.iconUrl}
              siteName={aiWebAccessPrompt.siteName}
              hostname={aiWebAccessPrompt.hostname}
              url={aiWebAccessPrompt.url}
              message={aiWebAccessPrompt.message}
              domainPolicy={aiWebAccessPrompt.domainPolicy}
              resolving={state.resolvingWebAccessDecision}
              resolveError={state.aiWebAccessResolveError}
              onResolve={handleResolveWebAccess}
              onPolicyChange={handleDomainPolicyChange}
            />
          )}
          {/* 本地工具访问授权面板 */}
          {aiLocalToolAccessPrompt?.sessionId === activeAiChatSessionId && (
            <LocalToolAccessPanel
              prompt={aiLocalToolAccessPrompt}
              resolving={state.resolvingLocalToolAccessDecision}
              resolveError={state.aiLocalToolAccessResolveError}
              onResolve={handleResolveLocalToolAccess}
            />
          )}
        </div>
      </div>
      {/* 输入栏 */}
      <ChatInputBar
        input={state.input}
        setInput={state.setInput}
        isStreaming={aiChatStreaming}
        agentMode={agentMode}
        currentAgentModeConfig={currentAgentModeConfig}
        selectedModel={state.selectedModel}
        isOllamaModel={state.isOllamaModel}
        isCustomApiModel={state.isCustomApiModel}
        modelToggleIcon={state.modelToggleIcon}
        customApiDisplayLabel={state.customApiDisplayLabel}
        ollamaDisplayLabel={state.ollamaDisplayLabel}
        isProUser={isProUser}
        hasCustomApiCredentials={state.hasCustomApiCredentials}
        aiConfig={aiConfig}
        setAiConfig={state.setAiConfig}
        contextUsageTokens={state.contextUsageTokens}
        selectedContextLimit={state.selectedContextLimit}
        contextUsagePercent={state.contextUsagePercent}
        contextUsagePercentText={state.contextUsagePercentText}
        contextUsageLevelClass={state.contextUsageLevelClass}
        contextUsageInlineText={state.contextUsageInlineText}
        selectedContextLabel={state.selectedContextLabel}
        showModelCard={state.showModelCard}
        setShowModelCard={state.setShowModelCard}
        showModelDropdown={state.showModelDropdown}
        setShowModelDropdown={state.setShowModelDropdown}
        modelDropdownRef={state.modelDropdownRef}
        showContextDropdown={state.showContextDropdown}
        setShowContextDropdown={state.setShowContextDropdown}
        contextDropdownRef={state.contextDropdownRef}
        showAgentModeDropdown={state.showAgentModeDropdown}
        toggleAgentModeDropdown={state.toggleAgentModeDropdown}
        setAgentMode={state.setAgentMode}
        agentModeDropdownRef={state.agentModeDropdownRef}
        agentModeTriggerRef={state.agentModeTriggerRef}
        agentModeDropdownPos={state.agentModeDropdownPos}
        showSessionSidebar={showSessionSidebar}
        setShowSessionSidebar={state.setShowSessionSidebar}
        pendingAttachments={state.pendingAttachments}
        setPendingAttachments={state.setPendingAttachments}
        fileInputRef={state.fileInputRef}
        attachmentDragOver={state.attachmentDragOver}
        attachmentDropInvalid={state.attachmentDropInvalid}
        handleAttachmentDragEnter={handleAttachmentDragEnter}
        handleAttachmentDragOver={handleAttachmentDragOver}
        handleAttachmentDragLeave={handleAttachmentDragLeave}
        handleAttachmentDropEvent={handleAttachmentDropEvent}
        handleAttachFiles={handleAttachFiles}
        skillDragOver={state.skillDragOver}
        setSkillDragOver={state.setSkillDragOver}
        skillDragDepthRef={state.skillDragDepthRef}
        pendingQuote={state.pendingQuote}
        setPendingQuote={state.setPendingQuote}
        handleSend={handleSend}
        handleStop={state.handleStop}
        handleKeyDown={handleKeyDown}
        inputRef={inputRef}
        selectedProvider={state.selectedProvider}
      />
    </div>
  );
}
