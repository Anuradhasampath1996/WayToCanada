<?php

namespace App\Http\Controllers;

use App\Services\DocumentOcrVisionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DocumentOcrController extends Controller
{
    /**
     * Scan an identity-document image and return structured fields.
     *
     * POST /api/v1/documents/scan
     *
     * Order:
     *   1. OpenAI Vision (same OPENAI_API_KEY as legislation) — fast + accurate
     *   2. Local EasyOCR microservice — fallback (PDF / offline / Vision miss)
     *   3. For passports: if Vision missed printed issueDate, merge from local OCR
     */
    public function scan(Request $request, DocumentOcrVisionService $vision): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:png,jpg,jpeg,webp,pdf',
                'max:10240',   // 10 MB
            ],
            'document_hint' => ['nullable', 'string', 'in:passport,id,licence,education,language,study'],
        ]);

        $file = $request->file('file');
        $hint = $request->input('document_hint');
        $hint = is_string($hint) && in_array($hint, DocumentOcrVisionService::HINTS, true) ? $hint : null;

        // ── 1. OpenAI Vision (shared legislation API key) ─────────────────────
        $visionResult = $vision->extract($file, $hint);
        if (is_array($visionResult) && (
            $this->hasUsefulFields($visionResult['extracted_data'] ?? [])
            || $this->hasAuthenticitySignal($visionResult['authenticity'] ?? null)
        )) {
            if ($this->needsPassportIssueDateSupplement($visionResult, $hint)) {
                $local = $this->callLocalOcr($file, $hint);
                if (is_array($local)) {
                    $visionResult = $this->mergeExtractedFields($visionResult, $local);
                }
            }

            return response()->json($visionResult);
        }

        // ── 2. Local OCR microservice fallback ────────────────────────────────
        $localResult = $this->callLocalOcr($file, $hint);
        if (is_array($localResult)) {
            return response()->json($localResult);
        }

        if ($vision->available()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Could not read this document. Try a clearer photo of the bio-data page, or fill the fields manually.',
            ], 422);
        }

        return response()->json([
            'status'  => 'error',
            'message' => 'AI service is temporarily unavailable. Ensure the OCR service is running on port 8001, then try again.',
        ], 503);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function callLocalOcr(UploadedFile $file, ?string $hint): ?array
    {
        $serviceUrl = rtrim((string) config('services.ocr.url'), '/') . '/scan-document';
        $timeout    = (int) config('services.ocr.timeout', 300);

        try {
            $pendingRequest = Http::timeout($timeout)
                ->connectTimeout(15)
                ->attach(
                    'file',
                    file_get_contents($file->getRealPath()),
                    $file->getClientOriginalName(),
                    ['Content-Type' => $file->getMimeType()]
                );

            $response = $pendingRequest->post(
                $serviceUrl,
                array_filter([
                    'document_hint' => $hint,
                ]),
            );
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[OCR] AI service unreachable', [
                'url'   => $serviceUrl,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        if ($response->failed()) {
            Log::error('[OCR] AI service returned error', [
                'url'    => $serviceUrl,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return null;
        }

        $json = $response->json();

        return is_array($json) ? $json : null;
    }

    /**
     * @param  array<string, mixed>  $visionResult
     */
    private function needsPassportIssueDateSupplement(array $visionResult, ?string $hint): bool
    {
        $docType = strtolower((string) ($visionResult['document_type'] ?? ''));
        $isPassport = $hint === 'passport' || $docType === 'passport';
        if (! $isPassport) {
            return false;
        }

        $data = $visionResult['extracted_data'] ?? [];
        if (! is_array($data)) {
            return true;
        }

        return empty($data['issueDate']);
    }

    /**
     * Fill empty Vision fields from local OCR (especially passport issueDate).
     *
     * @param  array<string, mixed>  $primary
     * @param  array<string, mixed>  $secondary
     * @return array<string, mixed>
     */
    private function mergeExtractedFields(array $primary, array $secondary): array
    {
        $primaryData = is_array($primary['extracted_data'] ?? null) ? $primary['extracted_data'] : [];
        $secondaryData = is_array($secondary['extracted_data'] ?? null) ? $secondary['extracted_data'] : [];

        foreach ($secondaryData as $key => $value) {
            if (! is_string($key)) {
                continue;
            }
            $existing = $primaryData[$key] ?? null;
            if (($existing === null || $existing === '') && $value !== null && $value !== '') {
                $primaryData[$key] = $value;
            }
        }

        $primary['extracted_data'] = $primaryData;

        if (empty($primary['document_type']) || $primary['document_type'] === 'unknown') {
            $secType = $secondary['document_type'] ?? null;
            if (is_string($secType) && $secType !== '' && $secType !== 'unknown') {
                $primary['document_type'] = $secType;
            }
        }

        return $primary;
    }

    /** @param  array<string, mixed>  $data */
    private function hasUsefulFields(array $data): bool
    {
        foreach ([
            'fullName', 'passportNumber', 'idNumber', 'dob', 'expiryDate', 'issueDate',
            'nationality', 'gender', 'address', 'birthPlace',
            'institutionName', 'degreeName', 'graduationYear', 'country',
            'testListening', 'testReading', 'testWriting', 'testSpeaking', 'testOverall', 'testDate',
        ] as $key) {
            if (! empty($data[$key])) {
                return true;
            }
        }

        return false;
    }

    /** @param  mixed  $auth */
    private function hasAuthenticitySignal(mixed $auth): bool
    {
        if (! is_array($auth)) {
            return false;
        }
        $verdict = (string) ($auth['verdict'] ?? 'unknown');

        return in_array($verdict, ['likely_authentic', 'needs_review', 'suspicious', 'likely_fake'], true);
    }
}
