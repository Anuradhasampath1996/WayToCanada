<?php

namespace App\Http\Controllers;

use App\Services\DocumentOcrVisionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            return response()->json($visionResult);
        }

        // ── 2. Local OCR microservice fallback ────────────────────────────────
        $serviceUrl = rtrim(config('services.ocr.url'), '/') . '/scan-document';
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

            // If Vision already ran but found nothing, and local OCR is down, say so clearly.
            if ($vision->available()) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Could not read this document. Try a clearer photo of the bio-data page, or fill the fields manually.',
                ], 422);
            }

            $msg = $e->getMessage();
            $userMessage = str_contains($msg, 'timed out') || str_contains($msg, 'cURL error 28')
                ? 'Document scan is taking longer than expected. Wait a moment, then use Re-scan — the first scan after starting the OCR service can take 1–2 minutes.'
                : 'AI service is temporarily unavailable. Ensure the OCR service is running on port 8001, then try again.';

            return response()->json([
                'status'  => 'error',
                'message' => $userMessage,
            ], 503);
        }

        if ($response->failed()) {
            Log::error('[OCR] AI service returned error', [
                'url'    => $serviceUrl,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            $body = $response->json();
            $detail = is_array($body) ? ($body['detail'] ?? $body['message'] ?? null) : null;
            if (is_array($detail)) {
                $detail = collect($detail)->pluck('msg')->filter()->first() ?? json_encode($detail);
            }

            return response()->json([
                'status'  => 'error',
                'message' => $detail ?: 'Document scanning failed. Please try again or fill in the details manually.',
            ], $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502);
        }

        return response()->json($response->json(), $response->status());
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
