<?php

/**
 * GST/HST/PST rates for Canadian sales (place of supply).
 * Used when charging tax on payments. Synced via `php artisan gst-hst:sync`.
 *
 * @see https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html
 */
return [
    'version'        => '2025-04',
    'effective_date' => '2025-04-01',
    'changelog'      => 'Nova Scotia HST reduced to 14% (Apr 1, 2025). Rates per CRA place-of-supply rules.',

    'source_urls' => [
        'charge_collect' => 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',
        'place_of_supply' => 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-rates-place-supply-rules.html',
        'calculator'     => 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-calculator.html',
    ],

    'federal_gst_rate' => 0.05,

    'provinces' => [
        'AB' => [
            'name'        => 'Alberta',
            'tax_type'    => 'gst_only',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0,
            'total_rate'  => 0.05,
            'label'       => 'GST 5%',
        ],
        'BC' => [
            'name'        => 'British Columbia',
            'tax_type'    => 'gst_pst',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0.07,
            'total_rate'  => 0.12,
            'label'       => 'GST 5% + PST 7%',
        ],
        'MB' => [
            'name'        => 'Manitoba',
            'tax_type'    => 'gst_pst',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0.07,
            'total_rate'  => 0.12,
            'label'       => 'GST 5% + PST 7%',
        ],
        'NB' => [
            'name'        => 'New Brunswick',
            'tax_type'    => 'hst',
            'gst_rate'    => 0,
            'prov_rate'   => 0,
            'total_rate'  => 0.15,
            'label'       => 'HST 15%',
        ],
        'NL' => [
            'name'        => 'Newfoundland and Labrador',
            'tax_type'    => 'hst',
            'gst_rate'    => 0,
            'prov_rate'   => 0,
            'total_rate'  => 0.15,
            'label'       => 'HST 15%',
        ],
        'NS' => [
            'name'        => 'Nova Scotia',
            'tax_type'    => 'hst',
            'gst_rate'    => 0,
            'prov_rate'   => 0,
            'total_rate'  => 0.14,
            'label'       => 'HST 14%',
            'notes'       => 'Provincial HST portion reduced to 9% effective April 1, 2025 (total HST 14%).',
        ],
        'NT' => [
            'name'        => 'Northwest Territories',
            'tax_type'    => 'gst_only',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0,
            'total_rate'  => 0.05,
            'label'       => 'GST 5%',
        ],
        'NU' => [
            'name'        => 'Nunavut',
            'tax_type'    => 'gst_only',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0,
            'total_rate'  => 0.05,
            'label'       => 'GST 5%',
        ],
        'ON' => [
            'name'        => 'Ontario',
            'tax_type'    => 'hst',
            'gst_rate'    => 0,
            'prov_rate'   => 0,
            'total_rate'  => 0.13,
            'label'       => 'HST 13%',
        ],
        'PE' => [
            'name'        => 'Prince Edward Island',
            'tax_type'    => 'hst',
            'gst_rate'    => 0,
            'prov_rate'   => 0,
            'total_rate'  => 0.15,
            'label'       => 'HST 15%',
        ],
        'QC' => [
            'name'        => 'Quebec',
            'tax_type'    => 'gst_qst',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0.09975,
            'total_rate'  => 0.14975,
            'label'       => 'GST 5% + QST 9.975%',
            'notes'       => 'QST calculated on price excluding GST.',
        ],
        'SK' => [
            'name'        => 'Saskatchewan',
            'tax_type'    => 'gst_pst',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0.06,
            'total_rate'  => 0.11,
            'label'       => 'GST 5% + PST 6%',
        ],
        'YT' => [
            'name'        => 'Yukon',
            'tax_type'    => 'gst_only',
            'gst_rate'    => 0.05,
            'prov_rate'   => 0,
            'total_rate'  => 0.05,
            'label'       => 'GST 5%',
        ],
    ],
];
