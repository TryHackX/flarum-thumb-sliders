import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import ThumbSlider from './components/ThumbSlider';

app.initializers.add('tryhackx-thumb-sliders', () => {
  // Extend contentItems to add the thumbnail slider on the left
  extend(DiscussionListItem.prototype, 'contentItems', function (items) {
    // Check if extension is enabled
    const enabled = app.forum.attribute('thumbSlidersEnabled');
    if (enabled === false) return;

    const discussion = this.attrs.discussion;
    const images = discussion.attribute('thumbImages');

    if (!images || !Array.isArray(images) || images.length === 0) return;

    const sliderWidth = parseInt(app.forum.attribute('thumbSlidersSliderWidth')) || 130;
    const autoplaySpeed = parseInt(app.forum.attribute('thumbSlidersAutoplaySpeed')) || 1200;

    items.add(
      'thumbSlider',
      <ThumbSlider
        images={images}
        sliderWidth={sliderWidth}
        autoplaySpeed={autoplaySpeed}
      />,
      110 // Higher priority than authorAvatar (100) so it renders first (leftmost)
    );
  });
});
