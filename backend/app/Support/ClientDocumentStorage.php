<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientDocumentStorage
{
    public const DISK_S3 = 'localstack';

    public const DISK_LOCAL = 'local';

    public static function buildPath(string $type, string $originalName): string
    {
        return sprintf(
            '%s/%s/%s/%s',
            $type,
            now()->format('Y'),
            now()->format('m'),
            $originalName,
        );
    }

    /**
     * Store an uploaded client document. Tries S3 first, then local disk.
     */
    public static function store(UploadedFile $file, string $type = 'client-document'): string
    {
        $path = self::buildPath($type, $file->getClientOriginalName());

        try {
            $stored = Storage::disk(self::DISK_S3)->putFileAs(
                dirname($path),
                $file,
                basename($path),
                'private',
            );
            if ($stored) {
                return $stored;
            }
        } catch (\Throwable $e) {
            Log::warning('Client document S3 upload failed; using local disk.', [
                'path'  => $path,
                'error' => $e->getMessage(),
            ]);
        }

        $stored = Storage::disk(self::DISK_LOCAL)->putFileAs(
            dirname($path),
            $file,
            basename($path),
        );

        if (! $stored) {
            throw new \RuntimeException('File upload failed.');
        }

        return $path;
    }

  /**
     * Locate a stored file path on any configured disk.
     */
    public static function locatePath(string $basename): ?string
    {
        $years = [(int) date('Y'), (int) date('Y') - 1];

        foreach ($years as $year) {
            for ($month = 1; $month <= 12; $month++) {
                $candidate = sprintf('client-document/%d/%02d/%s', $year, $month, $basename);
                if (self::existsOnAnyDisk($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    public static function existsOnAnyDisk(string $path): bool
    {
        return self::safeExists(self::DISK_S3, $path) || self::safeExists(self::DISK_LOCAL, $path);
    }

    public static function diskForPath(string $path): ?string
    {
        if (self::safeExists(self::DISK_S3, $path)) {
            return self::DISK_S3;
        }
        if (self::safeExists(self::DISK_LOCAL, $path)) {
            return self::DISK_LOCAL;
        }

        return null;
    }

    public static function streamResponse(string $path, bool $download = false): StreamedResponse
    {
        $disk = self::diskForPath($path);
        if (! $disk) {
            abort(404, 'File not found.');
        }

        $filename = basename($path);
        $mime     = Storage::disk($disk)->mimeType($path) ?: 'application/octet-stream';

        return Storage::disk($disk)->response($path, $filename, [
            'Content-Type'        => $mime,
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.addslashes($filename).'"',
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    private static function safeExists(string $disk, string $path): bool
    {
        try {
            return Storage::disk($disk)->exists($path);
        } catch (\Throwable) {
            return false;
        }
    }
}
