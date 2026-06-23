<?php

namespace App\Services;

use App\Models\ClientProfile;
use App\Models\ConsultantClientAiDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class WorkspaceMapleDocumentService
{
    public const MAX_DOCUMENTS = 5;

    public const MAX_FILE_KB = 10240;

    public const MAX_CONTEXT_CHARS_PER_DOC = 8000;

    public function __construct(
        private WorkspaceMapleDocumentTextExtractor $textExtractor,
    ) {}

    /** @return list<array<string, mixed>> */
    public function listForWorkspace(ClientProfile $profile, User $consultant): array
    {
        return ConsultantClientAiDocument::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (ConsultantClientAiDocument $doc) => $this->serializeDocument($doc))
            ->all();
    }

    /** @return array<string, mixed> */
    public function upload(ClientProfile $profile, User $consultant, UploadedFile $file): array
    {
        $activeCount = ConsultantClientAiDocument::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->where('status', 'ready')
            ->count();

        if ($activeCount >= self::MAX_DOCUMENTS) {
            throw new \InvalidArgumentException(
                'You can attach up to '.self::MAX_DOCUMENTS.' documents for Maple. Remove one before uploading another.'
            );
        }

        $extraction = $this->textExtractor->extract($file);
        $text       = $extraction['text'];
        $status     = $extraction['status'] === 'success' && $text !== '' ? 'ready' : 'failed';

        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename  = Str::uuid()->toString().'.'.$extension;
        $path      = sprintf(
            'maple-documents/%d/%d/%s',
            $profile->id,
            $consultant->id,
            $filename,
        );

        Storage::disk('local')->putFileAs(
            dirname($path),
            $file,
            basename($path),
        );

        $document = ConsultantClientAiDocument::create([
            'client_profile_id'  => $profile->id,
            'consultant_id'      => $consultant->id,
            'original_filename'  => $file->getClientOriginalName(),
            'mime_type'          => (string) $file->getMimeType(),
            'storage_path'       => $path,
            'disk'               => 'local',
            'extracted_text'     => $text !== '' ? $text : null,
            'char_count'         => strlen($text),
            'page_count'         => $extraction['page_count'],
            'extraction_method'  => $extraction['extraction_method'],
            'status'             => $status,
            'error_message'      => $status === 'failed' ? ($extraction['message'] ?? 'No readable text found in this file.') : null,
        ]);

        return $this->serializeDocument($document);
    }

    public function delete(ClientProfile $profile, User $consultant, ConsultantClientAiDocument $document): void
    {
        if ($document->client_profile_id !== $profile->id || $document->consultant_id !== $consultant->id) {
            abort(404);
        }

        if ($document->storage_path !== '') {
            Storage::disk($document->disk ?: 'local')->delete($document->storage_path);
        }

        $document->delete();
    }

    /**
     * @return list<array{filename: string, text: string, char_count: int}>
     */
    public function contextPackForChat(ClientProfile $profile, User $consultant): array
    {
        return ConsultantClientAiDocument::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->where('status', 'ready')
            ->whereNotNull('extracted_text')
            ->orderByDesc('id')
            ->limit(self::MAX_DOCUMENTS)
            ->get()
            ->map(function (ConsultantClientAiDocument $doc) {
                $text = (string) $doc->extracted_text;
                if (strlen($text) > self::MAX_CONTEXT_CHARS_PER_DOC) {
                    $text = substr($text, 0, self::MAX_CONTEXT_CHARS_PER_DOC)
                        ."\n\n[Text truncated for Maple context — full file is stored in workspace.]";
                }

                return [
                    'filename'   => $doc->original_filename,
                    'text'       => $text,
                    'char_count' => (int) $doc->char_count,
                ];
            })
            ->all();
    }

    /** @return array<string, mixed> */
    private function serializeDocument(ConsultantClientAiDocument $document): array
    {
        return [
            'id'                  => $document->id,
            'original_filename'   => $document->original_filename,
            'mime_type'           => $document->mime_type,
            'char_count'          => (int) $document->char_count,
            'page_count'          => $document->page_count,
            'extraction_method'   => $document->extraction_method,
            'status'              => $document->status,
            'error_message'       => $document->error_message,
            'created_at'          => $document->created_at?->toIso8601String(),
        ];
    }
}
