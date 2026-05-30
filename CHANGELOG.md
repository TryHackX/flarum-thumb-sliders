# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.7] - 2026-05-30

### Added
- Admin select setting **Replace avatar with thumbnail**
  (`tryhackx-thumb-sliders.avatar_mode`, default *off*) with three modes:
  - `none` — show both avatar and thumbnail.
  - `with_image` — hide the avatar only when the discussion has a real
    extracted image (fallbacks still show the avatar).
  - `always` — always hide the avatar so the thumbnail (or its configured
    fallback) takes its place. If both image and fallback are missing the
    avatar is kept, so the row is never empty.
- **Shared restructured layout module** for `DiscussionListItem`
  (`js/src/forum/discussionListLayout.js`) mirrored with
  `flarum-topic-rating`. Overrides `contentView()` (not the whole `view`)
  so slidable, the controls dropdown and the rest of core stay intact.
  Builds a clean flex row `[thumb][author][main][meta]` and extracts
  known keys (`thumbSlider`, `rating`, `discussion-views`, `tags`) from
  the standard ItemLists into a right-side meta column. Installs
  idempotently behind a global guard, regardless of which extension
  initialises first.

### Changed
- LESS for the discussion list was rewritten on top of the new layout:
  no more `.LayoutFixes()` mixin with absolute `top:`/`right:` offsets,
  no more `:has()` permutations for tag/rating/views/replies. The
  remaining feature CSS (slider visuals, fallback placeholder, dark
  theme) is unchanged.
- Mobile content padding is now `10px 6px 10px 6px` (was `10px 12px 10px 0`)
  so the thumbnail is no longer pinned to the very edge of the viewport.
- Desktop content padding aligned to the same horizontal rhythm:
  `12px 6px 12px 6px` (was `12px 16px 12px 0`), so the row breathes
  evenly on both sides on every viewport.
- Override of core's tablet+ `.DiscussionListItem` padding from
  `25 / 15` to a symmetric `12 / 12` so the outer row padding matches
  the inner content padding (no more uneven left/right gap on desktop).
- Cap the right meta column at `max-width: 18%` on the restructured
  layout, so a discussion with many tags wraps them down inside the
  narrow column instead of pushing the row wider. Tags themselves keep
  the natural `flex-wrap: wrap` behaviour. (We briefly tried mirroring
  core's `flarum/tags` truncate-with-hover-expand from
  `flarum/tags/less/forum.less` on the meta-item, but it didn't feel
  right in the meta-column context and isn't shipped in this release.)
- A scoped override sets `.DiscussionListItem-main { padding-right: 4px }`
  on phone and `.DiscussionListItem-title { margin-right: 32px }` on
  desktop (inside the restructured layout), overriding core /
  `flarum/tags` values so they survive a fresh install of either.
- Magnet-link integration: the list tooltip now only fires when the
  discussion's first post actually contains a `<MAGNET>` tag, so
  hovering a non-magnet discussion no longer flashes a "Loading magnet
  info…" tooltip. (Implemented in `flarum-magnet-link`; the layout
  module preserves `.DiscussionListItem-main` so the magnet tooltip
  hook keeps working.)

### Fixed
- **Cancel button in core's "Reset extension settings" modal** now
  uses Flarum's standard `Button--inverted` style so it doesn't render
  as a plain borderless button. Implemented with a small
  `MutationObserver` that adds the `Button--inverted` class to the
  Cancel button when the modal appears in the DOM (the modal class
  is lazy-loaded by core and not statically importable, so we can't
  extend its prototype directly). Each TryHackX extension registers
  this independently; repeated `classList.add` of the same class is
  a no-op.
- The `flarum-magnet-link` tooltip's mouse hook depends on
  `.DiscussionListItem-main`; the new `contentView` override re-emits
  that element verbatim, so magnets keep working when the layout is
  active.
- Avatar size on the mobile restructured layout is set explicitly
  (`.Avatar--size(30px)`) instead of relying on a chain of cascading
  overrides.

## [2.0.1] - 2026-04-09

### Changed
- Moved support button to the top of the admin settings page.
- Removed margin-top / padding-top / border-top CSS from the support
  button section.

## [2.0.0] - Initial tracked release

### Added
- Animated thumbnail image slider for the discussion list.
- Automatic image extraction from first post content.
- Smooth fade + scale animation with CSS transitions.
- Lazy loading with IntersectionObserver.
- Smart layout integration with topic-rating, magnet-link, and
  discussion-views extensions.
- Responsive design with mobile scaling.
- Dark mode support.
- Configurable image dimension filters.
- Admin panel settings for slider width, autoplay speed, max images, and
  dimension limits.
