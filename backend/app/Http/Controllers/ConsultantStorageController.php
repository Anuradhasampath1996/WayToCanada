<?php

namespace App\Http\Controllers;

use App\Models\ConsultantStorageFile;
use App\Models\ConsultantStorageFolder;
use App\Services\ConsultantStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConsultantStorageController extends Controller
{
    public function __construct(private ConsultantStorageService $storage) {}

    /** GET /api/v1/consultant/storage */
    public function summary(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json([
            'summary' => $this->storage->getSummary($userId),
            'addons'  => $request->user()
                ->consultantStorageAddons()
                ->with('package')
                ->where('status', 'active')
                ->get(),
        ]);
    }

    /** GET /api/v1/consultant/storage/browse?folder_id= */
    public function browse(Request $request): JsonResponse
    {
        $userId   = $request->user()->id;
        $folderId = $request->query('folder_id');

        $folder = null;
        if ($folderId) {
            $folder = ConsultantStorageFolder::where('user_id', $userId)->findOrFail($folderId);
        }

        $foldersQuery = ConsultantStorageFolder::where('user_id', $userId);
        if ($folder) {
            $foldersQuery->where('parent_id', $folder->id);
        } else {
            $foldersQuery->whereNull('parent_id');
        }

        $folders = $foldersQuery->orderBy('name')->get(['id', 'name', 'parent_id', 'created_at'])
            ->map(function ($f) use ($userId) {
                $subfolders = ConsultantStorageFolder::where('user_id', $userId)
                    ->where('parent_id', $f->id)
                    ->count();
                $files = ConsultantStorageFile::where('user_id', $userId)
                    ->where('folder_id', $f->id)
                    ->count();

                return [
                    'id'            => $f->id,
                    'name'          => $f->name,
                    'parent_id'     => $f->parent_id,
                    'created_at'    => $f->created_at,
                    'subfolder_count' => $subfolders,
                    'file_count'    => $files,
                    'item_count'    => $subfolders + $files,
                ];
            })
            ->values();

        $filesQuery = ConsultantStorageFile::where('user_id', $userId);
        if ($folder) {
            $filesQuery->where('folder_id', $folder->id);
        } else {
            $filesQuery->whereNull('folder_id');
        }

        $files = $filesQuery->orderBy('original_filename')->get([
            'id', 'folder_id', 'original_filename', 'mime_type', 'size_bytes', 'created_at',
        ]);

        if ($folder) {
            $folder->load('parent');
        }

        return response()->json([
            'summary'    => $this->storage->getSummary($userId),
            'folder'     => $folder ? ['id' => $folder->id, 'name' => $folder->name, 'parent_id' => $folder->parent_id] : null,
            'breadcrumb' => $this->storage->buildBreadcrumb($folder),
            'folders'    => $folders,
            'files'      => $files,
        ]);
    }

    /** POST /api/v1/consultant/storage/folders */
    public function createFolder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:consultant_storage_folders,id',
        ]);

        $userId = $request->user()->id;

        if (! empty($data['parent_id'])) {
            ConsultantStorageFolder::where('user_id', $userId)->findOrFail($data['parent_id']);
        }

        try {
            $this->storage->assertFolderNameUnique($userId, $data['parent_id'] ?? null, $data['name']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $folder = ConsultantStorageFolder::create([
            'user_id'   => $userId,
            'parent_id' => $data['parent_id'] ?? null,
            'name'      => trim($data['name']),
        ]);

        return response()->json(['data' => $folder, 'message' => 'Folder created.'], 201);
    }

    /** PATCH /api/v1/consultant/storage/folders/{folder} */
    public function renameFolder(Request $request, ConsultantStorageFolder $folder): JsonResponse
    {
        if (! $this->storage->folderBelongsToUser($folder, $request->user()->id)) {
            return response()->json(['message' => 'Folder not found.'], 404);
        }

        $data = $request->validate(['name' => 'required|string|max:255']);

        try {
            $this->storage->assertFolderNameUnique(
                $folder->user_id,
                $folder->parent_id,
                $data['name'],
                $folder->id
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $folder->update(['name' => trim($data['name'])]);

        return response()->json(['data' => $folder, 'message' => 'Folder renamed.']);
    }

    /** DELETE /api/v1/consultant/storage/folders/{folder} */
    public function deleteFolder(Request $request, ConsultantStorageFolder $folder): JsonResponse
    {
        if (! $this->storage->folderBelongsToUser($folder, $request->user()->id)) {
            return response()->json(['message' => 'Folder not found.'], 404);
        }

        $this->storage->deleteFolderRecursive($folder);

        return response()->json(['message' => 'Folder deleted.']);
    }

    /** POST /api/v1/consultant/storage/files */
    public function uploadFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file'      => 'required|file|max:51200', // 50 MB per file
            'folder_id' => 'nullable|integer|exists:consultant_storage_folders,id',
        ]);

        $userId = $request->user()->id;
        $upload = $request->file('file');
        $size   = $upload->getSize() ?: 0;

        if (! empty($data['folder_id'])) {
            ConsultantStorageFolder::where('user_id', $userId)->findOrFail($data['folder_id']);
        }

        try {
            $this->storage->assertCanUpload($userId, $size);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $original = $upload->getClientOriginalName();
        $safeName = Str::uuid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $original);
        $path     = "consultant-storage/{$userId}/{$safeName}";

        Storage::disk('local')->putFileAs(
            "consultant-storage/{$userId}",
            $upload,
            $safeName
        );

        $file = ConsultantStorageFile::create([
            'user_id'           => $userId,
            'folder_id'         => $data['folder_id'] ?? null,
            'disk_path'         => $path,
            'original_filename' => $original,
            'mime_type'         => $upload->getMimeType(),
            'size_bytes'        => $size,
        ]);

        return response()->json([
            'data'    => $file,
            'summary' => $this->storage->getSummary($userId),
            'message' => 'File uploaded.',
        ], 201);
    }

    /** GET /api/v1/consultant/storage/files/{file}/download */
    public function downloadFile(Request $request, ConsultantStorageFile $file): StreamedResponse|JsonResponse
    {
        if ((int) $file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($file->disk_path)) {
            return response()->json(['message' => 'File missing on server.'], 404);
        }

        return $disk->download($file->disk_path, $file->original_filename);
    }

    /** GET /api/v1/consultant/storage/files/{file}/view */
    public function viewFile(Request $request, ConsultantStorageFile $file): BinaryFileResponse|JsonResponse
    {
        if ((int) $file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($file->disk_path)) {
            return response()->json(['message' => 'File missing on server.'], 404);
        }

        $mime = $file->mime_type ?: 'application/octet-stream';

        return response()->file($disk->path($file->disk_path), [
            'Content-Type'        => $mime,
            'Content-Disposition' => 'inline; filename="' . addslashes($file->original_filename) . '"',
        ]);
    }

    /** PATCH /api/v1/consultant/storage/files/{file} */
    public function renameFile(Request $request, ConsultantStorageFile $file): JsonResponse
    {
        if ((int) $file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $data = $request->validate([
            'original_filename' => ['required', 'string', 'max:255', 'regex:/^[^\/\\\\]+$/'],
        ]);

        $file->update(['original_filename' => trim($data['original_filename'])]);

        return response()->json([
            'data'    => $file,
            'message' => 'File renamed.',
        ]);
    }

    /** DELETE /api/v1/consultant/storage/files/{file} */
    public function deleteFile(Request $request, ConsultantStorageFile $file): JsonResponse
    {
        if ((int) $file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $userId = $request->user()->id;
        $this->storage->deleteFileRecord($file);

        return response()->json([
            'message' => 'File deleted.',
            'summary' => $this->storage->getSummary($userId),
        ]);
    }
}
