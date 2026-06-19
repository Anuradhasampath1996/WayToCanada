<?php

namespace App\Services\ClientActivity;

use App\Enums\ClientActivityType;
use App\Models\CaseFile;
use App\Models\ClientActivityLog;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientActivityRecorder
{
    public function record(
        ClientProfile $profile,
        ClientActivityType $type,
        string $title,
        ?string $description = null,
        ?User $actor = null,
        string $actorType = 'system',
        ?CaseFile $caseFile = null,
        ?array $metadata = null,
        ?string $dedupeKey = null,
        ?Carbon $occurredAt = null,
        ?Request $request = null,
    ): ?ClientActivityLog {
        if ($dedupeKey && ClientActivityLog::where('client_profile_id', $profile->id)
            ->where('dedupe_key', $dedupeKey)->exists()) {
            return null;
        }

        $caseFile ??= $profile->caseFile;

        return ClientActivityLog::create([
            'client_profile_id' => $profile->id,
            'case_file_id'      => $caseFile?->id,
            'actor_user_id'     => $actor?->id,
            'actor_type'        => $actorType,
            'actor_name'        => $actor?->name,
            'event_type'        => $type->value,
            'title'             => $title,
            'description'       => $description,
            'metadata'          => $metadata,
            'ip_address'        => $request?->ip(),
            'dedupe_key'        => $dedupeKey,
            'occurred_at'       => $occurredAt ?? now(),
        ]);
    }

    public function actorFromRequest(Request $request, string $role): array
    {
        return [
            'user' => $request->user(),
            'type' => $role,
        ];
    }

    /** Backfill historical milestones from existing DB records (idempotent). */
    public function syncHistorical(ClientProfile $profile): int
    {
        $profile->loadMissing('user', 'caseFile');
        $count = 0;

        if ($profile->invited_at) {
            $count += $this->record(
                $profile,
                ClientActivityType::CLIENT_INVITED,
                'Client invited to portal',
                'Invitation email sent to join RCICMASTER client portal.',
                $profile->consultant ? User::find($profile->consultant_id) : null,
                'consultant',
                dedupeKey: 'hist:invited',
                occurredAt: $profile->invited_at,
            ) ? 1 : 0;
        }

        if ($profile->user?->created_at) {
            $count += $this->record(
                $profile,
                ClientActivityType::CLIENT_REGISTERED,
                'Client account registered',
                $profile->user->email . ' activated their account.',
                $profile->user,
                'client',
                dedupeKey: 'hist:registered',
                occurredAt: $profile->user->created_at,
            ) ? 1 : 0;
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
        if ($submission?->submitted_at) {
            $count += $this->record(
                $profile,
                ClientActivityType::QUESTIONNAIRE_SUBMITTED,
                'Questionnaire submitted',
                'Client formally submitted their immigration questionnaire.',
                $profile->user,
                'client',
                dedupeKey: 'hist:questionnaire',
                occurredAt: $submission->submitted_at,
            ) ? 1 : 0;
        }

        $caseFile = $profile->caseFile;
        if ($caseFile) {
            if ($caseFile->immigration_pathway && $caseFile->pathway_assessment_at) {
                $count += $this->record(
                    $profile,
                    ClientActivityType::PATHWAY_ASSIGNED,
                    'Immigration pathway assigned',
                    'Pathway: ' . $caseFile->immigration_pathway,
                    null,
                    'consultant',
                    $caseFile,
                    dedupeKey: 'hist:pathway',
                    occurredAt: $caseFile->pathway_assessment_at,
                ) ? 1 : 0;
            }

            if ($caseFile->agreement_sent_at) {
                $count += $this->record(
                    $profile,
                    ClientActivityType::AGREEMENT_SENT,
                    'Retainer agreement sent',
                    'Consultant sent retainer agreement for client signature.',
                    null,
                    'consultant',
                    $caseFile,
                    dedupeKey: 'hist:agreement_sent',
                    occurredAt: $caseFile->agreement_sent_at,
                ) ? 1 : 0;
            }

            if ($caseFile->agreement_signed_at) {
                $count += $this->record(
                    $profile,
                    ClientActivityType::AGREEMENT_SIGNED,
                    'Retainer agreement signed',
                    'Client signed the retainer agreement.',
                    $profile->user,
                    'client',
                    $caseFile,
                    dedupeKey: 'hist:agreement_signed',
                    occurredAt: $caseFile->agreement_signed_at,
                ) ? 1 : 0;
            }

            if ($caseFile->application_forms_verified_at) {
                $count += $this->record(
                    $profile,
                    ClientActivityType::FORMS_VERIFIED,
                    'Application forms verified',
                    'Consultant verified all required application forms.',
                    null,
                    'consultant',
                    $caseFile,
                    dedupeKey: 'hist:forms_verified',
                    occurredAt: $caseFile->application_forms_verified_at,
                ) ? 1 : 0;
            }

            foreach ($caseFile->documentSubmissions()->orderBy('created_at')->get() as $doc) {
                $count += $this->backfillDocument($profile, $caseFile, $doc);
            }
        }

        return $count;
    }

    private function backfillDocument(ClientProfile $profile, CaseFile $caseFile, DocumentSubmission $doc): int
    {
        $n = 0;
        $n += $this->record(
            $profile,
            ClientActivityType::DOCUMENT_UPLOADED,
            'Document uploaded',
            '"' . $doc->document_label . '" uploaded.',
            $doc->uploader,
            'client',
            $caseFile,
            ['document_type' => $doc->document_type, 'submission_id' => $doc->id],
            'hist:doc_upload:' . $doc->id,
            $doc->created_at,
        ) ? 1 : 0;

        if ($doc->reviewed_at && $doc->status === 'consultant_approved') {
            $n += $this->record(
                $profile,
                ClientActivityType::DOCUMENT_APPROVED,
                'Document approved',
                '"' . $doc->document_label . '" approved by consultant.',
                $doc->reviewer,
                'consultant',
                $caseFile,
                ['submission_id' => $doc->id],
                'hist:doc_approved:' . $doc->id,
                $doc->reviewed_at,
            ) ? 1 : 0;
        }

        if ($doc->reviewed_at && $doc->status === 'consultant_rejected') {
            $n += $this->record(
                $profile,
                ClientActivityType::DOCUMENT_REJECTED,
                'Document rejected',
                '"' . $doc->document_label . '" rejected.' . ($doc->rejection_comment ? ' ' . Str::limit($doc->rejection_comment, 120) : ''),
                $doc->reviewer,
                'consultant',
                $caseFile,
                ['submission_id' => $doc->id],
                'hist:doc_rejected:' . $doc->id,
                $doc->reviewed_at,
            ) ? 1 : 0;
        }

        return $n;
    }
}
