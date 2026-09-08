<?php

namespace App\Implementations\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use App\Services\GovernmentForms\FormProcessorClient;

class ItextPdfXfaEngine implements GovernmentPdfEngine
{
    public function __construct(
        private FormProcessorClient $client,
    ) {}

    public function engineId(): string
    {
        return 'itext_pdfxfa_append';
    }

    public function inspectTemplate(string $templatePath): array
    {
        return $this->client->inspect($templatePath);
    }

    public function fillXfaDatasets(string $templatePath, string $datasetsXml, string $outputPath): array
    {
        return $this->client->fill($templatePath, $datasetsXml, $outputPath);
    }

    public function flattenXfa(string $filledPdfPath, string $outputPath): array
    {
        throw new \RuntimeException('Browser flatten preview is only available with the local JAR processor driver.');
    }

    public function validateStructure(string $sourcePath, string $filledPath): array
    {
        return $this->client->validateStructure($sourcePath, $filledPath);
    }
}
