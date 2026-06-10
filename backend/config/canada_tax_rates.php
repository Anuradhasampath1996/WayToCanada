<?php

/**
 * Authoritative Canadian income tax rates for estimation.
 * Synced via `php artisan tax:sync` into tax_rate_versions.
 * Sources: Canada Revenue Agency (CRA) — canada.ca
 */
return [
    'version'        => '2025-01',
    'tax_year'       => 2025,
    'effective_date' => '2025-01-01',
    'changelog'      => '2025 federal and provincial/territorial income tax brackets, BPA, CPP, and EI limits per CRA publications.',

    'source_urls' => [
        'federal_rates' => 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html',
        'indexation'    => 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html',
        'payroll_t4127' => 'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas.html',
        'pdoc'          => 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/payroll-deductions-online-calculator.html',
    ],

    'federal' => [
        'basic_personal_amount' => 15705,
        'brackets' => [
            ['min' => 0,       'max' => 55867,   'rate' => 0.15],
            ['min' => 55867.01, 'max' => 111733,  'rate' => 0.205],
            ['min' => 111733.01,'max' => 173205,  'rate' => 0.26],
            ['min' => 173205.01,'max' => 246752,  'rate' => 0.29],
            ['min' => 246752.01,'max' => null,    'rate' => 0.33],
        ],
    ],

    'provinces' => [
        'AB' => [
            'name' => 'Alberta',
            'basic_personal_amount' => 21885,
            'brackets' => [
                ['min' => 0, 'max' => 148269, 'rate' => 0.10],
                ['min' => 148269.01, 'max' => 177922, 'rate' => 0.12],
                ['min' => 177922.01, 'max' => 237230, 'rate' => 0.13],
                ['min' => 237230.01, 'max' => 355845, 'rate' => 0.14],
                ['min' => 355845.01, 'max' => null, 'rate' => 0.15],
            ],
        ],
        'BC' => [
            'name' => 'British Columbia',
            'basic_personal_amount' => 12580,
            'brackets' => [
                ['min' => 0, 'max' => 49279, 'rate' => 0.0506],
                ['min' => 49279.01, 'max' => 98560, 'rate' => 0.077],
                ['min' => 98560.01, 'max' => 113158, 'rate' => 0.105],
                ['min' => 113158.01, 'max' => 137407, 'rate' => 0.1229],
                ['min' => 137407.01, 'max' => 186306, 'rate' => 0.147],
                ['min' => 186306.01, 'max' => 259829, 'rate' => 0.168],
                ['min' => 259829.01, 'max' => null, 'rate' => 0.205],
            ],
        ],
        'MB' => [
            'name' => 'Manitoba',
            'basic_personal_amount' => 15780,
            'brackets' => [
                ['min' => 0, 'max' => 47000, 'rate' => 0.108],
                ['min' => 47000.01, 'max' => 100000, 'rate' => 0.1275],
                ['min' => 100000.01, 'max' => null, 'rate' => 0.174],
            ],
        ],
        'NB' => [
            'name' => 'New Brunswick',
            'basic_personal_amount' => 12819,
            'brackets' => [
                ['min' => 0, 'max' => 49958, 'rate' => 0.094],
                ['min' => 49958.01, 'max' => 99916, 'rate' => 0.14],
                ['min' => 99916.01, 'max' => 185064, 'rate' => 0.16],
                ['min' => 185064.01, 'max' => null, 'rate' => 0.195],
            ],
        ],
        'NL' => [
            'name' => 'Newfoundland and Labrador',
            'basic_personal_amount' => 10818,
            'brackets' => [
                ['min' => 0, 'max' => 43198, 'rate' => 0.087],
                ['min' => 43198.01, 'max' => 86395, 'rate' => 0.145],
                ['min' => 86395.01, 'max' => 154244, 'rate' => 0.158],
                ['min' => 154244.01, 'max' => 215943, 'rate' => 0.173],
                ['min' => 215943.01, 'max' => 275870, 'rate' => 0.183],
                ['min' => 275870.01, 'max' => 551739, 'rate' => 0.198],
                ['min' => 551739.01, 'max' => 1103478, 'rate' => 0.208],
                ['min' => 1103478.01, 'max' => null, 'rate' => 0.213],
            ],
        ],
        'NS' => [
            'name' => 'Nova Scotia',
            'basic_personal_amount' => 11481,
            'brackets' => [
                ['min' => 0, 'max' => 29590, 'rate' => 0.0879],
                ['min' => 29590.01, 'max' => 59180, 'rate' => 0.1495],
                ['min' => 59180.01, 'max' => 93000, 'rate' => 0.1667],
                ['min' => 93000.01, 'max' => 150000, 'rate' => 0.175],
                ['min' => 150000.01, 'max' => null, 'rate' => 0.21],
            ],
        ],
        'NT' => [
            'name' => 'Northwest Territories',
            'basic_personal_amount' => 16593,
            'brackets' => [
                ['min' => 0, 'max' => 50597, 'rate' => 0.059],
                ['min' => 50597.01, 'max' => 101198, 'rate' => 0.086],
                ['min' => 101198.01, 'max' => 164525, 'rate' => 0.122],
                ['min' => 164525.01, 'max' => null, 'rate' => 0.1405],
            ],
        ],
        'NU' => [
            'name' => 'Nunavut',
            'basic_personal_amount' => 17925,
            'brackets' => [
                ['min' => 0, 'max' => 53268, 'rate' => 0.04],
                ['min' => 53268.01, 'max' => 106537, 'rate' => 0.07],
                ['min' => 106537.01, 'max' => 173205, 'rate' => 0.09],
                ['min' => 173205.01, 'max' => null, 'rate' => 0.115],
            ],
        ],
        'ON' => [
            'name' => 'Ontario',
            'basic_personal_amount' => 12747,
            'brackets' => [
                ['min' => 0, 'max' => 51937, 'rate' => 0.0505],
                ['min' => 51937.01, 'max' => 103875, 'rate' => 0.0915],
                ['min' => 103875.01, 'max' => 150000, 'rate' => 0.1116],
                ['min' => 150000.01, 'max' => 220000, 'rate' => 0.1216],
                ['min' => 220000.01, 'max' => null, 'rate' => 0.1316],
            ],
        ],
        'PE' => [
            'name' => 'Prince Edward Island',
            'basic_personal_amount' => 12000,
            'brackets' => [
                ['min' => 0, 'max' => 33328, 'rate' => 0.095],
                ['min' => 33328.01, 'max' => 64656, 'rate' => 0.1347],
                ['min' => 64656.01, 'max' => 105000, 'rate' => 0.166],
                ['min' => 105000.01, 'max' => 140000, 'rate' => 0.1762],
                ['min' => 140000.01, 'max' => null, 'rate' => 0.19],
            ],
        ],
        'QC' => [
            'name' => 'Quebec',
            'basic_personal_amount' => 18056,
            'brackets' => [
                ['min' => 0, 'max' => 51780, 'rate' => 0.14],
                ['min' => 51780.01, 'max' => 103545, 'rate' => 0.19],
                ['min' => 103545.01, 'max' => 126000, 'rate' => 0.24],
                ['min' => 126000.01, 'max' => null, 'rate' => 0.2575],
            ],
        ],
        'SK' => [
            'name' => 'Saskatchewan',
            'basic_personal_amount' => 17661,
            'brackets' => [
                ['min' => 0, 'max' => 52057, 'rate' => 0.105],
                ['min' => 52057.01, 'max' => 148734, 'rate' => 0.125],
                ['min' => 148734.01, 'max' => null, 'rate' => 0.145],
            ],
        ],
        'YT' => [
            'name' => 'Yukon',
            'basic_personal_amount' => 15705,
            'brackets' => [
                ['min' => 0, 'max' => 55867, 'rate' => 0.064],
                ['min' => 55867.01, 'max' => 111733, 'rate' => 0.09],
                ['min' => 111733.01, 'max' => 173205, 'rate' => 0.109],
                ['min' => 173205.01, 'max' => 500000, 'rate' => 0.128],
                ['min' => 500000.01, 'max' => null, 'rate' => 0.15],
            ],
        ],
    ],

    'cpp' => [
        'ympe'              => 71300,
        'basic_exemption'   => 3500,
        'employee_rate'     => 0.0595,
        'max_contribution'  => 4034.10,
    ],

    'ei' => [
        'max_insurable'     => 65700,
        'employee_rate'     => 0.0164,
        'max_premium'       => 1077.48,
    ],
];
