"""
backend/app/utils/llm_provider.py

Provider-agnostic LLM integration for question AI review.

Current provider : OpenAI GPT-4o-mini
Switch providers : set LLM_PROVIDER=anthropic (or other) in Railway env vars.
                   Implement the corresponding subclass and add it to get_llm_provider().

Future expansion : add review_with_tutor() to LLMProvider for the live AI tutor feature
                   without touching any existing call sites.

Usage (in admin.py):
    from ..utils.llm_provider import get_llm_provider
    provider = get_llm_provider()          # raises RuntimeError if misconfigured
    result   = provider.review_question(   # blocking; call from ThreadPoolExecutor
        question_id=q.id, exam=q.exam, section=q.section,
        question_text=q.question_text,
        option_a=q.option_a, option_b=q.option_b,
        option_c=q.option_c, option_d=q.option_d,
    )
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class QuestionReviewResult:
    """
    Returned by every provider's review_question() call.

    Fields:
        question_id      — mirrors the input so callers can correlate results
                           when processing batches.
        predicted_answer — 'a'|'b'|'c'|'d'  or None on failure.
                           NOT written to correct_answer until admin approves.
        confidence       — 0.0–1.0, LLM self-reported. None on failure.
        proposed_hint    — 1-2 sentence hint for students who answered wrong.
                           Copied to hint column only on admin approval.
                           Must NOT reveal or restate the correct answer.
        review_note      — 1-sentence internal justification for admin verification.
                           NEVER exposed to students under any code path.
        error            — Non-None string if the LLM call failed for any reason.
                           Caller should mark question review_status='unreviewed' on error.
    """
    question_id:      int
    predicted_answer: Optional[str]
    confidence:       Optional[float]
    proposed_hint:    Optional[str]
    review_note:      Optional[str]
    error:            Optional[str]


# ── Abstract base ─────────────────────────────────────────────────────────────

class LLMProvider(ABC):
    """
    Base class for all LLM providers.

    Contract:
    - review_question() is synchronous and blocking.
    - It must NEVER raise — all errors go into QuestionReviewResult.error.
    - It must NEVER write to the database.
    - It is safe to call from a ThreadPoolExecutor (I/O-bound, GIL released
      during network calls).

    Future methods to add here (without breaking existing call sites):
    - tutor_explain(question_id, ...) → TutorResult   # live AI tutor
    - generate_question(...) → GeneratedQuestion       # AI question authoring
    """

    @abstractmethod
    def review_question(
        self,
        question_id:   int,
        exam:          str,
        section:       str,
        question_text: str,
        option_a:      str,
        option_b:      str,
        option_c:      str,
        option_d:      str,
    ) -> QuestionReviewResult:
        ...


# ── OpenAI provider ───────────────────────────────────────────────────────────

class OpenAIProvider(LLMProvider):
    """
    GPT-4o-mini provider.

    Why GPT-4o-mini:
    - Fast (< 2s per question at low load)
    - Cheap  (~$0.00015 / 1K input tokens)
    - JSON mode available — no regex parsing needed
    - temperature=0 → deterministic output

    Environment variables required:
      OPENAI_API_KEY  — standard OpenAI key
    """

    MODEL = "gpt-4o-mini"

    _SYSTEM_PROMPT = """\
You are an expert exam reviewer for Saudi national standardised tests: Qudurat \
(Math and Verbal reasoning) and Tahsili (Math, Biology, Chemistry, Physics).

Given a multiple-choice question you must produce three things:

1. predicted_answer — the single correct option letter (a, b, c, or d), \
chosen purely on academic correctness.

2. proposed_hint — 1 to 2 sentences maximum. Written for a student who just \
answered incorrectly. Must activate thinking and guide reasoning toward the \
correct concept WITHOUT revealing or restating the answer. \
Supports LaTeX math notation using $...$ syntax.

3. review_note — exactly 1 sentence. Written for an internal admin reviewer \
who needs to verify your answer quickly. Explain concisely WHY the predicted \
answer is correct. This note is NEVER shown to students.

4. confidence — a float between 0.0 and 1.0 representing how certain you are.

Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation \
outside the JSON.

