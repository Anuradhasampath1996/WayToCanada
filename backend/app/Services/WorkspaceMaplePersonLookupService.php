<?php

namespace App\Services;

final class WorkspaceMaplePersonLookupService
{
    /** @var list<array{title: string, fields: list<string>}> */
    private const SECTIONS = [
        [
            'title'  => 'Identity',
            'fields' => ['fullName', 'dob', 'passportGender', 'nicFullName', 'nicDob', 'nicBirthPlace', 'nicAddress'],
        ],
        [
            'title'  => 'Passport',
            'fields' => ['passportFullName', 'passportNumber', 'passportIssueDate', 'passportExpiry', 'passportNationality'],
        ],
        [
            'title'  => 'Education',
            'fields' => ['educationLevels', 'studiedInCanada', 'canadaStudyInstitution'],
        ],
        [
            'title'  => 'English test',
            'fields' => ['_english_block'],
        ],
        [
            'title'  => 'French test',
            'fields' => ['_french_block'],
        ],
        [
            'title'  => 'Work experience',
            'fields' => ['workExperience', 'canadianWork', 'canadianWorkStart', 'canadianWorkEnd'],
        ],
        [
            'title'  => 'Immigration targets',
            'fields' => ['intendedNocCode', 'intendedNocTeer', 'intendedNocTitle', 'visaType'],
        ],
        [
            'title'  => 'Contact',
            'fields' => ['email', 'whatsapp'],
        ],
    ];

    /** @var array<string, string> */
    private const FIELD_LABELS = [
        'fullName' => 'Full name',
        'dob' => 'Date of birth',
        'passportFullName' => 'Name on passport',
        'passportNumber' => 'Passport number',
        'passportIssueDate' => 'Issue date',
        'passportExpiry' => 'Expiry date',
        'passportNationality' => 'Nationality',
        'passportGender' => 'Gender',
        'nicFullName' => 'ID name',
        'nicNumber' => 'ID number',
        'nicDob' => 'ID date of birth',
        'nicAddress' => 'Address on ID',
        'nicBirthPlace' => 'Birth place',
        'educationLevels' => 'Education level',
        'studiedInCanada' => 'Studied in Canada',
        'canadaStudyInstitution' => 'Canadian institution',
        'workExperience' => 'Foreign work',
        'canadianWork' => 'Canadian work',
        'canadianWorkStart' => 'Canadian work from',
        'canadianWorkEnd' => 'Canadian work to',
        'intendedNocCode' => 'Target NOC',
        'intendedNocTeer' => 'NOC TEER',
        'intendedNocTitle' => 'Occupation title',
        'email' => 'Email',
        'whatsapp' => 'WhatsApp',
        'visaType' => 'Visa type',
    ];

    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{role: string, content: string}>  $history
     */
    public function resolve(array $context, string $query, array $history = [], ?string $roleHint = null): ?array
    {
        $registry = $this->buildRegistry($context);
        if ($registry === []) {
            return null;
        }

        if ($roleHint !== null) {
            foreach ($registry as $person) {
                if ($person['role'] === $roleHint) {
                    return $person;
                }
            }
        }

        $q = strtolower($query);
        $wantsDetails = $this->asksPersonDetails($query);

        if ($wantsDetails) {
            foreach ($registry as $person) {
                foreach ($person['names'] as $name) {
                    $nameLower = strtolower($name);
                    if ($nameLower !== '' && str_contains($q, $nameLower)) {
                        return $person;
                    }
                }
            }

            $nameToken = $this->extractNameAfterAbout($query);
            if ($nameToken !== null) {
                foreach ($registry as $person) {
                    foreach ($person['names'] as $name) {
                        if ($this->namesMatch($nameToken, $name)) {
                            return $person;
                        }
                    }
                }
            }

            if ($this->mentionsSpouse($q)) {
                foreach ($registry as $person) {
                    if ($person['role'] === 'Spouse') {
                        return $person;
                    }
                }
            }

            $fromHistory = $this->personFromHistory($history, $registry);
            if ($fromHistory !== null) {
                return $fromHistory;
            }
        }

        return null;
    }

