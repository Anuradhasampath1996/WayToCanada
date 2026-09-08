<?php

return [
    'synthetic_test_data' => [
        'applicant.personal.family_name' => 'POCTEST',
        'applicant.personal.given_names' => 'Synthetic Client',
        'applicant.contact.email' => 'poc.test@example.invalid',
        'representative.full_name' => 'Synthetic RCIC Consultant',
        'representative.rcic_number' => 'R999999999',
        'representative.company_name' => 'RCICMASTER PoC Firm',
    ],

    'imm5476_poc_mappings' => [
        'applicant.personal.family_name' => 'IMM_5476[0].Page1[0].SectionA[0].familyName[0]',
        'applicant.personal.given_names' => 'IMM_5476[0].Page1[0].SectionA[0].givenName[0]',
        'representative.personal.family_name' => 'IMM_5476[0].Page1[0].SectionB[0].familyName[0]',
        'representative.personal.given_names' => 'IMM_5476[0].Page1[0].SectionB[0].givenName[0]',
        'representative.rcic_number' => 'IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].ICCRCMember[0]',
        'representative.company_name' => 'IMM_5476[0].Page1[0].SectionB[0].question7[0].organization[0]',
        'representative.email' => 'IMM_5476[0].Page1[0].SectionB[0].question7[0].email[0]',
    ],
];