{
  "predicted_answer": "a" | "b" | "c" | "d",
  "confidence": <float>,
  "proposed_hint": "<hint text>",
  "review_note": "<internal note>"
}"""

    def __init__(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY environment variable is not set. "
                "Add it to Railway environment variables."
            )
        try:
            from openai import OpenAI  # noqa: PLC0415
            self._client = OpenAI(api_key=api_key)
        except ImportError as exc:
            raise RuntimeError(
                "openai package is not installed. "
                "Add 'openai' to requirements.txt and redeploy."
            ) from exc

    def review_question(
        self,
        question_id:   int,
        exam:          str,
        section:       str,
        question_text: str,
        option_a:      str,
        option_b:      str,
        option_c:      str,
        option_d:      str,
    ) -> QuestionReviewResult:
        user_prompt = (
            f"Exam: {exam} | Section: {section}\n\n"
            f"Question:\n{question_text}\n\n"
            f"A) {option_a}\n"
            f"B) {option_b}\n"
            f"C) {option_c}\n"
            f"D) {option_d}"
        )

        try:
            response = self._client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {"role": "system", "content": self._SYSTEM_PROMPT},
                    {"role": "user",   "content": user_prompt},
                ],
                temperature=0.0,              # deterministic
                max_tokens=400,
                response_format={"type": "json_object"},
            )

            raw    = response.choices[0].message.content or ""
            parsed = json.loads(raw)

        except json.JSONDecodeError as exc:
            logger.error("LLM JSON parse error for question %d: %s", question_id, exc)
            return QuestionReviewResult(
                question_id=question_id,
                predicted_answer=None, confidence=None,
                proposed_hint=None, review_note=None,
                error=f"JSON parse error: {exc}",
            )
        except Exception as exc:  # network errors, rate limits, etc.
            logger.error("LLM call failed for question %d: %s", question_id, exc)
            return QuestionReviewResult(
                question_id=question_id,
                predicted_answer=None, confidence=None,
                proposed_hint=None, review_note=None,
                error=str(exc),
            )

        # Validate predicted_answer
        predicted = (parsed.get("predicted_answer") or "").strip().lower()
        if predicted not in {"a", "b", "c", "d"}:
            return QuestionReviewResult(
                question_id=question_id,
                predicted_answer=None, confidence=None,
                proposed_hint=None, review_note=None,
                error=f"LLM returned invalid predicted_answer: {predicted!r}",
            )

        # Clamp confidence to [0.0, 1.0]
        try:
            confidence = float(parsed.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))
        except (TypeError, ValueError):
            confidence = 0.5

        proposed_hint = (parsed.get("proposed_hint") or "").strip() or None
        review_note   = (parsed.get("review_note")   or "").strip() or None

        return QuestionReviewResult(
            question_id=question_id,
            predicted_answer=predicted,
            confidence=confidence,
            proposed_hint=proposed_hint,
            review_note=review_note,
            error=None,
        )


# ── Anthropic provider stub ───────────────────────────────────────────────────
# Uncomment and implement when switching providers.
#
# class AnthropicProvider(LLMProvider):
#     MODEL = "claude-sonnet-4-6"
#
#     def __init__(self) -> None:
#         api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
#         if not api_key:
#             raise RuntimeError("ANTHROPIC_API_KEY not set.")
#         try:
#             import anthropic
#             self._client = anthropic.Anthropic(api_key=api_key)
#         except ImportError as exc:
#             raise RuntimeError("anthropic package not installed.") from exc
#
#     def review_question(self, question_id, exam, section,
#                         question_text, option_a, option_b,
#                         option_c, option_d) -> QuestionReviewResult:
#         # Implement using self._client.messages.create(...)
#         ...


# ── Factory ───────────────────────────────────────────────────────────────────

def get_llm_provider() -> LLMProvider:
    """
    Returns the configured LLM provider instance.

    Configuration:
      Set LLM_PROVIDER env var in Railway to switch providers.
      Defaults to 'openai' if not set.

    Valid values:
      'openai'     → OpenAIProvider (GPT-4o-mini)
      'anthropic'  → AnthropicProvider (when implemented)

    Raises RuntimeError if the provider is misconfigured (missing API key,
    missing package). Caller is responsible for surfacing a 501 response.
    """
    provider_name = os.environ.get("LLM_PROVIDER", "openai").lower().strip()

    if provider_name == "openai":
        return OpenAIProvider()

    # elif provider_name == "anthropic":
    #     return AnthropicProvider()

    raise RuntimeError(
        f"Unknown LLM_PROVIDER: {provider_name!r}. "
        "Valid values: openai"
    )
