# Our Museum Passport - Design System

**Version:** 1.0  
**Status:** Planning submission  
**Product:** A private museum-discovery, visit-journal, and review forum for two people

## 1. Brand foundation

### Product promise

Our Museum Passport helps two people discover museums, plan visits, record what they experienced, compare personal ratings, and preserve a shared cultural history.

### Tagline

**Discover. Visit. Review. Remember.**

### Personality

- **Curious:** encourages exploration without feeling academic or intimidating.
- **Personal:** treats each visit as part of a shared history.
- **Thoughtful:** gives both partners an equal, independent voice.
- **Cultured:** borrows the restraint and clarity of museum signage.
- **Warm:** feels like a private journal rather than a corporate travel application.

### Design principles

1. **The map is a starting point.** Discovery and visit status must remain visible and easy to understand.
2. **Two opinions have equal weight.** Neither person's review is presented as the official answer.
3. **Memories come before metrics.** Photographs and stories lead; scores support them.
4. **Status must never rely on color alone.** Every map marker and badge also uses an icon and text label.
5. **Private by default.** Controls should communicate who can see, edit, or delete content.
6. **Mobile use is primary.** Logging a museum visit must work comfortably while away from a computer.

### Reference-fidelity rules

The supplied reference screens are the visual authority for this project. The application must preserve the following characteristics:

1. **Warm canvas:** use a pale cream background across the entire page. Do not introduce large white, dark, or gradient page backgrounds.
2. **Parchment panels:** primary cards and structural panels use the palette's Parchment color with a visible Forest outline.
3. **Rounded construction:** discovery cards use 30-pixel corners, structural panels use 28-pixel corners, inner controls use 16-pixel corners, and navigation uses 9-pixel rounded rectangles.
4. **Single friendly typeface:** all headings, body text, navigation, scores, and labels use Poppins. Do not introduce a contrasting serif display face.
5. **Centered composition:** desktop content remains inside a narrow, centered 1058-pixel shell with substantial empty space around it.
6. **Quiet elevation:** use the soft green-gray shadow on discovery cards and the floating action. Dashboard panels and statistics remain outline-based with little or no elevation. Avoid glassmorphism, heavy blur, layered floating surfaces, and dramatic gradients.
7. **Compact uppercase metadata:** category labels and small section eyebrows are uppercase, bold, and letter-spaced.
8. **Outlined inner cards:** statistics, museum previews, and form groups sit on a near-white surface with a subtle green outline.
9. **Simple active states:** selected navigation and sidebar items use a solid Forest rounded rectangle with white text.
10. **Controlled color distribution:** approximately 70 percent cream canvas, 20 percent parchment panels, 8 percent green structure and text, and 2 percent semantic accents.

Do not add sharp square cards, black page sections, neon colors, large photographic backgrounds, oversized editorial typography, ornamental museum columns, or decorative effects that are absent from the references.

## 2. Identity

### Name

**Our Museum Passport**

Use the full name on the login screen, document title, and first visit. Use **Museum Passport** in compact navigation.

### Logo concept

The primary mark combines:

- a compact circular museum seal;
- a simplified museum arch or column inside the seal;
- a subtle location point or passport-stamp detail.

The desktop brand lockup uses a 42-pixel circular seal followed by the wordmark, matching the silhouette and spacing of the reference header. The mark should remain geometric and readable at 24 pixels. Do not use detailed building illustrations, national flags, or generic globe artwork.

### Logo variants

- **Primary:** Forest mark with Deep Forest wordmark on the cream canvas.
- **Reverse:** Parchment mark and wordmark on Forest.
- **Single color:** Deep Forest, Forest, or white for small or restricted applications.
- **App icon:** Symbol only, centered inside a rounded-square field.

### Clear space and minimum size

- Clear space: at least the height of the inner museum arch on all sides.
- Digital wordmark minimum width: 144 pixels.
- Symbol minimum size: 24 by 24 pixels.
- Do not stretch, rotate, outline, recolor individual pieces, or place the logo over a visually busy photograph.

## 3. Color system

### Core palette

