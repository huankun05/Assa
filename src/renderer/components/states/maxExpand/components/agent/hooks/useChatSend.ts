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
 * @file useChatSend.ts
 * @description AI 对话消息发送 Hook：处理流式 API 调用、本地工具执行、网页授权及 SSE 事件分发。
 * @author 鸡哥
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  resolveMihtnelisWebAccess,
} from '../../../../../../api/ai/mihtnelisAgentStream';
import { resolveXiyueLocalToolResult, rejectXiyueLocalTool } from '../../../../../../api/ai/xiyueLocalTool';
import { streamXiyueAgent } from '../../../../../../api/ai/xiyueLocalAgent';
import {
  setWebsiteAuthorizationPolicy,
  type SiteAuthorizationPolicy,
} from '../../../../../../api/site/siteMetaApi';
import useIslandStore from '../../../../../../store/slices';
import type { AiChatAttachment, AiChatMessage, AiToolCall } from '../../../../../../store/types';
import { readLocalToken } from '../../../../../../utils/userAccount';
import { unwrapJsonEnvelope } from '../utils/chatUtils';
import {
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_SIZE_BYTES,
} from '../config/chatConstants';
import {
  isAcceptedAttachmentFile,
} from '../utils/chatHelpers';
import {
  SESSION_ABORT_CONTROLLERS,
  SESSION_STREAMING_IDS,
  type ChatState,
} from './useChatState';

import {
  getXiyueVisibleName,
  getXiyueModelDefault,
} from '../../../../../../utils/xiyueIdentity';

/** useChatSend Hook Props — 从 useChatState 解构出需要的状态与方法 */
interface UseChatSendParams {
  state: ChatState;
}

/** useChatSend Hook 返回类型 */
interface UseChatSendResult {
  handleSend: () => Promise<void>;
  executeAndSubmitLocalToolResult: (params: {
    token: string;
    requestId: string;
    tool: string;
    argumentsPayload: Record<string, unknown>;
  }) => Promise<void>;
  handleResolveWebAccess: (allow: boolean) => Promise<void>;
  handleResolveLocalToolAccess: (allow: boolean) => Promise<void>;
  handleDomainPolicyChange: (policy: SiteAuthorizationPolicy) => void;
  handleAttachFiles: (files: FileList | File[]) => void;
  handleAttachmentDrop: (files: FileList | File[]) => void;
  handleAttachmentDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleAttachmentDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleAttachmentDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleAttachmentDropEvent: (e: React.DragEvent<HTMLDivElement>) => void;
  markAttachmentDropInvalid: () => void;
  handleReportIssueFromFinalAnswer: (traceId: string, finalAnswer: string) => void;
  navigateToSettingsTab: (intent: string) => void;
}

