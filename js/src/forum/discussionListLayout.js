/**
 * SHARED DISCUSSION-LIST LAYOUT MODULE
 * ------------------------------------------------------------------
 * Identical copy lives in BOTH:
 *   - tryhackx/flarum-thumb-sliders/js/src/forum/discussionListLayout.js
 *   - tryhackx/flarum-topic-rating/js/src/forum/discussionListLayout.js
 * Keep them in sync. Bump LAYOUT_VERSION when the behaviour changes.
 *
 * Purpose: replace the fragile absolute-positioning CSS lattice in the
 * DiscussionListItem with a single, semantic flex/grid structure that the
 * three coordinated features (THUMBS / RATINGS / VIEWS) and tags drop into.
 *
 * It overrides `contentView()` (NOT the whole `view()`), so slidable and the
 * controls dropdown keep working untouched. Inside, it still calls the normal
 * ItemList builders (`contentItems()`, `infoItems()`, `statsItems()`) so that
 * foreign injectors keep working:
 *   - VIEWS (fof/discussion-views) -> infoItems 'discussion-views'
 *   - tags  (flarum/tags)          -> infoItems 'tags'
 *   - THUMBS                       -> contentItems 'thumbSlider'
 *   - RATINGS                      -> infoItems 'rating'
 * Detection = presence of the key in the ItemList, so every combination of the
 * trio is handled automatically. When none of the coordinated keys are present
 * we fall back to the core layout.
 *
 * `.DiscussionListItem-main` is preserved verbatim because flarum-magnet-link
 * reads it from the DOM (hover tooltip).
 *
 * TAGS PLACEMENT (responsive)
 * ---------------------------
 * On tablet/desktop the tags sit in the right-hand meta column (stacked above
 * rating / views / replies). On phones that column is far too narrow, so a
 * discussion with many tags balloons the row height (each tag wraps onto its
 * own line). On phones we therefore render the tags INSIDE
 * `.DiscussionListItem-main`, on their own line right below the author/info
 * line, where they can flex-wrap across the full width of the row. The actual
 * wrapping is done in less/forum.less (`.DiscussionListItem-mobileTags`).
 *
 * Since the breakpoint is evaluated in JS at render time (not via CSS), we also
 * register a one-shot matchMedia listener that triggers a redraw when the
 * viewport crosses the phone breakpoint, so the markup stays correct on resize
 * / orientation change.
 */

import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import Link from 'flarum/common/components/Link';
import listItems from 'flarum/common/helpers/listItems';
import highlight from 'flarum/common/helpers/highlight';
import classList from 'flarum/common/utils/classList';

const LAYOUT_VERSION = 4;

// Must mirror the `@phone` breakpoint in core's less variables (and the
// `@media @phone` blocks in our forum.less): max-width 767.98px.
const PHONE_QUERY = '(max-width: 767.98px)';

