<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DocumentOcrController extends Controller
{
    /**
     * Proxy an identity-document image to the OCR / AI service and return
     * the structured extraction result to the frontend.
     *
     * POST /api/v1/documents/scan
     *
     * The AI service URL is driven by the OCR_SERVICE_URL environment variable,
     * so switching from the local FastAPI server to a Google Colab endpoint (or
     * any other hosted model) only requires changing that single .env value —
     * no code changes needed.
     */
    public function scan(Request $request): JsonResponse
    {
        // ── 1. Validate ───────────────────────────────────────────────────────
        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:png,jpg,jpeg,webp,pdf',
                'max:10240',   // 10 MB
            ],
        ]);

        $file       = $request->file('file');
        $serviceUrl = rtrim(config('services.ocr.url'), '/') . '/scan-document';
        $timeout    = (int) config('services.ocr.timeout', 300);

        // ── 2. Forward to AI service ──────────────────────────────────────────
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
            Log::error('[OCR] AI service unreachable', [
                'url'   => $serviceUrl,
                'error' => $e->getMessage(),
            ]);

            $msg = $e->getMessage();
            $userMessage = str_contains($msg, 'timed out') || str_contains($msg, 'cURL error 28')
                ? 'Document scan is taking longer than expected. Wait a moment, then use Re-scan — the first scan after starting the OCR service can take 1–2 minutes.'
                : 'AI service is temporarily unavailable. Ensure the OCR service is running on port 8001, then try again.';

            return response()->json([
                'status'  => 'error',
                'message' => $userMessage,
            ], 503);
        }

        // ── 3. Handle AI service errors ───────────────────────────────────────
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

        // ── 4. Return the AI response as-is to the frontend ───────────────────
        // The response shape is:
        //   { status, document_type, extracted_data, confidence_score, message? }
        return response()->json($response->json(), $response->status());
    }
}
