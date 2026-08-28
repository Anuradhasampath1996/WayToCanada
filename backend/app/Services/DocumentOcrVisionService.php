<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Document field extraction + authenticity screening via OpenAI Vision.
 * Reuses the same OPENAI_API_KEY as legislation / Maple / letters.
 *
 * Authenticity is an assistive risk screen for consultants — not a legal
 * forgery determination.
 */
class DocumentOcrVisionService
{
    public const HINTS = [
        'passport',
        'id',
        'licence',
        'education',
        'language',
        'study',
    ];

    public function available(): bool
    {
        if (! (bool) config('services.ocr.openai_enabled', true)) {
            return false;
        }

        $key = (string) config('services.openai.key', '');

        return $key !== '' && ! str_starts_with($key, 'sk-test');
    }

    /**
     * @return array<string, mixed>|null
     */
    public function extract(UploadedFile $file, ?string $documentHint = null): ?array
    {
        if (! $this->available()) {
            return null;
        }

        $mime = strtolower((string) ($file->getMimeType() ?: ''));
        $originalName = (string) $file->getClientOriginalName();
        $isPdf = str_contains($mime, 'pdf') || str_ends_with(strtolower($originalName), '.pdf');

        $bytes = @file_get_contents($file->getRealPath());
        if ($bytes === false || $bytes === '') {
            return null;
        }

        $hint = in_array($documentHint, self::HINTS, true) ? $documentHint : null;

        if ($isPdf) {
            // 1) Rasterise page 1 → Vision (works for scanned + digital PDFs)
            $rendered = $this->renderPdfFirstPage($bytes, $originalName !== '' ? $originalName : 'document.pdf');
            if ($rendered !== null) {
                [$bytes, $mime] = $rendered;
            } else {
                // 2) Text-layer PDF → OpenAI text extract (no OCR service needed)
                return $this->extractFromPdfText($bytes, $hint);
            }
        } elseif (! in_array($mime, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], true)) {
            return null;
        }

        $prepared = $this->prepareImageDataUrl($bytes, $mime);
        if ($prepared === null) {
            return null;
        }

        [$dataUrl] = $prepared;

