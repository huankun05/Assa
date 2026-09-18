"""Embedding 多方案实现。

当前提供轻量级 `local_hash` 方案：
- 384 维
- 零成本、确定性、无需外部模型
- 适合 P0 阶段的 Librarian 基础检索

后续可扩展：
- nomic_embed_text（Ollama）
- openai（OpenAI API）
- ollama_generic（任意 Ollama 模型）
"""
from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod
from typing import Callable


class Embedder(ABC):
    """Embedding 抽象基类。"""

    @property
    @abstractmethod
    def dim(self) -> int:
        """向量维度。"""
        ...

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        """将文本编码为稠密向量。"""
        ...


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个等长向量的余弦相似度。"""
    if len(a) != len(b) or not a:
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


def resize_vector(vec: list[float], target_dim: int) -> list[float]:
    """将向量缩放至目标维度（截断或循环填充）。"""
    if not vec:
        return [0.0] * target_dim
    if len(vec) >= target_dim:
        return vec[:target_dim]
    # 循环填充
    return [vec[i % len(vec)] for i in range(target_dim)]


class LocalHashEmbedder(Embedder):
    """本地哈希 Embedding。

    使用特征哈希（feature hashing）将文本映射到固定维度向量：
    1. 分词（字符 + 2-gram）
    2. 每个 token 用 MD5 哈希，取多个位置更新向量
    3. L2 归一化

    特点：
    - 完全离线，无模型依赖
    - 对相同文本输出相同向量
    - 适合关键词/短句的近似匹配
    """

    dim: int = 384

    def __init__(self, dim: int = 384):
        self.dim = dim

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """将文本拆分为字符与 2-gram。"""
        text = text.lower().strip()
        # 移除多余空白与标点，保留中文、英文、数字
        text = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text)
        chars = list(text.replace(" ", ""))
        bigrams = [text[i : i + 2] for i in range(len(text) - 1)]
        return chars + bigrams

    def embed(self, text: str) -> list[float]:
        """编码文本为 384 维向量。"""
        vec = [0.0] * self.dim
        tokens = self._tokenize(text)
        if not tokens:
            return vec

        for token in tokens:
            digest = hashlib.md5(token.encode("utf-8")).digest()
            # 每 2 字节映射到一个维度，最多更新 16 个位置
            updates = min(len(digest) // 2, 16)
            for i in range(updates):
                idx = int.from_bytes(digest[i * 2 : i * 2 + 2], "little") % self.dim
                # 用第 31 字节决定正负，增加区分度
                sign = -1 if digest[i] & 0x80 else 1
                vec[idx] += sign * 1.0

        # L2 归一化
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec


def get_embedder(provider: str = "local_hash", **kwargs) -> Embedder:
    """工厂函数：按名称获取 Embedding 实现。

    Args:
        provider: local_hash | ollama
        **kwargs: 额外参数

    Returns:
        Embedder 实例
    """
    if provider == "local_hash":
        return LocalHashEmbedder(**kwargs)
    if provider == "ollama":
        return OllamaEmbedder(**kwargs)
    raise ValueError(f"Unknown embedding provider: {provider}")


class OllamaEmbedder(Embedder):
    """Ollama /api/embeddings（默认 bge-m3，中文强）。

    - 超时或失败时由调用方决定是否回退 LocalHashEmbedder
    - dim 由 model 决定（bge-m3=1024）
    """

    def __init__(
        self,
        model: str = "bge-m3",
        base_url: str = "http://127.0.0.1:11434",
        timeout_s: float = 8.0,
        dim: int = 1024,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    def embed(self, text: str) -> list[float]:
        text = (text or "").strip()
        if not text:
            return [0.0] * self._dim
        try:
            import json
            import urllib.error
            import urllib.request

            payload = json.dumps({"model": self.model, "prompt": text}).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/api/embeddings",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                obj = json.loads(resp.read().decode("utf-8"))
            vec = obj.get("embedding") or []
            if not isinstance(vec, list) or not vec:
                raise RuntimeError("empty embedding")
            self._dim = len(vec)
            return [float(x) for x in vec]
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"ollama embed failed: {exc}") from exc


# 默认 embedder 单例
_default_embedder: Embedder | None = None


def get_default_embedder() -> Embedder:
    """获取默认 embedder（懒加载）。

    优先 Ollama bge-m3（ASSA_EMBED=local_hash 可强制离线哈希）；
    Ollama 不可用时自动回退 LocalHashEmbedder。
    """
    global _default_embedder
    if _default_embedder is not None:
        return _default_embedder

    import os

    pref = (os.environ.get("ASSA_EMBED") or "ollama").strip().lower()
    if pref != "local_hash":
        try:
            oll = OllamaEmbedder(
                model=os.environ.get("ASSA_EMBED_MODEL") or "bge-m3",
                base_url=os.environ.get("ASSA_OLLAMA_URL") or "http://127.0.0.1:11434",
                timeout_s=float(os.environ.get("ASSA_EMBED_TIMEOUT") or "8"),
            )
            # 探活一次，避免每条记忆都踩超时
            probe = oll.embed("ping")
            if probe:
                _default_embedder = oll
                return _default_embedder
        except Exception:
            pass

    _default_embedder = LocalHashEmbedder()
    return _default_embedder


def reset_default_embedder_cache() -> None:
    """测试/配置变更时重置默认 embedder。"""
    global _default_embedder
    _default_embedder = None
