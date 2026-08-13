# Prompt plan — collapse the provider mess onto the processor pattern

**For a fresh session.** Paste the "Prompt" section below as the opening message.
Everything above it is context for whoever is deciding whether to run it.

---

## Why this exists

Ken, 260813: *"less is more — I got carried away with the providers."* The AI
provider code has grown three parallel stacks that don't know about each other,
and every recent provider bug was a symptom of that split rather than of any one
provider being wrong.

**This is a refactor of the code path LEO cannot function without.** Do not start
it while nobody is watching production. It wants a day of soak before it matters.

## The ground truth (measured 260813 — re-verify, don't trust)

| File | Lines | Role |
|---|---:|---|
| `src/utilities/ai-gateway.ts` | 1238 | chat/tool routing, tier maps, provider order |
| `src/utilities/imageGeneration.ts` | 1244 | **its own** provider chain for image gen |
| `src/utilities/mediaAnalysis.ts` | 1023 | **its own** chain for vision (Anthropic + Gemini) |
| `src/utilities/providerHealth.ts` | 103 | circuit breaker — the one piece already shared |
| `src/utilities/geminiVision.ts` | 98 | Gemini vision leaf |

Two kinds of duplication:

1. **Horizontal.** `createOpenAICompatible({ name, baseURL, apiKey })` appears
   **12 times**. Groq, OpenRouter, NVIDIA, OpenAI and Ollama differ ONLY by name,
   base URL and which env var holds the key. Five hand-written resolvers that are
   one function in five costumes. Google (native SDK) and Anthropic (vision-only,
   separate SDK) are the only genuinely different ones.
2. **Vertical — the expensive one.** Three stacks, three fallback orders, three
   ideas of what is configured. That is *why* the 260813 bugs happened:
   - image generation didn't know the gateway key was revoked, so it fell to paid
     OpenRouter silently;
   - vision reached Anthropic **by name** and never consulted `AI_PROVIDER_ORDER`,
     so a key with no credit was called on every image for weeks;
   - `autoAnalyzeUpload` gated the whole analysis pipeline on `ANTHROPIC_API_KEY`,
     so a Gemini-only node analyzed nothing at all.

Each was patched individually. The patches are the evidence for the refactor.

## The pattern to land on

Ken's framing, 260813: *processors loaded from configuration; a processor object
carrying the objects and variables the processor needs internally, plus step
information.*

Half of this already exists and should NOT be reinvented:

- **`src/utilities/executionTrace.ts`** — `ExecutionTrace` is the context object
  with the step recording. Read its docblock first; it explicitly describes
  itself as "the processing-unit half of the processor-pipeline pattern".
- **`providerHealth.ts`** — `isDown` / `markDown` / `recordSuccess` is the
  circuit breaker all three stacks already share. Keep it. Do not rewrite it.
- **`isProviderEnabled(name)`** in `ai-gateway.ts` (added 260813) — makes
  `AI_PROVIDER_ORDER` the single on/off list, including for providers the router
  doesn't route (`anthropic`). This is the seed of the config-driven registry;
  the refactor should generalise it, not work around it.

The missing half is the **registry**: providers as configuration rows rather than
functions.

```ts
// sketch, not a spec — the shape to aim at
const OPENAI_COMPATIBLE = {
  groq:       { baseURL: 'https://api.groq.com/openai/v1',        envKey: 'GROQ_API_KEY' },
  nvidia:     { baseURL: 'https://integrate.api.nvidia.com/v1',   envKey: 'NVIDIA_API_KEY' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1',          envKey: 'OPENROUTER_API_KEY' },
  cerebras:   { baseURL: 'https://api.cerebras.ai/v1',            envKey: 'CEREBRAS_API_KEY' },
  ollama:     { baseURLEnv: 'OLLAMA_BASE_URL',                    envKey: 'OLLAMA_API_KEY' },
}
```

Adding a provider becomes a row. All three stacks walk the same registry in the
same `AI_PROVIDER_ORDER`, through one fallback walker that records each attempt
as a trace step. Expected net: **‑400 to ‑600 lines**. If the diff is positive,
something has gone wrong — stop and say so.

