<?php

namespace App\Services;

use App\Models\ConsultantStorageAddon;
use App\Models\ConsultantStorageFile;
use App\Models\ConsultantStorageFolder;
use Illuminate\Support\Facades\DB;

class ConsultantStorageService
{
    public const FREE_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

    public function getUsedBytes(int $userId): int
    {
        return (int) ConsultantStorageFile::where('user_id', $userId)->sum('size_bytes');
    }

    public function getAddonBytes(int $userId): int
    {
        return (int) ConsultantStorageAddon::query()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->sum('extra_bytes');
    }

    public function getQuotaBytes(int $userId): int
    {
        return self::FREE_BYTES + $this->getAddonBytes($userId);
    }

    public function getSummary(int $userId): array
    {
        $used  = $this->getUsedBytes($userId);
        $quota = $this->getQuotaBytes($userId);

        return [
            'used_bytes'      => $used,
            'quota_bytes'     => $quota,
            'free_bytes'      => self::FREE_BYTES,
            'addon_bytes'     => $this->getAddonBytes($userId),
            'remaining_bytes' => max(0, $quota - $used),
            'used_percent'    => $quota > 0 ? round(($used / $quota) * 100, 1) : 0,
        ];
    }

    public function assertCanUpload(int $userId, int $additionalBytes): void
    {
        $used  = $this->getUsedBytes($userId);
        $quota = $this->getQuotaBytes($userId);

        if ($used + $additionalBytes > $quota) {
            $needGb = round(($used + $additionalBytes - $quota) / (1024 ** 3), 2);
            throw new \RuntimeException(
                "Storage quota exceeded. You need about {$needGb} GB more. Upgrade your storage plan to continue."
            );
        }
    }

    public function folderBelongsToUser(ConsultantStorageFolder $folder, int $userId): bool
    {
        return (int) $folder->user_id === $userId;
    }

    public function assertFolderNameUnique(int $userId, ?int $parentId, string $name, ?int $exceptId = null): void
    {
        $query = ConsultantStorageFolder::where('user_id', $userId)
            ->where('name', $name);

        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }

        if ($exceptId) {
            $query->where('id', '!=', $exceptId);
        }

        if ($query->exists()) {
            throw new \RuntimeException('A folder with this name already exists in this location.');
        }
    }

    public function deleteFolderRecursive(ConsultantStorageFolder $folder): void
    {
        DB::transaction(function () use ($folder) {
            foreach ($folder->children as $child) {
                $this->deleteFolderRecursive($child);
            }

            foreach ($folder->files as $file) {
                $this->deleteFileRecord($file);
            }

            $folder->delete();
        });
    }

    public function deleteFileRecord(ConsultantStorageFile $file): void
    {
        $disk = \Illuminate\Support\Facades\Storage::disk('local');
        if ($disk->exists($file->disk_path)) {
            $disk->delete($file->disk_path);
        }
        $file->delete();
    }

    public function buildBreadcrumb(?ConsultantStorageFolder $folder): array
    {
        $crumbs = [];
        $current = $folder;

        while ($current) {
            array_unshift($crumbs, [
                'id'   => $current->id,
                'name' => $current->name,
            ]);

            if (! $current->parent_id) {
                break;
            }

            $current = ConsultantStorageFolder::find($current->parent_id);
        }

        return $crumbs;
    }
}
