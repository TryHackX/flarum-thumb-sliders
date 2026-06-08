<?php

namespace TryHackX\ThumbSliders\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Formatter\Formatter;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Log\LoggerInterface;
use TryHackX\ThumbSliders\ImageExtractor;

/**
 * Builds the `thumbImages` attribute on the DiscussionResource.
 *
 * Extracted from extend.php so settings / formatter / logger arrive via
 * constructor injection (resolved once per request) instead of resolve() calls
 * inside a per-model closure, and so the logic is independently testable.
 *
 * Registered via `->fields(DiscussionThumbFields::class)`.
 */
class DiscussionThumbFields
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Formatter $formatter,
        protected LoggerInterface $log
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('thumbImages')
                ->get(fn (Discussion $discussion, Context $context) => $this->imagesFor($discussion)),
        ];
    }

    /**
     * @return array<int, string>
     */
    protected function imagesFor(Discussion $discussion): array
    {
        try {
            $firstPost = $discussion->firstPost;

            if (! $firstPost || $firstPost->type !== 'comment') {
                return [];
            }

            $rawXml = (string) $firstPost->getRawOriginal('content');
            if ($rawXml === '') {
                return [];
            }

            $maxImages = (int) $this->settings->get('tryhackx-thumb-sliders.max_images', 10);

            // Fast path: pull <IMG>/<UPL> straight out of the s9e XML (no render).
            $images = ImageExtractor::extractFromXml($rawXml, $maxImages);

            // Slow path: only fall back to a full HTML render when the post has
            // RICH content that could carry an image the XML scan missed (e.g. an
            // oembed / media-embed thumbnail). s9e TextFormatter roots a pure
            // plain-text post in `<t>…</t>` (no tags at all) and anything with
            // markup in `<r>…</r>`; a `<t>` post can never render an <img>, so
            // skipping the expensive, uncached render for it is free. This is what
            // turned a per-row render on text-only discussion lists into a no-op.
            if (empty($images) && strncmp(ltrim($rawXml), '<t', 2) !== 0) {
                $html = $this->formatter->render($rawXml, $firstPost);

                $minSize = (int) $this->settings->get('tryhackx-thumb-sliders.min_img_size', 50);
                $maxSize = (int) $this->settings->get('tryhackx-thumb-sliders.max_img_size', 5000);

                $images = ImageExtractor::extract($html, $minSize, $maxSize, $minSize, $maxSize, $maxImages);
            }

            return $images;
        } catch (\Throwable $e) {
            // Degrade gracefully (no thumbnail) but leave a breadcrumb rather than
            // swallowing the failure entirely, so real problems are diagnosable.
            $this->log->warning('tryhackx-thumb-sliders: thumbImages extraction failed', [
                'discussionId' => $discussion->id ?? null,
                'exception' => $e,
            ]);

            return [];
        }
    }
}