    /** @param array{role: string, display_name: string, data: array<string, mixed>} $person */
    public function formatProfile(array $person): string
    {
        $name = $person['display_name'] ?: $person['role'];
        $data = $person['data'];
        $blocks = [];
        $totalFields = 0;

        foreach (self::SECTIONS as $section) {
            $lines = [];

            foreach ($section['fields'] as $key) {
                if ($key === '_english_block') {
                    $english = $this->formatEnglishBlock($data);
                    if ($english !== null) {
                        $lines = array_merge($lines, $english);
                    }
                    continue;
                }
                if ($key === '_french_block') {
                    $french = $this->formatFrenchBlock($data);
                    if ($french !== null) {
                        $lines = array_merge($lines, $french);
                    }
                    continue;
                }

                if (! array_key_exists($key, $data)) {
                    continue;
                }

                $formatted = $this->formatField($key, $data[$key], $data);
                if ($formatted === null) {
                    continue;
                }

                if ($key === 'fullName' && $this->sameName($formatted, $name)) {
                    continue;
                }

                $label = self::FIELD_LABELS[$key] ?? $key;
                $lines[] = "• {$label}: {$formatted}";
                $totalFields++;
            }

            if ($lines !== []) {
                $blocks[] = $section['title']."\n".implode("\n", $lines);
            }
        }

        if ($totalFields === 0 && $blocks === []) {
            return "{$name} is on this case as {$person['role']}, but their questionnaire profile has no detailed fields filled in yet.";
        }

        $header = "Profile for {$name} ({$person['role']})";
        $body   = implode("\n\n", $blocks);

        if ($totalFields >= 16) {
            $body .= "\n\nOpen Questionnaire Review for remaining fields.";
        }

        return $header."\n\n".$body;
    }

    public function asksPersonDetails(string $query): bool
    {
        $q = strtolower($query);

        $needles = [
            'details', 'detail', 'information', 'info about', 'tell me about', 'what do we know',
            'what do you know', 'what have we', 'profile', 'everything about', 'all about',
            'summary of', 'describe', 'who is',
            'තොරතුරු', 'විස්තර', 'කියන්න', 'මොනවද', 'මොනවාද',
            'theruma', 'thoruma', 'wisthara', 'visithuru', 'kiyanna', 'monawada', 'mona wada',
            'details gana', 'details kiyanna',
        ];

        foreach ($needles as $needle) {
            if (str_contains($q, $needle)) {
                return true;
            }
        }

        return (bool) preg_match('/\babout\s+[\p{L}\p{N}]/u', $query);
    }

    /** @param array<string, mixed> $data @return list<string>|null */
    private function formatEnglishBlock(array $data): ?array
    {
        $taken = strtolower((string) ($data['languageTest'] ?? '')) === 'yes';
        $scores = is_array($data['scores'] ?? null) ? $data['scores'] : [];
        $scoreLines = $this->scoreLines($scores);

        if ($scoreLines !== []) {
            $type = strtoupper((string) ($data['languageTestType'] ?? 'IELTS'));
            $lines = ["• Test: {$type}"];
            foreach ($scoreLines as $line) {
                $lines[] = "  ◦ {$line}";
            }

            return $lines;
        }

        if ($taken) {
            return ['• English test marked yes (scores not entered yet)'];
        }

        return null;
    }

    /** @param array<string, mixed> $data @return list<string>|null */
    private function formatFrenchBlock(array $data): ?array
    {
        $taken = strtolower((string) ($data['frenchTestTaken'] ?? '')) === 'yes';
        $scores = is_array($data['frenchScores'] ?? null) ? $data['frenchScores'] : [];
        $scoreLines = $this->scoreLines($scores);

        if ($scoreLines === [] && ! $taken) {
            return null;
        }

        if ($scoreLines !== []) {
            $type = strtoupper((string) ($data['frenchTestType'] ?? 'TEF'));
            $lines = ["• Test: {$type}"];
            foreach ($scoreLines as $line) {
                $lines[] = "  ◦ {$line}";
            }

            return $lines;
        }

        return ['• French test marked yes (scores not entered yet)'];
    }

    /** @param array<string, mixed> $scores @return list<string> */
    private function scoreLines(array $scores): array
    {
        $lines = [];
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
            $v = $scores[$skill] ?? null;
            if ($v === null || $v === '' || $v === 0 || $v === '0') {
                continue;
            }
            $lines[] = ucfirst($skill).': '.$v;
        }