| Token | Value | Main use |
|---|---:|---|
| `forest-900` | `#164135` | Strong text, brand mark, hover state, dark botanical surface |
| `forest-600` | `#457257` | Primary action, outlines, navigation, visited status |
| `moss-600` | `#629007` | Rating stars, discovery accent, Want to Visit marker |
| `leaf-600` | `#618933` | Charts, secondary highlights, hover accents |
| `parchment-300` | `#EEDDA9` | Warm feature surface, selected background, highlight |
| `clay-400` | `#BB9D7D` | Favorite overlay, photography support, warm accent |
| `taupe-500` | `#8E837A` | Review-pending and neutral status |
| `slate-600` | `#54696D` | Secondary text, unsaved marker, muted control |
| `dusk-700` | `#474A65` | Planned status and information |
| `navy-900` | `#1E3054` | Planned status, focus, charts, limited semantic use |
| `canvas-50` | `#EFEDE0` | Main application background, reference neutral |
| `chrome-100` | `#E5E1CF` | Fixed header and footer background, reference neutral |
| `surface-0` | `#F3F5F2` | Inner cards, sheets, and dialogs, reference neutral |
| `surface-warm` | `#FBF6E8` | Dashboard statistics and expanded content cards |
| `pure-white` | `#FFFFFF` | Museum thumbnail and title tiles only |
| `line-300` | `#AEB3A7` | Page-level dividers, reference neutral |
| `forest-outline-soft` | `rgba(69,114,87,.35)` | Inner-card outlines and quiet separators |
| `forest-950` | `#0F332A` | Hover and pressed primary actions, derived shade |
| `error-700` | `#9A3232` | System-only destructive and error color |

The ten colors from the supplied palette remain the brand core. The canvas, chrome, surface, line, darker forest shade, and functional error red are supporting interface colors verified from the reference style or created for legibility.

### Required foreground combinations

| Foreground and background | Contrast ratio | Permitted use |
|---|---:|---|
| Deep Forest on Parchment | `8.44:1` | Brand headings and labels |
| Deep Forest on cream canvas | `9.70:1` | Headings and body text |
| Forest on cream canvas | `4.70:1` | Navigation, supporting text, and labels |
| Forest on soft white | `5.04:1` | Inner-card body text |
| White on Forest | `5.53:1` | Primary buttons and active states |
| White on Deep Forest | `11.40:1` | Pressed controls and dark brand surfaces |
| Near-black on Moss | `4.96:1` | Text placed directly on Moss |
| White on Slate | `5.80:1` | Secondary controls |
| White on Dusk | `8.62:1` | Planned and informational controls |
| White on Navy | `13.08:1` | Focus and limited status panels |
| Navy on Clay | `5.13:1` | Favorite labels and warm accents |

Forest text should not be used at small sizes directly on the darker Parchment panel because that combination is only `4.09:1`; use Deep Forest there. Moss and Leaf should not carry small white text. Use them for map markers, rating graphics, charts, borders, or backgrounds paired with near-black text.

### Marker and status colors

Favorite and review progress are overlays, not mutually exclusive visit states. For example, a museum may be **Visited**, **Favorite**, and **Awaiting Partner Review** at the same time.

| Meaning | Role | Color | Icon or shape | Text label |
|---|---|---|---|---|
| Search result / not saved | Base state | `slate-600` | Museum outline | Not saved |
| Want to Visit | Visit state | `moss-600` | Bookmark | Want to Visit |
| Planned | Visit state | `dusk-700` | Calendar | Planned |
| Visited | Visit state | `forest-600` | Check | Visited |
| Favorite | Independent overlay | `clay-400` with Navy | Star overlay | Favorite |
| Awaiting my review | Review overlay | `taupe-500` with dotted ring | Pencil | Your review is needed |
| Awaiting partner review | Review overlay | `slate-600` with dashed ring | Clock | Waiting for partner |
| Current location | Location indicator | `navy-900` | Pulsing dot with ring | Your location |
| Manually added | Verification state | `forest-900` | Pin with plus | Manually added |

## 4. Typography

### Font families

- **All product typography:** `Poppins`, Arial, Helvetica, sans-serif.
- **Scores and map statistics:** Poppins with tabular numerals.

The reference source uses Poppins throughout. Headings gain hierarchy through size and weight, not by switching type families.

### Type scale

