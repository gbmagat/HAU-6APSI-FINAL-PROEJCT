# Our Museum Passport

## Final Project Design System

**Course:** Application and Systems Integration  
**Prepared by:** Gabriel B. Magat Jr.
**Submission:** Part 3 - Design System

## 1. Styling approach and tokens

### Chosen stack

The interface uses **Next.js, React, and TypeScript**, styled with **CSS custom properties and component-scoped CSS classes**.

### Color tokens

The interface uses exactly five colors:

| Token | Value | Role |
|---|---:|---|
| `--color-ink` | `#164135` | Headings, body text, logo, and strong icons |
| `--color-action` | `#457257` | Primary actions, active navigation, borders, and status structure |
| `--color-canvas` | `#EFEDE0` | Page background and quiet space |
| `--color-panel` | `#EEDDA9` | Feature panels, museum cards, and highlights |
| `--color-white` | `#FFFFFF` | Text on primary actions, inputs, and inner controls |

Status does not add more colors. Want to Visit, Planned, Visited, Favorite, and Review Pending use distinct icons, line styles, and visible text labels.

### Type tokens

| Token | Size / line height | Weight | Use |
|---|---:|---:|---|
| `--font-interface` | Poppins with Arial, Helvetica, and sans-serif fallbacks | 400-800 | All interface text |
| `--type-page-title` | `26px / 34px` | 500 | Page titles |
| `--type-section-title` | `24px / 32px` | 700 | Major sections |
| `--type-card-title` | `21px / 26px` | 700 | Museum and post titles |
| `--type-body` | `14px / 21px` | 400 | Default reading text |
| `--type-label` | `14px / 20px` | 600 | Form and control labels |

### Spacing and shape tokens

| Group | Named values |
|---|---|
| Spacing | `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`, `--space-16: 64px` |
| Radius | `--radius-nav: 9px`, `--radius-control: 16px`, `--radius-panel: 28px`, `--radius-card: 30px`, `--radius-round: 999px` |
| Layout | `--border-strong: 2px`, `--layout-max: 1058px`, `--header-height: 66px` |
| Motion | `--motion-fast: 120ms`, `--motion-standard: 200ms`, `--motion-panel: 320ms` |

## 2. Color and contrast

All normal text and interactive control pairs meet the WCAG AA minimum of **4.5:1**:

| Foreground on background | Ratio | Approved use |
|---|---:|---|
| Ink on Canvas | `9.70:1` | Default headings and body text |
| Ink on Panel | `8.44:1` | Text inside Parchment panels |
| Action on Canvas | `4.70:1` | Navigation and supporting labels |
| Action and White, either direction | `5.53:1` | Outlined controls, primary buttons, and active navigation |

## 3. Reusable components from the wireframes

Levels follow **Atom -> Molecule -> Organism**.

| Component | Level | Wireframe use | Required props |
|---|---|---|---|
| `Button` | Atom | Login, Map, Feed, Visit form | `label`, `variant`, `size`, `icon?`, `disabled?`, `loading?`, `onPress` |
| `NavigationItem` | Atom | Desktop header and mobile navigation | `label`, `icon?`, `href`, `active`, `compact?` |
| `StatusChip` | Atom | Map preview, museum detail, visit post | `status`, `icon`, `label`, `emphasis?` |
| `RatingRow` | Molecule | Review form and review reveal | `criterion`, `value`, `readOnly`, `error?`, `onChange?` |
| `MapMarker` | Molecule | Desktop and mobile map | `museumId`, `status`, `favorite`, `reviewState`, `score?`, `selected`, `onSelect` |
| `MuseumCard` | Molecule | Map results and wishlist | `museum`, `category`, `status`, `thumbnailAlt`, `primaryAction` |
| `MetricCard` | Molecule | Passport statistics | `label`, `value`, `supportingText`, `icon`, `actionLabel?` |
| `VisitPostCard` | Organism | Desktop and mobile feed | `post`, `author`, `museum`, `photos`, `reviewState`, `reactions`, `comments` |
| `ReviewPair` | Organism | Museum detail and review reveal | `firstReview?`, `secondReview?`, `revealState`, `combinedScore?`, `recalculatedAt?` |
| `AppHeader` | Organism | All signed-in desktop screens | `brand`, `items`, `activeRoute`, `memberMenu` |

## 4. Responsive plan

| Breakpoint | Width | Behavior |
|---|---:|---|
| Mobile | `0-767px` | One-column feed, bottom navigation, full-height map with result sheet, stacked reviews, and 16px page padding |
| Tablet | `768-1023px` | Two-column museum grid, map/list tabs, dismissible filters, and secondary statistics below primary content |
| Desktop | `1024px+` | Centered 1058px shell, three-column museum grid, map and result panel together, and 680px feed with 354px context sidebar |

## 5. Accessibility checklist

| Check | Decision | Status |
|---|---|---|
| Contrast | Approved text and control pairs are at least 4.5:1. | Addressed |
| Keyboard | Navigation, cards, markers, ratings, dialogs, and form steps have keyboard paths. | Addressed |
| Focus | Interactive elements use a visible 2px Ink focus ring with White separation. | Addressed |
| Touch targets | Mobile controls are at least 44 by 44 pixels. | Addressed |
| Status | Every status combines text, icon/shape, and color. | Addressed |
| Map alternative | Every map has a searchable, keyboard-accessible result list. | Addressed |
| Semantics | Screens use headings, landmarks, lists, buttons, links, labels, and fieldsets. | Addressed |
| Forms | Labels remain visible and errors appear beside fields without relying on color. | Addressed |
| Images | User photographs require editable alternative text and source attribution when needed. | Addressed |
| Motion | Reduced-motion mode removes marker bounce and large panel movement. | Addressed |
| Reflow | Content remains usable at 200% zoom without horizontal reading scroll. | Addressed |
| Review privacy | One member's ratings stay hidden until both reviews are submitted. | Addressed |
