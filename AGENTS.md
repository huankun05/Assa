<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Before any uncertain operation:
- If an operation could be risky, ambiguous, or has unclear impact, pause and ask the user before proceeding.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Agent Prompt Sync (Global Rule)

**When feature scope changes, agent prompts must be updated in the same task.**

- If you add/remove/change any user-facing eIsland feature, also sync corresponding agent prompt descriptions in `eisland-server/server`.
- Treat prompt sync as part of Definition of Done; do not mark the task complete if prompts are stale.
- At minimum, verify all affected prompt builders mention the new capability consistently.
- If uncertain which prompts are affected, explicitly ask and confirm before finishing.

## 6. i18n Completeness (UI Change Gate)

**Every user-facing string must have translations. No exceptions.**

After any UI change (new component, new text, modified labels, new feedback messages):
1. Scan all `t('...')` calls in changed files for translation keys.
2. Check both `i18n/zh-CN.json` and `i18n/en-US.json` — every key must exist in both.
3. If a key is missing, add it to both files before marking the task done.
4. Hard-coded Chinese/English strings in UI code are forbidden — wrap them in `t()`.

Verification: `grep -rn "defaultValue" src/renderer/components/<changed-dir>/` should show `t()` wrappers, not raw strings.

## 7. Comment Standards (Code Change Gate)

**All code must comply with [`docs/COMMENT_STANDARDS.md`](docs/COMMENT_STANDARDS.md). No exceptions.**

## 8. Frontend Standards (Code Change Gate)

**All frontend code must comply with [`docs/FRONTEND_STANDARDS.md`](docs/FRONTEND_STANDARDS.md). No exceptions.**

## 9. Plugin Version Bump (Plugin Change Gate)

**Any change to a plugin's source code requires a version bump in its `package.json`.**

- After modifying files under `plugins/<name>/`, check if `plugins/<name>/package.json` version was incremented.
- Follow semver: patch for bug fixes, minor for new features, major for breaking changes.
- The `publish-plugins.yml` workflow skips publish when the version is unchanged — forgetting the bump means the change never ships.

**Creating a new plugin requires registering it in `.github/workflows/publish-plugins.yml`.**

- Add the plugin name to both `publish-npm` and `publish-gpr` job matrices.
- Without registration, the new plugin will never be published to npm or GitHub Packages.

## 10. Performance Discipline: Unused Paths Stay Off (Resource Gate)

**不启用用户未使用的功能/服务/网络请求。省内存、省 CPU、少一次多余的 IPC/外呼。**

适用于：主进程常驻服务、定时器、预创建窗口、天气/定位等外部 API、插件 watcher、动画预加载。

### 规则

1. **功能选择即开关**  
   用户选了「自定义位置优先」→ **禁止再打 IP 定位**（含启动预警、节流刷新、失败回退路径上的 IP）。  
   通用模式：优先级路径成功后立刻返回；未选中的来源不得作为「静默预热」偷偷请求。

2. **默认关闭非关键服务**  
   例如：Codex 监听、外部 Agent 扫描、非必需 watcher——默认 off 或延后启动；用户开启才轮询。

3. **按需预热，用完可卸**  
   窗口预热（设置/独立窗）只在可能用到时触发；长时间隐藏应可销毁。  
   不要为「可能用到」在启动路径无条件拉起重窗口/重依赖。

4. **多源定位/数据源**  
   主源成功即停；备用源只在失败时调用。  
   禁止并行无意义地打多家 API「反正免费」。

5. **审查检查清单**（PR / 改动后自问）  
   - [ ] 用户关掉的选项是否还有网络/轮询/子进程？  
   - [ ] 自定义路径是否仍会触发 IP / GPS / 第三方？  
   - [ ] 新服务是否有默认关闭或空闲销毁？  
   - [ ] 启动 `whenReady` 是否塞了非关键 I/O？

### 反例 / 正例

| 反例 | 正例 |
|------|------|
| 自定义城市有效仍请求 ip-api | 自定义优先：仅 custom → cached |
| 启动即 precreate 所有窗口 | 启动空闲预热 + 10min 无用销毁 |
| 天气三源并行请求 | 优先级链，失败才下一个 |

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


---

## Platform

汐月 is developed exclusively for Windows. Do not add macOS/Apple ports. Keep new system能力 in the Electron shell (src/main + plugins/*); keep gent/ free of Win32/UI coupling (multi-platform discipline, see docs/产品定位讨论报告_v1.0.md).