| Style | Size / line height | Weight | Use |
|---|---:|---:|---|
| Display | `30 / 38` | 600 | Login and exceptional page introduction |
| Page title | `26 / 34` | 500 | Centered page heading |
| Section title | `24 / 32` | 700 | Major panel section |
| Card title | `21 / 26` | 700 | Museum title pill |
| Metric | `32 / 36` | 700 | Passport statistics and shared score |
| Navigation | `18 / 36` | 500 | Desktop top navigation |
| Action | `18 / 24` | 500 | View and primary card actions |
| Body Large | `18 / 27` | 400 | Introductory tag line |
| Body | `14 / 21` | 400 | Default reading text |
| Label | `14 / 20` | 600 | Controls and form labels |
| Small | `13 / 19` | 500 | Supporting information |
| Metadata | `12 / 16` | 800 | Uppercase categories and compact labels |
| Caption | `11 / 16` | 600 | Timestamps and compact map details |

### Typography rules

- Limit long review text to approximately 70 characters per line.
- Use sentence case for long actions and labels.
- Use uppercase for top navigation, compact card actions, and very short metadata pills.
- Longer actions such as **View details** and **Submit review** remain sentence case.
- Add `0.06em` to `0.10em` letter spacing only to uppercase metadata.
- Keep page headings compact; the normal centered page title is 26 pixels and medium weight.
- Never place essential text inside photographs.

## 5. Layout and spacing

### Spacing scale

Use a four-pixel base:

`4, 8, 12, 16, 24, 32, 40, 48, 64, 80`

### Grid

- Maximum discovery-grid width: `1058px`.
- Header content width: approximately `994px`.
- Desktop: 12 columns with `24px` gutters.
- Tablet: 8 columns with `20px` gutters.
- Mobile: 4 columns with `16px` gutters.
- Standard page padding: `24px` desktop and `16px` mobile.
- Desktop header height: `66px`.
- Short-page footer height: approximately `112px`.

### Forum layout

- Main feed: `minmax(0, 680px)`.
- Context sidebar: `354px`.
- Gap: `24px`.
- Use the top navigation for primary destinations; do not add a permanent left sidebar to ordinary visitor pages.
- Compact museum discovery cards use the three-column grid. Story-heavy visit posts use one main column plus the context sidebar; do not introduce a second competing forum-grid rule.

### Map layout

- Desktop: place the map and results inside one large Parchment panel with a two-pixel Forest outline and 28-pixel corners. The map occupies approximately 62 percent and the result panel 38 percent.
- Tablet: map and list may switch through tabs.
- Mobile: full-screen map with a draggable bottom sheet and a permanent list-view alternative.

### Shape and elevation

| Token | Value | Use |
|---|---:|---|
| `radius-highlight` | `8px` | Highlighted word in a page heading |
| `radius-nav` | `9px` | Desktop navigation state |
| `radius-sm` | `12px` | Inputs and compact controls |
| `radius-md` | `16px` | Buttons, title tiles, and inner cards |
| `radius-panel` | `28px` | Structural panels and mobile sheets |
| `radius-card` | `30px` | Museum discovery cards |
| `radius-full` | `999px` | Avatars and filter chips |
| `shadow-1` | `none` | Dashboard statistics and ordinary inner cards |
| `shadow-2` | `14px 14px 28px rgba(69,114,87,.22)` | Primary card and map drawer |
| `shadow-3` | `0 20px 44px rgba(22,65,53,.18)` | Dialog |

Discovery cards use `shadow-2`. Dashboard panels and statistics rely on outlines and use no resting shadow. Inner cards use a one- or two-pixel Forest outline at reduced opacity.

## 6. Iconography and imagery

### Icons

- Use a consistent rounded-outline icon family.
- Standard sizes: 16, 20, and 24 pixels.
- Use a 2-pixel stroke at 24 pixels.
- Default icon color is Forest; strong emphasis may use Deep Forest.
- Feature icons sit inside a 48- to 55-pixel rounded tile. Use subtle palette-derived blue-gray, sage, clay, or moss tints for small icon tiles while keeping the surrounding interface cream and green.
- Pair unfamiliar icons with visible labels.
- Do not use emoji as primary navigation or status icons.

### Photography

- Discovery-card thumbnail: square, normally `56 by 56` pixels, inside a near-white outlined tile.
- Forum post preview: `3:2`.
- Museum detail hero: `16:9`, with an uncropped gallery available.
- Do not use photographs as full-card backgrounds in the primary discovery grid.
- Preserve natural colors; avoid aggressive filters that alter artwork.
- Every meaningful image requires editable alternative text.
- Show photographer or source attribution when the image is not owned by either user.

## 7. Navigation

### Desktop navigation

Primary destinations:

1. Map
2. Feed
3. Wishlist
4. Passport
5. Profile