/** AI 对话消息发送 Hook */
export function useChatSend({ state }: UseChatSendParams): UseChatSendResult {
  const { t } = useTranslation();

  const {
    input, setInput,
    setVisibleWindowStart,
    agentMode,
    pendingAttachments, setPendingAttachments,
    attachmentDragDepthRef, attachmentInvalidTimerRef,
    pendingMessageFlushRafRef,
    setResolvingWebAccessDecision,
    aiLocalToolAccessPrompt, setAiLocalToolAccessPrompt,
    setAiLocalToolAccessResolveError,
    setResolvingLocalToolAccessDecision,
    setPendingQuote,
    aiChatMessages, aiChatSessions, activeAiChatSessionId,
    aiChatStreaming,
    setAiChatStreaming, setAiChatSessionMessages,
    markAiChatSessionReplyFinished, setAiChatMessages,
    aiWebAccessPrompt, setAiWebAccessPrompt,
    setAiWebAccessResolveError,
    aiConfig,
    updateMessages, flushPendingAssistantUpdates,
    scheduleAssistantUpdateFlush, refreshActiveSessionStreaming,
    selectedModel, isOllamaModel, isCustomApiModel,
    selectedProvider, hasCustomApiCredentials,
    contextUsageTokens, selectedContextLimit,
    setAttachmentDragOver, setAttachmentDropInvalid,
  } = state;

  /** 执行本地工具并提交结果 */
  const executeAndSubmitLocalToolResult = useCallback(async (params: {
    requestId: string;
    tool: string;
    argumentsPayload: Record<string, unknown>;
  }): Promise<void> => {
    const executor = window.api?.executeAgentLocalTool;
    if (typeof executor !== 'function') {
      await resolveXiyueLocalToolResult({
        requestId: params.requestId,
        success: false,
        result: {},
        error: 'LOCAL_RUNTIME_UNAVAILABLE',
      });
      return;
    }
    let execution: {
      success?: boolean;
      result?: unknown;
      error?: string;
    } = {};
    try {
      // 仅在用户于授权框点击"允许"后进入此函数：主进程终审要求 confirm 工具必须携带 userConfirmed
      execution = await executor({
        tool: params.tool,
        arguments: params.argumentsPayload,
        workspaces: aiConfig.workspaces,
        userConfirmed: true,
      });
    } catch (error: unknown) {
      execution = {
        success: false,
        result: {},
        error: error instanceof Error
          ? error.message
          : t('aiChat.messages.localToolExecuteFailed', { defaultValue: '本地工具执行失败' }),
      };
    }
    await resolveXiyueLocalToolResult({
      requestId: params.requestId,
      success: Boolean(execution?.success),
      result: execution?.result,
      error: typeof execution?.error === 'string' ? execution.error : '',
    });
  }, [aiConfig.workspaces, t]);

  /** 发送消息并调用 API */
  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    const targetSessionId = activeAiChatSessionId;
    if (!text) return;
    if (SESSION_STREAMING_IDS.has(targetSessionId)) {
      if (agentMode !== 'r1pxc') return;
      const prevController = SESSION_ABORT_CONTROLLERS.get(targetSessionId);
      prevController?.abort();
      SESSION_ABORT_CONTROLLERS.delete(targetSessionId);
      SESSION_STREAMING_IDS.delete(targetSessionId);
      if (pendingMessageFlushRafRef.current !== null && pendingMessageFlushRafRef.current !== undefined) {
        window.cancelAnimationFrame(pendingMessageFlushRafRef.current);
        pendingMessageFlushRafRef.current = null;
      }
      flushPendingAssistantUpdates();
    }
    const updateTargetMessages = (updater: (prev: AiChatMessage[]) => AiChatMessage[]): void => {
      const storeState = useIslandStore.getState();
      const session = storeState.aiChatSessions.find((item) => item.id === targetSessionId);
      const prevMessages = session?.messages ?? [];
      storeState.setAiChatSessionMessages(targetSessionId, updater(prevMessages));
    };

    // 汐月本地 Agent 无需 token/API Key（原登录校验已移除）
    if (contextUsageTokens >= selectedContextLimit) {
      updateTargetMessages(prev => ([
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: t('aiChat.messages.contextLimitExceeded', {
            defaultValue: '⚠️ 当前会话已累计使用 {{used}} tokens，超出上下文限制（{{max}} tokens）。请新建会话继续对话。',
            used: contextUsageTokens.toLocaleString(),
            max: selectedContextLimit.toLocaleString(),
          }),
        },
      ]));
      setInput('');
      return;
    }

    const attachmentMeta: AiChatAttachment[] = pendingAttachments.map((a) => ({ name: a.name, size: a.size }));
    const attachmentPrefix = pendingAttachments.length > 0
      ? pendingAttachments.map((a) => `<attachment name="${a.name}">\n${a.content}\n</attachment>`).join('\n\n') + '\n\n'
      : '';
    const quotePrefix = state.pendingQuote && agentMode === 'r1pxc' ? `> 引用: ${state.pendingQuote}\n\n` : '';
    const fullContent = attachmentPrefix + quotePrefix + text;
    const userMsg: AiChatMessage = {
      role: 'user',
      content: fullContent,
      ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
      ...(state.pendingQuote && agentMode === 'r1pxc' ? { quote: state.pendingQuote } : {}),
    };
    updateTargetMessages(prev => [...prev, userMsg]);
    const latestSession = useIslandStore.getState().aiChatSessions.find((s) => s.id === targetSessionId);
    const nextMessages: AiChatMessage[] = latestSession?.messages ?? [...aiChatMessages, userMsg];
    setVisibleWindowStart(0);
    setInput('');
    setPendingAttachments([]);
    setPendingQuote(null);
    setAiChatStreaming(true);
    setAiWebAccessPrompt(null);
    setAiWebAccessResolveError('');
    setAiLocalToolAccessPrompt(null);
    setAiLocalToolAccessResolveError('');

    // 构建 API 请求消息（含 system prompt）
    const apiMessages: { role: string; content: string }[] = [];
    if (aiConfig.systemPrompt) {
      apiMessages.push({ role: 'system', content: aiConfig.systemPrompt });
    }
    nextMessages.forEach((m) => {
      apiMessages.push({ role: m.role, content: m.content });
    });

    // 添加占位 AI 消息
    updateTargetMessages(prev => ([...prev, { role: 'assistant', content: '', model: selectedModel, finalized: false, thinkBlocks: [], toolCalls: [] }]));

    const controller = new AbortController();
    SESSION_ABORT_CONTROLLERS.set(targetSessionId, controller);
    SESSION_STREAMING_IDS.add(targetSessionId);
    refreshActiveSessionStreaming();

    try {
      // ── 汐月 Hermes 本地 Agent（原三路由停用，分支体保留但不可达）──
      {
        let receivedXiyueChunk = false;
        await streamXiyueAgent({
          message: text,
          signal: controller.signal,
          onEvent: (event) => {
            if (SESSION_ABORT_CONTROLLERS.get(targetSessionId) !== controller) return;

            const pushAssistant = (updater: (prev: AiChatMessage) => AiChatMessage) => {
              updateTargetMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (!last || last.role !== 'assistant') return copy;
                copy[copy.length - 1] = updater(last);
                return copy;
              });
            };

            if (event.type === 'think') {
              const payload = event.payload as { text?: unknown } | undefined;
              const text = typeof payload?.text === 'string' ? payload.text : '';
              if (text) {
                pushAssistant(prev => ({
                  ...prev,
                  thinkBlocks: [...(prev.thinkBlocks ?? []), text],
                }));
              }
              return;
            }

            if (event.type === 'chunk') {
              const payload = event.payload as { text?: unknown } | undefined;
              const chunk = typeof payload?.text === 'string' ? payload.text : '';
              if (!chunk) return;
              receivedXiyueChunk = true;
              pushAssistant(prev => ({ ...prev, content: `${prev.content}${chunk}` }));
              return;
            }

            if (event.type === 'tool_call_request') {
              const payload = event.payload as {
                requestId?: unknown;
                tool?: unknown;
                purpose?: unknown;
                arguments?: unknown;
                authorizationRequired?: unknown;
              } | undefined;
              const requestId = typeof payload?.requestId === 'string' ? payload.requestId.trim() : '';
              const tool = typeof payload?.tool === 'string' ? payload.tool.trim() : '';
              const purpose = typeof payload?.purpose === 'string' ? payload.purpose.trim() : '';
              const authorizationRequired = Boolean(payload?.authorizationRequired);
              const argumentsPayload = (typeof payload?.arguments === 'object' && payload?.arguments !== null)
                ? (payload.arguments as Record<string, unknown>) : {};
              if (!tool || !requestId) return;

              pushAssistant(prev => {
                const tc = {
                  turn: (prev.toolCalls ?? []).length + 1,
                  tool,
                  purpose: purpose || `调用 ${tool}`,
                  arguments: argumentsPayload,
                  pending: true,
                  success: false,
                  result: {},
                  error: '',
                } as AiToolCall;
                return { ...prev, toolCalls: [...(prev.toolCalls ?? []), tc] };
              });

              if (authorizationRequired) {
                setAiLocalToolAccessPrompt({
                  sessionId: targetSessionId,
                  requestId,
                  tool,
                  purpose: purpose || `工具 ${tool} 请求授权`,
                  argumentsPayload,
                  riskLevel: 'confirm',
                  message: purpose || `工具 ${tool} 需要授权`,
                });
                return;
              }

              void (async () => {
                try {
                  const executor = window.api?.executeAgentLocalTool;
                  if (typeof executor !== 'function') {
                    await resolveXiyueLocalToolResult({ requestId, success: false, result: {}, error: 'LOCAL_RUNTIME_UNAVAILABLE' });
                    return;
                  }
                  const execution = await executor({ tool, arguments: argumentsPayload, workspaces: aiConfig.workspaces });
                  await resolveXiyueLocalToolResult({
                    requestId,
                    success: Boolean(execution?.success),
                    result: execution?.result,
                    error: typeof execution?.error === 'string' ? execution.error : '',
                  });
                  pushAssistant(prev => {
                    const toolCalls = [...(prev.toolCalls ?? [])];
                    const last = toolCalls[toolCalls.length - 1];
                    if (last && last.requestId === requestId) {
                      toolCalls[toolCalls.length - 1] = {
                        ...last,
                        pending: false,
                        success: Boolean(execution?.success),
                        result: execution?.result ?? {},
                        error: typeof execution?.error === 'string' ? execution.error : '',
                      } as AiToolCall;
                    }
                    return { ...prev, toolCalls };
                  });
                } catch {
                  await resolveXiyueLocalToolResult({ requestId, success: false, result: {}, error: '本地工具执行异常' });
                }
              })();
              return;
            }

            if (event.type === 'tool_call_result') {
              return;
            }

            if (event.type === 'final') {
              pushAssistant(prev => ({ ...prev, finalized: true, model: '汐月' }));
              return;
            }

            if (event.type === 'error') {
              const payload = event.payload as { message?: unknown } | undefined;
              const msg = typeof payload?.message === 'string' ? payload.message : '汐月返回错误';
              pushAssistant(prev => {
                if (!prev.content) {
                  return { ...prev, content: `❌ ${msg}` };
                }
                return prev;
              });
            }
          },
        });
        if (!receivedXiyueChunk) {
          updateTargetMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant' && !last.content) {
              copy[copy.length - 1] = { ...last, content: '⚠️ 汐月没有返回内容，请确认 Ollama 已启动。' };
            }
            return copy;
          });
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg = err instanceof Error
        ? err.message
        : t('aiChat.messages.unknownError', { defaultValue: '未知错误' });
      updateTargetMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = { ...last, content: `❌ ${errMsg}` };
        } else {
          copy.push({ role: 'assistant', content: `❌ ${errMsg}` });
        }
        return copy;
      });
    } finally {
      if (SESSION_ABORT_CONTROLLERS.get(targetSessionId) !== controller) return;
      SESSION_ABORT_CONTROLLERS.delete(targetSessionId);
      SESSION_STREAMING_IDS.delete(targetSessionId);
      refreshActiveSessionStreaming();
      if (pendingMessageFlushRafRef.current !== null && pendingMessageFlushRafRef.current !== undefined) {
        window.cancelAnimationFrame(pendingMessageFlushRafRef.current);
        pendingMessageFlushRafRef.current = null;
      }
      flushPendingAssistantUpdates();
      // 流结束后解包 JSON 信封并强制补存
      const storeState = useIslandStore.getState();
      const finalMessages = storeState.aiChatSessions.find((item) => item.id === targetSessionId)?.messages || [];
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
        const unwrapped = unwrapJsonEnvelope(lastMsg.content);
        if (unwrapped !== lastMsg.content) {
          const patched = [...finalMessages];
          patched[patched.length - 1] = { ...lastMsg, content: unwrapped };
          storeState.setAiChatSessionMessages(targetSessionId, patched);
        } else {
          storeState.setAiChatSessionMessages(targetSessionId, finalMessages);
        }
      } else {
        storeState.setAiChatSessionMessages(targetSessionId, finalMessages);
      }
      markAiChatSessionReplyFinished(targetSessionId, Date.now());
      setResolvingWebAccessDecision(false);
      setResolvingLocalToolAccessDecision(false);
    }
  }, [
    input, agentMode, aiChatMessages, aiChatSessions, activeAiChatSessionId,
    aiConfig, selectedModel, isOllamaModel, isCustomApiModel,
    selectedProvider, hasCustomApiCredentials, contextUsageTokens, selectedContextLimit,
    pendingAttachments, state.pendingQuote,
    setAiChatStreaming, setAiChatSessionMessages, markAiChatSessionReplyFinished, setAiChatMessages,
    setAiWebAccessPrompt, setAiWebAccessResolveError, setAiLocalToolAccessPrompt, setAiLocalToolAccessResolveError,
    setResolvingWebAccessDecision, setResolvingLocalToolAccessDecision,
    setVisibleWindowStart, setInput,
    setPendingAttachments, setPendingQuote,
    updateMessages, flushPendingAssistantUpdates,
    scheduleAssistantUpdateFlush, refreshActiveSessionStreaming,
    executeAndSubmitLocalToolResult,
    pendingMessageFlushRafRef, t,
  ]);

  /** 标记附件拖放无效 */
  const markAttachmentDropInvalid = useCallback(() => {
    setAttachmentDropInvalid(true);
    if (attachmentInvalidTimerRef.current !== null && attachmentInvalidTimerRef.current !== undefined) {
      window.clearTimeout(attachmentInvalidTimerRef.current);
    }
    attachmentInvalidTimerRef.current = window.setTimeout(() => {
      setAttachmentDropInvalid(false);
      attachmentInvalidTimerRef.current = null;
    }, 1200);
  }, [setAttachmentDropInvalid, attachmentInvalidTimerRef]);

  /** 处理文件附件 */
  const handleAttachFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (pendingAttachments.length >= ATTACHMENT_MAX_COUNT) return;
      if (file.size > ATTACHMENT_MAX_SIZE_BYTES) return;
      if (!isAcceptedAttachmentFile(file.name)) return;
      if (pendingAttachments.some((a) => a.name === file.name)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : '';
        if (!content) return;
        setPendingAttachments((prev) => {
          if (prev.length >= ATTACHMENT_MAX_COUNT) return prev;
          if (prev.some((a) => a.name === file.name)) return prev;
          return [...prev, { name: file.name, size: file.size, content }];
        });
      };
      reader.readAsText(file);
    });
    if (state.fileInputRef.current) state.fileInputRef.current.value = '';
  }, [pendingAttachments, setPendingAttachments, state.fileInputRef]);

  /** 处理附件拖放 */
  const handleAttachmentDrop = useCallback((files: FileList | File[]) => {
    if (aiChatStreaming) return;
    const fileArray = Array.from(files);
    if (pendingAttachments.length >= ATTACHMENT_MAX_COUNT) {
      markAttachmentDropInvalid();
      return;
    }
    const hasInvalid = fileArray.some(
      (file) => file.size > ATTACHMENT_MAX_SIZE_BYTES || !isAcceptedAttachmentFile(file.name),
    );
    if (hasInvalid) {
      markAttachmentDropInvalid();
    }
    handleAttachFiles(fileArray);
  }, [aiChatStreaming, handleAttachFiles, markAttachmentDropInvalid, pendingAttachments.length]);

  const handleAttachmentDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    attachmentDragDepthRef.current += 1;
    setAttachmentDragOver((prev) => (prev ? prev : true));
  }, [setAttachmentDragOver, attachmentDragDepthRef]);

  const handleAttachmentDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleAttachmentDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    attachmentDragDepthRef.current = Math.max(0, attachmentDragDepthRef.current - 1);
    if (attachmentDragDepthRef.current === 0) {
      setAttachmentDragOver(false);
    }
  }, [setAttachmentDragOver, attachmentDragDepthRef]);

  const handleAttachmentDropEvent = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    attachmentDragDepthRef.current = 0;
    setAttachmentDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleAttachmentDrop(e.dataTransfer.files);
    }
  }, [handleAttachmentDrop, setAttachmentDragOver, attachmentDragDepthRef]);

  /** 上报问题 */
  const handleReportIssueFromFinalAnswer = useCallback((traceId: string, finalAnswer: string): void => {
    const safeTraceId = traceId.trim() || '-';
    const safeAnswer = finalAnswer.trim();
    const payload = {
      title: t('aiChat.feedback.issueTitle', { defaultValue: 'Agent输出不符合预期 - {{traceId}}', traceId: safeTraceId }),
      content: safeAnswer,
    };
    void window.api.storeWrite('settings-about-feedback-prefill', payload)
      .then(() => window.api.storeWrite('settings-open-tab', 'about-feedback'))
      .then(() => window.api.openSettingsWindow())
      .catch(() => {});
  }, [t]);

  /** 导航到设置标签（打开独立设置窗口并携带意图） */
  const navigateToSettingsTab = useCallback((intent: string): void => {
    void window.api.storeWrite('settings-open-tab', intent)
      .then(() => window.api.openSettingsWindow())
      .catch(() => {});
  }, []);

  /** 处理网页访问授权 */
  const handleResolveWebAccess = useCallback(async (allow: boolean): Promise<void> => {
    const localToken = readLocalToken();
    if (!localToken || !aiWebAccessPrompt?.requestId) return;
    const policy: SiteAuthorizationPolicy = aiWebAccessPrompt.domainPolicy === 'allow' || aiWebAccessPrompt.domainPolicy === 'deny'
      ? aiWebAccessPrompt.domainPolicy
      : 'ask';
    setWebsiteAuthorizationPolicy(aiWebAccessPrompt.url, policy);
    setResolvingWebAccessDecision(true);
    setAiWebAccessResolveError('');
    try {
      await resolveMihtnelisWebAccess({
        token: localToken,
        requestId: aiWebAccessPrompt.requestId,
        allow,
      });
      if (!allow) {
        setAiWebAccessPrompt(null);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t('aiChat.messages.unknownError', { defaultValue: '未知错误' });
      if (errMsg.toLowerCase().includes('pending request not found')) {
        setAiWebAccessPrompt(null);
        updateMessages(prev => ([
          ...prev,
          {
            role: 'assistant',
            content: t('aiChat.webAccess.expiredHint', {
              defaultValue: '网页授权请求已失效，请重新发起请求后再授权。',
            }),
          },
        ]));
        return;
      }
      setAiWebAccessResolveError(errMsg);
    } finally {
      setResolvingWebAccessDecision(false);
    }
  }, [t, aiWebAccessPrompt, setAiWebAccessPrompt, setAiWebAccessResolveError, updateMessages, setResolvingWebAccessDecision]);

  /** 处理本地工具访问授权 */
  const handleResolveLocalToolAccess = useCallback(async (allow: boolean): Promise<void> => {
    if (!aiLocalToolAccessPrompt?.requestId) return;
    setResolvingLocalToolAccessDecision(true);
    setAiLocalToolAccessResolveError('');
    try {
      if (!allow) {
        await rejectXiyueLocalTool(aiLocalToolAccessPrompt.requestId, '用户拒绝执行工具');
        setAiLocalToolAccessPrompt(null);
        return;
      }
      await executeAndSubmitLocalToolResult({
        requestId: aiLocalToolAccessPrompt.requestId,
        tool: aiLocalToolAccessPrompt.tool,
        argumentsPayload: aiLocalToolAccessPrompt.argumentsPayload,
      });
      setAiLocalToolAccessPrompt(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t('aiChat.messages.unknownError', { defaultValue: '未知错误' });
      if (errMsg.toLowerCase().includes('pending local tool request not found')) {
        setAiLocalToolAccessPrompt(null);
        updateMessages(prev => ([
          ...prev,
          {
            role: 'assistant',
            content: t('aiChat.localToolAccess.expiredHint', {
              defaultValue: '本地工具授权请求已失效，请重新发起请求后再授权。',
            }),
          },
        ]));
        return;
      }
      setAiLocalToolAccessResolveError(errMsg);
    } finally {
      setResolvingLocalToolAccessDecision(false);
    }
  }, [t, aiLocalToolAccessPrompt, executeAndSubmitLocalToolResult, updateMessages, setAiLocalToolAccessPrompt, setAiLocalToolAccessResolveError, setResolvingLocalToolAccessDecision]);

  /** 网页授权策略变更 */
  const handleDomainPolicyChange = useCallback((policy: SiteAuthorizationPolicy): void => {
    if (!aiWebAccessPrompt) return;
    setAiWebAccessPrompt({ ...aiWebAccessPrompt, domainPolicy: policy });
    setAiWebAccessResolveError('');
  }, [aiWebAccessPrompt, setAiWebAccessPrompt, setAiWebAccessResolveError]);

  return {
    handleSend,
    executeAndSubmitLocalToolResult,
    handleResolveWebAccess,
    handleResolveLocalToolAccess,
    handleDomainPolicyChange,
    handleAttachFiles,
    handleAttachmentDrop,
    handleAttachmentDragEnter,
    handleAttachmentDragOver,
    handleAttachmentDragLeave,
    handleAttachmentDropEvent,
    markAttachmentDropInvalid,
    handleReportIssueFromFinalAnswer,
    navigateToSettingsTab,
  };
}
