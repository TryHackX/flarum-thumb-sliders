<?php

namespace TryHackX\ThumbSliders;

use Flarum\Extend;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Api\Endpoint;
use Flarum\Api\Context;
use Flarum\Discussion\Discussion;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\ApiResource(DiscussionResource::class))
        // Add thumbImages array attribute to Discussion API response
        ->fields(fn () => [
            Schema\Arr::make('thumbImages')
                ->get(function (Discussion $discussion, Context $context) {
                    try {
                        $firstPost = $discussion->firstPost;

                        if (!$firstPost || $firstPost->type !== 'comment') {
                            return [];
                        }

                        // Get the raw XML content from the database
                        $rawXml = $firstPost->getRawOriginal('content');

                        if (empty($rawXml)) {
                            return [];
                        }

                        // Get settings
                        $settings = resolve('flarum.settings');
                        $maxImages = (int) $settings->get('tryhackx-thumb-sliders.max_images', 10);

                        // Try fast XML extraction first (no rendering needed)
                        $images = ImageExtractor::extractFromXml($rawXml, $maxImages);

                        // If no images found via XML, fall back to full HTML rendering
                        if (empty($images)) {
                            $formatter = resolve(\Flarum\Formatter\Formatter::class);
                            $html = $formatter->render($rawXml, $firstPost);

                            $minSize = (int) $settings->get('tryhackx-thumb-sliders.min_img_size', 50);
                            $maxSize = (int) $settings->get('tryhackx-thumb-sliders.max_img_size', 5000);

                            $images = ImageExtractor::extract($html, $minSize, $maxSize, $minSize, $maxSize, $maxImages);
                        }

                        return $images;
                    } catch (\Throwable $e) {
                        return [];
                    }
                }),
        ])
        // Ensure firstPost is always included in discussion list API responses
        ->endpoint(Endpoint\Index::class, function (Endpoint\Index $endpoint) {
            return $endpoint->addDefaultInclude(['firstPost']);
        }),

    // Register default settings
    (new Extend\Settings())
        ->default('tryhackx-thumb-sliders.min_img_size', 50)
        ->default('tryhackx-thumb-sliders.max_img_size', 5000)
        ->default('tryhackx-thumb-sliders.max_images', 10)
        ->default('tryhackx-thumb-sliders.slider_width', 150)
        ->default('tryhackx-thumb-sliders.autoplay_speed', 1200)
        ->default('tryhackx-thumb-sliders.enabled', true)
        ->serializeToForum('thumbSlidersSliderWidth', 'tryhackx-thumb-sliders.slider_width')
        ->serializeToForum('thumbSlidersAutoplaySpeed', 'tryhackx-thumb-sliders.autoplay_speed')
        ->serializeToForum('thumbSlidersEnabled', 'tryhackx-thumb-sliders.enabled', function ($value) {
            return (bool) $value;
        }),
];