Do not place a search field, notification cluster, or separate primary call-to-action in the fixed header. Search belongs inside the Map or Feed page. **Log a Visit** uses the floating contextual action or an in-page action.

The navigation bar is 66 pixels high with a one-pixel Line border. Its contents occupy an approximately 994-pixel centered row. The logo stays on the left; the primary navigation stays on the right. Desktop navigation items are 126 by 36 pixels, use 18-pixel medium Poppins, and have a 9-pixel radius with 12-pixel gaps. Unselected items use Forest text. The active destination uses a solid Forest rounded rectangle with white text.

### Mobile navigation

Use a bottom navigation bar:

1. Map
2. Feed
3. Add
4. Passport

The Add action may be visually emphasized but must keep a visible text label.

### Active state

Active navigation uses a short solid Forest rounded rectangle, white text, and a supporting icon only when needed. Unselected navigation uses Forest text on the Chrome background. Hover alone must not be the only indication.

### Reference-derived page patterns

#### Centered page title

Page introductions are centered, uppercase, and compact. One short word may be highlighted in a Forest rounded rectangle with white text, following the reference treatment. Do not highlight multiple words or turn the heading into a banner.

#### Museum discovery grid

- Three equal columns on desktop, two on tablet, and one on mobile.
- Desktop grid width: `1058px`; columns: `325px`; column gap: `41px`; row gap: `34px`.
- Desktop card size: `325 by 205px`.
- Parchment card with a two-pixel Forest outline, 30-pixel radius, and `shadow-2`.
- Main row contains a `66 by 54px` thumbnail tile and a white outlined museum-name control.
- Museum-name control is 38 pixels high, uses a 16-pixel radius, and displays a 21-pixel bold title.
- Footer row is separated by a thin Forest rule and contains a compact uppercase category pill plus the primary action.
- Footer actions are 33 pixels high with 16-pixel radii. Metadata uses 12-pixel extra-bold Poppins with `0.12em` tracking.
- Cards keep consistent heights within a row.

#### Passport and management layout

- Narrow Parchment sidebar: approximately `208px`.
- Main Parchment panel: remaining width.
- Gap: `22px`.
- Active sidebar item: solid Forest rounded rectangle with white text.
- Main-panel padding: approximately `22px 24px 24px`.
- Statistics appear as a three-column grid with approximately 15-pixel gaps.
- Statistic cards use Warm Surface, a soft Forest outline, 14- to 16-pixel corners, and no resting shadow.
- Every statistics card includes a small label at the upper left, a roughly 55-pixel tinted icon tile at the upper right, a prominent metric, no more than two supporting lines, and a **View details** action anchored near the bottom.

#### Floating action

The main contextual action, normally **Log a Visit**, may appear as a fixed pill near the lower-right corner on large screens. It uses Parchment, a Forest outline, an icon, and Forest text. It must not cover map controls, mobile navigation, or form actions.

#### Footer

Short pages use a full-width Chrome band approximately 100 to 112 pixels tall, separated by a one-pixel Line rule. Inside the centered row:

- left: one short brand statement;
- center: copyright text;
- right: circular secondary-link icons and a short tagline.

Do not turn the footer into a multi-column sitemap.

## 8. Core components

### Buttons

#### Variants

- **Primary:** Forest background, white text.
- **Secondary:** Near-white surface, Deep Forest text, Forest outline.
- **Tertiary:** Transparent background, Forest text.
- **Danger:** Soft warm/blush treatment with a muted error icon for ordinary destructive affordances. Use solid Error Red only in the final confirmation action.
- **Icon button:** Only for familiar actions; include an accessible name and tooltip.

Compact card actions use a 16-pixel rounded rectangle, matching the reference. Full pill shapes are reserved for flexible filter chips, status badges, and the floating action. Large form-submission buttons use `radius-md`.

#### Sizes

- Small: `32px` minimum height.
- Medium: `40px` minimum height.
- Large and mobile primary: `48px` minimum height.

All buttons need default, hover, focus, pressed, loading, and disabled states.

### Text fields and search

Every field includes:

- persistent label;
- optional supporting text;
- clear focus ring;
- visible validation message;
- error icon and text, not color alone;
- sufficient spacing for autofill and password-manager controls.

The museum search field can accept a museum name, city, or area. Search results must support keyboard selection.

### Filter chips

Filter-chip states:

- Unselected
- Selected
- Focused
- Disabled
- Removable

Common filters include distance, museum category, rating, Want to Visit, Planned, Visited, Favorite, and Awaiting Review.

