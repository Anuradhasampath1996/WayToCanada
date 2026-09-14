<?php

namespace App\Services\Academy\Ai\Dto;

class ResearchNotes
{
    /**
     * @param  list<array{title:?string,url:?string,organization:?string,excerpt:?string,why_relevant:?string}>  $candidateSources
     * @param  list<array{url:?string,note:?string}>  $changedMaterialFlags
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public string $notes,
        public array $candidateSources = [],
        public array $changedMaterialFlags = [],
        public bool $secondaryOnly = true,
        public string $provider = 'openai',
        public ?string $providerTaskId = null,
        public ?string $providerRequestId = null,
        public array $raw = [],
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data, string $provider = 'openai'): self
    {
        return new self(
            notes: (string) ($data['notes'] ?? ''),
            candidateSources: is_array($data['candidate_sources'] ?? null) ? $data['candidate_sources'] : [],
            changedMaterialFlags: is_array($data['changed_material_flags'] ?? null) ? $data['changed_material_flags'] : [],
            secondaryOnly: (bool) ($data['secondary_only'] ?? true),
            provider: $provider,
            providerTaskId: $data['provider_task_id'] ?? null,
            providerRequestId: $data['provider_request_id'] ?? null,
            raw: $data,
        );
    }
}
