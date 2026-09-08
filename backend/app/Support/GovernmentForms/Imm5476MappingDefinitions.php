<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 5476 (11-2025) — Use of a Representative.
 * Paths verified against official AcroForm/XFA hybrid template field names.
 */
final class Imm5476MappingDefinitions
{
    /**
     * @return list<array{0: string, 1: string, 2: bool}>
     *   [canonical_key, pdf_field_path, is_required]
     */
    public static function all(): array
    {
        return [
            // Section A — Applicant
            ['applicant.personal.family_name', 'IMM_5476[0].Page1[0].SectionA[0].familyName[0]', true],
            ['applicant.personal.given_names', 'IMM_5476[0].Page1[0].SectionA[0].givenName[0]', true],
            ['applicant.personal.date_of_birth', 'IMM_5476[0].Page1[0].SectionA[0].DOB[0]', true],
            ['applicant.personal.uci', 'IMM_5476[0].Page1[0].SectionA[0].UCI[0]', false, 'uci'],
            ['applicant.application.type', 'IMM_5476[0].Page1[0].SectionA[0].application[0]', false],

            // Purpose: appointing a representative (RadioButtonList export value "0")
            ['form.purpose.appoint_representative', 'IMM_5476[0].Page1[0].RadioButtonList[0]', false],

            // Section B — Representative identity
            ['representative.personal.family_name', 'IMM_5476[0].Page1[0].SectionB[0].familyName[0]', true],
            ['representative.personal.given_names', 'IMM_5476[0].Page1[0].SectionB[0].givenName[0]', true],
            // Paid representative — CICC member (compensated export value "0")
            ['representative.paid_cicc', 'IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].compensated[0]', false],
            ['representative.rcic_number', 'IMM_5476[0].Page1[0].SectionB[0].question6[0].questionII[0].ICCRCMember[0]', true],
            ['representative.membership_id', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].membershipID[0]', false],

            // Section B — Firm / contact
            ['representative.firm_name', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].organization[0]', false],
            ['representative.contact.email', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].email[0]', false],
            ['representative.address.unit', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].unit[0]', false],
            ['representative.address.street_number', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].streetNo[0]', false],
            ['representative.address.street_name', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].streetName[0]', false],
            ['representative.address.city', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].city[0]', false],
            ['representative.address.province', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].province[0]', false],
            ['representative.address.country', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].country[0]', false],
            ['representative.address.postal_code', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].postalcode[0]', false],
            ['representative.contact.phone_country_code', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].phoneCountryCode[0]', false],
            ['representative.contact.phone_number', 'IMM_5476[0].Page1[0].SectionB[0].question7[0].phoneNumber[0]', false],
        ];
    }
}
