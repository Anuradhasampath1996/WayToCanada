<?php

namespace App\Services\Academy\Ai;

use App\Models\Academy\AcademyQuestionVersion;

class AcademyAiDuplicateDetector
{
    public function normalize(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    public function findDuplicate(string $stem): ?AcademyQuestionVersion
    {
        $needle = $this->normalize($stem);
        if ($needle === '') {
            return null;
        }

        foreach (AcademyQuestionVersion::query()->orderByDesc('id')->limit(500)->get() as $version) {
            if ($this->normalize((string) $version->question_text) === $needle) {
                return $version;
            }
        }

        return null;
    }
}
