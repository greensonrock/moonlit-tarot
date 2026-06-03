# Tarot Product Iteration Plan

## Product Thesis

Do not make the product a more complete AI tarot report. Make it a shorter, sharper tarot experience where the user has one real moment of recognition.

The product should feel like:

- A pause before explanation.
- A card that makes the user stop.
- A reader who has judgment, not a customer-service voice.
- A record of repeated patterns, not saved essays.

## Key Problems

1. The full flow is too long for repeat use.
2. Resonance choice needs to feel like the center of the reading, not a form step.
3. The report still feels like an AI essay when all content is visible at once.
4. History records need to reveal repeated user patterns.
5. Strong-emotion states need a slower, safer path.

## Execution Plan

### 1. Dual Entry

- Add explicit home entries: quick one-card and deep three-card.
- Quick path skips theme and mood, asks one question, draws one card.
- Deep path skips mood and goes from theme to question to spread.

### 2. Resonance As The Main Moment

- After all cards are revealed, make the selected resonance card visually dominant.
- Dim non-selected cards after resonance selection.
- Make the confirmation copy explain that the choice changes the reading focus.

### 3. Short Report By Default

- Default report should show a short "reader note": resonance card, core reading, sharp question, light action, echo.
- Full layered reading and per-card details should be collapsible.

### 4. History As Pattern

- Add a history insight panel.
- Summarize repeated themes, repeated resonance cards, and repeated feedback.

### 5. Safer Emotion Handling

- Detect strong emotional wording in the question.
- In strong-emotion cases, show a slower warning and encourage a one-card path before deep reading.

## Acceptance Criteria

- A returning user can choose a quick path without stepping through theme/mood/spread.
- Resonance choice visibly changes the card layout and the report.
- The first report screen is short enough to read without scrolling heavily.
- History shows at least one pattern insight when saved records exist.
- The product remains tarot-like: symbolic, participatory, non-deterministic, and not a decision machine.

## Execution Reflection

Implemented in this iteration:

- Home now has two explicit entries: quick one-card and deep three-card.
- Deep path skips mood selection and goes theme -> question -> spread.
- Resonance selection dims non-selected cards and lifts the selected card.
- Report defaults to a short reader note instead of a full AI essay.
- Full layered reading and per-card details are inside a collapsible section.
- History now includes repeated-pattern insights.
- Strong-emotion wording gets a slower caution before the user proceeds.

Product fit after execution:

- Game planning: better feedback loops; user choices now leave visible traces in the card table, report, and history.
- Tarot practice: closer to a reader-led session because the first screen is now a focused interpretation, not an exhaustive explanation.
- Art and interaction: the selected card gets stage priority, while the report becomes more like a short reading note than a dashboard.

Remaining risk:

- The full reading still exists below the fold and can become verbose when expanded.
- The reader voice is sharper, but still partly constrained by generated AI copy.
- History insights become meaningful only after repeated saved readings.
