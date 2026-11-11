# Stage 9: Implementation Readiness Test Report

* **Target Document**: [`dual-theme-pastel-card-system.md`](file:///D:/Codes/Progress/docs/designs/dual-theme-pastel-card-system.md)
* **Active Scope**: `DetailedRange` (Lines 356–431)
* **Date**: 2026-11-11
* **Reviewers**:
  * **Pragmatic Tech Lead** (`egm-implementation-readiness`)
  * **Pedantic Quality Auditor** (`egm-codebase-details`)
  * **Technical Copy Editor** (`egm-style`)
* **Standards Applied**:
  * [`implementation-readiness-standard.md`](file:///C:/Users/ACER/.gemini/config/plugins/egm/resources/document_standards/implementation-readiness-standard.md)
  * Plain English / Objective Technical Style Standard
* **Audited Codebase**: [`index.html`](file:///D:/Codes/Progress/index.html), [`app.js`](file:///D:/Codes/Progress/app.js), [`sw.js`](file:///D:/Codes/Progress/sw.js)

---

## Executive Summary of Findings

| Severity | Count | Primary Areas |
| :--- | :---: | :--- |
| 🔴 **Blocker** | **4** | Theme engine location mismatch (inline script in `index.html` vs proposed `app.js`); Existing heatmap accordion already present in markup; Unspecified streak algorithm & history data contract; Undefined modal date carousel & category chip form extraction |
| 🟡 **Major** | **8** | Tab IDs vs section mismatches (`bad-habits`, `backlog`, `Charity` is not a tab); Duplicate `.bottom-nav { display: none !important; }` rule at lines 1267–1269; Unresolved theme initialization design choice (Open Q1); Missing markup & action handler bindings for 6 hub sheet tiles; Popstate Android back gesture integration for `#quick-action-sheet`; Lack of programmatic test fixtures |
| 🟢 **Nit** | **8** | Uncalibrated haptic claim in verification; Vague adverbs ("clears gracefully", "cleanly"); RAS syndrome ("floating FAB button"); Jargon ("1-tap", "telemetry micro-pills"); `node --check` network import incompatibility with remote Firebase URLs; Extraneous footer tag |

---

## Detailed Findings by Reviewer

### 1. Codebase Details Auditor Review (`egm-codebase-details`)

#### Finding 1: Theme Engine Location & DOM Handler Mismatch
* **Severity**: 🔴 Blocker
* **Affected Scope**: Lines 373, 391 vs [`index.html#L1590`](file:///D:/Codes/Progress/index.html#L1590), [`index.html#L2464-L2481`](file:///D:/Codes/Progress/index.html#L2464-L2481), [`index.html#L2548`](file:///D:/Codes/Progress/index.html#L2548)
* **Discrepancy Description & Rationale**: The plan instructs adding `togglePastelTheme()` under `app.js (Modify)`. In the actual codebase, theme toggling is implemented entirely as an inline `<script>` in `index.html#L2464-L2481` via `applyDesignTheme(themeName)` and `toggleDesignTheme()`. Both `#btn-theme-toggle` (header) and line 2548 (drawer item) execute `onclick="toggleDesignTheme()"`. Adding a function in `app.js` without updating the inline script and DOM `onclick` attributes leaves the new theme engine dead code.
* **Remedy**: Update `applyDesignTheme` and `toggleDesignTheme` directly inside `index.html` (or cleanly extract to `app.js` and re-bind both button triggers).

#### Finding 2: Re-inventing Existing Heatmap Accordion Markup
* **Severity**: 🔴 Blocker
* **Affected Scope**: Lines 367, 378, 402 vs [`index.html#L1758-L1770`](file:///D:/Codes/Progress/index.html#L1758-L1770) and [`app.js#L95-L107`](file:///D:/Codes/Progress/app.js#L95-L107)
* **Discrepancy Description & Rationale**: The plan proposes "Wrap `#heatmap-card` in a `.collapsible-card` container with an interactive expand/collapse header". In reality, `#heatmap-card` is **already** inside `<div class="collapsible-card">` at `index.html#L1758`, toggled by `toggleAnalyticsView()` in `app.js#L95-L107`. 
* **Remedy**: Remove instructions to add new markup/wrappers; re-skin the existing collapsible container and retain `toggleAnalyticsView()`.

#### Finding 3: Invalid Tab IDs & Non-Existent Drawer Tab Targets
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 374, 417–418 vs [`index.html#L2508-L2531`](file:///D:/Codes/Progress/index.html#L2508-L2531) and [`app.js#L4214-L4255`](file:///D:/Codes/Progress/app.js#L4214-L4255)
* **Discrepancy Description & Rationale**:
  1. `Charity` is cited as a drawer tab, but **`Charity` is not a tab**; it is an in-page section (`#charity-dashboard-card`) reached via `scrollToCharity()`.
  2. The actual tab identifiers in the DOM are `bad-habits` (for habits) and `backlog` (for Saved Library). Calling `switchTab('habits')` or `switchTab('library')` will fail.
  3. The bottom nav active class handler in `app.js#L4237` currently targets `#nav-[tabName]` with class `.nav-item`.
* **Remedy**: Align all tab identifiers strictly with production IDs (`dashboard`, `tasks`, `bad-habits`, `budget`, `deen`, `backlog`, `journal`).

#### Finding 4: Residual Bottom Navigation Suppression Rules
* **Severity**: 🟡 Major
* **Affected Scope**: Line 364 vs [`index.html#L1266-L1274`](file:///D:/Codes/Progress/index.html#L1266-L1274)
* **Discrepancy Description & Rationale**: Removing the rule at line 1274 is insufficient. Lines 1267–1269 contain a second independent rule (`.bottom-nav { display: none !important; }`). Additionally, line 1271 sets container bottom padding to 30px, causing page content to be clipped behind `.bottom-nav-hub`.
* **Remedy**: Specify removing both rules (lines 1267–1269 and 1274) and adjusting `.container` padding to `calc(64px + env(safe-area-inset-bottom, 0px) + 24px)`.

#### Finding 5: Missing Modal Form Extraction Handler Updates
* **Severity**: 🟡 Major
* **Affected Scope**: Line 368 vs [`app.js#L1120-L1150`](file:///D:/Codes/Progress/app.js#L1120-L1150) and [`app.js#L3196-L3205`](file:///D:/Codes/Progress/app.js#L3196-L3205)
* **Discrepancy Description & Rationale**: The plan proposes replacing inputs with horizontal date carousels and pastel category chips, but omits updates to `saveTask()` and `addExpense()`. These functions extract values directly from `<select id="task-type">`, `<select id="expense-category">`, and `<input type="date" id="expense-date">`.
* **Remedy**: Reject custom date carousels (as determined in Zoom Out); keep standard inputs and update only styling.

#### Finding 6: Omission of Popstate Interceptor Integration for Quick-Action Sheet
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 375, 422 vs [`app.js#L112-L135`](file:///D:/Codes/Progress/app.js#L112-L135)
* **Discrepancy Description & Rationale**: In `app.js`, Android hardware back gestures are intercepted by `window.addEventListener('popstate')`. Without assigning `.modal-overlay` or integrating with the popstate stack, pressing the Android back button will navigate away from the page rather than closing `#quick-action-sheet`.
* **Remedy**: Add `#quick-action-sheet` to the popstate dismissal sequence and assign standard modal classes.

#### Finding 7: Node Syntax Check Network Import Limitation
* **Severity**: 🟢 Nit
* **Affected Scope**: Line 413 vs [`app.js#L203-L205`](file:///D:/Codes/Progress/app.js#L203-L205)
* **Discrepancy Description & Rationale**: `app.js` contains top-level ES module imports from remote HTTPS Firebase URLs. Standard `node --check` fails on remote URLs.
* **Remedy**: Use browser runtime testing or headless syntax verification without executing remote network imports.

---

### 2. Pragmatic Tech Lead Review (`egm-implementation-readiness`)

#### Finding 1: Unspecified `calculateTaskStreak` Algorithm & Data Contract
* **Severity**: 🔴 Blocker
* **Affected Scope**: Lines 376, 398, 424
* **Finding & Guidance**: The plan instructs adding `calculateTaskStreak(taskId, history)` without documenting the data schema of `activityHistory`, date boundary evaluation, or how interval frequencies are evaluated.
* **Remedy**: Parameterize and reuse [`computeHabitStreak`](file:///D:/Codes/Progress/app.js#L2061-L2096), which already calculates streaks from `activityHistory`.

#### Finding 2: Undefined Modal UI Components ("Horizontal Date Carousel")
* **Severity**: 🔴 Blocker
* **Affected Scope**: Lines 368, 396
* **Finding & Guidance**: The plan instructs adding bespoke carousels referencing unlinked external mockups without HTML structure, selection logic, or input bindings.
* **Remedy**: Strike date carousels; retain native HTML5 date inputs and update modal card surfaces with pastel tokens.

#### Finding 3: Unresolved Design Choice for Theme Initialization
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 40, 373, 389–391
* **Finding & Guidance**: Theme initialization is left as an unresolved question in the text. Under the Zero-Decision Rule, all decisions must be resolved in the plan.
* **Remedy**: Formally resolve: default to OS preference (`@media (prefers-color-scheme: dark)`), allow manual toggle, and persist in `localStorage.getItem('hisab_pastel_theme')`.

#### Finding 4: Missing Markup Templates & Action Handlers for Hub and Sheet
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 365–366, 374–375, 392–396
* **Finding & Guidance**: Lacks explicit HTML markup and action tile function mappings for the 6 action tiles on `#quick-action-sheet`.
* **Remedy**: Include full HTML templates for `.bottom-nav-hub` and `#quick-action-sheet`, explicitly binding each tile to its target modal trigger (`openTaskModal()`, `openExpenseModal()`, `openHabitModal()`, `openDeenModal()`, `openBacklogModal()`, `openJournalModal()`).

#### Finding 5: Absence of Programmatic Verification Fixtures
* **Severity**: 🟡 Major
* **Affected Scope**: Lines 410–428
* **Finding & Guidance**: The verification plan relies on manual inspection without automated verification fixtures.
* **Remedy**: Provide concrete test cases for streak computation, tab active state synchronization, and theme switching.

#### Finding 6: Heatmap Accordion Default State
* **Severity**: 🟢 Nit
* **Affected Scope**: Lines 367, 378, 401–402
* **Finding & Guidance**: The plan does not specify whether the accordion is collapsed or expanded by default.
* **Remedy**: Document default state (collapsed by default on mobile viewports).

---

### 3. Technical Copy Editor Review (`egm-style`)

#### Finding 1: Uncalibrated Claim in Verification Plan
* **Severity**: 🟡 Major
* **Affected Scope**: Line 420
* **Style Rationale**: "opens smoothly with haptic feedback" asserts hardware vibration behavior without implementation backing.
* **Editorial Action**: `CALIBRATE` to "opens and displays modal action tiles"; `DROP` "smoothly with haptic feedback".

#### Findings 2–7: Style & Wordiness Cleanups
* **Severity**: 🟢 Nit
* **Editorial Actions**:
  * Line 418: Replace "clears gracefully" with "clears the `.active` state from all slots".
  * Line 422: Replace "dismisses cleanly" with "closes and hides modal container".
  * Line 394: Replace "floating FAB button" with "centered floating action button (FAB)".
  * Lines 377, 397: Replace "1-tap" and "Telemetry Micro-Pills" with neutral terminology.
  * Line 367: Simplify "interactive expand/collapse header" to "expand/collapse toggle header".
  * Line 431: `DROP` `*Drafted with EGM*`.
