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
 */

import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import Link from 'flarum/common/components/Link';
import listItems from 'flarum/common/helpers/listItems';
import highlight from 'flarum/common/helpers/highlight';
import classList from 'flarum/common/utils/classList';

const LAYOUT_VERSION = 1;

export default function installDiscussionListLayout() {
  const registry = (window.tryhackxDLL = window.tryhackxDLL || {});

  // Idempotent: whichever of THUMBS / RATINGS initializes first installs the
  // single override; the other no-ops. Render-time detection (below) handles
  // which features are actually active.
  if (registry.installed) return;
  registry.installed = true;
  registry.version = LAYOUT_VERSION;

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
    const meta = [];
    if (tags) meta.push(<div className="DiscussionListItem-meta-item DiscussionListItem-meta-item--tags">{tags}</div>);
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
        </Link>
        <div className="DiscussionListItem-meta">{meta}</div>
      </div>
    );
  });
}
