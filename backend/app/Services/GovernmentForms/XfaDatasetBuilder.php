<?php

namespace App\Services\GovernmentForms;

use DOMDocument;
use DOMElement;
use RuntimeException;

class XfaDatasetBuilder
{
    /**
     * Build XFA data XML from pdf field path => value map.
     *
     * IMPORTANT: iText {@see XfaForm::fillXfaForm} replaces the first element under
     * datasets/data. The XML root MUST be the form data element (e.g. IMM_5476),
     * NOT an <xfa:datasets>/<xfa:data> wrapper — wrapping nests datasets and
     * Adobe/browser field binding breaks (inputs look empty).
     *
     * When a template datasets skeleton path is provided, values are merged into that
     * full IRCC structure (required for Adobe XFA binding on IMM 5476).
     *
     * Preserves SOM occurrence indices as repeated sibling elements
     * (e.g. PersonalData[0] and PersonalData[1], Child[0]/Child[2]).
     *
     * @param  array<string, string>  $fieldValues
     */
    public function build(string $formRootElement, array $fieldValues, ?string $skeletonXmlPath = null): string
    {
        if ($skeletonXmlPath !== null && $skeletonXmlPath !== '' && is_file($skeletonXmlPath)) {
            return $this->buildMergedIntoSkeleton($formRootElement, $fieldValues, $skeletonXmlPath);
        }

        return $this->buildSparse($formRootElement, $fieldValues);
    }

    /**
     * @param  array<string, string>  $fieldValues
     */
    private function buildSparse(string $formRootElement, array $fieldValues): string
    {
        $tree = [];

        foreach ($fieldValues as $somPath => $value) {
            $segments = $this->parseSomPath($somPath);
            if ($segments === []) {
                continue;
            }

            $this->setNestedValue($tree, $segments, $value);
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $root = $dom->createElement($formRootElement);
        $rootTree = $tree[$formRootElement] ?? $tree[array_key_first($tree)] ?? [];
        if (is_array($rootTree) && array_is_list($rootTree) && isset($rootTree[0]) && is_array($rootTree[0])) {
            // Root itself rarely indexed; take first occurrence bag.
            $rootTree = $rootTree[0]['children'] ?? $rootTree[0] ?? [];
        }
        $this->appendTree($dom, $root, is_array($rootTree) ? $rootTree : []);

        $dom->appendChild($root);

        $xml = $dom->saveXML();
        if ($xml === false) {
            throw new RuntimeException('Failed to build XFA datasets XML.');
        }

        return $xml;
    }

    /**
     * Merge mapped values into the official template datasets skeleton so Adobe keeps
     * the full XFA binding structure (empty siblings, Lists, page chrome, etc.).
     *
     * @param  array<string, string>  $fieldValues
     */
    private function buildMergedIntoSkeleton(string $formRootElement, array $fieldValues, string $skeletonXmlPath): string
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = true;

        $previous = libxml_use_internal_errors(true);
        $loaded = $dom->load($skeletonXmlPath);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded || ! $dom->documentElement instanceof DOMElement) {
            throw new RuntimeException('Failed to load XFA datasets skeleton: '.$skeletonXmlPath);
        }

        $root = $dom->documentElement;
        if ($root->localName !== $formRootElement && $root->nodeName !== $formRootElement) {
            throw new RuntimeException("Skeleton root must be {$formRootElement}, got {$root->nodeName}.");
        }

        foreach ($fieldValues as $somPath => $value) {
            $segments = $this->parseSomPath($somPath);
            if ($segments === []) {
                continue;
            }

            if (($segments[0]['name'] ?? null) === $formRootElement) {
                array_shift($segments);
            }

            if ($segments === []) {
                continue;
            }

            $this->setDomLeafValue($root, $segments, (string) $value);
        }

        $xml = $dom->saveXML();
        if ($xml === false) {
            throw new RuntimeException('Failed to serialize merged XFA datasets XML.');
        }

        return $xml;
    }

    /**
     * @param  list<array{name: string, index: int|null}>  $segments
     */
    private function setDomLeafValue(DOMElement $root, array $segments, string $value): void
    {
        $node = $root;

        foreach ($segments as $segment) {
            $name = $segment['name'];
            $index = $segment['index'] ?? 0;
            $next = $this->childOccurrence($node, $name, $index);
            if (! $next instanceof DOMElement) {
                return;
            }
            $node = $next;
        }

        while ($node->firstChild) {
            $node->removeChild($node->firstChild);
        }

        $node->appendChild($node->ownerDocument->createTextNode($value));
    }

    private function childOccurrence(DOMElement $parent, string $name, int $index): ?DOMElement
    {
        $matches = [];

        foreach ($parent->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            $local = $child->localName ?: $child->nodeName;
            if ($local === $name) {
                $matches[] = $child;
            }
        }

        return $matches[$index] ?? null;
    }

    /**
     * @return list<array{name: string, index: int|null}>
     */
    private function parseSomPath(string $somPath): array
    {
        $parts = explode('.', $somPath);
        $segments = [];

        foreach ($parts as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }

            if (preg_match('/^(.+)\[(\d+)\]$/', $part, $m)) {
                $segments[] = ['name' => $m[1], 'index' => (int) $m[2]];
            } else {
                $segments[] = ['name' => $part, 'index' => null];
            }
        }

        return $segments;
    }

    /**
     * Tree nodes are maps of element name => occurrence bags.
     * Occurrence bag: list of ['children' => array] sorted by index.
     *
     * @param  array<string, mixed>  $tree
     * @param  list<array{name: string, index: int|null}>  $segments
     */
    private function setNestedValue(array &$tree, array $segments, string $value): void
    {
        $cursor = &$tree;

        foreach ($segments as $i => $segment) {
            $name = $segment['name'];
            $index = $segment['index'] ?? 0;
            $isLast = $i === count($segments) - 1;

            if (! isset($cursor[$name]) || ! is_array($cursor[$name])) {
                $cursor[$name] = [];
            }

            // Ensure occurrence slot exists.
            while (count($cursor[$name]) <= $index) {
                $cursor[$name][] = ['children' => []];
            }

            if ($isLast) {
                // Leaf: store scalar on the occurrence (overwrite children map with value marker).
                $cursor[$name][$index]['value'] = $value;
                unset($cursor[$name][$index]['children']);

                return;
            }

            if (! isset($cursor[$name][$index]['children']) || ! is_array($cursor[$name][$index]['children'])) {
                $cursor[$name][$index]['children'] = [];
            }

            $cursor = &$cursor[$name][$index]['children'];
        }
    }

    /** @param array<string, mixed> $node */
    private function appendTree(DOMDocument $dom, DOMElement $parent, array $node): void
    {
        foreach ($node as $name => $occurrences) {
            if (! is_array($occurrences)) {
                continue;
            }

            // Legacy flat map support (no occurrence bags).
            if ($occurrences !== [] && ! array_is_list($occurrences)) {
                $element = $dom->createElement((string) $name);
                $this->appendTree($dom, $element, $occurrences);
                $parent->appendChild($element);
                continue;
            }

            foreach ($occurrences as $occurrence) {
                if (! is_array($occurrence)) {
                    continue;
                }

                $element = $dom->createElement((string) $name);

                if (array_key_exists('value', $occurrence)) {
                    $element->appendChild($dom->createTextNode((string) $occurrence['value']));
                } elseif (isset($occurrence['children']) && is_array($occurrence['children'])) {
                    $this->appendTree($dom, $element, $occurrence['children']);
                }

                $parent->appendChild($element);
            }
        }
    }
}
