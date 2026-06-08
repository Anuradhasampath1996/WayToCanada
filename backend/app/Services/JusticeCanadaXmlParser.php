<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

class JusticeCanadaXmlParser
{
    /** @var null|callable(string, string): bool */
    private $provisionVerifier = null;

    /** @var array<string, array{label: string, target_act_code: string, target_provision_key: string}> */
    private array $unresolvedAttempts = [];

    /** Enable verify-gated linkify: only emit anchors when verifier returns true. */
    public function beginVerifiedLinkify(?callable $verifier): void
    {
        $this->provisionVerifier  = $verifier;
        $this->unresolvedAttempts = [];
    }

    public function endVerifiedLinkify(): void
    {
        $this->provisionVerifier = null;
    }

    /** @return array<int, array{label: string, target_act_code: string, target_provision_key: string}> */
    public function getUnresolvedAttempts(): array
    {
        return array_values($this->unresolvedAttempts);
    }

    /** @return array{metadata: array, provisions: array<int, array>, rendered_html: string} */
    public function parse(string $xml, string $actCode, string $language = 'en', ?string $parentActCode = null): array
    {
        $pos = strpos($xml, '<?xml');
        if ($pos !== false && $pos > 0) {
            $xml = substr($xml, $pos);
        }

        $dom = new DOMDocument();
        $dom->preserveWhiteSpace = false;
        $dom->loadXML($xml);

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('lims', 'http://justice.gc.ca/lims');

        $metadata = [
            'short_title'     => $this->nodeText($xpath, '//ShortTitle'),
            'long_title'      => $this->nodeText($xpath, '//LongTitle'),
            'consolidated_no' => $this->nodeText($xpath, '//ConsolidatedNumber'),
            'act_code'        => $actCode,
            'parent_act_code' => $parentActCode,
            'language'        => $language,
        ];

        $provisions = [];
        $htmlParts  = ['<article class="leg-doc">'];

        if ($title = $metadata['long_title']) {
            $htmlParts[] = '<header class="leg-header"><h1 class="leg-title">'.htmlspecialchars($title).'</h1></header>';
        }

        $body = $xpath->query('//Body')->item(0);
        if ($body instanceof DOMElement) {
            $this->walkBody($body, $xpath, $actCode, $language, $provisions, $htmlParts, null, null, null);
        }

        $htmlParts[] = '</article>';
        $rendered = implode("\n", $htmlParts);
        $rendered = $this->linkifyTextReferences($rendered, $actCode, $parentActCode, $language);

        return ['metadata' => $metadata, 'provisions' => array_values($provisions), 'rendered_html' => $rendered];
    }

