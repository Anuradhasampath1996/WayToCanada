<?php

namespace App\Services\GovernmentForms;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Support\Facades\Storage;

class GovernmentFormStoragePathValidator
{
    /**
     * Resolve a DB-backed relative path and ensure it remains inside the approved private root.
     *
     * @throws AuthorizationException when the path is invalid or escapes the approved root
     */
    public function resolveGeneratedPath(string $relativePath, string $diskName = 'local'): string
    {
        $relativePath = trim(str_replace('\\', '/', $relativePath));

        if ($relativePath === '' || str_starts_with($relativePath, '/') || preg_match('/^[A-Za-z]:/', $relativePath)) {
            throw new AuthorizationException('Access denied.');
        }

        if (str_contains($relativePath, '..') || str_contains($relativePath, "\0") || str_contains($relativePath, '%')) {
            throw new AuthorizationException('Access denied.');
        }

        $rootPrefix = trim(str_replace('\\', '/', config('government_forms.storage.generated', 'government-forms/generated')), '/');
        if ($rootPrefix === '') {
            throw new AuthorizationException('Access denied.');
        }

        $normalizedRelative = $this->normalizeRelativePath($relativePath);
        if (! str_starts_with($normalizedRelative, $rootPrefix.'/') && $normalizedRelative !== $rootPrefix) {
            throw new AuthorizationException('Access denied.');
        }

        $disk = Storage::disk($diskName);
        $absolutePath = $disk->path($normalizedRelative);
        $rootAbsolute = rtrim($disk->path($rootPrefix), DIRECTORY_SEPARATOR);
        $resolved = realpath($absolutePath);

        if ($resolved === false || ! is_file($resolved)) {
            throw new FileNotFoundException('Generated form not found.');
        }

        $resolvedRoot = realpath($rootAbsolute) ?: $rootAbsolute;
        if (! $this->pathIsWithinRoot($resolved, $resolvedRoot)) {
            throw new AuthorizationException('Access denied.');
        }

        return $normalizedRelative;
    }

    /**
     * Resolve an official template path inside the approved templates root.
     *
     * @throws AuthorizationException when the path is invalid or escapes the approved root
     */
    public function resolveTemplatePath(string $relativePath, string $diskName = 'local'): string
    {
        $relativePath = trim(str_replace('\\', '/', $relativePath));

        if ($relativePath === '' || str_starts_with($relativePath, '/') || preg_match('/^[A-Za-z]:/', $relativePath)) {
            throw new AuthorizationException('Access denied.');
        }

        if (str_contains($relativePath, '..') || str_contains($relativePath, "\0") || str_contains($relativePath, '%')) {
            throw new AuthorizationException('Access denied.');
        }

        $normalizedRelative = $this->normalizeRelativePath($relativePath);
        if (! $this->isAllowedTemplatePath($normalizedRelative)) {
            throw new AuthorizationException('Access denied.');
        }

        $disk = Storage::disk($diskName);
        $absolutePath = $disk->path($normalizedRelative);
        $rootPrefix = $this->matchingTemplateRoot($normalizedRelative);
        $rootAbsolute = rtrim($disk->path($rootPrefix), DIRECTORY_SEPARATOR);
        $resolved = realpath($absolutePath);

        if ($resolved === false || ! is_file($resolved)) {
            throw new FileNotFoundException('Official template not found.');
        }

        $resolvedRoot = realpath($rootAbsolute) ?: $rootAbsolute;
        if (! $this->pathIsWithinRoot($resolved, $resolvedRoot)) {
            throw new AuthorizationException('Access denied.');
        }

        return $normalizedRelative;
    }

    /** @return list<string> */
    private function allowedTemplateRoots(): array
    {
        $roots = [
            trim(str_replace('\\', '/', config('government_forms.storage.templates', 'government-forms/templates')), '/'),
            'government-forms-poc/templates',
        ];

        return array_values(array_unique(array_filter($roots)));
    }

    private function isAllowedTemplatePath(string $normalizedRelative): bool
    {
        foreach ($this->allowedTemplateRoots() as $rootPrefix) {
            if ($normalizedRelative === $rootPrefix || str_starts_with($normalizedRelative, $rootPrefix.'/')) {
                return true;
            }
        }

        return false;
    }

    private function matchingTemplateRoot(string $normalizedRelative): string
    {
        foreach ($this->allowedTemplateRoots() as $rootPrefix) {
            if ($normalizedRelative === $rootPrefix || str_starts_with($normalizedRelative, $rootPrefix.'/')) {
                return $rootPrefix;
            }
        }

        throw new AuthorizationException('Access denied.');
    }

    private function normalizeRelativePath(string $relativePath): string
    {
        $segments = array_values(array_filter(explode('/', $relativePath), fn (string $segment): bool => $segment !== '' && $segment !== '.'));

        $normalized = [];
        foreach ($segments as $segment) {
            if ($segment === '..') {
                throw new AuthorizationException('Access denied.');
            }

            $normalized[] = $segment;
        }

        return implode('/', $normalized);
    }

    private function pathIsWithinRoot(string $resolvedPath, string $resolvedRoot): bool
    {
        $resolvedPath = rtrim(str_replace('\\', '/', $resolvedPath), '/');
        $resolvedRoot = rtrim(str_replace('\\', '/', $resolvedRoot), '/');

        return $resolvedPath === $resolvedRoot || str_starts_with($resolvedPath.'/', $resolvedRoot.'/');
    }
}