### Status badge

Each badge combines a semantic icon, text label, and tinted background. Never present status as an unexplained colored dot.

### Museum map marker

#### Anatomy

1. Pin silhouette
2. Museum-status icon
3. Optional combined-score label
4. Focus or hover halo
5. Selected outer ring
6. Optional Favorite or review-status overlay

#### States

- Default
- Hovered
- Keyboard focused
- Selected
- Clustered
- Loading
- Visited but awaiting the current user's review
- Visited but awaiting the partner's review
- Manually added or unverified
- Unavailable because the map service failed

Favorite is rendered as a star overlay and never replaces Want to Visit, Planned, or Visited. Current location uses a circular location indicator rather than a museum-pin shape.

Marker clusters show a count and inherit no single museum status. Selecting a cluster zooms or opens an accessible result list.

### Map visual treatment

- Place the map inside a Parchment panel with a two-pixel Forest outline and 28-pixel corners.
- Use a low-saturation, light map style so markers remain visually dominant.
- Style zoom, locate, filter, and layer controls as near-white rounded tiles with Forest icons and outlines.
- Avoid the provider's default saturated blue markers.
- Open the selected museum in a Parchment or near-white side card rather than a dark map popup.
- Preserve the same cream, green, rounded, and outlined visual language when the external map is loading or unavailable.
- Navy, Dusk, Moss, and other semantic colors remain small marker or icon accents; they do not become large map panels or page backgrounds.

### Museum preview card

The compact card opened from a marker contains:

- museum name;
- category and address;
- distance when location permission is active;
- combined rating or review-pending state;
- visit-status control;
- last or planned visit date;
- `View museum` and `Log visit` actions.

### Museum card

The full discovery card follows the reference composition:

- Parchment background, two-pixel Forest outline, 30-pixel corners, and `shadow-2`.
- Top region contains a `66 by 54px` museum thumbnail tile plus the museum name inside a 38-pixel-high pure-white outlined control.
- Bottom action row is separated by a thin Forest rule.
- Left side of the action row contains an uppercase museum-category or visit-status pill.
- Right side contains a compact **View** or **Log Visit** pill.

Do not add location, shared score, or visit count to this compact card. Those details belong in the map preview or museum-detail view. The entire card may not be a single link if it also contains buttons; use one clearly labeled title link and separate controls.

### Visit post card

The forum card contains:

- author and timestamp;
- museum and exhibition name;
- visit date;
- lead photograph or gallery preview;
- story excerpt;
- review state;
- combined score after reveal;
- reactions and comment count;
- overflow menu for edit, report, or delete actions.

Visit posts use a Parchment outer panel and Warm Surface content area. The museum name, visit category, and status use outlined rounded controls. Reactions and comments sit in a distinct footer row separated by a Forest rule. Avoid a generic social-media look with edge-to-edge imagery, dark action bars, or dense icon-only controls.

### Dual-review panel

#### Rating lifecycle

1. Neither person has rated.
2. Current user has an incomplete draft.
3. Current user submitted; partner is pending.
4. Partner submitted; current user is pending.
5. Both submitted; simultaneous reveal is available.
6. A revealed review was edited and the combined score was recalculated.
7. A review was deleted or became unavailable.

Before both reviews are complete:

- show the current user's submitted status;
- show **Waiting for your partner's review** for the other side;
- do not reveal scores, selected stars, or score-derived colors.

After both reviews are complete:

- reveal both reviews simultaneously;
- give each review equal width and visual weight;
- display a combined score as a separate shared result;
- clearly label the author of each review;
- preserve each person's written review without merging it automatically.
- identify when a revealed review was edited and when the shared score was recalculated.

On mobile, reviews stack vertically in a consistent order and include a **Compare ratings** summary.

If a submitted review is deleted, preserve the remaining person's review and replace the combined score with **Waiting for both reviews**.

### Rating input

Use a five-point star scale with text labels:

1. Disappointing
2. Needs improvement
3. Worth a visit
4. Excellent
5. Unforgettable

The selected value must appear as text, not only filled stars. Support arrow keys, direct number-key selection, touch, and screen-reader instructions. A reset option must be available before submission.

The combined overall score is:

`Combined score = (Partner A overall rating + Partner B overall rating) / 2`

Display the shared score to one decimal place only after both reviews are submitted.

### Review criteria

The initial rating form contains:

- Collection and exhibits
- Curation and storytelling
- Architecture and atmosphere
- Visitor experience
- Accessibility
- Value for money
- Overall experience
- Would visit again: Yes, Maybe, or No

Use progressive disclosure so the form does not present every control at once on a small screen.

### Comment thread

- Replies indent once only; deeper conversations remain visually flat.
- Show author, timestamp, edited state, and reply action.
- Allow users to edit or delete only their own comments.
- Confirm destructive actions.
- Preserve keyboard focus after posting, editing, or deleting.

### Reaction control

Initial reactions:

- Like
- Love
- Insightful
- Surprised

Each reaction includes an icon, accessible label, selected state, and count. Do not notify users repeatedly when a reaction is toggled.

### Add or edit visit form

Use a four-step flow:

1. Museum and visit date
2. Exhibition and story
3. Photographs and captions
4. Private review and publish confirmation

Show progress, save a draft, preserve entered data after validation errors, and allow movement back to earlier steps.

### Photo uploader

The uploader supports drag-and-drop and a standard file picker, but never requires dragging. It shows:

- accepted file types and size limits;
- thumbnail, filename, upload progress, and editable alternative text;
- retry and remove actions;
- invalid-type, oversized-file, network-failure, and storage-failure states;
- confirmation before removing an already published photograph.

### Dialogs, sheets, and notifications

- Use dialogs for decisions requiring focused confirmation.
- Use a bottom sheet for mobile map results and quick actions.
- Use toasts only for brief confirmations such as **Visit saved**.
- Errors requiring action remain visible near the affected field or panel.

## 9. Data visualization

Passport statistics may use bars, lines, maps, and small comparison charts.

- Always pair chart colors with labels or patterns.
- Start bar charts at zero.
- Do not exaggerate small rating differences.
- Show the number of reviews behind every average.
- Avoid competitive language that suggests one partner's opinion is more correct.

Initial statistics:

- Museums visited
- Cities explored
- Museum categories visited
- Average shared rating
- Favorite museum
- Museums awaiting a partner review
- Wishlist and planned visits
- Rating differences by category

## 10. Motion and feedback

### Duration tokens

- Micro feedback: `120ms`
- Standard transition: `200ms`
- Panel or sheet movement: `320ms`

Use motion for map selection, expanding reviews, saving feedback, and sheet transitions. Avoid decorative scroll-jacking and continuous parallax.

When reduced motion is requested:

- remove marker bounce;
- replace movement with opacity changes;
- open panels without sliding across large distances;
- keep all state changes immediate and understandable.

### Loading

- Use skeletons only when the final structure is known.
- Preserve the map viewport while results load.
- Show upload progress for photographs.
- Never replace a submitted review with an indefinite spinner.

### Map and service failures

- **Location denied:** retain search and manual map movement; explain how to enable location without blocking the page.
- **Offline:** retain previously loaded museum cards when available and disable actions requiring the network.
- **Map unavailable:** show the museum-result list with addresses and statuses.
- **Place search unavailable:** allow manual museum entry.
- **No results:** suggest changing the search area or adding the museum manually.
- **Possible duplicate:** compare name, address, and coordinates before creating another museum record.

## 11. Responsive behavior

Tablet and mobile patterns are necessary extensions of the desktop references. They must reuse the same three native shapes: outlined Parchment panels, Warm Surface inner cards, and compact rounded controls.

### Desktop

- One main forum column with one restrained context sidebar.
- Three-column layout is reserved for compact museum discovery cards and passport statistics.
- Map and result panel visible together.
- Dual reviews appear side by side.
- Filters may remain in a persistent sidebar.

### Tablet

- Two-column feed or map-plus-panel layout.
- Secondary statistics move below primary content.
- Filters open in a dismissible drawer.

### Mobile

- Single-column feed.
- Full-screen map with bottom-sheet results.
- Sticky bottom navigation.
- Dual reviews stack vertically.
- Rating targets remain at least 44 by 44 pixels.
- Important actions stay outside device safe-area insets.
- No hover-only content or drag-only map controls.

## 12. Accessibility requirements