    private function walkBody(
        DOMElement $node,
        DOMXPath $xpath,
        string $actCode,
        string $language,
        array &$provisions,
        array &$htmlParts,
        ?string $sectionLabel,
        ?string $subsectionLabel,
        ?string $paragraphLabel,
    ): void {
        foreach ($node->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }
            $tag = $child->localName ?: $child->nodeName;

            if ($tag === 'Heading') {
                $level = $child->getAttribute('level') ?: '2';
                $text  = trim($child->textContent);
                if ($text !== '') {
                    $htmlParts[] = '<h'.$level.' class="leg-heading leg-heading-l'.$level.'">'.htmlspecialchars($text).'</h'.$level.'>';
                }
                continue;
            }

            if ($tag === 'Section') {
                $secLabel = $this->labelText($xpath, $child);
                if (! $secLabel) {
                    continue;
                }
                $marginal = $this->marginalNote($xpath, $child);
                $htmlParts[] = '<section class="leg-section" id="s-'.htmlspecialchars($secLabel).'">';
                $htmlParts[] = '<div class="leg-section-head"><span class="leg-section-num">Section '.$secLabel.'</span>';
                if ($marginal) {
                    $htmlParts[] = '<span class="leg-marginal">'.htmlspecialchars($marginal).'</span>';
                }
                $htmlParts[] = '</div>';
                $this->indexProvision($provisions, $actCode, $language, $secLabel, null, null, $marginal, $child, $xpath);
                $this->walkBody($child, $xpath, $actCode, $language, $provisions, $htmlParts, $secLabel, null, null);
                $htmlParts[] = '</section>';
                continue;
            }

            if ($tag === 'Subsection') {
                $subLabel = $this->labelText($xpath, $child);
                $marginal = $this->marginalNote($xpath, $child);
                $subDisplay = trim($subLabel ?? '', '()');
                $htmlParts[] = '<div class="leg-subsection"><div class="leg-subsection-head">';
                $htmlParts[] = '<span class="leg-subsection-num">'.htmlspecialchars((string) $sectionLabel).'('.$subDisplay.')</span>';
                if ($marginal) {
                    $htmlParts[] = '<span class="leg-marginal">'.htmlspecialchars($marginal).'</span>';
                }
                $htmlParts[] = '</div>';
                $this->indexProvision($provisions, $actCode, $language, $sectionLabel, $subLabel, null, $marginal, $child, $xpath);
                $this->walkBody($child, $xpath, $actCode, $language, $provisions, $htmlParts, $sectionLabel, $subLabel, null);
                $htmlParts[] = '</div>';
                continue;
            }

            if ($tag === 'Paragraph') {
                $paraLabel = $this->labelText($xpath, $child);
                $paraDisplay = trim($paraLabel ?? '', '()');
                $htmlParts[] = '<div class="leg-paragraph">';
                if ($paraDisplay) {
                    $htmlParts[] = '<span class="leg-para-label">('.$paraDisplay.')</span>';
                }
                $this->indexProvision($provisions, $actCode, $language, $sectionLabel, $subsectionLabel, $paraLabel, null, $child, $xpath);
                $this->walkBody($child, $xpath, $actCode, $language, $provisions, $htmlParts, $sectionLabel, $subsectionLabel, $paraLabel);
                $htmlParts[] = '</div>';
                continue;
            }

            if ($tag === 'Text') {
                $htmlParts[] = '<p class="leg-text">'.$this->renderInline($child, $xpath, $actCode).'</p>';
                continue;
            }

            if (in_array($tag, ['Provision', 'Body'], true)) {
                $this->walkBody($child, $xpath, $actCode, $language, $provisions, $htmlParts, $sectionLabel, $subsectionLabel, $paragraphLabel);
            }
        }
    }

    private function indexProvision(
        array &$provisions,
        string $actCode,
        string $language,
        ?string $section,
        ?string $subsection,
        ?string $paragraph,
        ?string $marginal,
        DOMElement $node,
        DOMXPath $xpath,
    ): void {
        if (! $section) {
            return;
        }

        $key = $this->buildProvisionKey($section, $subsection, $paragraph);
        $html = $this->renderProvisionBody($node, $xpath, $actCode);
        if ($html === '' && ! $subsection && ! $paragraph) {
            $html = $this->renderSectionAggregateBody($node, $xpath, $actCode);
        }
        $text = trim(preg_replace('/\s+/', ' ', $this->collectProvisionText($node)));
        if ($text === '' && $html === '') {
            return;
        }
        if ($text === '') {
            $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)));
        }

        $provisions[$actCode.':'.$language.':'.$key] = [
            'act_code'         => $actCode,
            'language'         => $language,
            'provision_key'    => $key,
            'section_label'    => $section,
            'subsection_label' => $subsection,
            'paragraph_label'  => $paragraph,
            'marginal_note'    => $marginal,
            'text_content'     => $text,
            'html_fragment'    => $html,
            'lims_fid'         => $node->getAttribute('lims:fid') ?: null,
        ];
    }

    public function buildProvisionKey(?string $section, ?string $subsection, ?string $paragraph): string
    {
        $key = (string) $section;
        if ($subsection) {
            $key .= '('.trim($subsection, '()').')';
        }
        if ($paragraph) {
            $key .= '('.trim($paragraph, '()').')';
        }

        return $key;
    }

    private function renderProvisionBody(DOMElement $node, DOMXPath $xpath, string $actCode): string
    {
        $nodeTag = $node->localName ?: $node->nodeName;
        $parts   = [];

        foreach ($node->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }
            $tag = $child->localName ?: $child->nodeName;
            if (in_array($tag, ['Label', 'MarginalNote'], true)) {
                continue;
            }
            if ($tag === 'Subsection' && $nodeTag === 'Section') {
                continue;
            }
            if ($tag === 'Paragraph') {
                if ($nodeTag === 'Paragraph') {
                    $inner = $this->renderParagraphInline($child, $xpath, $actCode);
                    if ($inner !== '') {
                        $parts[] = $inner;
                    }
                    continue;
                }
                $inner = $this->renderParagraphInline($child, $xpath, $actCode);
                if ($inner === '') {
                    continue;
                }
                $label = $this->labelText($xpath, $child);
                $labelHtml = $label ? '<span class="leg-popup-para-label">('.htmlspecialchars(trim($label, '()')).')</span> ' : '';
                $parts[] = '<p class="leg-popup-para">'.$labelHtml.$inner.'</p>';
                continue;
            }
            if ($tag === 'Text') {
                $inner = $this->renderInline($child, $xpath, $actCode);
                if (trim(strip_tags($inner)) !== '') {
                    $parts[] = '<p class="leg-popup-text">'.$inner.'</p>';
                }
                continue;
            }
            $inner = $this->renderProvisionBody($child, $xpath, $actCode);
            if ($inner !== '') {
                $parts[] = $inner;
            }
        }

        return implode("\n", $parts);
    }

    private function renderSectionAggregateBody(DOMElement $sectionNode, DOMXPath $xpath, string $actCode): string
    {
        $blocks = [];
        foreach ($sectionNode->childNodes as $child) {
            if (! $child instanceof DOMElement || ($child->localName ?: $child->nodeName) !== 'Subsection') {
                continue;
            }
            $body = $this->renderProvisionBody($child, $xpath, $actCode);
            if ($body === '') {
                continue;
            }
            $blockParts = [];
            $subLabel = $this->labelText($xpath, $child);
            $marginal = $this->marginalNote($xpath, $child);
            if ($subLabel) {
                $blockParts[] = '<div class="leg-popup-subsection">Subsection ('.htmlspecialchars(trim($subLabel, '()')).')</div>';
            }
            if ($marginal) {
                $blockParts[] = '<div class="leg-popup-marginal">'.htmlspecialchars($marginal).'</div>';
            }
            $blockParts[] = $body;
            $blocks[] = '<div class="leg-popup-sub-block">'.implode("\n", $blockParts).'</div>';
        }

        return implode("\n", $blocks);
    }

    private function renderParagraphInline(DOMElement $paragraph, DOMXPath $xpath, string $actCode): string
    {
        $out = '';
        foreach ($paragraph->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }
            $tag = $child->localName ?: $child->nodeName;
            if (in_array($tag, ['Label', 'MarginalNote'], true)) {
                continue;
            }
            $out .= $tag === 'Text'
                ? $this->renderInline($child, $xpath, $actCode)
                : $this->renderParagraphInline($child, $xpath, $actCode);
        }

        return $out;
    }

    private function collectProvisionText(DOMNode $node): string
    {
        $text = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $text .= $child->textContent.' ';
            } elseif ($child instanceof DOMElement) {
                $tag = $child->localName ?: $child->nodeName;
                if (! in_array($tag, ['Label', 'MarginalNote'], true)) {
                    $text .= $this->collectProvisionText($child).' ';
                }
            }
        }

        return $text;
    }

    private function renderInline(DOMNode $node, DOMXPath $xpath, string $actCode): string
    {
        $out = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $out .= htmlspecialchars($child->textContent);
                continue;
            }
            if (! $child instanceof DOMElement) {
                continue;
            }
            $tag = $child->localName ?: $child->nodeName;
            if ($tag === 'XRefInternal') {
                $target = trim($child->textContent);
                $out .= $this->refAnchor($actCode, $this->normalizeRefKey($target), $target);
                continue;
            }
            if ($tag === 'XRefExternal') {
                $link = $child->getAttribute('link');
                $label = trim($child->textContent);
                $refAct = $link ?: 'external';
                if ($refAct !== 'external' && $refAct !== $actCode) {
                    $out .= '<a href="#" class="leg-ref leg-ref-external" data-ref="'.htmlspecialchars($refAct.':external').'" data-act="'.htmlspecialchars($refAct).'" data-key="external" data-external="1">'.htmlspecialchars($label).'</a>';
                } else {
                    $out .= htmlspecialchars($label);
                }
                continue;
            }
            $out .= $this->renderInline($child, $xpath, $actCode);
        }

        return $out;
    }

    private const REF_KEY = '\d+(?:\.\d+)?(?:\([^)]+\))*';

    /** Subsection number inside parentheses: 1, 1.01, 1.1, 1.2 */
    private const SUB_NUM = '[\d.]+';

    /** Re-run text linkify on HTML while preserving existing leg-ref anchors. */
    public function linkifyHtmlPreservingAnchors(string $html, string $actCode, ?string $parentActCode = null, string $language = 'en'): string
    {
        $placeholders = [];
        $i            = 0;

        $protected = preg_replace_callback(
            '/<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>.*?<\/a>/is',
            function (array $m) use (&$placeholders, &$i) {
                $key                 = '___LEGREFPH'.$i.'___';
                $placeholders[$key]  = $m[0];
                $i++;

                return $key;
            },
            $html
        ) ?? $html;

        $linked = $this->linkifyTextReferences($protected, $actCode, $parentActCode, $language);

        foreach ($placeholders as $key => $original) {
            $linked = str_replace($key, $original, $linked);
        }

        return $linked;
    }

    private function linkifyTextReferences(string $html, string $actCode, ?string $parentActCode = null, string $language = 'en'): string
    {
        return preg_replace_callback(
            '/>([^<]+)</s',
            fn (array $m) => '>'.$this->linkifyPlainText($m[1], $actCode, $parentActCode, $language).'<',
            $html
        ) ?? $html;
    }

    public function linkifyContextualSubsections(string $html, string $actCode, string $language = 'en'): string
    {
        return preg_replace_callback(
            '/<section class="leg-section" id="s-([^"]+)"[^>]*>(.*?)<\/section>/is',
            function (array $m) use ($actCode, $language) {
                $inner = $this->linkifyContextualSubsectionText($m[2], $actCode, $m[1], $language);

                return '<section class="leg-section" id="s-'.$m[1].'">'.$inner.'</section>';
            },
            $html
        ) ?? $html;
    }

    private function linkifyContextualSubsectionText(string $inner, string $actCode, string $sectionId, string $language = 'en'): string
    {
        $placeholders = [];
        $i            = 0;

        $protected = preg_replace_callback(
            '/<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>.*?<\/a>/is',
            function (array $m) use (&$placeholders, &$i) {
                $key                  = '___LEGCTX'.$i.'___';
                $placeholders[$key]   = $m[0];
                $i++;

                return $key;
            },
            $inner
        ) ?? $inner;

        $protected = preg_replace_callback(
            '/>([^<]+)</s',
            function (array $tm) use ($actCode, $sectionId, $language) {
                $text = $tm[1];
                if (str_contains($text, 'leg-ref') || str_contains($text, '___LEGCTX')) {
                    return '>'.$text.'<';
                }

                if (LegislationLinkifyTerms::isFrench($language)) {
                    $text = preg_replace_callback(
                        '/\b(paragraphes\s+)\(('.self::SUB_NUM.')\)\s+à\s+\(('.self::SUB_NUM.')\)/iu',
                        fn (array $sm) => $sm[1]
                            .$this->refAnchor($actCode, $sectionId.'('.$sm[2].')', '('.$sm[2].')')
                            .' à '
                            .$this->refAnchor($actCode, $sectionId.'('.$sm[3].')', '('.$sm[3].')'),
                        $text
                    ) ?? $text;

                    $text = preg_replace_callback(
                        '/\b(paragraphes?\s+)\(('.self::SUB_NUM.')\)/iu',
                        fn (array $sm) => $sm[1].$this->refAnchor(
                            $actCode,
                            $sectionId.'('.$sm[2].')',
                            '('.$sm[2].')',
                        ),
                        $text
                    ) ?? $text;

                    $text = preg_replace_callback(
                        '/\b(alinéas?\s+)\(('.self::SUB_NUM.')\)([a-z][a-z0-9.]*)?/iu',
                        function (array $sm) use ($actCode, $sectionId) {
                            $key = $sectionId.'('.$sm[2].')'.(isset($sm[3]) && $sm[3] !== '' ? '('.$sm[3].')' : '');
                            $label = '('.$sm[2].')'.($sm[3] ?? '');

                            return $sm[1].$this->refAnchor($actCode, $key, $label);
                        },
                        $text
                    ) ?? $text;
                } else {
                    $text = preg_replace_callback(
                        '/\b(subsections\s+)\(('.self::SUB_NUM.')\)\s+to\s+\(('.self::SUB_NUM.')\)/iu',
                        fn (array $sm) => $sm[1]
                            .$this->refAnchor($actCode, $sectionId.'('.$sm[2].')', '('.$sm[2].')')
                            .' to '
                            .$this->refAnchor($actCode, $sectionId.'('.$sm[3].')', '('.$sm[3].')'),
                        $text
                    ) ?? $text;

                    $text = preg_replace_callback(
                        '/\b(subsections?\s+)\(('.self::SUB_NUM.')\)/iu',
                        fn (array $sm) => $sm[1].$this->refAnchor(
                            $actCode,
                            $sectionId.'('.$sm[2].')',
                            '('.$sm[2].')',
                        ),
                        $text
                    ) ?? $text;
                }

                return '>'.$text.'<';
            },
            $protected
        ) ?? $protected;

        foreach ($placeholders as $key => $original) {
            $protected = str_replace($key, $original, $protected);
        }

        return $protected;
    }

    /** Link shorthand refs after a prior leg-ref (EN: or/to/and — FR: ou/à/et). */
    public function linkifyShorthandOrRefs(string $html, string $actCode, string $language = 'en'): string
    {
        $toWord  = LegislationLinkifyTerms::isFrench($language) ? '(?:to|à)' : 'to';
        $parWord = LegislationLinkifyTerms::isFrench($language) ? '(?:or|ou|et)' : 'or';
        $andWord = LegislationLinkifyTerms::isFrench($language) ? '(?:and|et)' : 'and';

        $html = preg_replace_callback(
            '/(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-key="([^"]+)"[^>]*>[^<]*<\/a>)\s+'.$toWord.'\s+\(('.self::SUB_NUM.')\)/iu',
            function (array $m) use ($actCode, $language) {
                $newKey = $this->siblingProvisionKey($m[2], $m[3]);
                if (! $newKey) {
                    return $m[0];
                }
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' à ' : ' to ';

                return $m[1].$sep.$this->refAnchor($actCode, $newKey, '('.$m[3].')');
            },
            $html
        ) ?? $html;

        $html = preg_replace_callback(
            '/(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-key="([^"]+)"[^>]*>[^<]*<\/a>)\s+'.$parWord.'\s+\(('.self::SUB_NUM.')\)/iu',
            function (array $m) use ($actCode, $language) {
                $newKey = $this->siblingProvisionKey($m[2], $m[3]);
                if (! $newKey) {
                    return $m[0];
                }
                $sep = preg_match('/\s+et\s+\(/iu', $m[0]) ? ' et '
                    : (LegislationLinkifyTerms::isFrench($language) ? ' ou ' : ' or ');

                return $m[1].$sep.$this->refAnchor($actCode, $newKey, '('.$m[3].')');
            },
            $html
        ) ?? $html;

        $html = preg_replace_callback(
            '/(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-key="([^"]+)"[^>]*>[^<]*<\/a>)\s+'.$andWord.'\s+(\d+(?:\.\d+)?)\(('.self::SUB_NUM.')\)/iu',
            function (array $m) use ($actCode, $language) {
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' et ' : ' and ';

                return $m[1].$sep.$this->refAnchor($actCode, $m[3].'('.$m[4].')', $m[3].'('.$m[4].')');
            },
            $html
        ) ?? $html;

        return preg_replace_callback(
            '/\b'.$parWord.'\s+(\d+(?:\.\d+)?)\(('.self::SUB_NUM.')\)(?=[\s,.;\):]|$)/iu',
            function (array $m) use ($actCode, $language) {
                $sep = preg_match('/^et\s+/iu', $m[0]) ? ' et '
                    : (LegislationLinkifyTerms::isFrench($language) ? ' ou ' : ' or ');

                return $sep.$this->refAnchor($actCode, $m[1].'('.$m[2].')', $m[1].'('.$m[2].')');
            },
            $html
        ) ?? $html;
    }

    /** Link "or 10.2" / "to 10.3" (or FR ou/à) after a prior section-level leg-ref anchor. */
    public function linkifySectionShorthandRefs(string $html, string $actCode, string $language = 'en'): string
    {
        $toWord = LegislationLinkifyTerms::isFrench($language) ? '(?:to|à)' : 'to';
        $orWord = LegislationLinkifyTerms::isFrench($language) ? '(?:or|ou)' : 'or';

        $html = preg_replace_callback(
            '/(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-key="(\d+(?:\.\d+)?)"[^>]*>[^<]*<\/a>)\s+'.$orWord.'\s+(\d+(?:\.\d+)?)(?=[\s,.;\):]|$)/iu',
            function (array $m) use ($actCode, $language) {
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' ou ' : ' or ';

                return $m[1].$sep.$this->refAnchor($actCode, $m[3], $m[3]);
            },
            $html
        ) ?? $html;

        return preg_replace_callback(
            '/(<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*data-key="(\d+(?:\.\d+)?)"[^>]*>[^<]*<\/a>)\s+'.$toWord.'\s+(\d+(?:\.\d+)?)(?=[\s,.;\):]|$)/iu',
            function (array $m) use ($actCode, $language) {
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' à ' : ' to ';

                return $m[1].$sep.$this->refAnchor($actCode, $m[3], $m[3]);
            },
            $html
        ) ?? $html;
    }

    private function siblingProvisionKey(string $prevKey, string $subNum): ?string
    {
        if (preg_match('/^(.+?)\([\d.]+\)$/', $prevKey, $m)) {
            return $m[1].'('.$subNum.')';
        }
        if (preg_match('/^(\d+(?:\.\d+)?)$/', $prevKey, $m)) {
            return $m[1].'('.$subNum.')';
        }

        return null;
    }

    private function linkifyPlainText(string $text, string $actCode, ?string $parentActCode, string $language = 'en'): string
    {
        if (str_contains($text, 'leg-ref')) {
            return $text;
        }

        if (LegislationLinkifyTerms::isFrench($language)) {
            return $this->linkifyFrenchPlainText($text, $actCode, $parentActCode);
        }

        $text = $this->linkifySectionCommaList($text, $actCode);
        $text = $this->linkifySectionRange($text, $actCode);
        $text = $this->linkifySectionOrPair($text, $actCode);
        $text = $this->linkifySubsectionAndList($text, $actCode);

        if ($parentActCode) {
            $text = preg_replace_callback(
                '/\b((?:subsections?|sections?|paragraphs?)\s+)('.self::REF_KEY.')\s+of\s+the\s+Act\b/iu',
                fn (array $m) => $m[1].$this->refAnchor($parentActCode, $this->normalizeRefKey($m[2]), $m[2].' of the Act'),
                $text
            ) ?? $text;
        }
        $text = preg_replace_callback(
            '/\b(sections)\s+([\d.]+(?:\s+and\s+[\d.]+)+)/iu',
            function (array $m) use ($actCode) {
                $linked = array_map(fn (string $n) => $this->refAnchor($actCode, trim($n), trim($n)), preg_split('/\s+and\s+/iu', $m[2]));

                return 'sections '.implode(' and ', $linked);
            },
            $text
        ) ?? $text;
        $text = preg_replace_callback(
            '/\b((?:subsections?|sections?|paragraphs?)\s+)('.self::REF_KEY.')(?=\s|,|;|\.|:|\)|$|\s+and|\s+of|\s+or)/iu',
            fn (array $m) => $m[1].$this->refAnchor($actCode, $this->normalizeRefKey($m[2]), $m[2]),
            $text
        ) ?? $text;

        return $text;
    }

    private function linkifyFrenchPlainText(string $text, string $actCode, ?string $parentActCode): string
    {
        $frKey = LegislationLinkifyTerms::FR_REF_KEY;

        $text = preg_replace_callback(
            '/\b(articles\s+)(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*(?:\s+et\s+\d+(?:\.\d+)?)?)/iu',
            function (array $m) use ($actCode) {
                $list    = $m[2];
                $rebuilt = 'articles ';
                $offset  = 0;
                $len     = strlen($list);

                while ($offset < $len) {
                    $rest = substr($list, $offset);
                    if (preg_match('/^\s*,\s*/', $rest, $dm)) {
                        $rebuilt .= ', ';
                        $offset += strlen($dm[0]);
                    } elseif (preg_match('/^\s+et\s+/iu', $rest, $dm)) {
                        $rebuilt .= ' et ';
                        $offset += strlen($dm[0]);
                    } elseif (preg_match('/^\d+(?:\.\d+)?/', $rest, $nm)) {
                        $n = $nm[0];
                        $rebuilt .= $this->refAnchor($actCode, $n, $n);
                        $offset += strlen($n);
                    } else {
                        break;
                    }
                }

                return $rebuilt;
            },
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b(articles\s+)(\d+(?:\.\d+)?)\s+à\s+(\d+(?:\.\d+)?)/iu',
            fn (array $m) => $m[1]
                .$this->refAnchor($actCode, $m[2], $m[2])
                .' à '
                .$this->refAnchor($actCode, $m[3], $m[3]),
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b(articles?\s+)(\d+(?:\.\d+)?)\s+ou\s+(\d+(?:\.\d+)?)/iu',
            fn (array $m) => $m[1]
                .$this->refAnchor($actCode, $m[2], $m[2])
                .' ou '
                .$this->refAnchor($actCode, $m[3], $m[3]),
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b(paragraphes\s+)(\d+(?:\.\d+)?\('.self::SUB_NUM.'\)(?:\s+et\s+\d+(?:\.\d+)?\('.self::SUB_NUM.'\))+)/iu',
            function (array $m) use ($actCode) {
                return preg_replace_callback(
                    '/(\d+(?:\.\d+)?)\(('.self::SUB_NUM.')\)/u',
                    fn (array $sm) => $this->refAnchor($actCode, $sm[1].'('.$sm[2].')', $sm[1].'('.$sm[2].')'),
                    $m[0],
                );
            },
            $text
        ) ?? $text;

        if ($parentActCode) {
            $text = preg_replace_callback(
                '/\b((?:du|au|le|les|des)\s+paragraphe[s]?\s+)('.$frKey.')\s+de\s+la\s+Loi\b/iu',
                fn (array $m) => $m[1].$this->refAnchor(
                    $parentActCode,
                    LegislationLinkifyTerms::normalizeFrenchRefKey($m[2]),
                    $m[2].' de la Loi',
                ),
                $text
            ) ?? $text;
        }

        $text = preg_replace_callback(
            '/\b((?:du|au|le|les|des)\s+paragraphe[s]?\s+)('.$frKey.')(?=\s|,|;|\.|:|\)|$|\s+et|\s+ou|\s+de|\s+à)/iu',
            fn (array $m) => $m[1].$this->refAnchor(
                $actCode,
                LegislationLinkifyTerms::normalizeFrenchRefKey($m[2]),
                $m[2],
            ),
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b(paragraphes?\s+)('.$frKey.')(?=\s|,|;|\.|:|\)|$|\s+et|\s+ou|\s+de|\s+à)/iu',
            fn (array $m) => $m[1].$this->refAnchor(
                $actCode,
                LegislationLinkifyTerms::normalizeFrenchRefKey($m[2]),
                $m[2],
            ),
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b((?:l\'|aux?\s+|les\s+|des\s+)?article[s]?\s+)('.$frKey.')(?=\s|,|;|\.|:|\)|$|\s+et|\s+ou|\s+de|\s+à)/iu',
            fn (array $m) => $m[1].$this->refAnchor(
                $actCode,
                LegislationLinkifyTerms::normalizeFrenchRefKey($m[2]),
                $m[2],
            ),
            $text
        ) ?? $text;

        return preg_replace_callback(
            '/\b((?:l\'|les\s+|des\s+)?alinéa[s]?\s+)('.$frKey.')(?=\s|,|;|\.|:|\)|$|\s+et|\s+ou|\s+de|\s+à)/iu',
            fn (array $m) => $m[1].$this->refAnchor(
                $actCode,
                LegislationLinkifyTerms::normalizeFrenchRefKey($m[2]),
                $m[2],
            ),
            $text
        ) ?? $text;
    }

    /** Link "sections 10.1 to 10.3" style ranges. */
    private function linkifySectionRange(string $text, string $actCode): string
    {
        return preg_replace_callback(
            '/\b(sections\s+)(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/iu',
            fn (array $m) => $m[1]
                .$this->refAnchor($actCode, $m[2], $m[2])
                .' to '
                .$this->refAnchor($actCode, $m[3], $m[3]),
            $text
        ) ?? $text;
    }

    /** Link "section 10.1 or 10.2" style pairs. */
    private function linkifySectionOrPair(string $text, string $actCode): string
    {
        return preg_replace_callback(
            '/\b(sections?\s+)(\d+(?:\.\d+)?)\s+or\s+(\d+(?:\.\d+)?)/iu',
            fn (array $m) => $m[1]
                .$this->refAnchor($actCode, $m[2], $m[2])
                .' or '
                .$this->refAnchor($actCode, $m[3], $m[3]),
            $text
        ) ?? $text;
    }

    /** Link "subsections 10.1(3) and 10.2(3)" style lists. */
    private function linkifySubsectionAndList(string $text, string $actCode): string
    {
        return preg_replace_callback(
            '/\bsubsections\s+(\d+(?:\.\d+)?\('.self::SUB_NUM.'\)(?:\s+and\s+\d+(?:\.\d+)?\('.self::SUB_NUM.'\))+)/iu',
            function (array $m) use ($actCode) {
                $list    = $m[1];
                $rebuilt = 'subsections ';
                $offset  = 0;
                $len     = strlen($list);

                while ($offset < $len) {
                    $rest = substr($list, $offset);
                    if (preg_match('/^\s+and\s+/iu', $rest, $dm)) {
                        $rebuilt .= ' and ';
                        $offset += strlen($dm[0]);
                    } elseif (preg_match('/^\d+(?:\.\d+)?\('.self::SUB_NUM.'\)/u', $rest, $nm)) {
                        $full = $nm[0];
                        if (preg_match('/^(\d+(?:\.\d+)?)\(('.self::SUB_NUM.')\)$/', $full, $parts)) {
                            $rebuilt .= $this->refAnchor($actCode, $parts[1].'('.$parts[2].')', $full);
                        } else {
                            $rebuilt .= $full;
                        }
                        $offset += strlen($full);
                    } else {
                        break;
                    }
                }

                return $rebuilt;
            },
            $text
        ) ?? $text;
    }

    /** Link bare "or/ou 10.2" / "to/à 10.3" left after prefix-merge split a section/article anchor. */
    public function linkifySectionOrRangeRemainders(string $html, string $actCode, string $language = 'en'): string
    {
        $toWord = LegislationLinkifyTerms::isFrench($language) ? '(?:to|à)' : 'to';
        $orWord = LegislationLinkifyTerms::isFrench($language) ? '(?:or|ou)' : 'or';
        $prefix = LegislationLinkifyTerms::isFrench($language) ? 'sections?|articles?' : 'sections?';

        $html = preg_replace_callback(
            '/\b(?:'.$prefix.')\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?)\s+'.$toWord.'\s+(\d+(?:\.\d+)?)(?![^<]*<\/a>)/iu',
            function (array $m) use ($actCode, $language, $toWord) {
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' à ' : ' to ';

                return preg_replace(
                    '/\s+'.$toWord.'\s+(\d+(?:\.\d+)?)(?![^<]*<\/a>)/',
                    $sep.$this->refAnchor($actCode, $m[1], $m[1]),
                    $m[0],
                    1,
                );
            },
            $html
        ) ?? $html;

        return preg_replace_callback(
            '/\b(?:'.$prefix.')\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?)\s+'.$orWord.'\s+(\d+(?:\.\d+)?)(?![^<]*<\/a>)/iu',
            function (array $m) use ($actCode, $language, $orWord) {
                $sep = LegislationLinkifyTerms::isFrench($language) ? ' ou ' : ' or ';

                return preg_replace(
                    '/\s+'.$orWord.'\s+(\d+(?:\.\d+)?)(?![^<]*<\/a>)/',
                    $sep.$this->refAnchor($actCode, $m[1], $m[1]),
                    $m[0],
                    1,
                );
            },
            $html
        ) ?? $html;
    }

    /** Link bare "and 10.2(3)" left after prefix-merge split a subsection list anchor. */
    public function linkifySubsectionAndListRemainders(string $html, string $actCode): string
    {
        return preg_replace_callback(
            '/\bsubsections\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?\('.self::SUB_NUM.'\))((?:\s+and\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?\('.self::SUB_NUM.'\)))+)/iu',
            function (array $m) use ($actCode) {
                return preg_replace_callback(
                    '/\band\s+(\d+(?:\.\d+)?)\(('.self::SUB_NUM.')\)(?![^<]*<\/a>)/iu',
                    fn (array $sm) => ' and '.$this->refAnchor($actCode, $sm[1].'('.$sm[2].')', $sm[1].'('.$sm[2].')'),
                    $m[0],
                );
            },
            $html
        ) ?? $html;
    }

    private function linkifySectionCommaList(string $text, string $actCode): string
    {
        return preg_replace_callback(
            '/\bsections\s+(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*(?:\s+and\s+\d+(?:\.\d+)?)?)/iu',
            function (array $m) use ($actCode) {
                $list    = $m[1];
                $rebuilt = 'sections ';
                $offset  = 0;
                $len     = strlen($list);

                while ($offset < $len) {
                    $rest = substr($list, $offset);
                    if (preg_match('/^\s*,\s*/', $rest, $dm)) {
                        $rebuilt .= ', ';
                        $offset += strlen($dm[0]);
                    } elseif (preg_match('/^\s+and\s+/iu', $rest, $dm)) {
                        $rebuilt .= ' and ';
                        $offset += strlen($dm[0]);
                    } elseif (preg_match('/^\d+(?:\.\d+)?/', $rest, $nm)) {
                        $n = $nm[0];
                        $rebuilt .= $this->refAnchor($actCode, $n, $n);
                        $offset += strlen($n);
                    } else {
                        break;
                    }
                }

                return $rebuilt;
            },
            $text
        ) ?? $text;
    }

    /** Link bare numbers left in a section list after prefix-merge split an anchor. */
    public function linkifySectionListRemainders(string $html, string $actCode): string
    {
        return preg_replace_callback(
            '/\bsections\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?)((?:\s*,\s*(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?))+(?:\s+and\s+(?:<a\s+[^>]*class="[^"]*leg-ref[^"]*"[^>]*>[^<]*<\/a>|\d+(?:\.\d+)?))?)/iu',
            function (array $m) use ($actCode) {
                return preg_replace_callback(
                    '/(?:,\s*|\band\s+)(\d+(?:\.\d+)?)(?![^<]*<\/a>)/iu',
                    fn (array $sm) => str_replace(
                        $sm[1],
                        $this->refAnchor($actCode, $sm[1], $sm[1]),
                        $sm[0],
                    ),
                    $m[0],
                );
            },
            $html
        ) ?? $html;
    }

    private function normalizeRefKey(string $target): string
    {
        $target = trim($target);
        if (preg_match('/^(\d+(?:\.\d+)?)((?:\([^)]+\))+)$/', $target, $m)) {
            return $m[1].$m[2];
        }

        return $target;
    }

    private function refAnchor(string $actCode, string $key, string $label): string
    {
        $key   = trim($key);
        $label = trim($label);

        if ($key === '' || $key === 'external') {
            return htmlspecialchars($label);
        }

        if ($this->provisionVerifier !== null && ! ($this->provisionVerifier)($actCode, $key)) {
            $attemptKey = mb_strtolower($actCode.':'.$key.':'.$label);
            $this->unresolvedAttempts[$attemptKey] = [
                'label'                => $label,
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ];

            return htmlspecialchars($label);
        }

        return '<a href="#" class="leg-ref" data-ref="'.htmlspecialchars($actCode.':'.$key).'" data-act="'.htmlspecialchars($actCode).'" data-key="'.htmlspecialchars($key).'">'.htmlspecialchars($label).'</a>';
    }

    private function nodeText(DOMXPath $xpath, string $query): ?string
    {
        $n = $xpath->query($query)->item(0);

        return $n ? trim($n->textContent) : null;
    }

    private function labelText(DOMXPath $xpath, DOMElement $parent): ?string
    {
        $n = $xpath->query('./Label', $parent)->item(0);

        return $n ? trim($n->textContent) : null;
    }

    private function marginalNote(DOMXPath $xpath, DOMElement $parent): ?string
    {
        $n = $xpath->query('./MarginalNote', $parent)->item(0);

        return $n ? trim($n->textContent) : null;
    }
}
