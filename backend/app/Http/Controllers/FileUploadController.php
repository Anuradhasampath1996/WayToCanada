<?php

namespace App\Http\Controllers;

use App\Support\ClientDocumentStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        if (! in_array($type, ['client-document', 'rcic-certificate', 'other'], true)) {
            $type = 'other';
        }

        $stored = ClientDocumentStorage::store($uploadedFile, $type);

        return response()->json([
            'message' => 'File uploaded successfully.',
            'path'    => $stored,
            'disk'    => ClientDocumentStorage::diskForPath($stored) ?? ClientDocumentStorage::DISK_S3,
            'bucket'  => config('filesystems.disks.localstack.bucket'),
        ], 201);
    }
}
