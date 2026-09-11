<?php

namespace Database\Seeders;

use App\Models\PathwayNode;
use Illuminate\Database\Seeder;

/**
 * Phase A immigration pathway catalog.
 * Safe to re-run: upserts by code (never truncates case data).
 */
class PathwayCatalogSeeder extends Seeder
{
    private const EE_PACKAGE = ['Express Entry (FSW, CEC, FST)', 'Express Entry'];

    private const PNP_PACKAGE = ['Provincial Nominee Program (PNP - Non-Express Entry)', 'Provincial Nominee'];

    private const STUDY_PACKAGE = [
        'Study permit from outside Canada',
        'Study permit from inside Canada',
        'Extend your study permit',
    ];

    private const WORK_PACKAGE = [
        'Work permit from outside Canada',
        'Work permit from inside Canada',
    ];

    public function run(): void
    {
        $sort = 0;

        // ── Express Entry ────────────────────────────────────────────────────
        $this->upsert([
            'code' => 'ee',
            'parent_code' => null,
            'label' => 'Express Entry',
            'family' => 'express_entry',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::EE_PACKAGE,
            'is_assignable' => false,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['ee.fsw', 'Express Entry – Federal Skilled Worker', 'Express Entry – Federal Skilled Worker', 3500, true],
            ['ee.cec', 'Express Entry – Canadian Experience Class', 'Express Entry – Canadian Experience Class', 3000, true],
            ['ee.fst', 'Express Entry – Federal Skilled Trades', 'Express Entry – Federal Skilled Trades', 3200, true],
        ] as [$code, $label, $crs, $fee, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'ee',
                'label' => $label,
                'family' => 'express_entry',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::EE_PACKAGE,
                'crs_backend_value' => $crs,
                'retainer_fee' => $fee,
                'retainer_description' => $this->eeDescription($code),
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        $this->upsert([
            'code' => 'ee.category',
            'parent_code' => 'ee',
            'label' => 'Express Entry – Category-based selection',
            'family' => 'express_entry',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::EE_PACKAGE,
            'crs_backend_value' => 'Express Entry – Canadian Experience Class',
            'retainer_fee' => 3200,
            'retainer_description' => 'Category-based Express Entry draw targeting, CRS optimization, and PR application support.',
            'is_assignable' => false,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['ee.category.french', 'French-language proficiency'],
            ['ee.category.healthcare', 'Healthcare & Social Services'],
            ['ee.category.stem', 'STEM occupations'],
            ['ee.category.trades', 'Trade occupations'],
            ['ee.category.education', 'Education occupations'],
            ['ee.category.transport', 'Transport occupations'],
            ['ee.category.other', 'Other targeted Canadian-experience categories'],
        ] as $i => [$code, $label]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'ee.category',
                'label' => 'EE Category – '.$label,
                'family' => 'express_entry',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::EE_PACKAGE,
                'crs_backend_value' => 'Express Entry – Canadian Experience Class',
                'retainer_fee' => 3200,
                'retainer_description' => 'Category-based Express Entry ('.$label.') — profile, draw monitoring, and PR submission.',
                'is_assignable' => true,
                'is_popular' => $i < 3,
                'sort_order' => $sort++,
            ]);
        }

        // ── Family Sponsorship ───────────────────────────────────────────────
        $this->upsert([
            'code' => 'family',
            'parent_code' => null,
            'label' => 'Family Sponsorship',
            'family' => 'family',
            'assessment_branch' => 'sponsorship',
            'package_leaf_preferences' => [
                'Family Sponsorship — Spouse or Partner',
                'Family Sponsorship — Parents and Grandparents',
                'Family Sponsorship',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 2500,
            'retainer_description' => 'Family sponsorship assessment, forms, supporting evidence, and IRCC submission.',
            'is_assignable' => false,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'family.spouse',
            'parent_code' => 'family',
            'label' => 'Family Sponsorship – Spouse / Common-law Partner',
            'family' => 'family',
            'assessment_branch' => 'sponsorship',
            'package_leaf_preferences' => [
                'Family Sponsorship — Spouse or Partner',
                'Family Sponsorship',
            ],
            'retainer_fee' => 2800,
            'retainer_description' => 'Spouse or common-law partner sponsorship — relationship evidence, forms, and submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'family.child',
            'parent_code' => 'family',
            'label' => 'Family Sponsorship – Dependent Child',
            'family' => 'family',
            'assessment_branch' => 'sponsorship',
            'package_leaf_preferences' => [
                'Family Sponsorship — Spouse or Partner',
                'Family Sponsorship',
            ],
            'retainer_fee' => 2200,
            'retainer_description' => 'Dependent child sponsorship — eligibility, forms, and IRCC submission.',
            'is_assignable' => true,
            'is_popular' => false,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'family.pgp',
            'parent_code' => 'family',
            'label' => 'Family Sponsorship – Parents and Grandparents',
            'family' => 'family',
            'assessment_branch' => 'sponsorship',
            'package_leaf_preferences' => [
                'Family Sponsorship — Parents and Grandparents',
                'Family Sponsorship',
            ],
            'retainer_fee' => 3000,
            'retainer_description' => 'Parents and grandparents sponsorship — income evidence, forms, and submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        // ── PNP by province ──────────────────────────────────────────────────
        $this->upsert([
            'code' => 'pnp',
            'parent_code' => null,
            'label' => 'Provincial Nominee Program',
            'family' => 'pnp',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::PNP_PACKAGE,
            'crs_backend_value' => 'Provincial Nominee Program',
            'retainer_fee' => 4000,
            'retainer_description' => 'Provincial stream identification, PNP application, nomination support, and PR.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['pnp.ab', 'AB', 'Alberta AAIP'],
            ['pnp.bc', 'BC', 'British Columbia BC PNP'],
            ['pnp.mb', 'MB', 'Manitoba MPNP'],
            ['pnp.sk', 'SK', 'Saskatchewan SINP'],
            ['pnp.on', 'ON', 'Ontario OINP'],
            ['pnp.nb', 'NB', 'New Brunswick NBPNP'],
            ['pnp.ns', 'NS', 'Nova Scotia NSNP'],
            ['pnp.pe', 'PE', 'Prince Edward Island PEI PNP'],
            ['pnp.nl', 'NL', 'Newfoundland and Labrador NLPNP'],
            ['pnp.yt', 'YT', 'Yukon YNP'],
            ['pnp.nt', 'NT', 'Northwest Territories NTNP'],
        ] as $i => [$code, $prov, $label]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'pnp',
                'label' => $label,
                'family' => 'pnp',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 4000,
                'retainer_description' => $label.' — stream matching, nomination application, and PR pathway support.',
                'is_assignable' => true,
                'is_popular' => in_array($prov, ['ON', 'BC', 'AB', 'SK'], true),
                'sort_order' => $sort++,
            ]);
        }

        // High-volume provincial streams (Phase C) under major PNPs.
        foreach ([
            ['pnp.on.employer-job-offer', 'pnp.on', 'ON', 'OINP – Employer Job Offer', true],
            ['pnp.on.masters-graduate', 'pnp.on', 'ON', 'OINP – Masters Graduate', true],
            ['pnp.on.phd-graduate', 'pnp.on', 'ON', 'OINP – PhD Graduate', false],
            ['pnp.on.human-capital', 'pnp.on', 'ON', 'OINP – Human Capital Priorities', true],
            ['pnp.bc.skills-immigration', 'pnp.bc', 'BC', 'BC PNP – Skills Immigration', true],
            ['pnp.bc.express-entry', 'pnp.bc', 'BC', 'BC PNP – Express Entry BC', true],
            ['pnp.bc.entrepreneur', 'pnp.bc', 'BC', 'BC PNP – Entrepreneur Immigration', false],
            ['pnp.ab.opportunity', 'pnp.ab', 'AB', 'AAIP – Alberta Opportunity Stream', true],
            ['pnp.ab.express-entry', 'pnp.ab', 'AB', 'AAIP – Express Entry Stream', true],
            ['pnp.ab.rural-renewal', 'pnp.ab', 'AB', 'AAIP – Rural Renewal Stream', false],
            ['pnp.sk.oid', 'pnp.sk', 'SK', 'SINP – Occupations In-Demand', true],
            ['pnp.sk.express-entry', 'pnp.sk', 'SK', 'SINP – Express Entry', true],
            ['pnp.sk.employer', 'pnp.sk', 'SK', 'SINP – Employment Offer', false],
        ] as [$code, $parent, $prov, $label, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => $parent,
                'label' => $label,
                'family' => 'pnp',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 4000,
                'retainer_description' => $label.' — eligibility, provincial application, nomination, and PR support.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        // ── Quebec (CSQ → federal PR) ────────────────────────────────────────
        $this->upsert([
            'code' => 'quebec',
            'parent_code' => null,
            'label' => 'Quebec Immigration',
            'family' => 'quebec',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::PNP_PACKAGE,
            'province_code' => 'QC',
            'retainer_fee' => 4500,
            'retainer_description' => 'Quebec selection (CSQ) and federal PR application support.',
            'is_assignable' => false,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['quebec.pstq', 'Quebec – Skilled Worker (PSTQ / Arrima)', 4500, true],
            ['quebec.peq', 'Quebec – Experience Program (PEQ)', 4200, true],
            ['quebec.business', 'Quebec – Business / Entrepreneur', 5500, false],
        ] as [$code, $label, $fee, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'quebec',
                'label' => $label,
                'family' => 'quebec',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => 'QC',
                'crs_backend_value' => null,
                'retainer_fee' => $fee,
                'retainer_description' => $label.' — Quebec selection certificate (CSQ) pathway and federal PR filing.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        // ── Federal business immigration ─────────────────────────────────────
        $this->upsert([
            'code' => 'business',
            'parent_code' => null,
            'label' => 'Business Immigration',
            'family' => 'business',
            'assessment_branch' => 'business',
            'package_leaf_preferences' => self::EE_PACKAGE,
            'retainer_fee' => 6000,
            'retainer_description' => 'Federal business immigration assessment and PR application support.',
            'is_assignable' => false,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['business.startup', 'Start-up Visa', 6500, true],
            ['business.self-employed', 'Self-employed Persons', 5500, true],
            ['business.caregiver', 'Caregiver – Home Child Care / Home Support', 4000, false],
        ] as [$code, $label, $fee, $popular]) {
            $prefs = $code === 'business.caregiver' ? self::WORK_PACKAGE : self::EE_PACKAGE;
            $this->upsert([
                'code' => $code,
                'parent_code' => 'business',
                'label' => $label,
                'family' => $code === 'business.caregiver' ? 'work' : 'business',
                'assessment_branch' => $code === 'business.caregiver' ? 'temporary' : 'business',
                'package_leaf_preferences' => $prefs,
                'crs_backend_value' => null,
                'retainer_fee' => $fee,
                'retainer_description' => $label.' — eligibility, documentation, and IRCC application support.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        // ── Study / Work / Visitor ───────────────────────────────────────────
        $this->upsert([
            'code' => 'study',
            'parent_code' => null,
            'label' => 'Study Permit',
            'family' => 'study',
            'assessment_branch' => 'temporary',
            'package_leaf_preferences' => self::STUDY_PACKAGE,
            'crs_backend_value' => 'Study Permit',
            'retainer_fee' => 1500,
            'retainer_description' => 'DLI selection guidance, study permit application preparation, and submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'work',
            'parent_code' => null,
            'label' => 'Work Permit',
            'family' => 'work',
            'assessment_branch' => 'temporary',
            'package_leaf_preferences' => self::WORK_PACKAGE,
            'crs_backend_value' => 'Work Permit',
            'retainer_fee' => 2000,
            'retainer_description' => 'LMIA or LMIA-exempt work permit assessment, application, and response handling.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'visitor',
            'parent_code' => null,
            'label' => 'Visitor Visa (TRV)',
            'family' => 'visitor',
            'assessment_branch' => 'temporary',
            'package_leaf_preferences' => [
                'Visitor visa (from outside Canada)',
                'Visitor visa',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 1200,
            'retainer_description' => 'Temporary resident visa assessment, supporting documents, and IRCC submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'visitor.super',
            'parent_code' => 'visitor',
            'label' => 'Super Visa (Parents and Grandparents)',
            'family' => 'visitor',
            'assessment_branch' => 'temporary',
            'package_leaf_preferences' => [
                'Super Visa (Parents and Grandparents)',
                'Super Visa',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 1800,
            'retainer_description' => 'Super Visa eligibility, insurance, invitation, and IRCC submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'citizenship',
            'parent_code' => null,
            'label' => 'Canadian Citizenship (Grant)',
            'family' => 'citizenship',
            'assessment_branch' => 'citizenship',
            'package_leaf_preferences' => [
                'Adults (18 years of age and older)',
                'Become a Canadian citizen — Grant of Citizenship',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 2500,
            'retainer_description' => 'Citizenship grant eligibility, language/knowledge prep support, and application filing.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'citizenship.proof',
            'parent_code' => 'citizenship',
            'label' => 'Proof of Citizenship Certificate',
            'family' => 'citizenship',
            'assessment_branch' => 'citizenship',
            'package_leaf_preferences' => [
                'Apply for a citizenship certificate',
                'Get a certificate of citizenship — Proof of Citizenship',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 1500,
            'retainer_description' => 'Citizenship certificate application preparation and IRCC submission.',
            'is_assignable' => true,
            'is_popular' => false,
            'sort_order' => $sort++,
        ]);

        $this->upsert([
            'code' => 'pr_card',
            'parent_code' => null,
            'label' => 'PR Card Renew / Replace',
            'family' => 'pr_card',
            'assessment_branch' => 'temporary',
            'package_leaf_preferences' => [
                'Renew or replace a PR Card',
                'Get, renew or replace a Permanent Resident Card',
            ],
            'crs_backend_value' => null,
            'retainer_fee' => 1200,
            'retainer_description' => 'PR card renewal or replacement — forms, supporting evidence, and IRCC submission.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        // Extra Atlantic / Prairies streams (Phase D)
        foreach ([
            ['pnp.mb.skilled-worker', 'pnp.mb', 'MB', 'MPNP – Skilled Worker Overseas', true],
            ['pnp.mb.international-education', 'pnp.mb', 'MB', 'MPNP – International Education', false],
            ['pnp.ns.labour-market', 'pnp.ns', 'NS', 'NSNP – Labour Market Priorities', true],
            ['pnp.ns.skilled-worker', 'pnp.ns', 'NS', 'NSNP – Skilled Worker', true],
            ['pnp.nb.skilled-worker', 'pnp.nb', 'NB', 'NBPNP – Skilled Worker', true],
            ['pnp.nb.express-entry', 'pnp.nb', 'NB', 'NBPNP – Express Entry', false],
            ['pnp.nl.express-entry', 'pnp.nl', 'NL', 'NLPNP – Express Entry', false],
            ['pnp.nl.skilled-worker', 'pnp.nl', 'NL', 'NLPNP – Skilled Worker', true],
        ] as [$code, $parent, $prov, $label, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => $parent,
                'label' => $label,
                'family' => 'pnp',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 4000,
                'retainer_description' => $label.' — eligibility, provincial application, nomination, and PR support.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        // ── Community pilots (RCIP / FCIP / AIP) ───────────────────────────────
        $this->upsert([
            'code' => 'pilot.aip',
            'parent_code' => null,
            'label' => 'Atlantic Immigration Program',
            'family' => 'pilot',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::PNP_PACKAGE,
            'crs_backend_value' => 'Provincial Nominee Program',
            'retainer_fee' => 3800,
            'retainer_description' => 'Atlantic Immigration Program — employer offer, settlement plan, and PR support.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['pilot.aip.ns', 'NS', 'AIP – Nova Scotia'],
            ['pilot.aip.nb', 'NB', 'AIP – New Brunswick'],
            ['pilot.aip.pe', 'PE', 'AIP – Prince Edward Island'],
            ['pilot.aip.nl', 'NL', 'AIP – Newfoundland and Labrador'],
        ] as $i => [$code, $prov, $label]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'pilot.aip',
                'label' => $label,
                'family' => 'pilot',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 3800,
                'retainer_description' => $label.' — designated employer offer, settlement plan, and PR application.',
                'is_assignable' => true,
                'is_popular' => $prov === 'NS' || $prov === 'NB',
                'sort_order' => $sort++,
            ]);
        }

        $this->upsert([
            'code' => 'pilot.rcip',
            'parent_code' => null,
            'label' => 'Rural Community Immigration Pilot (RCIP)',
            'family' => 'pilot',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::PNP_PACKAGE,
            'crs_backend_value' => 'Provincial Nominee Program',
            'retainer_fee' => 4000,
            'retainer_description' => 'RCIP — community recommendation, designated employer, and PR pathway.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        // Official IRCC RCIP 14 communities (popular Ontario hubs first).
        foreach ([
            ['pilot.rcip.thunder-bay', 'ON', 'thunder-bay', 'RCIP → Thunder Bay', true],
            ['pilot.rcip.sudbury', 'ON', 'sudbury', 'RCIP → Sudbury', true],
            ['pilot.rcip.north-bay', 'ON', 'north-bay', 'RCIP → North Bay', true],
            ['pilot.rcip.timmins', 'ON', 'timmins', 'RCIP → Timmins', true],
            ['pilot.rcip.sault-ste-marie', 'ON', 'sault-ste-marie', 'RCIP → Sault Ste. Marie', false],
            ['pilot.rcip.pictou-county', 'NS', 'pictou-county', 'RCIP → Pictou County', true],
            ['pilot.rcip.steinbach', 'MB', 'steinbach', 'RCIP → Steinbach', false],
            ['pilot.rcip.altona-rhineland', 'MB', 'altona-rhineland', 'RCIP → Altona/Rhineland', false],
            ['pilot.rcip.brandon', 'MB', 'brandon', 'RCIP → Brandon', false],
            ['pilot.rcip.moose-jaw', 'SK', 'moose-jaw', 'RCIP → Moose Jaw', false],
            ['pilot.rcip.claresholm', 'AB', 'claresholm', 'RCIP → Claresholm', false],
            ['pilot.rcip.west-kootenay', 'BC', 'west-kootenay', 'RCIP → West Kootenay', false],
            ['pilot.rcip.north-okanagan-shuswap', 'BC', 'north-okanagan-shuswap', 'RCIP → North Okanagan Shuswap', false],
            ['pilot.rcip.peace-liard', 'BC', 'peace-liard', 'RCIP → Peace Liard', false],
        ] as $i => [$code, $prov, $community, $label, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'pilot.rcip',
                'label' => $label,
                'family' => 'pilot',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'community_code' => $community,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 4000,
                'retainer_description' => $label.' — designated employer job offer, community recommendation, and PR.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        $this->upsert([
            'code' => 'pilot.fcip',
            'parent_code' => null,
            'label' => 'Francophone Community Immigration Pilot (FCIP)',
            'family' => 'pilot',
            'assessment_branch' => 'skilled',
            'package_leaf_preferences' => self::PNP_PACKAGE,
            'crs_backend_value' => 'Provincial Nominee Program',
            'retainer_fee' => 4000,
            'retainer_description' => 'FCIP — Francophone community recommendation, designated employer, and PR pathway.',
            'is_assignable' => true,
            'is_popular' => true,
            'sort_order' => $sort++,
        ]);

        foreach ([
            ['pilot.fcip.acadian-peninsula', 'NB', 'acadian-peninsula', 'FCIP → Acadian Peninsula', true],
            ['pilot.fcip.sudbury', 'ON', 'sudbury', 'FCIP → Sudbury', true],
            ['pilot.fcip.timmins', 'ON', 'timmins', 'FCIP → Timmins', true],
            ['pilot.fcip.superior-east', 'ON', 'superior-east', 'FCIP → Superior East Region', false],
            ['pilot.fcip.st-pierre-jolys', 'MB', 'st-pierre-jolys', 'FCIP → St. Pierre Jolys', false],
            ['pilot.fcip.kelowna', 'BC', 'kelowna', 'FCIP → Kelowna', true],
        ] as $i => [$code, $prov, $community, $label, $popular]) {
            $this->upsert([
                'code' => $code,
                'parent_code' => 'pilot.fcip',
                'label' => $label,
                'family' => 'pilot',
                'assessment_branch' => 'skilled',
                'package_leaf_preferences' => self::PNP_PACKAGE,
                'province_code' => $prov,
                'community_code' => $community,
                'crs_backend_value' => 'Provincial Nominee Program',
                'retainer_fee' => 4000,
                'retainer_description' => $label.' — French-speaking skilled worker pathway with community recommendation.',
                'is_assignable' => true,
                'is_popular' => $popular,
                'sort_order' => $sort++,
            ]);
        }

        $this->command?->info('Pathway catalog seeded (Phase A–D: EE/PNP/Quebec/business/visitor/citizenship/PR/pilots).');
    }

    /** @param  array<string, mixed>  $attrs */
    private function upsert(array $attrs): void
    {
        $attrs['is_active'] = $attrs['is_active'] ?? true;
        PathwayNode::updateOrCreate(
            ['code' => $attrs['code']],
            $attrs
        );
    }

    private function eeDescription(string $code): string
    {
        return match ($code) {
            'ee.fsw' => 'Express Entry profile creation, FSW eligibility assessment, CRS optimization, monitoring draws, and full PR application submission.',
            'ee.cec' => 'CEC eligibility assessment, Express Entry profile, CRS optimization, and full PR application submission.',
            'ee.fst' => 'FST eligibility assessment, trade certification verification, Express Entry profile, and PR application.',
            default => 'Express Entry assessment and PR application support.',
        };
    }
}
