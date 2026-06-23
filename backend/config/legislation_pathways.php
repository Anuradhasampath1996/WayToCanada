<?php

/**
 * Immigration pathway → legislation document act codes for the Legislation Hub filter.
 * IRPA (I-2.5) and IRPR (SOR-2002-227) are included on most temporary/PR routes.
 */
return [

    'pathways' => [

        'express_entry' => [
            'label'       => 'Express Entry (FSW / CEC / FST)',
            'description' => 'Federal economic permanent residence — CRS, invitations, and selection.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
                'SOR-2007-147',
                'SOR-2018-206',
            ],
        ],

        'study_permit' => [
            'label'       => 'Study permit',
            'description' => 'International students — permits, conditions, and work while studying.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
            ],
        ],

        'work_permit' => [
            'label'       => 'Work permit',
            'description' => 'Temporary foreign workers — employer-specific and LMIA-exempt permits.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
            ],
        ],

        'permanent_residence' => [
            'label'       => 'Permanent residence',
            'description' => 'PR status, landing obligations, and resident requirements.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
            ],
        ],

        'provincial_nominee' => [
            'label'       => 'Provincial Nominee (PNP)',
            'description' => 'Provincial nomination streams and Express Entry alignment.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
            ],
        ],

        'family_sponsorship' => [
            'label'       => 'Family sponsorship',
            'description' => 'Spouse, partner, dependent children, and family class sponsorship.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
            ],
        ],

        'refugee_protection' => [
            'label'       => 'Refugee & protection',
            'description' => 'Refugee claims, PRRA, and IRB division rules.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
                'SOR-2002-230',
                'SOR-2012-140',
                'SOR-2013-212',
                'SOR-2014-140',
                'SOR-2014-141',
            ],
        ],

        'citizenship' => [
            'label'       => 'Citizenship',
            'description' => 'Citizenship applications, residence, and citizenship regulations.',
            'act_codes'   => [
                'C-29',
                'SOR-93-246',
            ],
        ],

        'inadmissibility' => [
            'label'       => 'Inadmissibility & enforcement',
            'description' => 'Criminal, medical, misrepresentation, detention, and appeals.',
            'act_codes'   => [
                'I-2.5',
                'SOR-2002-227',
                'C-46',
                'SOR-2014-140',
                'SOR-2014-141',
            ],
        ],

    ],

];