- Meet WCAG AA contrast for text and interactive controls.
- Provide a visible two-pixel Navy focus ring with a white separation halo so it remains visible on light and dark surfaces.
- Keep minimum touch targets at 44 by 44 pixels.
- Provide a searchable list alternative to every map view.
- Make map markers, result cards, ratings, dialogs, and media controls keyboard accessible.
- Move focus to the relevant heading when a museum detail panel opens.
- Use semantic headings, landmarks, buttons, links, lists, and form labels.
- Announce rating-reveal and save-result changes through an appropriate live region.
- Provide alternative text, video captions, and audio transcripts.
- Never communicate visit status, rating, validation, or chart meaning through color alone.
- Respect reduced-motion, browser zoom, text resizing, and high-contrast preferences.

## 13. Privacy and trust patterns

- Display **Private to both of you** near post-publishing controls.
- Ask for device location only after the user selects **Museums near me**.
- Do not store continuous or background location history.
- Distinguish the public museum address from the users' private visit information.
- Explain whether an uploaded photograph contains location metadata before processing it.
- Use confirmation for permanent deletion and identify exactly what will be removed.
- Allow either partner to edit or delete their own review while preserving the other person's content.
- Never use manipulative streaks, guilt messages, or competitive partner rankings.

## 14. Voice and content

### Voice

Warm, specific, curious, and neutral.

### Preferred language

- **Log a visit**
- **Want to Visit**
- **Waiting for your partner's review**
- **Both reviews are ready**
- **Would you visit again?**
- **No museums match these filters**

### Avoid

- **You failed to review**
- **Your partner rated better**
- **Bad museum**
- **You must enable location**
- unexplained technical errors or provider names

### Empty-state example

**Your passport is ready for its first stamp.**  
Explore the map or add a museum you already visited.

## 15. Design tokens

```css
:root {
  --color-forest-deep: #164135;
  --color-forest: #457257;
  --color-moss: #629007;
  --color-leaf: #618933;
  --color-parchment: #eedda9;
  --color-clay: #bb9d7d;
  --color-taupe: #8e837a;
  --color-slate: #54696d;
  --color-dusk: #474a65;
  --color-navy: #1e3054;

  --color-background: #efede0;
  --color-chrome: #e5e1cf;
  --color-surface: #f3f5f2;
  --color-surface-warm: #fbf6e8;
  --color-surface-pure: #ffffff;
  --color-panel: #eedda9;
  --color-border: #aeb3a7;
  --color-border-strong: #457257;
  --color-border-soft: rgba(69, 114, 87, 0.35);
  --color-text: #164135;
  --color-text-muted: #457257;
  --color-primary: #457257;
  --color-primary-hover: #164135;
  --color-rating: #629007;
  --color-want-to-visit: #629007;
  --color-planned: #474a65;
  --color-visited: #457257;
  --color-favorite: #bb9d7d;
  --color-review-pending: #8e837a;
  --color-danger: #9a3232;
  --color-focus: #1e3054;

  --font-display: "Poppins", Arial, Helvetica, sans-serif;
  --font-interface: "Poppins", Arial, Helvetica, sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  --radius-highlight: 8px;
  --radius-nav: 9px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-panel: 28px;
  --radius-card: 30px;
  --radius-full: 999px;

  --border-strong: 2px solid var(--color-border-strong);
  --shadow-card: 14px 14px 28px rgba(69, 114, 87, 0.22);
  --layout-max: 1058px;
  --header-content: 994px;
  --header-height: 66px;

  --motion-fast: 120ms;
  --motion-standard: 200ms;
  --motion-panel: 320ms;
}
```

## 16. Required wireframe coverage

The wireframe submission must demonstrate the design system in these states:

1. Private login
2. Desktop forum feed
3. Mobile forum feed
4. Interactive map with status markers and filter panel
5. Mobile map with museum bottom sheet
6. Museum detail with visit history
7. Visit post before both reviews are submitted
8. Dual-review reveal after both reviews are submitted
9. Add Visit form
10. Museum Passport statistics and empty states

## 17. Submission checklist

- [x] Product name, promise, personality, and design principles
- [x] Strict reference-fidelity and prohibited-style rules
- [x] Logo direction and usage rules
- [x] Supplied ten-color palette and semantic status assignments
- [x] Accessible text combinations
- [x] Source-verified single-family Poppins typography scale
- [x] Grid, spacing, radius, and elevation
- [x] Header, footer, centered title, discovery grid, dashboard, and floating-action patterns
- [x] Navigation patterns
- [x] Map-marker and map-panel states
- [x] Forum, post, comment, reaction, and form components
- [x] Independent and combined-rating states
- [x] Responsive behavior
- [x] Accessibility, privacy, motion, and content guidance
- [x] Reusable design tokens
