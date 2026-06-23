<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WorkspaceMapleDocumentTextExtractor
{
    private const PLAIN_TEXT_MIMES = [
        'text/plain',
        'text/csv',
        'application/csv',
    ];

    public function __construct(
        private WorkspaceMapleLocalPdfTextExtractor $localPdf,
    ) {}

    /**
     * @return array{status: string, text: string, page_count: ?int, extraction_method: string, message: ?string}
     */
    public function extract(UploadedFile $file): array
    {
        $mime = strtolower((string) $file->getMimeType());

        if (in_array($mime, self::PLAIN_TEXT_MIMES, true) || $file->getClientOriginalExtension() === 'txt') {
            $text = file_get_contents($file->getRealPath()) ?: '';

            return [
                'status'             => trim($text) !== '' ? 'success' : 'error',
                'text'               => trim($text),
                'page_count'         => null,
                'extraction_method'  => 'plain_text',
                'message'            => trim($text) !== '' ? null : 'The text file appears to be empty.',
            ];
        }

        $localPdf = $this->localPdf->extract($file);
        if ($localPdf !== null && ($localPdf['status'] ?? '') === 'success' && ($localPdf['text'] ?? '') !== '') {
            return $localPdf;
        }

        $ocrResult = $this->extractViaOcrService($file);
        if (($ocrResult['status'] ?? '') === 'success' && ($ocrResult['text'] ?? '') !== '') {
            return $ocrResult;
        }

        if ($localPdf !== null && ($localPdf['text'] ?? '') !== '') {
            return $localPdf;
        }

        return $ocrResult['message'] !== null
            ? $ocrResult
            : ($localPdf ?? $ocrResult);
    }

    /**
     * @return array{status: string, text: string, page_count: ?int, extraction_method: string, message: ?string}
     */
    private function extractViaOcrService(UploadedFile $file): array
    {
        $serviceUrl = rtrim((string) config('services.ocr.url'), '/').'/extract-text';
        $timeout    = (int) config('services.ocr.timeout', 300);

        try {
            $response = Http::timeout($timeout)
                ->connectTimeout(15)
                ->attach(
                    'file',
                    file_get_contents($file->getRealPath()),
                    $file->getClientOriginalName(),
                    ['Content-Type' => $file->getMimeType()]
                )
                ->post($serviceUrl);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[Maple] OCR extract-text unreachable', [
                'url'   => $serviceUrl,
                'error' => $e->getMessage(),
            ]);

            $msg = $e->getMessage();
            $userMessage = str_contains($msg, 'timed out') || str_contains($msg, 'cURL error 28')
                ? 'Document text extraction is taking longer than expected. Wait a moment and try again.'
                : 'OCR service is not running. Start it on port 8001 for scanned PDFs and images.';

            return $this->errorResult('ocr', $userMessage);
        }

        if ($response->failed()) {
            Log::warning('[Maple] OCR extract-text failed', [
                'url'    => $serviceUrl,
                'status' => $response->status(),
                'body'   => substr($response->body(), 0, 500),
            ]);

            $body   = $response->json();
            $detail = is_array($body) ? ($body['detail'] ?? $body['message'] ?? null) : null;
            if (is_array($detail)) {
                $detail = collect($detail)->pluck('msg')->filter()->first() ?? json_encode($detail);
            }

            if ($response->status() === 404 || $detail === 'Not Found') {
                $detail = 'OCR service is outdated or not running. Restart the ai-service on port 8001, then try again.';
            }

            return $this->errorResult('ocr', $detail ?: 'Could not extract text from this file.');
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return $this->errorResult('ocr', 'Unexpected response from text extraction service.');
        }

        return [
            'status'            => (string) ($payload['status'] ?? 'error'),
            'text'              => trim((string) ($payload['text'] ?? '')),
            'page_count'        => isset($payload['page_count']) ? (int) $payload['page_count'] : null,
            'extraction_method' => (string) ($payload['extraction_method'] ?? 'ocr'),
            'message'           => isset($payload['message']) ? (string) $payload['message'] : null,
        ];
    }

    /** @return array{status: string, text: string, page_count: ?int, extraction_method: string, message: ?string} */
    private function errorResult(string $method, string $message): array
    {
        return [
            'status'            => 'error',
            'text'              => '',
            'page_count'        => null,
            'extraction_method' => $method,
            'message'           => $message,
        ];
    }
}
