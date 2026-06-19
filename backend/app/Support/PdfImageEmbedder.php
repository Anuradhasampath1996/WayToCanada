<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

final class PdfImageEmbedder
{
    /** Embed a logo for DomPDF without HTTP fetches (avoids artisan serve deadlocks). */
    public static function logoDataUri(?string $logo): ?string
    {
        if (! $logo) {
            return null;
        }

        $logo = trim($logo);

        if (str_starts_with($logo, 'data:image/')) {
            return $logo;
        }

        $relative = self::storageRelativePath($logo);
        if ($relative !== null) {
            $diskPath = Storage::disk('public')->path($relative);
            if (is_file($diskPath)) {
                return self::fileToDataUri($diskPath);
            }

            $publicPath = public_path('storage/'.$relative);
            if (is_file($publicPath)) {
                return self::fileToDataUri($publicPath);
            }
        }

        if (is_file($logo)) {
            return self::fileToDataUri($logo);
        }

        return null;
    }

    private static function storageRelativePath(string $logo): ?string
    {
        $path = parse_url($logo, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            $path = $logo;
        }

        if (preg_match('#/storage/(.+)$#', $path, $matches)) {
            return ltrim($matches[1], '/');
        }

        if (str_starts_with($path, 'storage/')) {
            return ltrim(substr($path, strlen('storage/')), '/');
        }

        return null;
    }

    private static function fileToDataUri(string $path): ?string
    {
        $mime = mime_content_type($path) ?: 'image/png';

        if ($mime === 'image/webp') {
            return self::webpToPngDataUri($path);
        }

        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            return null;
        }

        return 'data:'.$mime.';base64,'.base64_encode($bytes);
    }

    private static function webpToPngDataUri(string $path): ?string
    {
        if (! function_exists('imagecreatefromwebp')) {
            return null;
        }

        $image = @imagecreatefromwebp($path);
        if ($image === false) {
            return null;
        }

        ob_start();
        imagepng($image);
        imagedestroy($image);
        $png = ob_get_clean();

        if ($png === false || $png === '') {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($png);
    }
}
