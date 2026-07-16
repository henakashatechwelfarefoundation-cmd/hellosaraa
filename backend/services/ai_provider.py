"""Model-agnostic AI provider registry.

Phase 1: no AI calls executed — this module exposes provider metadata that the
frontend can consume when the user configures which self-hosted LLM to talk to.

Future phases will add concrete `generate()` / `stream()` implementations here.
Only open-source / self-hosted providers are supported by design.
"""
from models.schemas import AIProviderInfo


PROVIDERS: list[AIProviderInfo] = [
    AIProviderInfo(
        id="ollama",
        label="Ollama (local)",
        default_base_url="http://localhost:11434",
        supports_streaming=True,
        example_models=["llama3.2", "qwen2.5", "phi3.5", "mistral"],
    ),
    AIProviderInfo(
        id="llama_cpp",
        label="llama.cpp server",
        default_base_url="http://localhost:8080",
        supports_streaming=True,
        example_models=["gguf-model"],
    ),
    AIProviderInfo(
        id="vllm",
        label="vLLM",
        default_base_url="http://localhost:8000/v1",
        supports_streaming=True,
        example_models=["meta-llama/Llama-3-8B-Instruct"],
    ),
    AIProviderInfo(
        id="lm_studio",
        label="LM Studio",
        default_base_url="http://localhost:1234/v1",
        supports_streaming=True,
        example_models=["local-model"],
    ),
    AIProviderInfo(
        id="openrouter",
        label="OpenRouter (optional)",
        default_base_url="https://openrouter.ai/api/v1",
        supports_streaming=True,
        example_models=["meta-llama/llama-3-70b-instruct"],
    ),
]


def get_providers() -> list[AIProviderInfo]:
    return PROVIDERS
