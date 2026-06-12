<?php

namespace App\Services\ClientActivity;

use App\Enums\ClientActivityType;
use App\Models\ClientActivityLog;
use App\Models\ClientProfile;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ClientActivityReportPdfService
{
    public function buildQuery(ClientProfile $profile, Request $request): Builder
    {
        $query = ClientActivityLog::where('client_profile_id', $profile->id)
            ->orderBy('occurred_at')
            ->orderBy('id');

        if ($actor = $request->query('actor')) {
            $query->where('actor_type', $actor);
        }

        if ($type = $request->query('event_type')) {
            $query->where('event_type', $type);
        }

        if ($category = $request->query('category')) {
            $types = collect(ClientActivityType::cases())
                ->filter(fn ($t) => $t->category() === $category)
                ->map(fn ($t) => $t->value)
                ->all();
            $query->whereIn('event_type', $types);
        }

        if ($from = $request->query('from')) {
            $query->where('occurred_at', '>=', $from);
        }

        if ($to = $request->query('to')) {
            $query->where('occurred_at', '<=', $to . ' 23:59:59');
        }

        return $query;
    }

    public function generate(ClientProfile $profile, User $consultant, Request $request): \Barryvdh\DomPDF\PDF
    {
        $profile->loadMissing('user', 'caseFile');
        $consultant->loadMissing([]);

        $logs = $this->buildQuery($profile, $request)->get();

        $companyAddress = collect([
            $consultant->company_address_line1,
            $consultant->company_address_line2,
            $consultant->company_city,
            $consultant->company_province,
            $consultant->company_postal_code,
            $consultant->company_country,
        ])->filter()->implode(', ');

        $clientPhone = $profile->user?->phone ?? $profile->phone;
        $generatedAt = now();
        $reportRef = sprintf(
            'WTC-CAR-%d-%s',
            $profile->id,
            $generatedAt->format('YmdHis'),
        );

        $filterLabels = $this->filterSummary($request);

        $clientActions = $logs->where('actor_type', 'client')->count();
        $consultantActions = $logs->where('actor_type', 'consultant')->count();

        return Pdf::loadView('pdf.client_activity_report', [
            'reportRef'         => $reportRef,
            'generatedAt'       => $generatedAt->timezone('America/Toronto')->format('F j, Y \a\t g:i A T'),
            'consultant'        => $consultant,
            'companyName'       => $consultant->company_name ?: $consultant->name,
            'companyAddress'    => $companyAddress,
            'companyPhone'      => $consultant->company_phone ?: $consultant->phone,
            'companyWeb'        => $consultant->company_website,
            'companyLogo'       => $consultant->company_logo,
            'rcicNo'            => $consultant->rcic_number,
            'client'            => $profile,
            'clientUser'        => $profile->user,
            'clientPhone'       => $clientPhone,
            'pathway'           => $profile->immigration_pathway ?? $profile->caseFile?->immigration_pathway,
            'logs'              => $logs,
            'totalEvents'       => $logs->count(),
            'clientActions'     => $clientActions,
            'consultantActions' => $consultantActions,
            'filterLabels'      => $filterLabels,
        ])
            ->setPaper('a4', 'portrait')
            ->setOption('isRemoteEnabled', true)
            ->setOption('isHtml5ParserEnabled', true);
    }

    public function filename(ClientProfile $profile): string
    {
        $profile->loadMissing('user');
        $name = $profile->user?->name ?? 'client';
        $slug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $name) ?: 'client';

        return 'client-activity-report-' . trim($slug, '-') . '-' . now()->format('Y-m-d') . '.pdf';
    }

    /** @return list<string> */
    private function filterSummary(Request $request): array
    {
        $labels = [];

        if ($actor = $request->query('actor')) {
            $labels[] = 'Actor: ' . ucfirst($actor);
        }

        if ($category = $request->query('category')) {
            $labels[] = 'Category: ' . str_replace('_', ' ', ucfirst($category));
        }

        if ($from = $request->query('from')) {
            $labels[] = 'From: ' . $from;
        }

        if ($to = $request->query('to')) {
            $labels[] = 'To: ' . $to;
        }

        if ($labels === []) {
            $labels[] = 'All recorded events (no filters applied)';
        }

        return $labels;
    }
}
