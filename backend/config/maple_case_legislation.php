<?php

return [

    'viewer_documents' => [
        'I-2.5'        => ['en' => null, 'fr' => null],
        'SOR-2002-227' => ['en' => null, 'fr' => null],
        'DORS-2002-227'=> ['en' => null, 'fr' => null],
    ],

    'pathway_sections' => [
        'study permit' => [
            ['act_code' => 'SOR-2002-227', 'provision_key' => '216', 'reason' => 'Study permit — general'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '219', 'reason' => 'Conditions on study permits'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '220', 'reason' => 'Work while studying'],
        ],
        'express entry' => [
            ['act_code' => 'SOR-2002-227', 'provision_key' => '75', 'reason' => 'Express Entry — eligible candidates'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '76', 'reason' => 'Comprehensive ranking system'],
            ['act_code' => 'I-2.5', 'provision_key' => '12', 'reason' => 'Selection of permanent residents'],
        ],
        'permanent residence' => [
            ['act_code' => 'I-2.5', 'provision_key' => '11', 'reason' => 'Protected persons and permanent residents'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '70', 'reason' => 'Permanent resident class'],
        ],
        'work permit' => [
            ['act_code' => 'SOR-2002-227', 'provision_key' => '200', 'reason' => 'Work permits — general'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '203', 'reason' => 'Employer-specific work permits'],
        ],
        'provincial nominee' => [
            ['act_code' => 'SOR-2002-227', 'provision_key' => '87', 'reason' => 'Provincial nominee class'],
        ],
        'family class' => [
            ['act_code' => 'SOR-2002-227', 'provision_key' => '117', 'reason' => 'Family class — sponsorship'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '130', 'reason' => 'Spouse or common-law partner in Canada'],
        ],
    ],

    'topic_sections' => [
        'inadmissibility' => [
            ['act_code' => 'I-2.5', 'provision_key' => '33', 'reason' => 'Inadmissibility — general'],
            ['act_code' => 'I-2.5', 'provision_key' => '36', 'reason' => 'Criminal inadmissibility'],
            ['act_code' => 'I-2.5', 'provision_key' => '38', 'reason' => 'Medical inadmissibility'],
            ['act_code' => 'I-2.5', 'provision_key' => '40', 'reason' => 'Misrepresentation'],
        ],
        'refusal' => [
            ['act_code' => 'I-2.5', 'provision_key' => '14', 'reason' => 'Visa and status decisions'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '179', 'reason' => 'Restoration of status'],
        ],
        'misrepresentation' => [
            ['act_code' => 'I-2.5', 'provision_key' => '40', 'reason' => 'Misrepresentation'],
            ['act_code' => 'SOR-2002-227', 'provision_key' => '240', 'reason' => 'Misrepresentation — regulations'],
        ],
    ],

];
