# Stage 6: Comprehension Test Report

* **Target Document**: [`dual-theme-pastel-card-system.md`](file:///D:/Codes/Progress/docs/designs/dual-theme-pastel-card-system.md)
* **Auditor**: Naive Reader (`egm-comprehension`)
* **Date**: 2026-11-11
* **Scope**: `FeatureRange` (1..355) & `DetailedRange` (356..431)

---

### What this proposes
The document proposes overhauling Hisab Tracker's presentation and navigation layers by replacing its legacy dark/obsidian themes with a pure CSS variable-driven dual-theme pastel system (*Pastel Morning* and *Pastel Twilight*). It re-enables and redesigns the bottom navigation bar into a 5-slot hub centered around a floating `+` quick-action button for rapid entry, while retaining the slide-out hamburger drawer for access to all 8 core modules and auxiliary tools. In addition, it restructures task and habit cards into rounded bento containers equipped with single-user telemetry pills (streaks and penalties), encapsulates the 12-week dashboard heatmap in an accordion to prevent viewport overcrowding, and updates `index.html`, `app.js`, and `sw.js` without altering existing backend schemas or sync endpoints.

### How the existing system works, per this document
According to the document, Hisab Tracker is an offline-capable PWA synchronized with `localStorage`, Firebase Firestore, and Google Sheets webhooks that currently offers only three dark-oriented themes (neon `classic`, `obsidian`, and amber `ramadan`). The bottom navigation bar is suppressed via a hardcoded CSS `display: none !important` rule, requiring users to navigate modules exclusively through the slide-out drawer or dashboard launcher. Task cards present dense, unprioritized metadata (7-day mini-week pills, custom inputs, penalties) and generic avatar clusters without glanceable streak or priority badges. Finally, the dashboard permanently renders a large 84-day activity heatmap above the fold, pushing immediate daily tasks down the screen.

---

### Findings

#### 1. Unlinked External Mockup References
* **Severity**: 🟡 Major
* **Affected Scope**: Section 5 (Line 301), Alternatives Considered: Alternative C (Line 344), Detailed Implementation Plan: Target Files (Line 368)
* **Discrepancy Description & Rationale**: The document repeatedly references external visual artifacts ("Screen 1 of the reference mockup", "reference Figma mockup", and "reference Screen 3") to define layout specifications—such as the dashboard's asymmetric 2x2 bento grid and horizontal date carousels in modals. However, these mockups are neither embedded, linked, nor defined structurally within the document. A fresh reader or implementer has no way to inspect or verify the source of these layout requirements.

#### 2. Undefined Interaction Model for Collapsible Slider Drawers
* **Severity**: 🟡 Major
* **Affected Scope**: Section 4 (Lines 284–285), Detailed Implementation Plan: Step 4 (Line 399)
* **Discrepancy Description & Rationale**: The architecture introduces a `Collapsible Slider Drawer` / `expandable slider drawers` on task cards to house secondary tools (Pomodoro timer, 30-day history modal, Google Calendar alarm, notes). The document never explains the interaction model or technical mechanism for this drawer: it is unclear whether it expands via a card tap, an explicit toggle icon, or a swipe gesture, and whether it uses native `<details>`, CSS transitions, or dynamic DOM insertion.

#### 3. Undefined Strictness Metric Variable `M`
* **Severity**: 🟡 Major
* **Affected Scope**: Goal 4 (Line 27), Section 4 Micro-Pill Layout (Line 293), Verification Plan (Line 425)
* **Discrepancy Description & Rationale**: The document specifies a strictness badge with the format `● Strict (M/5)`, but nowhere defines what the variable `M` represents (e.g., missed days, completed milestones, strikes, or remaining attempts) or where it is retrieved in the underlying data model.

#### 4. Tab Identifier Inconsistency (`habits` vs `bad-habits`)
* **Severity**: 🟡 Major
* **Affected Scope**: Section 3 (Lines 212–213) vs Goals 2 & 3 (Lines 25, 26)
* **Discrepancy Description & Rationale**: Goals 2 and 3 and the overview list the 4 primary operational tabs and modules as `Tasks`, `Habits`, and `Budget`. However, the code sample for `switchTab(tabId)` explicitly routes `if (tabId === 'bad-habits') renderBadHabits();`. If the bottom navigation hub registers slot 3 as `habits` (matching the goals), calling `switchTab('habits')` will fail to activate `renderBadHabits()`. The document should specify whether the module identifier is `habits` or `bad-habits`.

#### 5. Unspecified Default/Fallback Theme
* **Severity**: 🟢 Nit
* **Affected Scope**: Open Questions (Line 40), Step-by-Step Implementation Sequence: Step 1 (Line 391)
* **Discrepancy Description & Rationale**: Open Question 1 asks whether theme selection should default to `prefers-color-scheme` or time-of-day boundaries, but Step 1 simply instructs to wire up the switcher without documenting a fallback or initial default theme for new users.

#### 6. Unguarded Haptic Vibration Call
* **Severity**: 🟢 Nit
* **Affected Scope**: CUJ 1 (Line 48), Verification Plan (Line 420)
* **Discrepancy Description & Rationale**: The user journey and verification plan require the quick-action button to trigger a "light haptic vibration", but the document does not specify the implementation method (`navigator.vibrate`) or account for the fact that WebKit/iOS Safari does not support the Web Vibration API without defensive guards (`if (navigator.vibrate) navigator.vibrate(10)`).