## Explicitly NOT the answer

- **A new library.** The Vercel AI SDK + `@ai-sdk/openai-compatible` is already
  the right abstraction and is already installed. This is a deletion, not an
  adoption. Dependency policy is pinned to Payload's template set anyway.
- **LiteLLM** — Python, wrong runtime.
- **Vercel AI Gateway as the universal router** — already wired, key revoked, and
  it is a paid intermediary. Points against the standing goal of zero recurring
  cost until paying customers exist.
- **OpenRouter as universal router** — same shape, also paid.

---

## Prompt

> We are consolidating the AI provider code in `C:\Dev\angels-os` onto the
> processor pattern. Read `docs/PROMPT_PLAN_PROVIDER_PROCESSORS.md` first — it has
> the measurements, the prior art, and the things that are explicitly not the
> answer. Re-verify its numbers rather than trusting them; it was written 260813.
>
> **Goal.** One provider registry loaded from configuration, one fallback walker,
> one `AI_PROVIDER_ORDER`. `ai-gateway.ts`, `imageGeneration.ts` and
> `mediaAnalysis.ts` stop having three private provider chains and share one.
> Each attempt is a step on an `ExecutionTrace` so a failed chain reads
> `groq ✗ (429) → nvidia ✗ (down) → google ✓` instead of an opaque catch.
>
> **Reuse, don't rebuild:** `ExecutionTrace` (the context/step object),
> `providerHealth` (the circuit breaker), `isProviderEnabled` (the on/off list).
>
> **Order of work.** Land it in reviewable slices, each green and committed on its
> own — not one large diff:
> 1. The registry + walker, with the existing resolvers delegating to it. No
>    behaviour change. This slice should be provably a no-op.
> 2. `imageGeneration.ts` onto the walker. Fix the standing cost leak while you
>    are there: the image path has no free lane, so it reaches paid OpenRouter.
>    Google direct (`GOOGLE_AI_API_KEY`, already held) or a `:free` OpenRouter
>    model is the fix.
> 3. `mediaAnalysis.ts` vision onto the walker, retiring the bespoke
>    `isProviderEnabled('anthropic')` special case in favour of the general path.
> 4. Delete what is now dead. Report the net line count.
>
> **Constraints.**
> - Test gate is `pnpm test:unit` ONLY (bare `vitest run` boots Payload and
>   cascades into timeouts). It must be green at each slice.
> - Every behaviour you preserve on purpose needs a test that would fail without
>   it. Particularly: the free lanes are ordered ahead of paid OpenRouter, an
>   unset `AI_PROVIDER_ORDER` allows everything, and a provider marked down is
>   skipped rather than retried.
> - `*.spacesangels.com` is served by **Railway**, not the local Docker stack —
>   the local `angels` DB is a stale copy. Deploy is `railway up -s Core`; it does
>   NOT auto-deploy from GitHub. Live logs: `railway logs -d`.
> - Live provider state as of 260813: `AI_PROVIDER_ORDER=google,groq,nvidia,ollama,openrouter`.
>   Google is funded and primary. Groq + NVIDIA free tiers are verified working.
>   OpenRouter is paid, last, capped at $20. The Vercel gateway key is REVOKED.
>   Anthropic has no credit. Ollama Cloud is configured but unverified.
> - Do not start slice 2 or later if production is unattended.
>
> Ask before widening scope. The point is less code, not more capability.

---

## Open questions for Ken (ask, don't assume)

1. **Drop `gateway` entirely?** Its key is revoked and it is a paid intermediary.
   Keeping it is a dead branch in every walker.
2. **Add Cerebras?** 1M tokens/day free, but an 8,192-token context cap on the
   free tier — too small for LEO's tool schema, so it is a chitchat/summarise
   lane only, not a tool-use lane. A row in the registry either way.
3. **How many providers does he actually want?** "Less is more" suggests pruning
   to google + groq + nvidia + openrouter, with ollama when configured. Confirm
   before deleting resolvers.
