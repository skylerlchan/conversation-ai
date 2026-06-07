# Brooks — Demo Video Storyboard + Generation Prompts

_Created 2026-06-07 · pairs with [demo-video-script.md](demo-video-script.md)_

**Approach:** generated cinematic b-roll for the concept scenes, REAL footage for the proof (Edison on camera + your live backend + the Brooks UI). One consistent grade ties it together so it reads as one story.

**Two hard rules for the generated clips:**
1. **Never let the video model render text or numbers** — it garbles them. Generate clean visuals, then add every word/dollar figure as an overlay in your editor (PowerPoint Morph, CapCut, or Premiere).
2. **Reuse the STYLE LINE verbatim in every prompt** (it's appended to each below). Same grade = same world = one story. If your model supports a seed or reference image, lock it across scenes too.

**Recommended models:** Veo 3 or Sora 2 for the cinematic scenes (best photoreal + camera control); 5–8s per clip, generate each scene separately. Color-grade your real footage (Edison, backend, UI) to match — cold teal key, deep blacks, one amber accent — so it cuts together seamlessly.

**Style line (in every generated prompt):**
> _cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text._

---

## BLOCK A — SKYLER (setup)

### Scene 1 · Intro [0:00–0:12] — REAL FOOTAGE
**VO (Skyler):** "I'm Skyler, this is Edison. We're founding engineers at WithAI Research — YC Spring 2026 — building tools for hedge funds. We work with hedge funds that trade 100s of millions of dolllars every day — we sit right next to them."
**Visual:** Whiteboard with a shit ton of mathematics behind it. We introdcue our selves as withai research. 
**Overlay:** `WithAI Research · YC S26`

### Scene 2 · The stakes [0:12–0:35] — GENERATED
**VO (Skyler):** We asked ourselves, "Where do people pay thousands of dollars for a one-hour phone call?"

We realized that buy-side funds get on thousand-dollar-an-hour calls with equity research analysts to build their models.   They need to ask the right question in real-time while udnerstanding what's going on. 
**Prompt:**
> Why did we choose buyside hedgefund calls as our moat? 
> We just need to show 1,000/hour, 1 hour, to ask all their assumptions (and a clean animation for that)

### Scene 3 · The miss [0:35–0:50] — GENERATED
**VO (Skyler):** "They hang up, and twenty minutes later: 'we never asked about China inventory.' That number was supposed to go in the model. Now it's a guess — on a position worth millions." And these models are simply huge 
**Prompt:**
> Macro shot gliding across a financial spreadsheet model on a dark monitor, endless rows of numbers in cold light, the camera drifts to a single empty cell pulsing faint red. In the soft background bokeh, a desk phone's call-ended screen fades to black. The feeling of a held breath, a mistake just made. Slow dolly, shallow focus. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Overlay:** `NOT ASKED: China inventory` (red)

---

## BLOCK B — EDISON (the demo — REAL FOOTAGE, make it look crack)

### Scene 4 · Edison + Brooks live [0:50–1:05] — REAL (Edison talking head + UI capture)
**VO (Edison, on camera):** "So we built Brooks. It's that second analyst — except it never misses. It sits silently on the call, tracks every question you planned to ask, and reads the company's own filings as they talk."
**Visual:** Edison talking head — shallow DOF, seated beside a monitor throwing teal light on him so he matches the grade. Intercut with a clean screen-capture of the **live mission console** at `localhost:3000/console` (the real Next.js UI, not the standalone HTML): the call clock ticking down, coverage ticking green, the live transcript streaming.

### Scene 5 · The money shot + the backend [1:05–1:15] — REAL (UI + terminal)
**VO (Edison):** "Management just said margins expanded — Brooks knows their last 10-Q guided them down, and flags it live. And before you run out of time, it tells you exactly what you're about to walk away without."
**Visual:** Cut tight between (a) the mission console at `localhost:3000/console` — the red **CONTRADICTS YOUR MODEL** flag firing in the Context panel + the **LEFT** call-clock ticking down + a still-OPEN pillar, and (b) **a fast screen-recording of your real backend** — transcript packets streaming in the terminal, the agent running the live call end to end, multiple panes moving fast. This is the "we actually built this" proof. Grade it teal to match.

---

## BLOCK C — EDISON (the close)

### Scene 6 · Why real-time / premium [1:15–1:30] — GENERATED
**VO (Edison):** "This only works in real time. A notetaker runs after the call — too late, the person's already gone. Brooks protects the one hour you can't get back. Thousands per call, millions per position — the easiest yes in finance."
**Prompt:**
> A single glowing live audio waveform stretches across a dark screen in electric teal, pulsing with a voice; behind it a ghosted grey duplicate drifts out of focus and dissolves into particles, like a window closing. Minimal, elegant, charged. Slow lateral drift, shallow focus. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Overlay:** `LIVE` (teal) vs `AFTER — too late` (grey)

---

## BLOCK D — SKYLER (the finale)

### Scene 7 · The bigger picture + close [1:30–1:55] — GENERATED (3-shot montage → logo)
**VO (Skyler):** "A deposition with a top M&A lawyer runs two to four thousand dollars an hour. A McKinsey partner, two thousand. AEvery high-stakes conversation has the same problem. One shot. No rewind. We're WithAI Research. Brooks — never hang up having missed the question that mattered."
**Prompt 7a (law):**
> A polished mahogany deposition room, empty leather chairs around a long table, a single microphone and a stenographer's machine catching a shaft of cold window light. Slow push toward the mic. High-stakes silence. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Prompt 7b (consulting):**
> A glass-walled strategy war-room at night, a wall of charts and a glittering city skyline beyond, a sharp consultant mid-gesture frozen in cold light. Slow orbit around the table. Elite, expensive, decisive. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Prompt 7c (medicine):**
> Over-the-shoulder shot of a doctor leaning toward a patient in a dim consult room, a medical scan glowing on a screen, a warm amber lamp against cold shadow. Slow push-in on the doctor's focused eyes. The weight of a single decision. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Prompt 7d (logo close):**
> In a void of deep black, fine particles of light slowly converge toward a single point, a subtle watchful-eye motif resolving in the negative space with one amber glint, then settling into stillness. Slow, confident, premium. Cinematic photoreal, anamorphic widescreen, shallow depth of field, moody high-contrast lighting, deep near-black background with a cold electric-teal key light and a single warning-amber accent, fine film grain, slow deliberate camera movement, premium fintech-thriller aesthetic, 24fps, no on-screen text.

**Overlays:** `$2,000–4,000 / hr` · `$2,000 / hr` · `priceless` (one per montage shot), then the montage resolves into the logo — `BROOKS` wordmark + tagline `Never hang up having missed the question that mattered.` + `WithAI Research` (add wordmark in edit)

---

## If you'd rather just use PowerPoint
Drop each generated clip in as a **full-bleed background**, put the overlay text on top, and use **Morph transitions** between slides + one cinematic music bed. That gets you 80% of the "cool animation" feel with zero editing skill — the clips do the work, PowerPoint just sequences them.

## Consistency checklist
- [ ] Same STYLE LINE in every generated prompt
- [ ] All text/numbers added as overlays, never generated
- [ ] Edison, UI, and backend footage graded teal/amber to match the b-roll
- [ ] One music bed across the whole cut
- [ ] Backend scene is fast + dense — that's the "we built this" flex
