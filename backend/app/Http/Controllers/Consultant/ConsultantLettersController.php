<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\ConsultantLetter;
use App\Models\ConsultantLetterTemplate;
use App\Services\ConsultantLetterContextService;
use App\Services\ConsultantLetterGenerationService;
use App\Services\ConsultantLetterPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ConsultantLettersController extends Controller
{
    public function __construct(
        private ConsultantLetterGenerationService $generation,
        private ConsultantLetterContextService $context,
        private ConsultantLetterPdfService $pdf,
    ) {}

    /** GET /api/v1/consultant/letters/meta */
    public function meta(Request $request): JsonResponse
    {
        $types = [];
        foreach (config('consultant_letters.letter_types', []) as $slug => $label) {
            $types[] = ['slug' => $slug, 'label' => $label];
        }

        return response()->json([
            'letter_types'     => $types,
            'openai_available' => $this->generation->openAiAvailable(),
            'branding'         => $this->pdf->brandingForConsultant($request->user()),
            'branding_warnings' => $this->brandingWarnings($request->user()),
        ]);
    }

    /** @return list<string> */
    private function brandingWarnings(\App\Models\User $user): array
    {
        $warnings = [];
        if (empty($user->company_logo)) {
            $warnings[] = 'Upload your company logo in Account settings for a professional letterhead.';
        }
        if (empty($user->rcic_number)) {
            $warnings[] = 'Add your RCIC license number in Account settings.';
        }
        if (empty($user->company_name) && empty($user->name)) {
            $warnings[] = 'Complete your consultant profile before sending letters.';
        }

        return $warnings;
    }

    /** GET /api/v1/consultant/letters/context/{profile} */
    public function clientContext(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeClient($request, $profile);

        return response()->json([
            'data' => $this->context->buildClientContext($profile, $request->user()),
        ]);
    }

    /** GET /api/v1/consultant/letters/templates */
    public function templatesIndex(Request $request): JsonResponse
    {
        $templates = ConsultantLetterTemplate::where('consultant_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (ConsultantLetterTemplate $t) => $this->generation->formatTemplate($t));

        return response()->json(['data' => $templates]);
    }

    /** POST /api/v1/consultant/letters/templates */
    public function templatesStore(Request $request): JsonResponse
    {
        $data = $this->validateTemplate($request);

        if ($data['is_default'] ?? false) {
            $this->clearDefaultTemplates($request->user()->id);
        }

        $template = ConsultantLetterTemplate::create([
            'consultant_id'       => $request->user()->id,
            ...$data,
        ]);

        return response()->json([
            'data'    => $this->generation->formatTemplate($template),
            'message' => 'Template saved.',
        ], 201);
    }

    /** PUT /api/v1/consultant/letters/templates/{template} */
    public function templatesUpdate(Request $request, ConsultantLetterTemplate $template): JsonResponse
    {
        $this->authorizeTemplate($request, $template);
        $data = $this->validateTemplate($request, partial: true);

        if ($data['is_default'] ?? false) {
            $this->clearDefaultTemplates($request->user()->id, $template->id);
        }

        $template->update($data);

        return response()->json([
            'data'    => $this->generation->formatTemplate($template->fresh()),
            'message' => 'Template updated.',
        ]);
    }

    /** DELETE /api/v1/consultant/letters/templates/{template} */
    public function templatesDestroy(Request $request, ConsultantLetterTemplate $template): JsonResponse
    {
        $this->authorizeTemplate($request, $template);
        $template->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    /** GET /api/v1/consultant/letters */
    public function index(Request $request): JsonResponse
    {
        $letters = ConsultantLetter::where('consultant_id', $request->user()->id)
            ->with('clientProfile.user:id,name')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn (ConsultantLetter $l) => $this->generation->formatLetter($l));

        return response()->json(['data' => $letters]);
    }

    /** GET /api/v1/consultant/letters/{letter} */
    public function show(Request $request, ConsultantLetter $letter): JsonResponse
    {
        $this->authorizeLetter($request, $letter);

        return response()->json(['data' => $this->generation->formatLetter($letter)]);
    }

    /** POST /api/v1/consultant/letters */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateLetter($request);
        $this->validateClientOwnership($request, $data['client_profile_id'] ?? null);

        $letter = ConsultantLetter::create([
            'consultant_id'     => $request->user()->id,
            'generation_mode'   => $data['generation_mode'] ?? 'blank',
            'context_snapshot'  => $this->buildSnapshotForStore($request, $data['client_profile_id'] ?? null),
            ...$data,
        ]);

        return response()->json([
            'data'    => $this->generation->formatLetter($letter),
            'message' => 'Letter draft saved.',
        ], 201);
    }

    /** PUT /api/v1/consultant/letters/{letter} */
    public function update(Request $request, ConsultantLetter $letter): JsonResponse
    {
        $this->authorizeLetter($request, $letter);
        $data = $this->validateLetter($request, partial: true);

        if (array_key_exists('client_profile_id', $data)) {
            $this->validateClientOwnership($request, $data['client_profile_id']);
        }

        $letter->update($data);

        return response()->json([
            'data'    => $this->generation->formatLetter($letter->fresh()),
            'message' => 'Letter updated.',
        ]);
    }

    /** DELETE /api/v1/consultant/letters/{letter} */
    public function destroy(Request $request, ConsultantLetter $letter): JsonResponse
    {
        $this->authorizeLetter($request, $letter);
        $letter->delete();

        return response()->json(['message' => 'Letter deleted.']);
    }

    /** POST /api/v1/consultant/letters/generate */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'letter_type'          => 'required|string|max:60',
            'custom_instructions'  => 'nullable|string|max:5000',
            'client_profile_id'    => 'nullable|integer',
            'template_id'          => 'nullable|integer',
            'letter_id'            => 'nullable|integer',
            'save_draft'           => 'nullable|boolean',
        ]);

        $this->validateClientOwnership($request, $data['client_profile_id'] ?? null);

        if (! empty($data['template_id'])) {
            $template = ConsultantLetterTemplate::where('consultant_id', $request->user()->id)
                ->findOrFail($data['template_id']);
            $data['template_id'] = $template->id;
        }

        $generated = $this->generation->generate($request->user(), $data);
        $generated['body_html'] = $this->generation->normalizeBodyHtml($generated['body_html']);

        if ($data['save_draft'] ?? true) {
            $clientProfileId = $data['client_profile_id'] ?? null;
            $clientProfile = $clientProfileId
                ? ClientProfile::forConsultant($request->user()->id)->find($clientProfileId)
                : null;

            $payload = [
                'client_profile_id'   => $clientProfileId,
                'template_id'         => $data['template_id'] ?? null,
                'title'               => $generated['title'],
                'letter_type'         => $data['letter_type'],
                'status'              => 'draft',
                'subject'             => $generated['subject'],
                'body_html'           => $generated['body_html'],
                'generation_mode'     => 'ai',
                'generation_prompt'   => $data['custom_instructions'] ?? null,
                'context_snapshot'    => $this->context->buildSnapshot($request->user(), $clientProfile),
                'openai_used'         => $generated['openai_used'],
            ];

            if (! empty($data['letter_id'])) {
                $letter = ConsultantLetter::where('consultant_id', $request->user()->id)
                    ->findOrFail((int) $data['letter_id']);
                $letter->update($payload);
            } else {
                $letter = ConsultantLetter::create([
                    'consultant_id' => $request->user()->id,
                    ...$payload,
                ]);
            }

            return response()->json([
                'data'    => $this->generation->formatLetter($letter),
                'notes'   => $generated['notes'] ?? null,
                'message' => $generated['openai_used']
                    ? 'Letter drafted with AI.'
                    : 'Letter draft created (AI unavailable — edit before sending).',
            ], 201);
        }

        return response()->json([
            'data' => [
                'title'       => $generated['title'],
                'subject'     => $generated['subject'],
                'body_html'   => $generated['body_html'],
                'openai_used' => $generated['openai_used'],
            ],
            'notes' => $generated['notes'] ?? null,
        ]);
    }

    /** POST /api/v1/consultant/letters/{letter}/export-pdf */
    public function exportPdf(Request $request, ConsultantLetter $letter): Response
    {
        $this->authorizeLetter($request, $letter);

        if (empty($letter->body_html)) {
            abort(422, 'Letter body is empty.');
        }

        $pdf = $this->pdf->generate($letter);

        return $pdf->download($this->pdf->filename($letter));
    }

    /** POST /api/v1/consultant/letters/{letter}/save-as-template */
    public function saveAsTemplate(Request $request, ConsultantLetter $letter): JsonResponse
    {
        $this->authorizeLetter($request, $letter);

        $data = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        $template = ConsultantLetterTemplate::create([
            'consultant_id'       => $request->user()->id,
            'name'                => $data['name'],
            'letter_type'         => $letter->letter_type,
            'applies_to_client'   => $letter->client_profile_id !== null,
            'subject_template'    => $letter->subject,
            'body_html'           => $letter->body_html,
            'body_json'           => $letter->body_json,
            'prompt_instructions' => $letter->generation_prompt,
        ]);

        return response()->json([
            'data'    => $this->generation->formatTemplate($template),
            'message' => 'Saved as template.',
        ], 201);
    }

    private function authorizeClient(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function authorizeTemplate(Request $request, ConsultantLetterTemplate $template): void
    {
        if ($template->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function authorizeLetter(Request $request, ConsultantLetter $letter): void
    {
        if ($letter->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }

    private function validateClientOwnership(Request $request, ?int $clientProfileId): void
    {
        if ($clientProfileId === null) {
            return;
        }

        $exists = ClientProfile::forConsultant($request->user()->id)
            ->where('id', $clientProfileId)
            ->exists();

        if (! $exists) {
            abort(403, 'Client not found.');
        }
    }

    /** @return array<string, mixed> */
    private function validateTemplate(Request $request, bool $partial = false): array
    {
        $rules = [
            'name'                => ($partial ? 'sometimes|' : '').'required|string|max:120',
            'letter_type'         => ($partial ? 'sometimes|' : '').'string|max:60',
            'applies_to_client'   => 'boolean',
            'prompt_instructions' => 'nullable|string|max:5000',
            'subject_template'    => 'nullable|string|max:500',
            'body_html'           => 'nullable|string',
            'body_json'           => 'nullable|array',
            'is_default'          => 'boolean',
        ];

        return $request->validate($rules);
    }

    /** @return array<string, mixed> */
    private function validateLetter(Request $request, bool $partial = false): array
    {
        $rules = [
            'client_profile_id' => 'nullable|integer',
            'template_id'       => 'nullable|integer',
            'title'             => ($partial ? 'sometimes|' : '').'required|string|max:200',
            'letter_type'       => ($partial ? 'sometimes|' : '').'string|max:60',
            'status'            => 'nullable|string|in:draft,final',
            'subject'           => 'nullable|string|max:500',
            'body_html'         => 'nullable|string',
            'body_json'         => 'nullable|array',
            'generation_mode'   => 'nullable|string|in:blank,template,ai',
            'generation_prompt' => 'nullable|string|max:5000',
        ];

        return $request->validate($rules);
    }

    /** @return array<string, mixed>|null */
    private function buildSnapshotForStore(Request $request, ?int $clientProfileId): ?array
    {
        if ($clientProfileId === null) {
            return ['consultant' => $this->context->buildConsultantContext($request->user())];
        }

        $profile = ClientProfile::forConsultant($request->user()->id)->find($clientProfileId);

        return $profile
            ? $this->context->buildSnapshot($request->user(), $profile)
            : null;
    }

    private function clearDefaultTemplates(int $consultantId, ?int $exceptId = null): void
    {
        $query = ConsultantLetterTemplate::where('consultant_id', $consultantId);
        if ($exceptId) {
            $query->where('id', '!=', $exceptId);
        }
        $query->update(['is_default' => false]);
    }
}