        return $lines;
    }

    /** @param array<string, mixed> $data */
    private function formatField(string $key, mixed $value, array $data): ?string
    {
        if ($value === null || $value === '' || $value === '[document on file]') {
            return null;
        }

        if ($key === 'canadianWork') {
            if (strtolower((string) $value) !== 'yes') {
                return strtolower((string) $value) === 'no' ? 'No' : null;
            }
            $start = $data['canadianWorkStart'] ?? null;
            $end   = $data['canadianWorkEnd'] ?? null;
            if ($start || $end) {
                return trim("Yes ({$start} → {$end})", ' ()→');
            }

            return 'Yes';
        }

        if (is_array($value)) {
            $flat = array_filter(array_map('strval', $value), fn ($v) => trim($v) !== '');

            return $flat !== [] ? implode(', ', $flat) : null;
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        $str = trim((string) $value);
        if (strtolower($str) === 'yes' || strtolower($str) === 'no') {
            return ucfirst(strtolower($str));
        }

        return $str;
    }

    private function sameName(string $formatted, string $displayName): bool
    {
        return strtolower(trim($formatted)) === strtolower(trim($displayName));
    }

    /**
     * @param  array<string, mixed>  $context
     * @return list<array{role: string, display_name: string, data: array<string, mixed>, names: list<string>}>
     */
    private function buildRegistry(array $context): array
    {
        $detail = $context['case_detail']['questionnaire'] ?? null;
        if (! is_array($detail)) {
            return [];
        }

        $registry = [];

        $main = is_array($detail['main_data'] ?? null) ? $detail['main_data'] : [];
        $registry[] = $this->personEntry('Main applicant', $main, $context['case_facts']['main_applicant']['display_name'] ?? null);

        $spouse = is_array($detail['spouse_data'] ?? null) ? $detail['spouse_data'] : [];
        if ($spouse !== [] || ($context['case_facts']['married'] ?? false)) {
            $registry[] = $this->personEntry('Spouse', $spouse, $context['case_facts']['spouse']['display_name'] ?? null);
        }

        foreach (is_array($detail['children_data'] ?? null) ? $detail['children_data'] : [] as $i => $child) {
            if (is_array($child) && $child !== []) {
                $registry[] = $this->personEntry('Child '.($i + 1), $child, $child['fullName'] ?? null);
            }
        }

        foreach (is_array($detail['accompanying_data'] ?? null) ? $detail['accompanying_data'] : [] as $i => $person) {
            if (is_array($person) && $person !== []) {
                $registry[] = $this->personEntry('Accompanying person '.($i + 1), $person, $person['fullName'] ?? null);
            }
        }

        return $registry;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{role: string, display_name: string, data: array<string, mixed>, names: list<string>}
     */
    private function personEntry(string $role, array $data, ?string $fallbackName): array
    {
        $names = array_values(array_unique(array_filter([
            $fallbackName,
            isset($data['fullName']) ? (string) $data['fullName'] : null,
            isset($data['passportFullName']) ? (string) $data['passportFullName'] : null,
            isset($data['nicFullName']) ? (string) $data['nicFullName'] : null,
        ], fn ($n) => is_string($n) && trim($n) !== '')));

        $display = $names[0] ?? $role;

        return [
            'role'         => $role,
            'display_name' => $display,
            'data'         => $data,
            'names'        => $names,
        ];
    }

    private function extractNameAfterAbout(string $query): ?string
    {
        if (preg_match('/\babout\s+([\p{L}\p{N}\-\'\.]+)/iu', $query, $m)) {
            return trim($m[1], "?.! \t");
        }

        return null;
    }

    private function namesMatch(string $a, string $b): bool
    {
        $a = strtolower(trim($a));
        $b = strtolower(trim($b));
        if ($a === '' || $b === '') {
            return false;
        }

        return $a === $b || str_contains($b, $a) || str_contains($a, $b);
    }

    private function mentionsSpouse(string $q): bool
    {
        return str_contains($q, 'spouse') || str_contains($q, 'partner')
            || str_contains($q, 'wife') || str_contains($q, 'husband')
            || str_contains($q, 'barya') || str_contains($q, 'බළා') || str_contains($q, 'භාර්යා');
    }

    /** @param list<array{role: string, content: string}> $history */
    private function historyMentionsSpouse(array $history): bool
    {
        foreach (array_reverse($history) as $turn) {
            $c = strtolower($turn['content'] ?? '');
            if (str_contains($c, 'spouse')) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{role: string, content: string}>  $history
     * @param  list<array{role: string, display_name: string, data: array<string, mixed>, names: list<string>}>  $registry
     */
    private function historyMentionsPerson(array $history, array $registry): bool
    {
        foreach (array_reverse(array_slice($history, -4)) as $turn) {
            $c = strtolower($turn['content'] ?? '');
            foreach ($registry as $person) {
                foreach ($person['names'] as $name) {
                    if ($name !== '' && str_contains($c, strtolower($name))) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * @param  list<array{role: string, content: string}>  $history
     * @param  list<array{role: string, display_name: string, data: array<string, mixed>, names: list<string>}>  $registry
     * @return array{role: string, display_name: string, data: array<string, mixed>}|null
     */
    private function personFromHistory(array $history, array $registry): ?array
    {
        foreach (array_reverse(array_slice($history, -6)) as $turn) {
            $c = strtolower($turn['content'] ?? '');
            foreach ($registry as $person) {
                foreach ($person['names'] as $name) {
                    if ($name !== '' && str_contains($c, strtolower($name))) {
                        return $person;
                    }
                }
            }
            if (str_contains($c, 'spouse on file is')) {
                foreach ($registry as $person) {
                    if ($person['role'] === 'Spouse') {
                        return $person;
                    }
                }
            }
        }

        return null;
    }
}
