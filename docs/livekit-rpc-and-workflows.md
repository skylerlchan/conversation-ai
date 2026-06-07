# LiveKit RPC & Workflows — what they are, and how they fit the diligence copilot

Created: 2026-06-06 17:41 PDT
Grounded in the *installed* versions in this repo: `livekit==1.1.8` (rtc/realtime SDK) and
`livekit-agents==1.5.16` (Agents SDK). Every API signature below was read from the installed
source under `agent-py/.venv/.../site-packages/livekit/` and cross-checked at runtime, not from
memory. Authoritative docs pulled via `lk docs`.

---

## TL;DR

- **RPC (remote procedure call)** is a LiveKit *transport* feature: one participant calls a
  named method on another participant **and awaits a string response** over the data channel.
  Request/response, point-to-point, with typed errors and a timeout.
  ([LiveKit · RPC](https://docs.livekit.io/transport/data/rpc/))
- **Workflows** is an *Agents SDK* concept — the umbrella for two ways to structure a
  multi-phase voice app: **handoffs** (one `Agent` permanently transfers session control to
  another) and **tasks** (an `AgentTask` takes temporary, scoped control, returns a typed
  result, and hands back). This repo's own AGENTS.md says exactly this, and it's correct.
  ([LiveKit · Workflows](https://docs.livekit.io/agents/build/workflows/))

They live in different layers and solve different problems. RPC is about *who can call whom
across the room*; workflows are about *how you decompose the agent's own reasoning*.

---

## 1. RPC — remote method calls

### What it is
Call a method on another participant by identity and `await` a string back. It's the opposite
of a broadcast: targeted at one participant, request/response, with structured errors and a
timeout. For AI agents, RPC is the mechanism for **tool forwarding** — the LLM's tool call is
fulfilled by code running in the frontend (e.g. read the browser's timezone, mutate the UI) and
the result flows back into the conversation.
([LiveKit · Forwarding to the frontend](https://docs.livekit.io/agents/logic/tools/forwarding/))

### How it works
1. The **receiver pre-registers** a named handler on its `LocalParticipant`
   (`register_rpc_method` / `registerRpcMethod`). Calling an unregistered method returns the
   built-in error `UNSUPPORTED_METHOD` (1400).
2. The **caller** invokes `perform_rpc` / `performRpc` with the destination identity, method
   name, and a string payload. It's awaitable: resolves with the response string or raises
   `RpcError`.
3. The handler runs (sync or async), returns a string (or raises `RpcError`), and the framework
   routes the response back, correlated by `request_id` (matches on both ends — handy for logs).

Direction is symmetric: **agent → frontend** (the tool-forwarding case) *or* **frontend → agent**
(the frontend calls a method the agent registered). Inside the agent, your own participant is
`get_job_context().room.local_participant`; the frontend's identity is in `room.remote_participants`.
Hidden participants cannot call RPC.

### Python API (verified in `livekit==1.1.8`, `rtc/participant.py` + `rtc/rpc.py`)

| Symbol | Signature |
|---|---|
| `LocalParticipant.perform_rpc` | `async def perform_rpc(self, *, destination_identity: str, method: str, payload: str, response_timeout: float | None = None) -> str` |
| `LocalParticipant.register_rpc_method` | `register_rpc_method(method_name, handler=None)` — works as a **decorator** or a plain call. Handler: `(RpcInvocationData) -> Optional[str]`, sync or async |
| `LocalParticipant.unregister_rpc_method` | `unregister_rpc_method(method: str) -> None` |
| `RpcInvocationData` | `@dataclass` → `request_id: str`, `caller_identity: str`, `payload: str`, `response_timeout: float` (snake_case in Python; **camelCase in JS**) |
| `RpcError` | `RpcError(code: int | ErrorCode, message: str, data: str | None = None)`; `.code`, `.message`, `.data` |
| `RpcError.ErrorCode` | `IntEnum`: 1400 `UNSUPPORTED_METHOD`, 1401 `RECIPIENT_NOT_FOUND`, 1402 `REQUEST_PAYLOAD_TOO_LARGE`, 1403 `UNSUPPORTED_SERVER`, 1404 `UNSUPPORTED_VERSION`, 1500 `APPLICATION_ERROR`, 1501 `CONNECTION_TIMEOUT`, 1502 `RESPONSE_TIMEOUT`, 1503 `RECIPIENT_DISCONNECTED`, 1504 `RESPONSE_PAYLOAD_TOO_LARGE`, 1505 `SEND_FAILED` |

Frontend (`livekit-client`): `localParticipant.registerRpcMethod(method, handler)` and
`localParticipant.performRpc({ destinationIdentity, method, payload, responseTimeout })`. Note
the JS surface differs: `performRpc` takes a single **options object** and `responseTimeout` is
in **milliseconds**, whereas Python uses keyword args and **seconds**.

### Limits & error model
- **Payload:** 15 KiB (UTF-8) max for request *and* response (and `RpcError.data`); method names
  ≤ 64 bytes. ⚠️ In `livekit 1.1.8` these numbers are **not** Python constants — there's no
  client-side `ValueError`; the cap is enforced native/server-side and surfaces as
  `REQUEST_PAYLOAD_TOO_LARGE` (1402) / `RESPONSE_PAYLOAD_TOO_LARGE` (1504).
- **Timeout:** default 10 s, configurable per call. Also not a Python constant — when you omit
  `response_timeout`, Python sends nothing and the native layer applies the 10 s default. On the
  handler side, **async** handlers are wrapped in `asyncio.wait_for(...)` → `RESPONSE_TIMEOUT`
  (1502); **sync** handlers are *not* wrapped, so a blocking sync handler isn't timeout-enforced.
- **Custom errors:** raise `RpcError(code, message, data?)` with a code **outside** the reserved
  1001–1999 range. Any non-`RpcError` exception in a handler becomes `APPLICATION_ERROR` (1500)
  and the original message is *not* leaked. In an agent tool, catch and re-raise as
  `livekit.agents.ToolError` so the LLM sees a clean failure.

### Minimal examples

Agent calls the frontend (tool forwarding):
```python
from livekit.agents import function_tool, get_job_context, RunContext, ToolError
from livekit import rtc
import json

@function_tool()
async def get_user_timezone(context: RunContext) -> str:
    """Get the user's IANA timezone from their browser."""
    room = get_job_context().room
    frontend = next(iter(room.remote_participants))          # the one browser participant
    try:
        return await room.local_participant.perform_rpc(     # kwargs only; seconds
            destination_identity=frontend, method="getUserTimezone",
            payload=json.dumps({}), response_timeout=5.0,
        )
    except rtc.RpcError as e:
        raise ToolError(f"Frontend RPC failed ({e.code}): {e.message}")
```

Agent registers a method the frontend can call (reverse direction):
```python
@lp.register_rpc_method("ask_followup")     # lp = ctx.room.local_participant
async def _ask_followup(data: rtc.RpcInvocationData) -> str:
    payload = json.loads(data.payload)      # snake_case fields: request_id, caller_identity, ...
    # ...mutate call state, return an ack the UI can trust...
    return json.dumps({"ok": True})
```

Frontend handler (`livekit-client`, e.g. agent-starter-react):
```ts
import { RpcError, RpcInvocationData } from 'livekit-client';
localParticipant.registerRpcMethod('getUserTimezone', async (d: RpcInvocationData) => {
  // camelCase fields: d.callerIdentity, d.payload, d.requestId, d.responseTimeout
  return JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
});
```

### RPC vs the starter's `publish_data` (data packets)
The starter pushes context to the UI with `local_participant.publish_data(payload=encoded,
reliable=True)` ([agent.py:157](agent-py/src/agent.py#L157)). That's **fire-and-forget**: no
return value, no ack, no per-recipient error, broadcasts to *all* participants by default, and
the frontend just listens for a `DataReceived` event and pattern-matches the JSON shape (a
hand-rolled, untyped contract). They're **complementary**:

| | `publish_data` (data packet) | RPC |
|---|---|---|
| Shape | Fire-and-forget | Request/response, awaitable |
| Targets | Broadcast (all, or a list) | Exactly one participant by identity |
| Returns | Nothing | A string (≤15 KiB) |
| Errors | None surfaced | Typed `RpcError` + 10 s timeout |
| Best for | One-way display updates to a passive panel | Calls that need an acknowledged result |

---

## 2. Workflows — handoffs + tasks

### What it is
"Workflows" is how the Agents SDK lets you build a multi-phase voice app out of two composable
pieces instead of one giant multi-phase prompt:
- **Handoffs** — one `Agent` permanently transfers session control to another `Agent`.
- **Tasks** — an `AgentTask` takes temporary, scoped control, runs its own LLM loop to achieve
  one outcome, returns a typed result, then hands control back.

The point is **latency and reliability**: voice agents are latency-sensitive, so each LLM
request should carry a short, phase-specific prompt and a small, relevant tool list — not a
bloated instruction block that covers every phase. ([LiveKit · Workflows](https://docs.livekit.io/agents/build/workflows/))

### Mechanism A — Handoffs (Agent → Agent)
Two paths, both confirmed in `1.5.16`:
- **Model-driven:** a `@function_tool` returns an `Agent` (or a `(Agent, message)` tuple — the
  non-Agent element becomes the tool's textual reply). The SDK detects the returned `Agent`
  (`generation.py`), sets `_handoff_required`, and calls `session.update_agent(new_agent)`.
- **Code-driven:** call `session.update_agent(NewAgent())` directly for a deterministic
  (non-LLM) switch.

Context is **not** carried automatically — pass `chat_ctx=self.chat_ctx` into the new agent's
constructor to preserve history (works for any `Agent` subclass), or start fresh. The new agent's
`on_enter()` runs when it becomes active. ([LiveKit · Agents & handoffs](https://docs.livekit.io/agents/build/workflows/))

```python
class IntakeAgent(Agent):
    @function_tool()
    async def transfer_to_billing(self, context: RunContext):
        """Transfer to a billing specialist."""
        return BillingAgent(chat_ctx=self.chat_ctx), "Transferring to billing"
# or deterministically: session.update_agent(BillingAgent(chat_ctx=session.history))
```

### Mechanism B — Tasks (`AgentTask`)
`AgentTask[ResultT]` is a short-lived, scoped sub-agent. Subclass it with its own instructions +
tools; from a `@function_tool` call `self.complete(result)` to finish. You **run a task by
awaiting it** (`result = await MyTask(...)`) — there is **no public `.run()`** in Python 1.5.16
(that's the Node.js form). Hard constraints, enforced in source:
- A task may only be awaited from an `Agent`'s `on_enter`, `on_exit`, or inside a
  `@function_tool` body — anywhere else raises `RuntimeError`.
- Not re-entrant — await once.
- Starts with an empty `chat_ctx`; pass `chat_ctx=self.chat_ctx.copy(exclude_instructions=True)`
  to give it history without the parent's system prompt.

```python
class CollectContact(AgentTask[Contact]):
    def __init__(self, chat_ctx=None):
        super().__init__(instructions="Collect the caller's name and email.", chat_ctx=chat_ctx)
    @function_tool()
    async def record(self, name: str, email: str):
        """Record the collected contact details."""
        self.complete(Contact(name=name, email=email))   # resolves the task

class Reception(Agent):
    @function_tool()
    async def start_intake(self):
        """Collect the caller's contact info."""
        contact = await CollectContact(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))
        return f"Recorded {contact.name}."               # control returns here
```

### Key API (verified in `livekit-agents==1.5.16`, `voice/agent.py` + `voice/agent_session.py`)

| Symbol | Note |
|---|---|
| `Agent(*, instructions, id=None, chat_ctx=NOT_GIVEN, tools=None, stt/vad/llm/tts/...)` | The long-lived building block; subclass per phase/persona |
| `Agent.on_enter / on_exit` | Async lifecycle hooks; two of the three valid `AgentTask` await-sites |
| `Agent.update_instructions / update_tools / update_chat_ctx` | **In-place mutation, no handoff** — lower-latency than splitting agents when only the prompt/tools change |
| `AgentTask(Agent, Generic[ResultT])` | Scoped sub-agent; `await` it to get the typed result. **No `id` kwarg** (unlike `Agent`) |
| `AgentTask.complete(result \| Exception)` | Resolves the task; also `.done()`, `.cancel()` |
| `AgentSession.update_agent(agent)` | The actual handoff primitive |
| `AgentHandoff`, `AgentHandoffEvent`, `current_agent` | Handoff bookkeeping |
| `beta.workflows.TaskGroup` + prebuilt tasks | ⚠️ **Beta, not top-level** — `from livekit.agents.beta.workflows import TaskGroup`. Ordered multi-step with backtracking. Ships `GetEmailTask`, `GetNameTask`, `GetAddressTask`, `WarmTransferTask`, etc. |

### When to split (don't do it preemptively)
A single agent + a small tool set is the recommended default. The docs list four signals to
escalate, and the right escalation ladder:

> single agent → `update_instructions`/`update_tools` in place → supervisor + `AgentTask`
> → agent handoff / `TaskGroup`

1. **Instruction bloat** — the prompt is so big the model underperforms → split.
2. **Conflicting tool access** — phases need different tools/permissions → separate agents.
3. **Multi-turn validated collection** — a step needs its own LLM loop → `AgentTask`.
4. **Backtracking** — users must revisit earlier steps → `TaskGroup` (beta).

---

## 3. How both map to the diligence copilot

(See [diligence-call-copilot-plan.md](docs/diligence-call-copilot-plan.md). The copilot is a
**silent listener**: it never speaks on the call, runs a structured per-turn coverage engine, and
surfaces cards to the analyst console.)

### RPC — add a frontend→agent control channel; keep `publish_data` for cards
- **Keep `publish_data` for the four cards** (coverage / follow-up / grounding / thesis delta).
  They're one-way, broadcast, no-response-needed UI notifications — the textbook `publish_data`
  case, already wired through `useMossContextEvents.ts`. Re-plumbing them through RPC buys nothing
  and adds a round-trip + timeout failure surface.
- **Add RPC for control verbs the console fires *into* the agent**, where the analyst needs an
  acknowledged, state-changing result a broadcast can't give:
  - `ask_followup` — analyst clicked "ask this follow-up" → agent marks it *asked* so the next
    coverage pass looks for the *close* (partial→answered) instead of re-emitting the prompt.
    **This one directly serves the hero demo beat** (click follow-up → it goes green) and closes
    the desync risk.
  - `mark_answered` / `dismiss_card` — analyst overrides the state machine; agent mutates call
    state and returns the new state.
  - `reground` — analyst re-queries Moss for a `question_id`; agent returns matches synchronously.
- **Agent→frontend tool-forwarding is mostly *not* worth it here** — the silent agent already owns
  the corpus (Moss), the transcript (STT), and call state, so the browser holds little unique
  data. Only reach for it to read console-only state (e.g. pull an analyst-typed note into the
  thesis-delta step).

### Workflows — the coverage engine is one `AgentTask`, not a handoff
- The coverage engine (one schema-constrained, low-temperature LLM call per researcher turn
  returning `{addresses_question_id, coverage, extracted_facts, contradiction, followup}`) is
  structurally a **scoped `AgentTask`** owned by the single silent-listener agent (the supervisor
  pattern). It gives you the **typed return the whole demo rides on**, keeps the per-turn prompt
  small (the plan's own latency mitigation), and is **testable** per the repo's TDD rule.
- **Handoffs and `TaskGroup` are out of scope** — no multi-phase conversation, no persona switch,
  no backtracking, and the agent never speaks. The academic-vs-equity "swap the corpus" is a
  config/index change at session start, not a runtime handoff. Adding them would be the
  feature-stuffing the plan explicitly warns against.
- **Honest 24h cut:** if wiring the `AgentTask` abstraction eats hours, a plain JSON-schema-
  constrained LLM call inside `on_user_turn_completed` gives the identical typed result and the
  same demo. The task construct is the idiomatic, eval-friendly home — not a hard requirement.

**Net:** ship `ask_followup` over RPC + the coverage engine as a scoped task (or a structured
LLM call); leave multi-agent handoffs and broadcast-for-cards alone.

---

## Sources
- RPC: [docs.livekit.io/transport/data/rpc](https://docs.livekit.io/transport/data/rpc/) ·
  [docs.livekit.io/agents/logic/tools/forwarding](https://docs.livekit.io/agents/logic/tools/forwarding/)
- Workflows: [docs.livekit.io/agents/build/workflows](https://docs.livekit.io/agents/build/workflows/)
- Installed source: `agent-py/.venv/.../livekit/rtc/{participant,rpc}.py` (1.1.8),
  `livekit/agents/voice/{agent,agent_session,agent_activity,generation}.py` and
  `livekit/agents/beta/workflows/task_group.py` (1.5.16).
