<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Smalot\PdfParser\Parser;

class WorkspaceMapleLocalPdfTextExtractor
{
    private const MIN_CHARS = 40;

    /**
     * @return array{status: string, text: string, page_count: ?int, extraction_method: string, message: ?string}|null
     */
    public function extract(UploadedFile $file): ?array
    {
        $mime = strtolower((string) $file->getMimeType());
        if ($mime !== 'application/pdf' && $file->getClientOriginalExtension() !== 'pdf') {
            return null;
        }

        try {
            $parser = new Parser();
            $pdf    = $parser->parseFile($file->getRealPath());
            $raw    = (string) $pdf->getText();
            $text   = trim(preg_replace("/[ \t]+/u", ' ', $raw) ?? '');
            $text   = trim(preg_replace("/\n{3,}/u", "\n\n", $text) ?? '');
            $pages  = count($pdf->getPages());

            if (strlen($text) < self::MIN_CHARS) {
                return [
                    'status'            => 'error',
                    'text'              => $text,
                    'page_count'        => $pages > 0 ? $pages : null,
                    'extraction_method' => 'php_pdf_parser',
                    'message'           => 'This PDF has little or no selectable text (likely a scan). OCR is required.',
                ];
            }

            return [
                'status'            => 'success',
                'text'              => $text,
                'page_count'        => $pages > 0 ? $pages : null,
                'extraction_method' => 'php_pdf_parser',
                'message'           => null,
            ];
        } catch (\Throwable $e) {
            return [
                'status'            => 'error',
                'text'              => '',
                'page_count'        => null,
                'extraction_method' => 'php_pdf_parser',
                'message'           => 'Could not read this PDF locally.',
            ];
        }
    }
}
