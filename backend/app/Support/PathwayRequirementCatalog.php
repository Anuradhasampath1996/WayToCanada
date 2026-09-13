<?php

namespace App\Support;

/**
 * Versioned registry seed data (v1).
 * Active cases must snapshot this — they must not bind to a live mutable row.
 */
final class PathwayRequirementCatalog
{
    public const VERSION = 1;
    public const SOURCE_NAME = 'RCICMaster Pathway Requirement Registry';
    public const SOURCE_REFERENCE = 'Seeded from CaseManagementHubService checklists + CaseGovernmentFormCodes + package family maps (2026-09-13).';

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function definitions(): array
    {
        $baseDocs = [
            ['id' => 'passport', 'label' => 'Valid Passport (all pages)', 'category' => 'identity', 'reuse_from' => ['questionnaire.passportName']],
            ['id' => 'photos', 'label' => 'Passport-style photos (2×)', 'category' => 'identity', 'reuse_from' => []],
            ['id' => 'proof_address', 'label' => 'Proof of address', 'category' => 'identity', 'reuse_from' => []],
            ['id' => 'police_cert', 'label' => 'Police clearance certificate', 'category' => 'background', 'reuse_from' => []],
            ['id' => 'medical_exam', 'label' => 'Medical examination (IMM 1017E)', 'category' => 'medical', 'reuse_from' => []],
        ];

        $families = [
            'Express Entry' => [
                'calculators' => ['crs', 'fsw', 'cec', 'fst'],
                'extra_fields' => [
                    ['key' => 'express_entry_profile_number', 'label' => 'Express Entry profile number'],
                    ['key' => 'intended_noc_code', 'label' => 'Intended NOC code', 'reuse_from' => ['questionnaire.intendedNocCode']],
                ],
                'official_form_codes' => ['IMM 0008', 'IMM 5669', 'IMM 5406', 'IMM 5562'],
                'documents' => [
                    ['id' => 'ielts_results', 'label' => 'Language test results (IELTS / CELPIP)', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'eca', 'label' => 'Educational Credential Assessment (ECA)', 'category' => 'eligibility', 'reuse_from' => []],
                    ['id' => 'employment_refs', 'label' => 'Employment reference letters', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'pay_stubs', 'label' => 'Pay stubs (last 3 months)', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'tax_returns', 'label' => 'NOA / Tax returns', 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of funds (bank statements)', 'category' => 'financial', 'required_if' => ['needs_funds'], 'reuse_from' => []],
                    ['id' => 'express_entry_profile', 'label' => 'Express Entry profile confirmation', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'marriage_cert', 'label' => 'Marriage / relationship certificate', 'category' => 'relationship', 'required_if' => ['has_spouse'], 'reuse_from' => []],
                    ['id' => 'birth_certs', 'label' => 'Birth certificates (dependents)', 'category' => 'identity', 'required_if' => ['has_children'], 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep', 'pr_portal'],
            ],
            'PNP' => [
                'calculators' => ['crs', 'pnp'],
                'extra_fields' => [
                    ['key' => 'pnp_stream', 'label' => 'Provincial stream / nomination program'],
                    ['key' => 'nomination_certificate_number', 'label' => 'Nomination certificate number'],
                ],
                'official_form_codes' => ['IMM 0008', 'IMM 5669', 'IMM 5406'],
                'documents' => [
                    ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'eca', 'label' => 'Educational Credential Assessment', 'category' => 'eligibility', 'reuse_from' => []],
                    ['id' => 'employment_refs', 'label' => 'Employment reference letters', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'pnp_nomination', 'label' => 'Provincial Nomination Certificate', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'job_offer', 'label' => 'Job offer letter (if applicable)', 'category' => 'work', 'required_if' => ['has_job_offer'], 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of funds', 'category' => 'financial', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['provincial', 'ircc_rep', 'pr_portal'],
            ],
            'Family Sponsorship' => [
                'calculators' => ['family_sponsorship'],
                'extra_fields' => [
                    ['key' => 'sponsor_uci', 'label' => 'Sponsor UCI / client ID'],
                    ['key' => 'relationship_to_sponsor', 'label' => 'Relationship to sponsor'],
                ],
                'official_form_codes' => ['IMM 1344', 'IMM 0008', 'IMM 5540', 'IMM 5490'],
                'documents' => [
                    ['id' => 'sponsor_status', 'label' => "Sponsor's PR card / citizenship certificate", 'category' => 'sponsor', 'reuse_from' => []],
                    ['id' => 'marriage_cert', 'label' => 'Marriage / relationship certificate', 'category' => 'relationship', 'reuse_from' => []],
                    ['id' => 'sponsor_income', 'label' => "Sponsor's proof of income (NOA)", 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'relationship_proof', 'label' => 'Proof of genuine relationship', 'category' => 'relationship', 'reuse_from' => []],
                    ['id' => 'birth_certs', 'label' => 'Birth certificates (dependents)', 'category' => 'identity', 'required_if' => ['has_children'], 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep', 'pr_portal'],
            ],
            'Family Sponsorship – PGP' => [
                'calculators' => ['family_pgp'],
                'extra_fields' => [
                    ['key' => 'sponsor_uci', 'label' => 'Sponsor UCI / client ID'],
                    ['key' => 'mni_year', 'label' => 'Minimum necessary income year used'],
                ],
                'official_form_codes' => ['IMM 1344', 'IMM 0008', 'IMM 5768', 'IMM 5772'],
                'documents' => [
                    ['id' => 'sponsor_status', 'label' => "Sponsor's PR card / citizenship certificate", 'category' => 'sponsor', 'reuse_from' => []],
                    ['id' => 'sponsor_income', 'label' => "Sponsor's proof of income (NOA / MNI)", 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'birth_certs', 'label' => 'Birth certificates (parents / grandparents)', 'category' => 'identity', 'reuse_from' => []],
                    ['id' => 'relationship_proof', 'label' => 'Proof of parent/grandparent relationship', 'category' => 'relationship', 'reuse_from' => []],
                    ['id' => 'undertaking', 'label' => 'Sponsorship undertaking documents', 'category' => 'sponsor', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep', 'pr_portal'],
            ],
            'Study Permit' => [
                'calculators' => ['study_permit'],
                'extra_fields' => [
                    ['key' => 'dli_number', 'label' => 'DLI number'],
                    ['key' => 'program_name', 'label' => 'Program / course name', 'reuse_from' => ['questionnaire.canadaStudyProgram']],
                    ['key' => 'program_start_date', 'label' => 'Program start date', 'reuse_from' => ['questionnaire.canadaStudyStart']],
                    ['key' => 'funds_source', 'label' => 'Source of funds'],
                ],
                'official_form_codes' => ['IMM 1294', 'IMM 5707'],
                'documents' => [
                    ['id' => 'acceptance_letter', 'label' => 'Letter of acceptance from DLI', 'category' => 'study', 'reuse_from' => []],
                    ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'transcripts', 'label' => 'Academic transcripts', 'category' => 'study', 'reuse_from' => ['questionnaire.educationQuals.documentName']],
                    ['id' => 'study_plan', 'label' => 'Statement of purpose / study plan', 'category' => 'study', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of financial support', 'category' => 'financial', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
            'Work Permit' => [
                'calculators' => ['work_permit'],
                'extra_fields' => [
                    ['key' => 'employer_name', 'label' => 'Canadian employer name'],
                    ['key' => 'job_offer_noc', 'label' => 'Job offer NOC'],
                    ['key' => 'lmia_number', 'label' => 'LMIA / exemption number'],
                ],
                'official_form_codes' => ['IMM 1295', 'IMM 5707'],
                'documents' => [
                    ['id' => 'lmia_job_offer', 'label' => 'LMIA-approved or LMIA-exempt job offer', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'employment_contract', 'label' => 'Signed employment contract', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'ielts_results', 'label' => 'Language test results (if required)', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'qualifications', 'label' => 'Educational / professional qualifications', 'category' => 'work', 'reuse_from' => ['questionnaire.educationQuals.documentName']],
                    ['id' => 'resume', 'label' => 'Current resume / CV', 'category' => 'work', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
            'Community Pilot' => [
                'calculators' => ['crs', 'community_pilot'],
                'extra_fields' => [
                    ['key' => 'designated_community', 'label' => 'Designated community'],
                    ['key' => 'designated_employer', 'label' => 'Designated employer'],
                ],
                'official_form_codes' => ['IMM 0008', 'IMM 5669', 'IMM 5406'],
                'documents' => [
                    ['id' => 'job_offer', 'label' => 'Job offer from designated employer', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'community_recommendation', 'label' => 'Community recommendation letter', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'employment_refs', 'label' => 'Work experience letters', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Settlement funds', 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'settlement_plan', 'label' => 'Settlement plan (if required)', 'category' => 'application', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep', 'pr_portal'],
            ],
            'Quebec' => [
                'calculators' => ['quebec'],
                'extra_fields' => [
                    ['key' => 'arrima_number', 'label' => 'Arrima / CSQ reference'],
                ],
                'official_form_codes' => ['IMM 0008', 'IMM 5669', 'IMM 5406'],
                'documents' => [
                    ['id' => 'french_test', 'label' => 'French language test results (TEF / TCF)', 'category' => 'eligibility', 'reuse_from' => []],
                    ['id' => 'eca', 'label' => 'Educational Credential Assessment / Quebec diploma', 'category' => 'eligibility', 'reuse_from' => []],
                    ['id' => 'employment_refs', 'label' => 'Work experience letters', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of financial self-sufficiency', 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'csq', 'label' => 'Certificat de sélection du Québec (CSQ)', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'arrima', 'label' => 'Arrima expression of interest / invitation (if applicable)', 'category' => 'application', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['provincial', 'ircc_rep', 'pr_portal'],
            ],
            'Business Immigration' => [
                'calculators' => ['business'],
                'extra_fields' => [
                    ['key' => 'business_stream', 'label' => 'Business stream (SUV / investor / other)'],
                ],
                'official_form_codes' => ['IMM 0008', 'IMM 5669', 'IMM 5406'],
                'documents' => [
                    ['id' => 'business_plan', 'label' => 'Business plan / venture details', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of investment / settlement funds', 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'experience_letters', 'label' => 'Business / self-employment experience evidence', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'language_tests', 'label' => 'Language test results', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'letter_of_support', 'label' => 'Designated organization letter of support (Start-up Visa)', 'category' => 'application', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'required', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep', 'pr_portal'],
            ],
            'Visitor' => [
                'calculators' => ['visitor'],
                'extra_fields' => [
                    ['key' => 'visit_purpose', 'label' => 'Purpose of visit'],
                    ['key' => 'intended_stay_days', 'label' => 'Intended length of stay'],
                ],
                'official_form_codes' => ['IMM 5257', 'IMM 5707'],
                'documents' => [
                    ['id' => 'invitation_letter', 'label' => 'Invitation letter (if applicable)', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'proof_funds', 'label' => 'Proof of funds / ties to home country', 'category' => 'financial', 'reuse_from' => []],
                    ['id' => 'travel_history', 'label' => 'Travel history / itinerary', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'employment_letter', 'label' => 'Employment letter from home country', 'category' => 'work', 'reuse_from' => []],
                    ['id' => 'insurance', 'label' => 'Medical insurance (required for Super Visa)', 'category' => 'medical', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'optional', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
            'Citizenship' => [
                'calculators' => ['citizenship'],
                'extra_fields' => [
                    ['key' => 'physical_presence_days', 'label' => 'Physical presence days in Canada'],
                ],
                'official_form_codes' => ['CIT 0002'],
                'documents' => [
                    ['id' => 'pr_card', 'label' => 'PR card / confirmation of PR', 'category' => 'identity', 'reuse_from' => []],
                    ['id' => 'language_proof', 'label' => 'Language proof (IELTS / CELPIP / TEF)', 'category' => 'eligibility', 'reuse_from' => ['questionnaire.languageTestDocName']],
                    ['id' => 'tax_filings', 'label' => 'Tax filings / physical presence evidence', 'category' => 'eligibility', 'reuse_from' => []],
                    ['id' => 'knowledge_test', 'label' => 'Citizenship knowledge study materials', 'category' => 'application', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'optional', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
            'PR Card' => [
                'calculators' => ['pr_card'],
                'extra_fields' => [
                    ['key' => 'pr_card_number', 'label' => 'Current / last PR card number'],
                ],
                'official_form_codes' => ['IMM 5444', 'IMM 5455'],
                'documents' => [
                    ['id' => 'current_pr_card', 'label' => 'Current / expired PR card', 'category' => 'identity', 'reuse_from' => []],
                    ['id' => 'travel_history', 'label' => 'Travel history outside Canada', 'category' => 'application', 'reuse_from' => []],
                    ['id' => 'photos', 'label' => 'PR card photos', 'category' => 'identity', 'reuse_from' => []],
                    ['id' => 'proof_address', 'label' => 'Proof of address in Canada', 'category' => 'identity', 'reuse_from' => []],
                ],
                'representative' => ['default' => 'optional', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
            'default' => [
                'calculators' => [],
                'extra_fields' => [],
                'official_form_codes' => [],
                'documents' => [],
                'representative' => ['default' => 'optional', 'form_code' => 'IMM5476'],
                'submission_portals' => ['ircc_rep'],
            ],
        ];

        $out = [];
        foreach ($families as $key => $def) {
            $docs = array_merge($baseDocs, $def['documents']);
            $seen = [];
            $uniqueDocs = [];
            foreach ($docs as $doc) {
                if (isset($seen[$doc['id']])) {
                    continue;
                }
                $seen[$doc['id']] = true;
                $doc['required_if'] = $doc['required_if'] ?? [];
                $doc['reuse_from'] = $doc['reuse_from'] ?? [];
                $uniqueDocs[] = $doc;
            }

            $out[$key] = [
                'family' => $key === 'default' ? null : $key,
                'calculators' => $def['calculators'],
                'extra_fields' => $def['extra_fields'],
                'official_form_codes' => $def['official_form_codes'],
                'interactive_form_slugs' => [],
                'documents' => $uniqueDocs,
                'representative' => $def['representative'],
                'submission_portals' => $def['submission_portals'],
                'client_acknowledgement_required' => true,
                'client_signature_required' => $key !== 'default',
            ];
        }

        return $out;
    }

    public static function familyAliases(): array
    {
        return [
            'family.pgp' => 'Family Sponsorship – PGP',
            'Express Entry – Federal Skilled Worker' => 'Express Entry',
            'Express Entry – Canadian Experience Class' => 'Express Entry',
            'Express Entry – Federal Skilled Trades' => 'Express Entry',
        ];
    }

    public static function resolveKey(?string $pathwayCode, ?string $family, ?string $label): string
    {
        $aliases = self::familyAliases();
        if ($pathwayCode && isset($aliases[$pathwayCode])) {
            return $aliases[$pathwayCode];
        }
        if ($pathwayCode && isset(self::definitions()[$pathwayCode])) {
            return $pathwayCode;
        }
        if ($label && isset($aliases[$label])) {
            return $aliases[$label];
        }
        if ($family && isset(self::definitions()[$family])) {
            return $family;
        }
        if ($label && isset(self::definitions()[$label])) {
            return $label;
        }

        return 'default';
    }
}