export default function installDiscussionListLayout() {
  const registry = (window.tryhackxDLL = window.tryhackxDLL || {});

  // Idempotent: whichever of THUMBS / RATINGS initializes first installs the
  // single override; the other no-ops. Render-time detection (below) handles
  // which features are actually active.
  if (registry.installed) return;
  registry.installed = true;
  registry.version = LAYOUT_VERSION;

  // Redraw when the viewport crosses the phone breakpoint so the tags hop
  // between the meta column (desktop) and the main column (phone). Registered
  // once, guarded by the same `installed` flag above. The redraw alone is not
  // enough — DiscussionListItem's SubtreeRetainer short-circuits re-renders, so
  // we ALSO force a rebuild from onbeforeupdate (below) when the breakpoint
  // actually flips (e.g. phone rotated into landscape past 768px).
  try {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => m.redraw();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange); // Safari < 14 / legacy
  } catch (e) {
    // matchMedia unavailable -> just skip live re-layout on resize.
  }

  // SubtreeRetainer keeps each row from re-rendering unless the discussion's
  // freshness (or read state) changes. That optimization would otherwise pin a
  // row to whichever layout (meta-column vs main-column tags) it first rendered
  // with, so a viewport that crosses the phone breakpoint after mount wouldn't
  // re-flow. Force a rebuild on the render where the breakpoint differs from the
  // value contentView last rendered with.
  //
  // IMPORTANT: the source of truth for "what did we last render" is set in
  // contentView (`this._tryhackxLastPhone`), NOT here. onbeforeupdate is never
  // called on mount — only on updates — so if we initialized the flag here it
  // would capture the *post-flip* breakpoint and silently swallow the very first
  // desktop→phone (or phone→desktop) switch after load. contentView runs on
  // every render including mount, so the flag always reflects the live DOM.
  //
  // NOTE: must be `override` (not `extend`) — `extend` discards the callback's
  // return value, and onbeforeupdate's boolean return is what drives the skip.
  override(DiscussionListItem.prototype, 'onbeforeupdate', function (original, vnode) {
    const shouldUpdate = original ? original(vnode) : undefined;

    let isPhone;
    try {
      isPhone = window.matchMedia(PHONE_QUERY).matches;
    } catch (e) {
      return shouldUpdate;
    }

    // Breakpoint changed since the last render -> override the SubtreeRetainer
    // skip so contentView re-runs and moves the tags. contentView then updates
    // _tryhackxLastPhone to match.
    if (this._tryhackxLastPhone !== undefined && this._tryhackxLastPhone !== isPhone) {
      return true;
    }
    return shouldUpdate;
  });

  override(DiscussionListItem.prototype, 'contentView', function (original) {
    const contentItems = this.contentItems();
    const infoItems = this.infoItems();

    const thumb = contentItems.has('thumbSlider') ? contentItems.get('thumbSlider') : null;
    const rating = infoItems.has('rating') ? infoItems.get('rating') : null;
    const views = infoItems.has('discussion-views') ? infoItems.get('discussion-views') : null;
    const tags = infoItems.has('tags') ? infoItems.get('tags') : null;

    // Nothing for us to relocate -> keep the stock layout.
    if (!thumb && !rating && !views && !tags) {
      return original();
    }

    // Everything that stays under the title (terminalPost / search excerpt).
    infoItems.remove('rating');
    infoItems.remove('discussion-views');
    infoItems.remove('tags');

    const discussion = this.attrs.discussion;
    const isUnread = discussion.isUnread();
    const isRead = discussion.isRead();

    // On phones the tags render inside the main column (full width, flex-wrap)
    // instead of the narrow right-hand meta column. See file header.
    const isPhone = window.matchMedia(PHONE_QUERY).matches;

    // Record what this render is committing to, so onbeforeupdate can detect a
    // later breakpoint flip and force a rebuild (SubtreeRetainer would otherwise
    // skip it). Set here — on every render incl. mount — so it never drifts out
    // of sync with the actual DOM.
    this._tryhackxLastPhone = isPhone;

    // Avatar replacement (thumb-sliders feature). `thumbSlidersAvatarMode` only
    // exists when thumb-sliders is installed; when it is absent we keep the
    // avatar. Modes:
    //   'with_image' -> hide the avatar only when the discussion has a real
    //                   extracted image (fallbacks still show the avatar).
    //   'always'     -> always hide the avatar so the thumb (or its configured
    //                   fallback) stands in for it. If there is no thumb at all
    //                   we keep the avatar, so the row is never left empty.
    const avatarMode = app.forum.attribute('thumbSlidersAvatarMode') || 'none';
    const thumbImages = discussion.attribute('thumbImages');
    const hasRealImage = Array.isArray(thumbImages) && thumbImages.length > 0;
    let showAvatar = true;
    if (avatarMode === 'always') showAvatar = !thumb;
    else if (avatarMode === 'with_image') showAvatar = !hasRealImage;

    // getJumpTo() also sets this.highlightRegExp, consumed by highlight() and
    // by the search excerpt inside infoItems, so it must run first.
    const jumpTo = this.getJumpTo();

    // Right meta column, stacked top-to-bottom: tags, rating, views, replies.
    // On phones the tags are pulled out and rendered in the main column below.
    const meta = [];
    if (tags && !isPhone) meta.push(<div className="DiscussionListItem-meta-item DiscussionListItem-meta-item--tags">{tags}</div>);
    if (rating) meta.push(<div className="DiscussionListItem-meta-item DiscussionListItem-meta-item--rating">{rating}</div>);
    if (views) meta.push(<div className="DiscussionListItem-meta-item DiscussionListItem-meta-item--views">{views}</div>);
    this.statsItems()
      .toArray()
      .forEach((stat) => {
        meta.push(<div className="DiscussionListItem-meta-item DiscussionListItem-meta-item--stat">{stat}</div>);
      });

    return (
      <div
        className={classList('DiscussionListItem-content', 'Slidable-content', 'DiscussionListItem-content--restructured', {
          unread: isUnread,
          read: isRead,
        })}
      >
        {thumb}
        {showAvatar ? this.authorView() : null}
        <Link href={app.route.discussion(discussion, jumpTo)} className="DiscussionListItem-main">
          <h2 className="DiscussionListItem-title">{highlight(discussion.title(), this.highlightRegExp)}</h2>
          <ul className="DiscussionListItem-info">{listItems(infoItems.toArray())}</ul>
          {isPhone && tags ? <div className="DiscussionListItem-mobileTags">{tags}</div> : null}
        </Link>
        <div className="DiscussionListItem-meta">{meta}</div>
      </div>
    );
  });
}
