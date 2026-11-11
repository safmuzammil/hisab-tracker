# Stage 7: Critic Review Report

* **Target Document**: [`dual-theme-pastel-card-system.md`](file:///D:/Codes/Progress/docs/designs/dual-theme-pastel-card-system.md)
* **Active Scope**: `FeatureRange` (Lines 1–355)
* **Date**: 2026-11-11
* **Reviewers**:
  * **Design Critic** (`egm-design`)
  * **Structural Layout Validator** (`egm-structural`)
  * **Technical Copy Editor** (`egm-style`)
* **Standards Applied**:
  * [`feature-spec-standard.md`](file:///C:/Users/ACER/.gemini/config/plugins/egm/resources/document_standards/feature-spec-standard.md)
  * Plain English / Objective Technical Style Standard

---

## Executive Summary of Findings

| Severity | Count | Primary Areas |
| :--- | :---: | :--- |
| 🔴 **Blocker** | **1** | Missing mandatory `## Risks & Limits` / `## Risks & Mitigations` section (Unanimous: Design & Structural) |
| 🟡 **Major** | **10** | Content occlusion & bottom safe-area offset; Mobile virtual keyboard collision; Desktop dock unbounded width; Theme FOUC & token contrast; Overlay mutual exclusion; Rejection attribution without links; Uncalibrated statistical claims (80% taps, 100% compatibility, WCAG 7:1 AA, haptic vibration) |
| 🟢 **Nit** | **11** | Headings nomenclature (`Problem Statement`, `Goals & Non-Goals`); Markdown divider normalization; Marketing fluff, filler ("smoothly", "during a busy day"), buzzwords ("bento", "glanceable momentum"), and redundant "Rejected by author:" prefixes |

---

## Detailed Findings by Reviewer

### 1. Design Critic Review (`egm-design`)

#### Finding 1: Mandatory "Risks & Limits" Section Missing
* **Severity**: 🔴 Blocker
* **Affected Scope**: Missing Section (between Lines 326 and 328 or under Architecture)
* **Finding**: The document completely omits a `## Risks & Limits` (or `## Risks & Mitigations`) section. Under the *Feature Specification Standard*, this is a strict requirement: *"The specification must explicitly call out its own constraints. It must identify potential failure modes, security implications, scalability limits, and how they will be mitigated."*
* **Recommendation**: Add a dedicated `## Risks & Limits` section detailing concrete operational and architectural failure modes, specifically:
  1. Mobile virtual keyboard occlusion and viewport resizing.
  2. Main tab content clipping under the fixed bottom dock.
  3. UI rendering latency during client-side streak calculations across large activity histories.
  4. Mutual exclusion between simultaneous overlays (drawer vs quick-action sheet vs modals).

#### Finding 2: Content Occlusion & Missing Bottom Viewport Safe-Offset
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 221–236 (`.bottom-nav-hub` CSS) & Lines 187–216 (`switchTab`)
* **Finding**: The navigation hub is pinned to the bottom using `position: fixed; bottom: 0; left: 0; right: 0; height: 64px; padding-bottom: env(safe-area-inset-bottom, 0px); z-index: 150;`. However, the technical plan defines no corresponding bottom padding or margin on `.tab-content` or `main`. Consequently, the bottom 64px–80px of every scrollable view will be permanently occluded behind the opaque bottom navigation bar.
* **Recommendation**: Explicitly define layout container offsets in the presentation layer specification:
  ```css
  main, .tab-content {
      padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 24px);
  }
  ```

#### Finding 3: Mobile Keyboard Collisions with Fixed Bottom Bar & FAB
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 221–263 (`.bottom-nav-hub`, `.nav-hub-fab-wrap`)
* **Finding**: On mobile devices (Android Chrome / iOS Safari), focusing on any form input triggers the virtual keyboard. Because `.bottom-nav-hub` is `position: fixed; bottom: 0;`, viewports without `interactive-widget=resizes-content` will either float the bottom bar and elevated circular FAB directly over the input fields or trigger severe layout shifts.
* **Recommendation**:
  1. Add an architectural requirement to suppress/hide `.bottom-nav-hub` when modal overlays or input focus events are active, or
  2. Specify viewport meta tag constraints (`interactive-widget=resizes-content`) and describe keyboard dismiss behavior.

#### Finding 4: Unconstrained Desktop Viewport Topology & Unresolved Layout Question
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 38–42 (`## Open Questions`, Q2) & Lines 221–236 (`.bottom-nav-hub`)
* **Finding**: Open Question 2 leaves tablet/desktop (>768px) dock behavior undecided, yet the CSS specification defines `.bottom-nav-hub` with `left: 0; right: 0; display: flex; justify-content: space-around;`. On desktop displays (1080p, 1440p), this creates a 1920px wide bar where 4 icons and 1 FAB are separated by hundreds of pixels of blank space while application cards remain centered in a mobile shell.
* **Recommendation**: Resolve Open Question 2 directly in the architecture. For desktop/tablet viewports, constrain the bottom bar:
  ```css
  .bottom-nav-hub {
      max-width: 540px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 24px 24px 0 0;
  }
  ```

#### Finding 5: Theme FOUC and Marginal WCAG Contrast on Accent Tokens
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 100–178 (`### 2. Design Token System & Dual-Theme Engine`) & Lines 38–40 (Q1)
* **Finding**:
  1. **FOUC (Flash of Unstyled Content)**: The spec describes runtime toggling on `body[data-theme]`, but does not specify early synchronous theme resolution in `<head>`. On initial page load from `localStorage`, users will see an unstyled or inverted flash before JavaScript loads.
  2. **Token Contrast**: The primary token `--primary: #6366f1` (Indigo 500) paired with `--surface-card: #ffffff` has a contrast ratio of ~4.45:1, falling slightly short of WCAG AA (4.5:1 for normal body text).
* **Recommendation**:
  1. Specify an inline critical script block in `<head>` to read `localStorage` and set `document.documentElement.dataset.theme = ...` synchronously before DOM rendering.
  2. Darken `--primary` in light mode to `#4f46e5` (Indigo 600, ~5.9:1 on white) to guarantee strict WCAG AA compliance across all text sizes.

#### Finding 6: Overlay Mutual Exclusion & Backdrop Stacking
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 310–325 (`### 6. Z-Index Stratification Hierarchy`)
* **Finding**: The Z-index table stratifies layers, but the navigation and state controller logic does not mandate mutual exclusion. If a user triggers the floating `+` FAB while the drawer is open, multiple modal backdrops and focus traps will compound.
* **Recommendation**: Add a state machine rule in the Navigation Controller specification: invoking any overlay (`openDrawer()`, `openQuickActionSheet()`, `openModal()`) must dismiss any other currently active overlay before mounting.

#### Finding 7: Ambiguous Alternatives Attribution Phrasing
* **Severity**: 🟢 Nit
* **Affected Scope**: Lines 328–353 (`## Alternatives Considered`)
* **Finding**: The rejection rationales repeatedly use the phrasing *"Rejected by author: ..."*. The standard prohibits maintainer attribution without linking issues or PRs.
* **Recommendation**: Rephrase the rejection rationales objectively based on technical trade-offs.

---

### 2. Structural Layout Validator Review (`egm-structural`)

#### Finding 1: Missing Mandatory Section — `Risks & Mitigations`
* **Severity**: 🔴 Blocker
* **Affected Scope**: Missing Section following `## Alternatives Considered`
* **Discrepancy Description & Rationale**: The Feature Specification Standard mandates that high-level feature specifications explicitly detail failure modes, constraints, security implications, scalability limits, and how they will be mitigated (`## Risks & Mitigations`). In the audited scope, this section is entirely missing.

#### Finding 2: Maintainer Attribution Without Reference Links
* **Severity**: 🟡 Major
* **Affected Scope**: `## Alternatives Considered` (lines 334, 340, 346, 352)
* **Discrepancy Description & Rationale**: Alternatives A, B, C, and D state rejection rationales prefixed with `"Rejected by author:"`. The standard explicitly requires: *"Rejection rationales must state concrete technical or scope trade-offs and must not attribute a rejection to a maintainer without linking their issue, discussion, or PR."*

#### Finding 3: Heading Nomenclature Deviation
* **Severity**: 🟢 Nit
* **Affected Scope**: `## The Problem` (line 15)
* **Discrepancy Description & Rationale**: The Target Standard defines the required problem section as `Problem Statement`. Using `## The Problem` deviates from the canonical blueprint naming convention.

#### Finding 4: Heading Hierarchy & Blueprint Alignment
* **Severity**: 🟢 Nit
* **Affected Scope**: `## Goals` (line 22) and `## Non-Goals` (line 31)
* **Discrepancy Description & Rationale**: The Target Standard specifies `Goals & Non-Goals` as a combined structural requirement. Nesting them as H3s under `## Goals & Non-Goals` strictly mirrors the standard blueprint.

#### Finding 5: Inconsistent Thematic Break Formatting
* **Severity**: 🟢 Nit
* **Affected Scope**: Document Dividers (lines 7, 60, 96, 180, 265, 297, 326, 354)
* **Discrepancy Description & Rationale**: The document alternates between 80-character hyphens and standard Markdown thematic breaks (`---`). Normalizing all section dividers to standard `---` will ensure uniform Markdown syntax throughout.

---

### 3. Technical Copy Editor Review (`egm-style`)

#### Finding 1: Uncalibrated Statistical Claim
* **Severity**: 🟡 Major
* **Affected Scope**: Line 18 (`## The Problem`, Item 2)
* **Style Rationale**: The assertion that "80% of daily actions ... require unnecessary taps" introduces an unverified statistical metric without empirical measurement or telemetry citations.
* **Editorial Action**: `CALIBRATE` (state objectively that routine actions currently require multi-step drawer navigation).

#### Finding 2: Uncalibrated Standard Specification
* **Severity**: 🟡 Major
* **Affected Scope**: Line 24 (`## Goals`, Goal 1)
* **Style Rationale**: The text states "WCAG AA contrast (minimum 7:1 for body text, 4.5:1 for accents)". 7:1 is WCAG AAA for normal text; AA is 4.5:1 for body text and 3:1 for UI accents.
* **Editorial Action**: `CALIBRATE` threshold to match WCAG AA (4.5:1 normal text, 3:1 graphical objects/accents).

#### Finding 3: Hyperbole & Absolute Backward Compatibility Guarantee
* **Severity**: 🟡 Major
* **Affected Scope**: Line 29 (`## Goals`, Goal 6)
* **Style Rationale**: "Guarantee 100% backward compatibility ... without schema or protocol modifications" presents an uncalibrated absolute guarantee rather than a testable requirement.
* **Editorial Action**: `CALIBRATE` (e.g., "Maintain backward compatibility with existing localStorage schemas and sync protocols").

#### Finding 4: Uncalibrated Haptic Capability Claim & Wordiness
* **Severity**: 🟡 Major
* **Affected Scope**: Line 48 (`## Critical User Journeys (CUJs)`, CUJ 1)
* **Style Rationale**: Asserts haptic behavior without platform qualification (`navigator.vibrate` is unsupported on iOS Safari). "Smoothly" is subjective filler.
* **Editorial Action**: `CALIBRATE` or `DROP` haptic claim; `DROP` "smoothly".

#### Finding 5: Subjective Physiological Evaluation
* **Severity**: 🟡 Major
* **Affected Scope**: Line 53 (`## Critical User Journeys (CUJs)`, CUJ 2)
* **Style Rationale**: "without eye strain" describes an unmeasurable subjective physiological experience.
* **Editorial Action**: `DROP` ("without eye strain").

#### Findings 6–12: Editorial Tone, Fluff & Buzzword Pruning
* **Severity**: 🟢 Nit
* **Affected Scope**: Overview, CUJ 1, Section 1, Section 4, Alternatives
* **Editorial Actions**:
  * Line 11: Replace "financial operating system" with "personal tracker"; drop marketing qualifiers ("flagship", "comprehensive visual and architectural overhaul").
  * Line 46: `DROP` narrative filler ("During a busy day").
  * Lines 27, 83, 267: Replace buzzwords ("Bento Cards", "Telemetry Micro-Pill Engine") with neutral technical terms ("rounded card layout", "streak and priority badge stack").
  * Line 206: Simplify "Scroll to top with momentum reset" to "Scroll to top instantly".
  * Lines 334, 340, 346, 352: `DROP` "Rejected by author:".
  * Lines 345–346: Rephrase subjective emotional tone ("deceptive visual noise", "genuine motivational feedback") to neutral technical descriptions.
