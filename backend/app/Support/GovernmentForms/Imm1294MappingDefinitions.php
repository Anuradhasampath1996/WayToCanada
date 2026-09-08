<?php

namespace App\Support\GovernmentForms;

/**
 * IMM 1294 (06-2026) — Study Permit Made Outside of Canada.
 * C1: identity, contact, passport, languages (form1 root).
 *
 * @phpstan-type MappingRow array{0: string, 1: string, 2: bool, 3?: string}
 */
final class Imm1294MappingDefinitions
{
    private const PERSONAL = 'form1[0].Page1[0].PersonalDetails[0]';

    private const PAGE2 = 'form1[0].Page2[0].MaritalStatus[0].SectionA[0]';

    private const LANG = self::PAGE2.'.Languages[0].languages[0]';

    private const PASSPORT = self::PAGE2.'.Passport[0]';

    /**
     * @return list<MappingRow>
     */
    public static function all(): array
    {
        return [
            ['applicant.personal.family_name', self::PERSONAL.'.Name[0].FamilyName[0]', true, 'name'],
            ['applicant.personal.given_names', self::PERSONAL.'.Name[0].GivenName[0]', true, 'name'],
            ['applicant.personal.uci', self::PERSONAL.'.UCIClientID[0]', false, 'uci'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.DOBYear[0]', true, 'date_yyyy'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.DOBMonth[0]', true, 'date_mm'],
            ['applicant.personal.date_of_birth', self::PERSONAL.'.DOBDay[0]', true, 'date_dd'],
            ['applicant.personal.city_of_birth', self::PERSONAL.'.PlaceBirthCity[0]', false, 'text'],
            ['applicant.personal.country_of_birth', self::PERSONAL.'.PlaceBirthCountry[0]', false, 'text'],

            ['applicant.family.spouse.family_name', 'form1[0].Page1[0].MaritalStatus[0].SectionA[0].FamilyName[0]', false, 'name'],
            ['applicant.family.spouse.given_names', 'form1[0].Page1[0].MaritalStatus[0].SectionA[0].GivenName[0]', false, 'name'],

            ['applicant.language.native', self::LANG.'.nativeLang[0].nativeLang[0]', false, 'text'],
            ['applicant.language.communicate', self::LANG.'.ableToCommunicate[0].ableToCommunicate[0]', false, 'text'],

            ['applicant.passport.number', self::PASSPORT.'.PassportNum[0].PassportNum[0]', false, 'text'],
            ['applicant.passport.country', self::PASSPORT.'.CountryofIssue[0].CountryofIssue[0]', false, 'text'],

            ['applicant.contact.phone', 'form1[0].Page3[0].PhoneNumbers[0].Phone[0].ActualNumber[0]', false, 'text'],
            ['applicant.contact.email', 'form1[0].Page3[0].FaxEmail[0].Email[0]', true, 'text'],
        ];
    }
}
