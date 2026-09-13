<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\QuestionnaireSubmission;
use App\Support\QuestionnaireDocumentResolver;

class CaseProfileFactsResolver
{
    /**
     * Circumstance flags used by the requirement snapshot (required_if).
     *
     * @return array<string, mixed>
     */
    public function facts(CaseFile $caseFile): array
    {
        $submission = $this->submissionFor($caseFile);
        $main = $this->mainData($caseFile, $submission);
        $step1 = $this->step1Data($caseFile, $submission);
        $spouse = is_array($submission?->spouse_data) ? $submission->spouse_data : [];
        $children = is_array($submission?->children_data) ? $submission->children_data : [];

        $married = strtolower((string) ($step1['married'] ?? $main['married'] ?? '')) === 'yes';
        $hasSpouse = $married || $this->filled($spouse);
        $hasChildren = $this->filled($children);
        $hasJobOffer = $this->filled($this->firstFilled([
            $main['jobOffer'] ?? null,
            $main['canadianJobOffer'] ?? null,
            $main['lmiaNumber'] ?? null,
            $main['hasJobOffer'] ?? null,
        ]));
        $insideCanada = $this->looksCanadian($main['countryOfResidence'] ?? null)
            || $this->filled($main['studiedInCanada'] ?? null)
            || $this->filled($main['canadianWork'] ?? null);

        $pathway = strtolower((string) ($caseFile->pathway_code.' '.$caseFile->immigration_pathway));
        $cecExempt = str_contains($pathway, 'cec') || str_contains($pathway, 'canadian experience');

        return [
            'has_spouse' => $hasSpouse,
            'has_children' => $hasChildren,
            'has_job_offer' => $hasJobOffer,
            'needs_funds' => ! $cecExempt,
            'inside_canada' => $insideCanada,
            'represented_by_consultant' => true,
            'client_self_submit' => false,
        ];
    }

    public function fieldValue(CaseFile $caseFile, array $reuseFrom): mixed
    {
        foreach ($reuseFrom as $path) {
            $value = $this->valueAtPath($caseFile, (string) $path);
            if ($this->filled($value)) {
                return is_array($value) ? $this->firstScalar($value) : $value;
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $reuseFrom
     * @return array<string, mixed>|null
     */
    public function documentCandidate(CaseFile $caseFile, array $reuseFrom): ?array
    {
        $submission = $this->submissionFor($caseFile);
        if (! $submission) {
            return null;
        }

        $wantedKeys = [];
        foreach ($reuseFrom as $path) {
            $leaf = $this->leafKey((string) $path);
            if ($leaf !== '') {
                $wantedKeys[] = $leaf;
            }
        }

        foreach (QuestionnaireDocumentResolver::listUploadedDocuments($submission) as $doc) {
            if ($wantedKeys === [] || in_array($doc['field_key'], $wantedKeys, true)) {
                return [
                    'source' => 'intake',
                    'field_key' => $doc['field_key'],
                    'label' => $doc['label'],
                    'person' => $doc['person'],
                    'path' => $doc['path'],
                    'original_filename' => $doc['original_filename'],
                ];
            }
        }

        return null;
    }

    public function submissionFor(CaseFile $caseFile): ?QuestionnaireSubmission
    {
        $caseFile->loadMissing('clientProfile');
        $userId = $caseFile->clientProfile?->user_id;
        if (! $userId) {
            return null;
        }

        return QuestionnaireSubmission::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();
    }

    private function valueAtPath(CaseFile $caseFile, string $path): mixed
    {
        $submission = $this->submissionFor($caseFile);
        $main = $this->mainData($caseFile, $submission);
        $step1 = $this->step1Data($caseFile, $submission);

        $normalized = preg_replace('/^questionnaire\./', '', $path) ?? $path;
        if ($normalized === 'educationQuals.documentName') {
            $quals = $main['educationQuals'] ?? [];
            if (is_array($quals)) {
                foreach ($quals as $qual) {
                    if (is_array($qual) && $this->filled($qual['documentName'] ?? null)) {
                        return $qual['documentName'];
                    }
                }
            }

            return null;
        }

        return $main[$normalized] ?? $step1[$normalized] ?? null;
    }

    private function leafKey(string $path): string
    {
        $normalized = preg_replace('/^questionnaire\./', '', $path) ?? $path;
        $parts = explode('.', $normalized);

        return (string) end($parts);
    }

    /**
     * @return array<string, mixed>
     */
    private function mainData(CaseFile $caseFile, ?QuestionnaireSubmission $submission): array
    {
        if (is_array($submission?->main_data)) {
            return $submission->main_data;
        }

        $snap = $caseFile->questionnaire_snapshot ?? [];

        return is_array($snap['main_data'] ?? null) ? $snap['main_data'] : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function step1Data(CaseFile $caseFile, ?QuestionnaireSubmission $submission): array
    {
        if (is_array($submission?->step1_data)) {
            return $submission->step1_data;
        }

        $snap = $caseFile->questionnaire_snapshot ?? [];

        return is_array($snap['step1_data'] ?? null) ? $snap['step1_data'] : [];
    }

    /**
     * @param  list<mixed>  $values
     */
    private function firstFilled(array $values): mixed
    {
        foreach ($values as $value) {
            if ($this->filled($value)) {
                return $value;
            }
        }

        return null;
    }

    private function firstScalar(array $value): mixed
    {
        foreach ($value as $item) {
            if (is_array($item)) {
                $nested = $this->firstScalar($item);
                if ($this->filled($nested)) {
                    return $nested;
                }
                continue;
            }
            if ($this->filled($item)) {
                return $item;
            }
        }

        return null;
    }

    private function looksCanadian(mixed $value): bool
    {
        return str_contains(strtolower((string) $value), 'canada');
    }

    private function filled(mixed $value): bool
    {
        if (is_array($value)) {
            return $value !== [];
        }

        return trim((string) $value) !== '';
    }
}
