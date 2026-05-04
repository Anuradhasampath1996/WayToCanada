<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;

class FileUploadController extends Controller
{
    /**
     * Show the upload form (web only, dev convenience).
     */
    public function showForm()
    {
        return view('upload');
    }

    /**
     * Handle file upload → LocalStack S3 (waytocanada-docs bucket).
     *
     * Accepted types  : pdf, jpg, jpeg, png
     * Max size        : 10 MB
     * Storage path    : {type}/{year}/{month}/{original-name}
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                File::types(['pdf', 'jpg', 'jpeg', 'png'])
                    ->max(10 * 1024), // 10 MB
            ],
            'type' => ['nullable', 'string', 'in:client-document,rcic-certificate,other'],
        ]);

        $uploadedFile = $request->file('file');
        $type         = $request->input('type', 'other');

        // Build a structured, collision-safe path inside the bucket.
        $path = sprintf(
            '%s/%s/%s/%s',
            $type,
            now()->format('Y'),
            now()->format('m'),
            $uploadedFile->getClientOriginalName()
        );

        // Store on the localstack disk (S3-compatible, path-style endpoint).
        $stored = Storage::disk('localstack')->putFileAs(
            dirname($path),
            $uploadedFile,
            basename($path),
            'private'
        );

        if (! $stored) {
            return response()->json(['message' => 'File upload failed.'], 500);
        }

        return response()->json([
            'message' => 'File uploaded successfully.',
            'path'    => $stored,
            'disk'    => 'localstack',
            'bucket'  => config('filesystems.disks.localstack.bucket'),
        ], 201);
    }
}
