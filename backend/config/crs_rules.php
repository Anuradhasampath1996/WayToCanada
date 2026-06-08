<?php

/**
 * Authoritative CRS / FSW scoring rules.
 * Updated via `php artisan crs:sync` and seeded into crs_rule_versions.
 * Source: IRCC Express Entry CRS criteria (verify against official tool).
 */
return [
    'version'        => '2025-03-25',
    'effective_date' => '2025-03-25',
    'source_url'     => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html',
    'official_tool'  => 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html',
    'changelog'      => 'Removed CRS job-offer bonus points effective 2025-03-25 per IRCC policy update.',

    'policies' => [
        'job_offer_crs_points'     => false,
        'job_offer_fsw_arranged'   => true,
        'provincial_nomination_pts'=> 600,
        'sibling_pts'              => 15,
    ],

    'ielts_speaking_clb' => [
        ['min' => 7.5, 'clb' => 10], ['min' => 7.0, 'clb' => 9], ['min' => 6.5, 'clb' => 8],
        ['min' => 6.0, 'clb' => 7], ['min' => 5.5, 'clb' => 6], ['min' => 5.0, 'clb' => 5],
        ['min' => 4.5, 'clb' => 4],
    ],
    'ielts_listening_clb' => [
        ['min' => 8.5, 'clb' => 10], ['min' => 8.0, 'clb' => 9], ['min' => 7.5, 'clb' => 8],
        ['min' => 6.0, 'clb' => 7], ['min' => 5.5, 'clb' => 6], ['min' => 5.0, 'clb' => 5],
        ['min' => 4.5, 'clb' => 4],
    ],
    'ielts_reading_clb' => [
        ['min' => 8.0, 'clb' => 10], ['min' => 7.0, 'clb' => 9], ['min' => 6.5, 'clb' => 8],
        ['min' => 6.0, 'clb' => 7], ['min' => 5.0, 'clb' => 6], ['min' => 4.0, 'clb' => 5],
        ['min' => 3.5, 'clb' => 4],
    ],
    'ielts_writing_clb' => [
        ['min' => 7.5, 'clb' => 10], ['min' => 7.0, 'clb' => 9], ['min' => 6.5, 'clb' => 8],
        ['min' => 6.0, 'clb' => 7], ['min' => 5.5, 'clb' => 6], ['min' => 5.0, 'clb' => 5],
        ['min' => 4.0, 'clb' => 4],
    ],

    // CELPIP-G scores map 1:1 to CLB for each skill (same numeric scale)
    'celpip_is_clb' => true,

    // TEF Canada / TCF Canada → CLB (simplified min-score tables per skill)
    'tef_clb' => [
        'speaking'  => [[348, 10], [330, 9], [298, 8], [271, 7], [226, 6], [181, 5], [146, 4]],
        'listening' => [[316, 10], [298, 9], [248, 8], [221, 7], [181, 6], [145, 5], [117, 4]],
        'reading'   => [[263, 10], [248, 9], [207, 8], [181, 7], [151, 6], [121, 5], [91, 4]],
        'writing'   => [[393, 10], [371, 9], [330, 8], [301, 7], [226, 6], [181, 5], [145, 4]],
    ],

    'age_points' => [
        'without_spouse' => [
            17 => 0, 18 => 99, 19 => 105,
            '20_29' => 110,
            '30' => 105, '31' => 99, '32' => 94, '33' => 88, '34' => 83,
            '35' => 77, '36' => 72, '37' => 66, '38' => 61, '39' => 55,
            '40' => 50, '41' => 39, '42' => 28, '43' => 17, '44' => 6, '45_plus' => 0,
        ],
        'with_spouse' => [
            17 => 0, 18 => 90, 19 => 95,
            '20_29' => 100,
            '30' => 100, '31' => 95, '32' => 90, '33' => 85, '34' => 80,
            '35' => 75, '36' => 70, '37' => 65, '38' => 60, '39' => 55,
            '40' => 50, '41' => 39, '42' => 28, '43' => 17, '44' => 6, '45_plus' => 0,
        ],
    ],

    'education_points' => [
        'without_spouse' => [
            'none' => 0, 'secondary' => 30, 'one_year' => 90, 'two_year' => 98,
            'bachelors' => 120, 'two_or_more' => 128, 'masters' => 135, 'doctoral' => 150,
        ],
        'with_spouse' => [
            'none' => 0, 'secondary' => 28, 'one_year' => 84, 'two_year' => 91,
            'bachelors' => 112, 'two_or_more' => 119, 'masters' => 126, 'doctoral' => 140,
        ],
    ],

    'first_language_skill' => [
        'without_spouse' => [0, 0, 0, 0, 0, 6, 9, 17, 23, 31, 34],
        'with_spouse'    => [0, 0, 0, 0, 0, 6, 8, 16, 22, 29, 32],
    ],

    'second_language_skill' => [
        'without_spouse' => [0, 0, 0, 0, 0, 1, 1, 1, 3, 6, 6],
        'with_spouse'    => [0, 0, 0, 0, 0, 1, 1, 1, 3, 4, 4],
    ],

    'canadian_work' => [
        'without_spouse' => [0, 40, 53, 64, 72, 80],
        'with_spouse'    => [0, 35, 46, 56, 63, 70],
    ],

    'spouse_education' => [
        'none' => 0, 'secondary' => 2, 'one_year' => 6, 'two_year' => 7,
        'bachelors' => 8, 'two_or_more' => 9, 'masters' => 10, 'doctoral' => 10,
    ],

    'spouse_language' => [0, 0, 0, 0, 0, 1, 1, 3, 3, 5, 5],

    'spouse_canadian_work' => [0, 5, 7, 8, 9, 10],

    'french_bonus' => [
        ['min_clb' => 7, 'english_max_clb' => 4, 'pts' => 50],
        ['min_clb' => 7, 'english_max_clb' => null, 'pts' => 50],
        ['min_clb' => 5, 'english_max_clb' => null, 'pts' => 25],
    ],

    'canadian_study_bonus' => [
        'one_two_year' => 15,
        'three_plus'   => 30,
    ],

    'fsw' => [
        'pass_mark' => 67,
        'language'  => [
            ['min_avg_clb' => 9, 'pts' => 24], ['min_avg_clb' => 8, 'pts' => 20],
            ['min_avg_clb' => 7, 'pts' => 16], ['min_avg_clb' => 6, 'pts' => 8],
            ['min_avg_clb' => 5, 'pts' => 4], ['min_avg_clb' => 4, 'pts' => 2],
        ],
        'education' => [
            'none' => 0, 'secondary' => 5, 'one_year' => 15, 'two_year' => 19,
            'bachelors' => 21, 'two_or_more' => 22, 'masters' => 23, 'doctoral' => 25,
        ],
        'experience' => [0, 9, 11, 13, 15, 15],
        'age' => [
            '18_35' => 12, '36' => 11, '37' => 10, '38' => 9, '39' => 8,
            '40' => 7, '41' => 6, '42' => 5, '43' => 4, '44' => 3, '45' => 2,
        ],
        'arranged_employment' => 10,
        'adaptability_max' => 10,
    ],

    'draw_sync' => [
        'sources' => [
            'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json',
            'https://api-open-data.canada.ca/open-data/api/crs/express-entry',
        ],
    ],
];
