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
