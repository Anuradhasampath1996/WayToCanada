<?php

namespace App\Support;

use App\Models\CaseFile;

class RetainerAgreementConfig
{
    public static function defaults(): array
    {
        return [
            'totalFee'            => 3000,
            'currency'            => 'CAD',
            'milestone1Pct'       => 30,
            'milestone1Label'     => 'Upon signing this agreement (Retainer Fee)',
            'milestone2Pct'       => 40,
            'milestone2Label'     => 'Upon receiving an ITA, provincial nomination, or equivalent approval',
            'milestone3Pct'       => 30,
            'milestone3Label'     => 'Before final application submission to IRCC',
            'docDeadlineDays'     => 14,
            'refundPolicy'        =>
                'The retainer fee (Milestone 1) is non-refundable once work has commenced. ' .
                'Milestones 2 and 3 are not payable if the corresponding government action does not occur. ' .
                'No refund will be issued if the application is refused due to fraudulent documents provided by the client.',
            'customClauses'       => '',
            'consultantLicenseNo' => '',
            'clientName'          => '',
            'clientEmail'         => '',
            'consultantName'      => '',
            'pathway'             => '',
            'scopeDescription'    => '',
        ];
    }

    public static function merge(?array $stored, array $overrides = []): array
    {
        return array_merge(static::defaults(), $stored ?? [], $overrides);
    }

    /** @return array<string, mixed> */
    public static function validateRules(): array
    {
        return [
            'agreement_config'                    => 'nullable|array',
            'agreement_config.totalFee'             => 'nullable|numeric|min:0|max:50000',
            'agreement_config.currency'           => 'nullable|string|in:CAD,USD',
            'agreement_config.milestone1Pct'        => 'nullable|integer|min:0|max:100',
            'agreement_config.milestone2Pct'        => 'nullable|integer|min:0|max:100',
            'agreement_config.milestone3Pct'        => 'nullable|integer|min:0|max:100',
            'agreement_config.milestone1Label'      => 'nullable|string|max:500',
            'agreement_config.milestone2Label'      => 'nullable|string|max:500',
            'agreement_config.milestone3Label'      => 'nullable|string|max:500',
            'agreement_config.docDeadlineDays'      => 'nullable|integer|min:3|max:60',
            'agreement_config.refundPolicy'         => 'nullable|string|max:10000',
            'agreement_config.customClauses'        => 'nullable|string|max:10000',
            'agreement_config.consultantLicenseNo'  => 'nullable|string|max:50',
            'agreement_config.clientName'           => 'nullable|string|max:255',
            'agreement_config.clientEmail'          => 'nullable|email|max:255',
            'agreement_config.consultantName'       => 'nullable|string|max:255',
            'agreement_config.pathway'              => 'nullable|string|max:150',
            'agreement_config.scopeDescription'     => 'nullable|string|max:2000',
            'agreement_config.clientDetails'          => 'nullable|array',
            'agreement_config.clientDetails.fullLegalName' => 'nullable|string|max:255',
            'agreement_config.clientDetails.email'         => 'nullable|email|max:255',
            'agreement_config.clientDetails.phone'         => 'nullable|string|max:50',
            'agreement_config.clientDetails.dateOfBirth'   => 'nullable|string|max:100',
            'agreement_config.clientDetails.passportNumber'=> 'nullable|string|max:100',
            'agreement_config.clientDetails.citizenship'   => 'nullable|string|max:100',
            'agreement_config.clientDetails.residentialAddress' => 'nullable|string|max:500',
            'agreement_config.clientDetails.caseReference' => 'nullable|string|max:50',
            'agreement_fee'                       => 'nullable|numeric|min:0',
            'agreement_notes'                     => 'nullable|string|max:5000',
        ];
    }

    public static function milestonePctSum(array $config): int
    {
        return (int) ($config['milestone1Pct'] ?? 0)
            + (int) ($config['milestone2Pct'] ?? 0)
            + (int) ($config['milestone3Pct'] ?? 0);
    }

    public static function normalize(array $input, ?string $pathway = null): array
    {
        $config = static::merge($input);

        if ($pathway) {
            $config['pathway'] = $pathway;
        }

        $config['totalFee'] = (float) ($config['totalFee'] ?? 0);

        return $config;
    }

    public static function formatAgreementPayload(CaseFile $caseFile): array
    {
        $stored = $caseFile->agreement_config ?? [];
        $config = static::merge($stored, [
            'pathway'       => $caseFile->immigration_pathway ?? ($stored['pathway'] ?? ''),
            'customClauses' => $caseFile->agreement_notes ?? ($stored['customClauses'] ?? ''),
        ]);

        if ($caseFile->agreement_fee) {
            $config['totalFee'] = (float) $caseFile->agreement_fee;
        }

        return $config;
    }

    public static function defaultMilestonePayments(): array
    {
        return ['1' => false, '2' => false, '3' => false];
    }
}
