# Version 2 Chat Listening Room

## Product change

The listening room now presents one continuous co-creation conversation instead of attaching every full comment to a musician figure. The stage remains visible on the left, while an unframed conversation stream on the right keeps facilitator transitions, musician replies, user messages, and streaming output in chronological order.

Musician figures only show speaking and active states. Long comments therefore cannot cover figures, the crystal, the composer, or other comments.

## Facilitator 2.1

The facilitator now receives the shared transcript and current VisualBrief. Each plan contains:

- selected musician speakers
- a transition that explains what the conversation has found and where it goes next
- one current visual goal
- one focused user question
- two or three optional sentence starters

The four conversational goals are:

1. subject and space
2. motion and composition
3. light, color, and material
4. personal meaning and constraints

These are conversational scaffolds rather than image-generation controls. The user still writes free text, and the exact user message remains the primary source for confirmed VisualBrief fields.

## Interaction behavior

- The conversation drawer starts closed. Only the first queued musician shows an animated speech bubble.
- Clicking that bubble opens the drawer and starts that musician's streamed response. No musician response starts automatically.
- The queued musician receives a restrained breathing aura around the figure and stage, in addition to the speech bubble.
- When a response completes, only the next queued musician receives a bubble. After the scheduled musicians finish, the turn returns to the user.
- A user response schedules the next guided round, but the next musician still waits for an explicit bubble click.
- On narrow screens the drawer overlays the right side of the stage and provides a visible return-to-stage action whenever another musician is waiting.
- The current facilitator question remains pinned above the composer.
- Every new facilitator question triggers one border-light sweep; the effect does not loop continuously.
- The composer receives a soft breathing highlight only while the conversation turn belongs to the user.
- Sentence starters fill the composer but do not submit automatically.
- The primary generation action stays disabled until the user contributes at least one message.
- Resonance controls live with musician messages in the conversation stream.
- The stream scrolls independently, so long messages do not move or cover the stage.
- The crystal controls a persistent page-level audio element. Playback failures are visible instead of failing silently.
- Figure wrappers no longer capture pointer events through transparent regions.

## Validation

The desktop layout was inspected at 1280 x 720 with one, two, three, and four selected musicians. Long musician messages remain inside the scrollable conversation region. No full comment bubble is rendered over a figure. The main crystal and figure controls retain distinct clickable centers in each arrangement.

Automated browser control cannot satisfy Chromium's trusted-user-gesture requirement for audible playback, so it reports `NotAllowedError` during automation. The audio element itself loads the 45-second preset successfully with ready state 4; final audible playback should be confirmed with one manual click in the user browser.
