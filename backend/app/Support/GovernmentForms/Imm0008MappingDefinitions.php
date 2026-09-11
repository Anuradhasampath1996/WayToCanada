<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 0008 (05-2026) — Generic Application Form for Canada.
 * Phase C1: applicant identity / contact / address (+ spouse name when married).
 * Phase C2: phone, education/occupation, national ID, first dependent (depPrime).
 * Phase C3: native / communicate languages.
 * Phase C4: sex, citizenship, current COR country, passport dates, corr/interview lang,
 *           mailing apt, depPrime birth country + relationship.
 * SOM paths verified against official XFA datasets (form1 root).
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool, 3?: string}
 */
final class Imm0008MappingDefinitions
{
    private const ROOT = 'form1[0].Page1[0]';

    private const PERSONAL = self::ROOT.'.PersonalDetails[0]';

    private const CONTACT = self::ROOT.'.contactInformation[0]';

    private const PASSPORT = self::ROOT.'.passport[0].Passport[0]';

    private const NAT_ID = self::ROOT.'.natID[0]';

    private const EDU = self::ROOT.'.educationOccupation[0].EduOccupation[0]';

    private const DEP0 = self::ROOT.'.depPrime[0]';

    private const LANG = self::ROOT.'.languageDetails[0].Languages[0].languages[0]';

    private const GEN = self::ROOT.'.genDetails[0]';

    /**
     * @return list<MappingRow>
     *   [canonical_key, pdf_field_path, is_required, transformer?]
     */
    public static function all(): array
    {
        return [
            // Personal — name / UCI / birth
            ['applicant.personal.family_name', self::PERSONAL.'.q1[0].FamilyName[0]', true, 'name'],
            ['applicant.personal.given_names', self::PERSONAL.'.q1[0].GivenName[0]', true, 'name'],
            ['applicant.personal.uci', self::PERSONAL.'.q3-4-5-6[0].UCI[0]', false, 'uci'],
            ['applicant.personal.gender', self::PERSONAL.'.q3-4-5-6[0].Sex[0].Sex[0]', false, 'sex'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.q7-8[0].DOB[0].DOBYYYY[0]', true, 'date_yyyy'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.q7-8[0].DOB[0].DOBMM[0]', true, 'date_mm'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.q7-8[0].DOB[0].DOBDD[0]', true, 'date_dd'],
            ['applicant.personal.city_of_birth', self::PERSONAL.'.q7-8[0].PlaceBirthCity[0]', false, 'text'],
            ['applicant.personal.country_of_birth', self::PERSONAL.'.q7-8[0].PlaceBirthCountry[0]', false, 'text'],
            ['applicant.personal.citizenship', self::PERSONAL.'.q9[0].Citizenship1[0]', false, 'text'],
            ['applicant.personal.marital_status', self::PERSONAL.'.q14[0].MaritalStatus[0].MaritalStatus[0]', false, 'text'],
            ['applicant.address.country', self::PERSONAL.'.q10[0].CurrentCOR[0].Row2[0].Country[0]', false, 'text'],

            // Spouse (when married) — IRCC stores current spouse under marital status block
            ['applicant.family.spouse.family_name', self::PERSONAL.'.q14[0].MaritalStatus[0].FamilyName[0]', false, 'name'],
            ['applicant.family.spouse.given_names', self::PERSONAL.'.q14[0].MaritalStatus[0].GivenName[0]', false, 'name'],

            // Mailing address
            ['applicant.address.line2', self::CONTACT.'.q1[0].AddressRow1[0].Apt[0].AptUnit[0]', false, 'text'],
            ['applicant.address.line1', self::CONTACT.'.q1[0].AddressRow1[0].Streetname[0].Streetname[0]', false, 'text'],
            ['applicant.address.city', self::CONTACT.'.q1[0].AddressRow2[0].CityTown[0].CityTown[0]', false, 'text'],
            ['applicant.address.country', self::CONTACT.'.q1[0].AddressRow2[0].Country[0].Country[0]', false, 'text'],
            ['applicant.address.province', self::CONTACT.'.q1[0].AddressRow2[0].ProvinceState[0].ProvinceState[0]', false, 'text'],
            ['applicant.address.postal_code', self::CONTACT.'.q1[0].AddressRow2[0].PostalCode[0].PostalCode[0]', false, 'text'],

            // Contact
            ['applicant.contact.email', self::CONTACT.'.q5-6[0].Email[0]', true, 'text'],
            ['applicant.contact.phone', self::CONTACT.'.q3-4[0].Phone[0].ActualNumber[0]', false, 'text'],

            // Passport
            ['applicant.passport.number', self::PASSPORT.'.PassportNum[0].PassportNum[0]', false, 'text'],
            ['applicant.passport.country', self::PASSPORT.'.CountryofIssue[0].CountryofIssue[0]', false, 'text'],
            ['applicant.passport.issue_date', self::PASSPORT.'.IssueDate[0].IssueDate[0]', false, 'date'],
            ['applicant.passport.expiry_date', self::PASSPORT.'.ExpiryDate[0]', false, 'date'],

            // National ID
            ['applicant.national_id.number', self::NAT_ID.'.natIDdocs[0].DocNum[0].DocNum[0]', false, 'text'],
            ['applicant.national_id.country', self::NAT_ID.'.natIDdocs[0].CountryofIssue[0].CountryofIssue[0]', false, 'text'],

            // Education / occupation
            ['applicant.education.level', self::EDU.'.Education[0].levelEdu[0].levelEdu[0]', false, 'text'],
            ['applicant.work.job_title', self::EDU.'.currentOccupation[0]', false, 'text'],
            ['applicant.work.intended_occupation', self::EDU.'.intendedOccupation[0]', false, 'text'],

            // Languages (C3) + correspondence (C4)
            ['applicant.language.native', self::LANG.'.nativeLang[0].nativeLang[0]', false, 'text'],
            ['applicant.language.communicate', self::LANG.'.communicateLang[0].communicateLang[0]', false, 'text'],
            ['applicant.language.communicate', self::GEN.'.q5[0].CorrespondenceLang[0]', false, 'text'],
            ['applicant.language.communicate', self::GEN.'.q5[0].InterviewLang[0]', false, 'text'],

            // First dependent (depPrime) ← children[0]
            ['applicant.family.children.0.family_name', self::DEP0.'.q1[0].FamilyName[0]', false, 'name'],
            ['applicant.family.children.0.given_names', self::DEP0.'.q1[0].GivenName[0]', false, 'name'],
            ['applicant.family.children.0.date_of_birth', self::DEP0.'.personalDetails[0].q7-8[0].DOB[0].DOBYYYY[0]', false, 'date_yyyy'],
            ['applicant.family.children.0.date_of_birth', self::DEP0.'.personalDetails[0].q7-8[0].DOB[0].DOBMM[0]', false, 'date_mm'],
            ['applicant.family.children.0.date_of_birth', self::DEP0.'.personalDetails[0].q7-8[0].DOB[0].DOBDD[0]', false, 'date_dd'],
            ['applicant.family.children.0.uci', self::DEP0.'.personalDetails[0].q3-4-5-6[0].UCI[0]', false, 'uci'],
            ['applicant.family.children.0.country_of_birth', self::DEP0.'.personalDetails[0].q7-8[0].PlaceBirthCountry[0]', false, 'text'],
            ['applicant.family.children.0.relationship', self::DEP0.'.personalDetails[0].q10[0].relationToapplicant[0].relationshipToapplicant[0]', false, 'text'],
        ];
    }
}
