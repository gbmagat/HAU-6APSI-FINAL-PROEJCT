# Our Places Passport

## Final Project Proposal

**Course:** Application and Systems Integration  
**Prepared by:** GB Magat  
**Submission:** Part 1 - Proposal

## 1. Purpose and audience

**Our Places Passport gives GB Magat and his girlfriend a private way to discover places in the Philippines, plan where to go, record shared experiences, and compare independent reviews without scattering their plans, photographs, and notes across separate applications.**

The audience is exactly two invited members: the student and his girlfriend. The website can include museums, restaurants, cafes, parks, attractions, and other places they want to experience together.

The first release integrates private authentication, place and location data, experience records, photograph storage, independent ratings, comments, reactions, and calculated passport statistics.

Public registration, public reviews, direct messaging, reservations or ticket purchasing, turn-by-turn navigation, artificial-intelligence recommendations, and a native mobile application are excluded.

## 2. Five core screens

| Screen / route | Reason to exist |
|---|---|
| **Discover Map - `/map`** | Finds museums, restaurants, cafes, parks, attractions, and other destinations by name, city, category, or current area. It also shows Want to Visit, Planned, and Visited states and includes a list alternative to the map. |
| **Experience Feed - `/feed`** | Keeps the couple's shared experiences in chronological order and makes stories, photographs, review progress, reactions, and comments easy to revisit. |
| **Place Detail - `/places/[id]`** | Stores one real place separately from its dated experiences, preventing duplicate map records and keeping every visit to the same place together. |
| **Log an Experience - `/experiences/new`** | Captures the place, date, category-specific details, story, private photographs, and one member's independent review. |
| **Our Passport - `/passport`** | Calculates places visited, cities explored, categories experienced, favorites, planned destinations, shared ratings, and reviews still awaiting a member. |

Private sign-in protects the five screens. Wishlist and profile controls remain focused states inside them instead of becoming overlapping routes.

## 3. State and content plan

| Screen | Screen-owned state | Data used | Real content to gather |
|---|---|---|---|
| **Discover Map** | Search query, category and status filters, selected marker, map viewport, location permission, loading, empty, offline, and provider-error states | Place ID, name, category, address, city, coordinates, provider ID, visit state, Favorite flag, review progress, and revealed shared score | Verified records for at least 12 Philippine places across at least four categories, including addresses, coordinates, categories, attribution, and one manual fallback record |
| **Experience Feed** | Feed filter, expanded review, selected reactions, comment draft, reply target, and load-more position | Author, timestamp, place, category, experience date, story, photographs, captions, alternative text, review state, score, reactions, and comments | Four to six real shared experiences, two to five owned photographs per experience, captions, alternative text, and authentic comments from both members |
| **Place Detail** | Selected experience, Favorite and visit-status controls, review comparison, and plan-a-visit dialog | Canonical place record, linked experiences, category-specific information, each member's reviews, shared scores after reveal, planned date, and Favorite state | Official place information, a representative owned or attributed image, visit dates, relevant category details, and one completed pair of reviews |
| **Log an Experience** | Current form step, selected category, draft values, validation errors, upload progress, retry/removal, private-review draft, and confirmation | Place ID, date, category, story, cost or ticket note, private photos, captions, alternative text, rating criteria, revisit answer, author, and timestamps | Actual visit details, a short shared story, original photographs with location metadata removed, and separate ratings from both members |
| **Our Passport** | Active statistic, time and category filters, chart/list choice, and new-passport empty state | Totals derived from places, experiences, cities, categories, favorites, planned dates, revealed reviews, and pending reviews | No separate statistics; every value is calculated from stored place, experience, and review records |

One place may have many dated experiences. Each member may submit one review per experience. The shared score stays hidden until both reviews are submitted:

`Combined score = (Member A overall rating + Member B overall rating) / 2`

Every review includes an overall rating and a written reflection. Additional criteria depend on the place category. For example, museums may use collection and curation, while restaurants may use food, service, atmosphere, and value.

Favorite is independent from Want to Visit, Planned, or Visited.

## 4. One genuine risk

**Risk:** Place discovery depends on an external search and map provider whose pricing, request limits, attribution rules, or coverage across different place categories may not fit a student project. Incomplete or duplicate provider records could split one place's experience history.

**Response:** Provider calls will sit behind one adapter, required attribution will remain visible, and the application will compare normalized names, addresses, categories, and coordinates before saving a new place. A searchable list and manual-place fallback will remain available. Candidate providers will be tested using the same set of Philippine museums, restaurants, cafes, parks, and attractions before one is selected.