        return $this->callOpenAiVision($dataUrl, $hint);
    }

    /**
     * @return array{0: string, 1: string}|null [bytes, mime]
     */
    private function renderPdfFirstPage(string $pdfBytes, string $filename): ?array
    {
        $serviceUrl = rtrim((string) config('services.ocr.url'), '/').'/render-pdf-page';

        try {
            $response = Http::timeout(60)
                ->connectTimeout(10)
                ->attach('file', $pdfBytes, $filename, ['Content-Type' => 'application/pdf'])
                ->post($serviceUrl);

            if (! $response->successful()) {
                Log::warning('[OCR Vision] PDF render failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $b64 = $response->json('image_base64');
            $mime = strtolower((string) ($response->json('mime') ?: 'image/png'));
            if (! is_string($b64) || $b64 === '') {
                return null;
            }

            $png = base64_decode($b64, true);
            if ($png === false || $png === '') {
                return null;
            }

            return [$png, $mime === 'image/jpg' ? 'image/jpeg' : $mime];
        } catch (\Throwable $e) {
            Log::warning('[OCR Vision] PDF render exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Digital PDFs with a text layer — extract via OpenAI without Vision.
     *
     * @return array<string, mixed>|null
     */
    private function extractFromPdfText(string $pdfBytes, ?string $hint): ?array
    {
        try {
            if (! class_exists(\Smalot\PdfParser\Parser::class)) {
                return null;
            }

            $parser = new \Smalot\PdfParser\Parser;
            $pdf = $parser->parseContent($pdfBytes);
            $text = trim((string) $pdf->getText());
            if (strlen($text) < 40) {
                return null;
            }

            // Cap prompt size
            if (strlen($text) > 12000) {
                $text = substr($text, 0, 12000);
            }

            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout((int) config('services.ocr.openai_timeout', 90))
                ->connectTimeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'           => (string) config('services.ocr.openai_model', 'gpt-4o-mini'),
                    'temperature'     => 0,
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'system', 'content' => $this->systemPrompt()],
                        [
                            'role'    => 'user',
                            'content' => $this->userPrompt($hint)."\n\nExtract from this PDF text (page content):\n\n".$text
                                ."\n\nFor authenticity: this is a text-layer PDF (not a photo). "
                                .'Use needs_review if content looks fabricated; likely_authentic if it looks like a normal official PDF export.',
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('[OCR Vision] PDF text OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed = is_string($content) ? json_decode($content, true) : null;
            if (! is_array($parsed)) {
                return null;
            }

            $result = $this->normalizeResponse($parsed, $hint);
            if (is_array($result)) {
                $result['engine'] = 'openai_pdf_text';
            }

            return $result;
        } catch (\Throwable $e) {
            Log::warning('[OCR Vision] PDF text extract exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function callOpenAiVision(string $dataUrl, ?string $hint): ?array
    {
        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout((int) config('services.ocr.openai_timeout', 90))
                ->connectTimeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'           => (string) config('services.ocr.openai_model', 'gpt-4o-mini'),
                    'temperature'     => 0,
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'system', 'content' => $this->systemPrompt()],
                        [
                            'role'    => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $this->userPrompt($hint)],
                                [
                                    'type'      => 'image_url',
                                    'image_url' => [
                                        'url'    => $dataUrl,
                                        'detail' => 'high',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('[OCR Vision] OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                    'hint'   => $hint,
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed = is_string($content) ? json_decode($content, true) : null;
            if (! is_array($parsed)) {
                return null;
            }

            return $this->normalizeResponse($parsed, $hint);
        } catch (\Throwable $e) {
            Log::warning('[OCR Vision] exception: '.$e->getMessage());

            return null;
        }
    }

    private function systemPrompt(): string
    {
        return <<<'PROMPT'
You are a document intelligence assistant for a Canadian immigration consultancy.
You (1) extract structured fields from an uploaded document photo and (2) screen for authenticity risks.

Return JSON only with these keys:
{
  "document_type": "passport|national_id|driving_license|education|language_test|study_permit|unknown",
  "fullName": "",
  "passportNumber": "",
  "idNumber": "",
  "dob": "",
  "expiryDate": "",
  "issueDate": "",
  "nationality": "",
  "gender": "",
  "address": "",
  "birthPlace": "",
  "institutionName": "",
  "degreeName": "",
  "graduationYear": "",
  "country": "",
  "testListening": "",
  "testReading": "",
  "testWriting": "",
  "testSpeaking": "",
  "testOverall": "",
  "testDate": "",
  "confidence": 0.0,
  "authenticity": {
    "verdict": "likely_authentic|needs_review|suspicious|likely_fake|unknown",
    "score": 0.0,
    "summary": "",
    "flags": []
  }
}

Extraction rules:
- Dates must be YYYY-MM-DD or "".
- gender must be Male, Female, Other, or "".
- graduationYear must be YYYY or "".
- Language scores: keep numeric strings as printed (IELTS 0-9, CELPIP 1-12, TEF/TCF as printed).
- Prefer MRZ on passports when visible.
- Never invent values. Use "" when unsure.
- Match fields to the document type (ignore irrelevant keys).

Authenticity screening rules (assistive only — not a legal determination):
- Look for AI-generated / synthetic image cues (warped fonts, inconsistent holograms/MRZ, unnatural skin/texture, repeated patterns, impossible geometry).
- Look for obvious photoshop / composite edits, mismatched fonts, cloned seals, cropped edges, low-quality printouts of screenshots.
- Real phone photos of real documents usually score higher even if blurry.
- Screenshots of PDFs or clear scans of genuine docs can still be likely_authentic.
- If unsure, use needs_review — do not over-call likely_fake.
- flags: short strings like "ai_artifacts", "font_inconsistency", "mrz_mismatch", "edited_regions", "screenshot_of_photo", "low_resolution".
- score: 0-1 where 1 = appears genuine.
PROMPT;
    }

    private function userPrompt(?string $hint): string
    {
        return match ($hint) {
            'passport' => 'Document hint: passport bio-data page. Extract passport fields (prefer MRZ) and screen authenticity.',
            'id' => 'Document hint: national ID / CNIC / government identity card (front or back). Extract ID fields and screen authenticity.',
            'licence' => 'Document hint: driving licence (front or back). Extract licence/ID fields and screen authenticity.',
            'education' => 'Document hint: degree, diploma, or academic transcript. Extract institution, degree/course, graduation year, country if present, and screen authenticity.',
            'language' => 'Document hint: IELTS / CELPIP / TEF / TCF score report. Extract listening, reading, writing, speaking (and overall/date if present) and screen authenticity.',
            'study' => 'Document hint: Canadian study permit, enrollment letter, or Canadian transcript. Extract institution, program/course, and related dates if present, and screen authenticity.',
            default => 'Identify the document, extract all relevant fields for an immigration questionnaire, and screen authenticity.',
        };
    }

    /**
     * @param  array<string, mixed>  $parsed
     * @return array<string, mixed>|null
     */
    private function normalizeResponse(array $parsed, ?string $hint): ?array
    {
        $allowedTypes = [
            'passport', 'national_id', 'driving_license',
            'education', 'language_test', 'study_permit', 'unknown',
        ];
        $docType = strtolower(trim((string) ($parsed['document_type'] ?? 'unknown')));
        if (! in_array($docType, $allowedTypes, true)) {
            $docType = 'unknown';
        }

        $docType = match ($hint) {
            'passport' => $docType === 'unknown' ? 'passport' : $docType,
            'id' => in_array($docType, ['national_id', 'driving_license'], true) ? $docType : ($docType === 'unknown' ? 'national_id' : $docType),
            'licence' => $docType === 'unknown' ? 'driving_license' : $docType,
            'education' => $docType === 'unknown' ? 'education' : $docType,
            'language' => $docType === 'unknown' ? 'language_test' : $docType,
            'study' => $docType === 'unknown' ? 'study_permit' : $docType,
            default => $docType,
        };

        $extracted = [
            'fullName'         => $this->cleanStr($parsed['fullName'] ?? ''),
            'passportNumber'   => strtoupper($this->cleanStr($parsed['passportNumber'] ?? '')),
            'idNumber'         => $this->cleanStr($parsed['idNumber'] ?? ''),
            'dob'              => $this->cleanDate($parsed['dob'] ?? ''),
            'expiryDate'       => $this->cleanDate($parsed['expiryDate'] ?? ''),
            'issueDate'        => $this->cleanDate($parsed['issueDate'] ?? ''),
            'nationality'      => $this->cleanStr($parsed['nationality'] ?? ''),
            'gender'           => $this->mapGender($parsed['gender'] ?? ''),
            'address'          => $this->cleanStr($parsed['address'] ?? ''),
            'birthPlace'       => $this->cleanStr($parsed['birthPlace'] ?? ''),
            'institutionName'  => $this->cleanStr($parsed['institutionName'] ?? ''),
            'degreeName'       => $this->cleanStr($parsed['degreeName'] ?? ''),
            'graduationYear'   => $this->cleanYear($parsed['graduationYear'] ?? ''),
            'country'          => $this->cleanStr($parsed['country'] ?? ''),
            'testListening'    => $this->cleanScore($parsed['testListening'] ?? ''),
            'testReading'      => $this->cleanScore($parsed['testReading'] ?? ''),
            'testWriting'      => $this->cleanScore($parsed['testWriting'] ?? ''),
            'testSpeaking'     => $this->cleanScore($parsed['testSpeaking'] ?? ''),
            'testOverall'      => $this->cleanScore($parsed['testOverall'] ?? ''),
            'testDate'         => $this->cleanDate($parsed['testDate'] ?? ''),
        ];

        $fieldCount = count(array_filter($extracted, fn ($v) => $v !== ''));
        $authenticity = $this->normalizeAuthenticity($parsed['authenticity'] ?? null);

        // Keep result if we extracted fields OR authenticity raised a risk flag.
        if ($fieldCount === 0 && ($authenticity['verdict'] ?? 'unknown') === 'unknown') {
            return null;
        }

        $confidence = (float) ($parsed['confidence'] ?? 0.85);
        if ($confidence <= 0 || $confidence > 1) {
            $confidence = 0.85;
        }

        $status = $fieldCount >= 2 && $confidence >= 0.65 ? 'success' : 'partial_success';
        $message = null;
        if ($status === 'partial_success' && $fieldCount > 0) {
            $message = 'Please verify the extracted fields.';
        }
        if (in_array($authenticity['verdict'], ['suspicious', 'likely_fake'], true)) {
            $message = trim(($message ? $message.' ' : '').'Authenticity review recommended before accepting this document.');
        } elseif ($authenticity['verdict'] === 'needs_review') {
            $message = trim(($message ? $message.' ' : '').'Document authenticity needs manual review.');
        }

        return [
            'status'           => $status,
            'document_type'    => $docType,
            'extracted_data'   => $extracted,
            'confidence_score' => round($confidence, 3),
            'message'          => $message,
            'authenticity'     => $authenticity,
            'engine'           => 'openai_vision',
        ];
    }

    /**
     * @return array{verdict: string, score: float, summary: string, flags: list<string>}
     */
    private function normalizeAuthenticity(mixed $raw): array
    {
        $fallback = [
            'verdict' => 'unknown',
            'score'   => 0.0,
            'summary' => '',
            'flags'   => [],
        ];
        if (! is_array($raw)) {
            return $fallback;
        }

        $verdict = strtolower(trim((string) ($raw['verdict'] ?? 'unknown')));
        $allowed = ['likely_authentic', 'needs_review', 'suspicious', 'likely_fake', 'unknown'];
        if (! in_array($verdict, $allowed, true)) {
            $verdict = 'unknown';
        }

        $score = (float) ($raw['score'] ?? 0);
        if ($score < 0 || $score > 1) {
            $score = 0.0;
        }

        $flags = [];
        if (is_array($raw['flags'] ?? null)) {
            foreach ($raw['flags'] as $flag) {
                if (is_string($flag) && $flag !== '') {
                    $flags[] = substr($this->cleanStr($flag), 0, 64);
                }
            }
            $flags = array_values(array_unique(array_slice($flags, 0, 8)));
        }

        return [
            'verdict' => $verdict,
            'score'   => round($score, 3),
            'summary' => substr($this->cleanStr($raw['summary'] ?? ''), 0, 400),
            'flags'   => $flags,
        ];
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function prepareImageDataUrl(string $bytes, string $mime): ?array
    {
        if (function_exists('imagecreatefromstring') && function_exists('imagejpeg')) {
            $img = @imagecreatefromstring($bytes);
            if ($img !== false) {
                $w = imagesx($img);
                $h = imagesy($img);
                $maxEdge = 1600;
                if ($w > 0 && $h > 0 && max($w, $h) > $maxEdge) {
                    $scale = $maxEdge / max($w, $h);
                    $nw = max(1, (int) round($w * $scale));
                    $nh = max(1, (int) round($h * $scale));
                    $dst = imagecreatetruecolor($nw, $nh);
                    if ($dst !== false) {
                        imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
                        imagedestroy($img);
                        $img = $dst;
                    }
                }
                ob_start();
                imagejpeg($img, null, 85);
                imagedestroy($img);
                $jpeg = ob_get_clean();
                if (is_string($jpeg) && $jpeg !== '') {
                    return ['data:image/jpeg;base64,'.base64_encode($jpeg), 'image/jpeg'];
                }
            }
        }

        if (strlen($bytes) > 4_500_000) {
            return null;
        }

        $b64Mime = $mime === 'image/jpg' ? 'image/jpeg' : $mime;

        return ['data:'.$b64Mime.';base64,'.base64_encode($bytes), $b64Mime];
    }

    private function cleanStr(mixed $value): string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return '';
        }

        return trim(preg_replace('/\s+/', ' ', (string) $value) ?? '');
    }

    private function cleanDate(mixed $value): string
    {
        $raw = $this->cleanStr($value);
        if ($raw === '') {
            return '';
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m)) {
            $y = (int) $m[1];
            $mo = (int) $m[2];
            $d = (int) $m[3];
            if (checkdate($mo, $d, $y) && $y >= 1900 && $y <= 2100) {
                return sprintf('%04d-%02d-%02d', $y, $mo, $d);
            }

            return '';
        }
        if (preg_match('/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/', $raw, $m)) {
            $d = (int) $m[1];
            $mo = (int) $m[2];
            $y = (int) $m[3];
            if (checkdate($mo, $d, $y)) {
                return sprintf('%04d-%02d-%02d', $y, $mo, $d);
            }
        }

        return '';
    }

    private function cleanYear(mixed $value): string
    {
        $raw = $this->cleanStr($value);
        if (preg_match('/^(19|20)\d{2}$/', $raw)) {
            return $raw;
        }
        if (preg_match('/(19|20)\d{2}/', $raw, $m)) {
            return $m[0];
        }

        return '';
    }

    private function cleanScore(mixed $value): string
    {
        $raw = $this->cleanStr($value);
        if ($raw === '') {
            return '';
        }
        if (preg_match('/^\d{1,2}(?:\.\d{1,2})?$/', $raw)) {
            return $raw;
        }

        return '';
    }

    private function mapGender(mixed $value): string
    {
        $u = strtoupper($this->cleanStr($value));
        if (in_array($u, ['M', 'MALE'], true)) {
            return 'Male';
        }
        if (in_array($u, ['F', 'FEMALE'], true)) {
            return 'Female';
        }
        if (in_array($u, ['X', 'OTHER', 'UNSPECIFIED', 'U'], true)) {
            return 'Other';
        }

        return '';
    }
}
