<?php

namespace App\Services\ClientCompliance;

use App\Models\ClientProfile;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class ClientCompliancePacketPdfService
{
    public function __construct(
        private ClientCompliancePacketService $packetService,
    ) {}

    public function generate(ClientProfile $profile, User $consultant, Request $request): \Barryvdh\DomPDF\PDF
    {
        $data = $this->packetService->gather($profile, $consultant, $request);

        return Pdf::loadView('pdf.client_compliance_packet', $data)
            ->setPaper('a4', 'portrait')
            ->setOption('isRemoteEnabled', false)
            ->setOption('isHtml5ParserEnabled', true);
    }

    public function filename(ClientProfile $profile): string
    {
        return $this->packetService->filename($profile);
    }
}
