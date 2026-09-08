<?php

namespace App\Contracts\GovernmentForms;

/**
 * Abstraction boundary for the government-form PDF engine.
 * Application code must depend on this contract, not iText APIs directly.
 */
interface GovernmentPdfEngine
{
    public function engineId(): string;

    /** @return array<string, mixed> */
    public function inspectTemplate(string $templatePath): array;

    /**
     * Populate XFA datasets and write via append mode (production strategy).
     *
     * @return array{output_path: string, report: array<string, mixed>}
     */
    public function fillXfaDatasets(string $templatePath, string $datasetsXml, string $outputPath): array;

    /**
     * Flatten a filled XFA PDF to a static PDF for browser preview.
     * Must not replace the official append-mode submission artifact.
     *
     * @return array{output_path: string, report: array<string, mixed>}
     */
    public function flattenXfa(string $filledPdfPath, string $outputPath): array;

    /** @return array<string, mixed> */
    public function validateStructure(string $sourcePath, string $filledPath): array;
}
