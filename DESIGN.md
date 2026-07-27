# Design System

## Direction

Open Bistimulation should feel like a **calm signal instrument**: precise, quiet, trustworthy, and purpose-built for bilateral cue control. It avoids both generic SaaS-dashboard conventions and simulated clinical hardware.

The system applies the specificity, hierarchy, and restraint encouraged by [Impeccable](https://impeccable.style/), without copying its visual identity. Every element must earn its space by clarifying status, action, sequence, or safety.

Design qualities:

- Operational, not decorative.
- Calm, not sterile or pseudo-clinical.
- Direct, not promotional once a session begins.
- Dense enough for a controller, spacious enough for touch.
- Visibly bilateral: left/right relationships are a recurring structural motif.

## Interface Modes and Hierarchy

### Landing: persuade, explain, disclose

1. Product name and one clear description.
2. A single session-creation action.
3. A bilateral signal graphic that explains the product rather than decorating it.
4. Modality summary and safety limits.
5. Legal navigation.

The landing page is a full composition, not a large card floating on a background.

### Therapist: operate

1. Session title, connection state, and end-session action.
2. Command deck: elapsed state, transport controls, and round duration.
3. Participant invitation.
4. Visual, auditory, and tactile configuration.
5. Preview and device detail.

Start, pause, resume, and stop remain more prominent than configuration. Ending a session is destructive, separated from round controls, and requires an explicit confirmation.

### Participant: experience

1. The stimulus stage owns the viewport.
2. A single command dock exposes connection, audio enablement, fullscreen, language where space permits, and local stop/resume.
3. Tactile setup appears as a secondary sheet only when tactile output is enabled.
4. Audio permission is requested in a focused dialog before audio-dependent fullscreen use.

Participant controls must remain reachable without competing visually with the stimulus.

### Legal: read

Legal pages use a conventional narrow reading column, clear headings, and links. They do not borrow dashboard panels or marketing treatments.

## Foundations

### Color

Use the CSS tokens in `src/styles/globals.css` as the source of truth:

| Role | Token | Value |
| --- | --- | --- |
| App canvas | `--canvas` | `#edf1ef` |
| Primary surface | `--surface` | `#ffffff` |
| Subtle surface | `--surface-subtle` | `#f5f7f6` |
| Primary ink | `--ink` | `#182321` |
| Secondary text | `--muted` | `#5d6a67` |
| Borders | `--line`, `--line-strong` | `#c8d0cd`, `#8c9995` |
| Primary action | `--action` | `#075f5a` |
| Bilateral signal accent | `--signal` | `#d45c3d` |
| Destructive action | `--danger` | `#a6382d` |
| Success | `--success` | `#276749` |
| Keyboard focus | `--focus` | `#177a74` |

Color communicates category, but never carries status alone. Pair it with text, shape, position, or a status indicator. Stimulus colors are user-configurable and are separate from interface semantics.

### Type

- Body and controls: Aptos or Segoe UI system fallbacks.
- Display headings, numeric readouts, and the wordmark: Arial Narrow or Aptos Display fallbacks.
- Technical labels and compact signal readouts: Cascadia Mono or Consolas.
- Use sentence case for interface copy. Reserve uppercase and tracking for very short instrument labels.
- Favor short, literal labels. Do not invent wellness language or clinical authority.

### Geometry and spacing

- Use a `4px` to `6px` radius for controls and panels.
- Prefer borders, alignment, and whitespace over elevation.
- Use a spacing rhythm derived from `4, 8, 12, 16, 20, 24, 32, 48, 64px`.
- Keep the principal content width at or below `1380px`.
- Use larger gaps to separate task groups and smaller gaps within a control group.
- Shadows are reserved for a temporary layer that must sit above the interface, such as the audio-permission dialog.

### Motion

- Interface transitions should be brief and functional; the switch thumb uses `140ms`.
- Honor `prefers-reduced-motion` for interface animation.
- Do not automatically disable the bilateral stimulus motion: it is the user-requested output, not decorative UI animation. Output remains governed by the explicit session and local-stop controls.

## Components and States

- Buttons use three clear levels: primary action, bordered secondary action, and destructive action.
- Selected presets and stimulus options use both a visible selected treatment and `aria-pressed`.
- On/off settings use named switches with `role="switch"` and `aria-checked`.
- Panels group one operational concern. Nested panels should be exceptional.
- Connection badges use a dot plus readable state text and expose status semantics.
- Notices distinguish informational, success, warning, and error states with text and border treatments.
- Loading, empty, disconnected, permission-denied, expired, ended, busy, stopping, and local-stop states must be designed explicitly.
- Busy controls prevent duplicate commands without hiding the current session state.
- Destructive confirmation stays inline with the action context or uses a true modal dialog; it never relies on a transient toast.
- Copy and clipboard actions report failures in the same region.
- Audio and hardware permission requests explain why a browser prompt is needed before triggering it.

## Accessibility

- All controls have an accessible name; groups use a heading, `fieldset`/`legend`, or `aria-label`.
- Use native controls first. Custom selection controls expose `aria-pressed`; switches expose checked state.
- Keyboard focus is always visible with a high-contrast outline and offset.
- User-facing touch targets should be at least `44px` in either dimension. Compact controller actions may be `38px` only where the surrounding layout remains generous and the mobile rule enlarges them.
- Alerts use `role="alert"` when immediate action may be required. Connection and progress updates use status semantics without excessive announcements.
- Dialogs provide `role="dialog"`, `aria-modal`, a labelled title, and descriptive copy.
- Disabled controls remain legible and are not the only explanation for what is required.
- Text and meaningful controls must meet WCAG AA contrast against their actual background.
- Zoom to 200%, keyboard-only operation, screen-reader names, and 320px layout are release checks.

## Responsive Rules

- Above `1120px`: the therapist workspace may use three modality columns and a sticky command deck.
- At `1120px` and below: the command deck becomes static and modalities reduce to two columns.
- At `760px` and below: use one content column, reduce header chrome, let command actions wrap, and anchor the participant dock to safe-area insets.
- At `480px` and below: simplify dense grids, keep direction controls within the viewport, and stack tactile actions.
- The participant tactile sheet sits above, never underneath, the command dock.
- Fullscreen controls account for device notches and browser safe areas.
- No horizontal scrolling is acceptable at `320px`.

## Anti-patterns

Do not introduce:

- Generic cards nested inside cards.
- Gratuitous gradients, glow, glass blur, or soft drop shadows.
- Excessive pills or fully rounded containers.
- Hover lift, floating tiles, or decorative parallax.
- A giant centered hero card with an eyebrow label and generic feature-card grid.
- Decorative icons where a precise label is clearer.
- Multiple competing call-to-action colors.
- Fake metrics, testimonials, avatars, or clinical-looking badges.
- Low-contrast gray-on-gray control states.
- Animation that masks state changes or delays an emergency/local stop.

## UI QA Checklist

- [ ] The most important action and current state are identifiable within five seconds.
- [ ] Start, pause/resume, stop, local stop, and end-session controls are unambiguous.
- [ ] Destructive actions require deliberate confirmation.
- [ ] Running, paused, stopping, stopped, disconnected, expired, locally stopped, and ended states are visually distinct.
- [ ] No output permission prompt appears without explanatory copy.
- [ ] Every switch, selector, input, button, status, alert, and dialog has correct semantics and an accessible name.
- [ ] Keyboard focus is visible and logical; no keyboard trap exists.
- [ ] Text and controls meet contrast requirements without relying on color alone.
- [ ] English and Spanish copy fit without clipping or untranslated labels.
- [ ] Layout is checked at 320px, 480px, 760px, 1120px, and a wide desktop viewport.
- [ ] Participant controls respect safe areas and do not cover tactile controls.
- [ ] Reduced-motion preference removes decorative UI transitions without silently changing requested stimulus behavior.
- [ ] The page contains no accidental nested-card, gradient, shadow, pill, or hover-lift styling.
- [ ] Loading, backend-unavailable, permission, clipboard, realtime, audio, and hardware failures are visible and actionable.
