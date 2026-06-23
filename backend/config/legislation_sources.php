<?php

return [

    'base_url' => 'https://laws-lois.justice.gc.ca',

    'openai' => [
        'enabled'   => env('LEGISLATION_OPENAI_ENABLED', false),
        'model'     => env('LEGISLATION_OPENAI_MODEL', 'gpt-4o-mini'),
        'chunk_max' => (int) env('LEGISLATION_OPENAI_CHUNK_MAX', 4000),
    ],

    'regulation_parent_acts' => [
        'SOR-2002-227'  => 'I-2.5',
        'DORS-2002-227' => 'I-2.5',
    ],

    /*
    | Batch sync tuning — rate limit requests to Justice Canada.
    */
    'batch' => [
        'default_size'      => (int) env('LEGISLATION_BATCH_SIZE', 10),
        'max_size'          => 30,
        'request_delay_ms'  => (int) env('LEGISLATION_REQUEST_DELAY_MS', 300),
    ],

    /*
    | Priority amendment watch — admins notified when content hash changes.
    */
    'amendment_watch' => [
        'I-2.5',
        'SOR-2002-227',
    ],

    /*
    | Immigration tier — sync after IRPA/IRPR for consultant-relevant federal law.
    | Entries may be synced from catalog or built from act_code when not discovered yet.
    */
    'immigration_tier' => [
        ['act_code' => 'C-29', 'title' => 'Citizenship Act', 'category' => 'act'],
        ['act_code' => 'SOR-93-246', 'title' => 'Citizenship Regulations', 'category' => 'regulation'],
        ['act_code' => 'SOR-2002-228', 'title' => 'Immigration and Refugee Protection Regulations (Miscellaneous)', 'category' => 'regulation'],
        ['act_code' => 'SOR-2002-229', 'title' => 'Designated Countries of Origin Regulations', 'category' => 'regulation'],
        ['act_code' => 'SOR-2002-230', 'title' => 'Pre-Removal Risk Assessment Regulations', 'category' => 'regulation'],
        ['act_code' => 'SOR-2012-140', 'title' => 'Refugee Appeal Division Rules', 'category' => 'regulation'],
        ['act_code' => 'SOR-2013-212', 'title' => 'Refugee Protection Division Rules', 'category' => 'regulation'],
        ['act_code' => 'SOR-2018-206', 'title' => 'Ministerial Instructions (Express Entry)', 'category' => 'regulation'],
        ['act_code' => 'SOR-2007-147', 'title' => 'Federal Skilled Worker Regulations', 'category' => 'regulation'],
        ['act_code' => 'SOR-2014-140', 'title' => 'Immigration Division Rules', 'category' => 'regulation'],
        ['act_code' => 'SOR-2014-141', 'title' => 'Immigration Appeal Division Rules', 'category' => 'regulation'],
        ['act_code' => 'SOR-2002-224', 'title' => 'Immigration and Refugee Protection Act Fees Regulations', 'category' => 'regulation'],
        ['act_code' => 'C-46', 'title' => 'Criminal Code', 'category' => 'act'],
        ['act_code' => 'A-1', 'title' => 'Access to Information Act', 'category' => 'act'],
        ['act_code' => 'P-21', 'title' => 'Privacy Act', 'category' => 'act'],
    ],

    /*
    | Priority sources — full catalog discovery extends this list over time.
    */
    'sources' => [
        'irpa' => [
            'title'    => 'Immigration and Refugee Protection Act',
            'act_code' => 'I-2.5',
            'category' => 'act',
            'formats'  => [
                'xml' => [
                    'en' => '/eng/XML/I-2.5.xml',
                    'fr' => '/fra/XML/I-2.5.xml',
                ],
                'html' => [
                    'en' => '/eng/acts/I-2.5/page-1.html',
                    'fr' => '/fra/lois/I-2.5/page-1.html',
                ],
                'pdf' => [
                    'en' => '/pdf/i-2.5.pdf',
                    'fr' => '/pdf/i-2.5.pdf',
                ],
            ],
        ],
        'irpr' => [
            'title'           => 'Immigration and Refugee Protection Regulations',
            'act_code'        => 'SOR-2002-227',
            'category'        => 'regulation',
            'parent_act_code' => 'I-2.5',
            'formats'         => [
                'xml' => [
                    'en' => '/eng/XML/SOR-2002-227.xml',
                    'fr' => '/fra/XML/DORS-2002-227.xml',
                ],
                'html' => [
                    'en' => '/eng/regulations/SOR-2002-227/page-1.html',
                    'fr' => '/fra/reglements/DORS-2002-227/page-1.html',
                ],
                'pdf' => [
                    'en' => '/pdf/sor-2002-227.pdf',
                    'fr' => '/pdf/sor-2002-227.pdf',
                ],
            ],
        ],
    ],

];
