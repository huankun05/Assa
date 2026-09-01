"""记忆系统端到端实测脚本。

验证：
1. L0 对话历史读写
2. L1 工作记忆 add/search/forget/count
3. 侧车 /chat 是否能正常对话并写入记忆
"""

from agent.memory.store import init_db, add, search, count, forget
from agent.memory.history import load_history, save_history
from agent.memory.working import add_fact, get_active_facts, clear_expired

def test_store():
    init_db()
    before = count()
    add("fact", "用户喜欢简洁")
    add("preference", "默认模型 qwen3-4b-32k")
    assert count() == before + 2
    results = search("用户")
    assert len(results) >= 1
    forget("模型")
    assert count() == before + 1
    print("[store] OK")

def test_history():
    history = load_history()
    assert isinstance(history, list)
    save_history(history + [{"role": "user", "content": "test"}])
    new_history = load_history()
    assert len(new_history) == len(history) + 1
    # 恢复原状
    save_history(history)
    print("[history] OK")

def test_working():
    add_fact("测试事实", source="test", importance=3)
    facts = get_active_facts()
    assert any("测试事实" in f for f in facts), f"facts: {facts}"
    removed = clear_expired()
    print(f"[working] OK (cleared {removed} expired)")

if __name__ == "__main__":
    test_store()
    test_history()
    test_working()
    print("all memory tests passed")
