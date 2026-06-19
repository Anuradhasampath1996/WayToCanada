<?php

namespace App\Services;

final class WorkspaceMapleCaseChatService
{
    public function __construct(
        private WorkspaceMaplePersonLookupService $personLookup,
        private WorkspaceMaplePathwayAdvisorService $pathwayAdvisor,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{role: string, content: string}>  $history
     */
    public function reply(array $context, string $message, array $history = []): string
    {
        $facts = $context['case_facts'] ?? [];
        $q     = $this->normalize($message);

        if ($q === '') {
            return 'Please ask a question about this client — for example their name, case stage, CRS, or immigration rules.';
        }

        if ($this->asksAny($q, ['hello', 'hi ', 'hey', 'good morning', 'good afternoon', 'ayubowan', 'ayubo'])) {
            return $this->greeting($facts);
        }

        if ($this->asksChildrenQuestion($q)) {
            return $this->answerChildren($context);
        }

        if ($this->asksWhoIsMainApplicant($q)) {
            return $this->answerName($facts, $q);
        }

        if ($this->asksNameQuestion($q)) {
            return $this->answerName($facts, $q);
        }

        if ($this->asksPathwayAdvice($q, $history)) {
            return $this->pathwayAdvisor->advise($context, $message, $history);
        }

        if ($this->asksSpouseTopic($q)) {
            if ($this->wantsPersonProfile($q, $history)) {
                $spouse = $this->personLookup->resolve($context, 'spouse '.$message, $history, 'Spouse');
                if ($spouse !== null) {
                    return $this->personLookup->formatProfile($spouse);
                }
            }

            return $this->answerSpouse($facts);
        }

        if ($this->wantsPersonProfile($q, $history)) {
            $person = $this->personLookup->resolve($context, $message, $history);
            if ($person !== null) {
                return $this->personLookup->formatProfile($person);
            }
        }

        if ($this->asksAny($q, ['email', 'e-mail', 'mail address'])) {
            return $this->answerEmail($facts);
        }

        if ($this->asksAny($q, ['phone', 'whatsapp', 'contact number', 'mobile'])) {
            return $this->answerPhone($facts);
        }

        if ($this->asksAny($q, ['date of birth', 'dob', 'birthday', 'born'])) {
            return $this->answerDob($facts);
        }

        if ($this->asksAny($q, ['married', 'marital'])) {
            return $this->answerMarried($facts);
        }

        if ($this->asksAny($q, ['pathway', 'immigration route', 'program'])) {
            if ($this->asksAny($q, ['best', 'good', 'recommend', 'suitable', 'which', 'better', 'compare', 'should'])) {
                return $this->pathwayAdvisor->advise($context, $message, $history);
            }

            return $this->answerPathway($context);
        }

        if ($this->asksAny($q, ['crs', 'score', 'points', 'competitive', 'draw', 'ita', 'invite'])) {
            return $this->answerCrs($context);
        }

        if ($this->asksAny($q, ['noc', 'occupation', 'teer', 'job title'])) {
            return $this->answerNoc($context);
        }

        if ($this->asksAny($q, ['education', 'degree', 'qualification', 'university'])) {
            return $this->answerEducation($context);
        }

        if ($this->asksAny($q, ['ielts', 'celpip', 'english', 'language test', 'clb', 'french', 'tef', 'tcf'])) {
            return $this->answerLanguage($context);
        }

        if ($this->asksAny($q, ['work experience', 'work history', 'employment', 'canadian work', 'foreign work'])) {
            return $this->answerWork($context);
        }

        if ($this->asksAny($q, ['express entry', 'irpa', 'irpr', 'legislation', 'law', 'regulation', 'inadmissib', 'study permit', 'work permit', 'pnp', 'provincial nominee'])) {
            $imm = $this->answerImmigrationKnowledge($context, $q);
            if ($imm !== null) {
                return $imm;
            }
        }

        if ($this->asksAny($q, ['stage', 'status', 'where are we', 'case status', 'workflow'])) {
            return $this->answerStage($context);
        }

        if ($this->asksAny($q, ['next', 'what should i do', 'what do i do', 'focus', 'priority']) && ! $this->asksPathwayAdvice($q, $history)) {
            return $this->answerNextAction($context);
        }

        if ($this->asksAny($q, ['questionnaire', 'form', 'submitted', 'submission'])) {
            return $this->answerQuestionnaire($context);
        }

        if ($this->asksAny($q, ['gap', 'missing', 'blocker', 'incomplete', 'refill'])) {
            return $this->answerGaps($context);
        }

        if ($this->asksAny($q, ['agreement', 'retainer', 'signed', 'signature'])) {
            return $this->answerAgreement($context);
        }

        if ($this->asksAny($q, ['inadmissib', 'criminal', 'medical', 'refusal', 'flag'])) {
            return $this->answerFlags($context);
        }

        $fieldAnswer = $this->lookupCaseDetailField($context, $q);
        if ($fieldAnswer !== null) {
            return $fieldAnswer;
        }

        if ($this->asksAny($q, ['summary', 'overview']) && ! $this->asksWhoIsMainApplicant($q)) {
            return $this->caseSummary($context, $facts);
        }

        return $this->smartFallback($context, $facts, $q, $history);
    }

    private function asksWhoIsMainApplicant(string $q): bool
    {
        if (! $this->asksAny($q, ['who is', 'who s', 'kawda', 'mona', 'kiyanne'])) {
            return false;
        }

        return $this->asksAny($q, [
            'main', 'applicant', 'aplivan', 'aplicant', 'aplicane', 'aplicane', 'client',
        ]);
    }

    /** @param list<array{role: string, content: string}> $history */
    private function asksPathwayAdvice(string $q, array $history): bool
    {
        if ($this->asksAny($q, [
            'best pathway', 'which pathway', 'recommend pathway', 'pathway recommend',
            'good for him', 'good for her', 'good for this', 'is it good', 'worth it',
            'right pathway', 'fit for', 'compare pathway', 'suitable pathway', 'should he',
            'should she', 'pathway fit', 'good option', 'best route', 'best option',
            'hoda', 'hondai', 'hodata', 'yahama',
        ])) {
            return true;
        }

        if ($this->asksAny($q, ['pathway', 'study permit', 'express entry', 'pnp'])
            && $this->asksAny($q, ['best', 'good', 'recommend', 'suitable', 'which', 'better', 'compare', 'should', 'fit'])) {
            return true;
        }

        if ($this->asksAny($q, ['is it good', 'good for him', 'good for her', 'worth it', 'suitable', 'honda', 'hodata'])
            && $this->pathwayAdvisor->historyAboutPathway($history)) {
            return true;
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $facts
     * @param  list<array{role: string, content: string}>  $history
     */
    private function smartFallback(array $context, array $facts, string $q, array $history): string
    {
        if ($this->pathwayAdvisor->historyAboutPathway($history)
            || $this->asksAny($q, ['pathway', 'study permit', 'express entry', 'immigrat', 'pr ', 'permanent'])) {
            return $this->pathwayAdvisor->advise($context, '', $history);
        }

        $name = $facts['main_applicant']['display_name'] ?? 'this client';

        return "I'm not sure I understood that question about {$name}.\n\n"
            ."Try asking clearly, for example:\n"
            ."• Who is the main applicant?\n"
            ."• What is the best pathway for this client?\n"
            ."• Is Study Permit a good fit?\n"
            ."• What is their CRS score?\n"
            ."• What details do we have about the spouse?";
    }

    private function normalize(string $message): string
    {
        $q = strtolower(trim($message));
        $q = preg_replace('/[^\p{L}\p{N}\s\?]/u', ' ', $q) ?? $q;
        $q = preg_replace('/\s+/', ' ', $q) ?? $q;

        return trim($q);
    }

    /** @param list<string> $needles */
    private function asksAny(string $q, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($q, strtolower($needle))) {
                return true;
            }
        }

        return false;
    }

    private function asksNameQuestion(string $q): bool
    {
        if (! str_contains($q, 'name') && ! str_contains($q, 'nama') && ! str_contains($q, 'නම')) {
            return false;
        }

        if ($this->personLookup->asksPersonDetails($q)) {
            return false;
        }

        return $this->asksSpouseTopic($q)
            || $this->asksAny($q, [
                'main applicant', 'applicant', 'aplivan', 'aplicant', 'aplicane', 'client', 'full name', 'main',
            ])
            || str_contains($q, 'name');
    }

    /** @param list<array{role: string, content: string}> $history */
    private function historyAboutSpouse(array $history): bool
    {
        foreach (array_reverse(array_slice($history, -4)) as $turn) {
            if (($turn['role'] ?? '') !== 'user') {
                continue;
            }
            if ($this->asksSpouseTopic(strtolower((string) ($turn['content'] ?? '')))) {
                return true;
            }
        }

        return false;
    }

    private function asksSpouseTopic(string $q): bool
    {
        return $this->asksAny($q, [
            'spouse', 'spuse', 'spouce', 'partner', 'wife', 'wifr', 'husband', 'husban',
            'barya', 'බළා', 'භාර්යා',
        ]);
    }

    private function asksChildrenQuestion(string $q): bool
    {
        if ($this->asksAny($q, [
            'child', 'children', 'kids', 'kid', 'dependent', 'son', 'daughter',
            'daruwa', 'daruwane', 'lamai', 'lamayek', 'lamayi', 'පැුට්ටා', 'දරු', 'ළමා',
        ])) {
            return true;
        }

        return (bool) preg_match('/\b(how many|have|has|innavada|kiyak|monawada)\b.*\b(child|children|lamai|daruwa|kid)/iu', $q)
            || (bool) preg_match('/\b(lamai|daruwa).*\b(innavada|kiyak|monawada|have|has)/iu', $q);
    }

    /** @param list<array{role: string, content: string}> $history */
    private function wantsPersonProfile(string $q, array $history): bool
    {
        if ($this->asksNameQuestion($q) || $this->asksChildrenQuestion($q)) {
            return false;
        }

        if ($this->personLookup->asksPersonDetails($q)) {
            return true;
        }

        if ($this->asksSpouseTopic($q) && ! $this->asksAny($q, ['name', 'nama', 'නම'])) {
            return $this->asksAny($q, ['details', 'detail', 'theruma', 'thoruma', 'wisthara', 'තොරතුරු', 'විස්තර', 'profile']);
        }

        return false;
    }

    /** @param array<string, mixed> $context */
    private function answerChildren(array $context): string
    {
        $questionnaire = $context['case_detail']['questionnaire'] ?? null;
        if (! is_array($questionnaire)) {
            return 'No questionnaire data yet — children information is not available.';
        }

        $step1    = is_array($questionnaire['step1_data'] ?? null) ? $questionnaire['step1_data'] : [];
        $children = is_array($questionnaire['children_data'] ?? null) ? $questionnaire['children_data'] : [];
        $declared = $step1['dependentChildren'] ?? null;

        $filled = array_values(array_filter($children, fn ($c) => is_array($c) && $c !== []));

        if ($filled !== []) {
            $names = collect($filled)->map(function ($child, $i) {
                $name = trim((string) ($child['fullName'] ?? $child['passportFullName'] ?? ''));

                return $name !== '' ? $name : 'Child '.($i + 1);
            })->implode(', ');

            $count = is_numeric($declared) ? (int) $declared : count($filled);

            return "Yes — {$count} dependent child(ren) on file: {$names}.";
        }

        $declaredStr = strtolower(trim((string) $declared));
        if ($declaredStr === '0' || $declaredStr === 'none' || $declaredStr === 'no') {
            return 'No — the questionnaire records zero dependent children.';
        }

        if ($declared !== null && $declared !== '') {
            return "The questionnaire declares {$declared} dependent child(ren), but individual child profiles are not filled in yet.";
        }

        return 'No dependent children are recorded on the questionnaire yet.';
    }

    /** @param list<array{role: string, content: string}> $history */
    private function recentUserTopic(array $history): string
    {
        foreach (array_reverse($history) as $turn) {
            if (($turn['role'] ?? '') === 'user') {
                return (string) ($turn['content'] ?? '');
            }
        }

        return '';
    }

    /** @param array<string, mixed> $facts */
    private function greeting(array $facts): string
    {
        $name = $facts['main_applicant']['display_name'] ?? $facts['account']['name'] ?? 'this client';

        return "Hi! I'm Maple. Ask me anything about {$name}'s case or Canadian immigration rules — CRS, pathways, questionnaire fields, or next steps.";
    }

    /** @param array<string, mixed> $facts */
    private function answerName(array $facts, string $q = ''): string
    {
        if ($q !== '' && $this->asksSpouseTopic($q)) {
            return $this->answerSpouse($facts);
        }

        $main = $facts['main_applicant'] ?? [];
        $name = $main['display_name'] ?? $main['full_name'] ?? $facts['account']['name'] ?? null;

        if (! $name) {
            return "I don't have a main applicant name on file yet. The client hasn't completed the questionnaire profile — check Questionnaire Review.";
        }

        $source = $main['name_source'] ?? 'case file';
        $extra  = '';
        if (! empty($main['passport_full_name']) && $main['passport_full_name'] !== $name) {
            $extra = " Passport name on file: {$main['passport_full_name']}.";
        }

        return "The main applicant is {$name} (from {$source}).{$extra}";
    }

    /** @param array<string, mixed> $facts */
    private function answerEmail(array $facts): string
    {
        $email = $facts['main_applicant']['email'] ?? $facts['account']['email'] ?? null;

        return $email
            ? "The client email on file is {$email}."
            : "I don't see an email in the questionnaire yet.";
    }

    /** @param array<string, mixed> $facts */
    private function answerPhone(array $facts): string
    {
        $phone = $facts['main_applicant']['whatsapp'] ?? $facts['main_applicant']['phone'] ?? $facts['account']['phone'] ?? null;

        return $phone
            ? "The contact number on file is {$phone}."
            : "I don't see a phone or WhatsApp number in the questionnaire yet.";
    }

    /** @param array<string, mixed> $facts */
    private function answerDob(array $facts): string
    {
        $dob = $facts['main_applicant']['date_of_birth'] ?? null;

        return $dob
            ? "The main applicant's date of birth on file is {$dob}."
            : "Date of birth isn't in the questionnaire yet.";
    }

    /** @param array<string, mixed> $facts */
    private function answerSpouse(array $facts): string
    {
        if (! ($facts['married'] ?? false)) {
            return 'The questionnaire shows this client is not marked as married.';
        }

        $name = $facts['spouse']['display_name'] ?? $facts['spouse']['full_name'] ?? null;

        return $name
            ? "The spouse on file is {$name}."
            : "The client is marked married, but the spouse profile isn't filled in yet.";
    }

    /** @param array<string, mixed> $facts */
    private function answerMarried(array $facts): string
    {
        return ($facts['married'] ?? false)
            ? 'Yes — the questionnaire marks this client as married.'
            : 'No — the questionnaire does not mark this client as married.';
    }

    /** @param array<string, mixed> $context */
    private function answerPathway(array $context): string
    {
        $pathway = $context['case_file']['immigration_pathway'] ?? null;
        if ($pathway) {
            return "The assigned immigration pathway is {$pathway}.";
        }

        $guides = $context['immigration_knowledge']['pathway_guides']['express_entry'] ?? null;
        $hint   = $guides ? ' '.$guides : '';

        return "No pathway is assigned yet.{$hint} Use the pathway calculator after questionnaire review.";
    }

    /** @param array<string, mixed> $context */
    private function answerCrs(array $context): string
    {
        $detail = $context['case_detail']['crs_estimate'] ?? null;
        $saved  = $context['case_file']['pathway_assessment_crs_score'] ?? null;
        $ircc   = $context['case_file']['pathway_assessment_ircc_crs_score'] ?? null;

        $parts = [];
        if ($detail && isset($detail['crs_total'])) {
            $parts[] = 'estimated CRS from questionnaire: '.$detail['crs_total'].' (rules '.$detail['rules_version'].')';
        }
        if ($saved !== null) {
            $parts[] = 'saved workspace assessment CRS: '.$saved;
        }
        if ($ircc !== null) {
            $parts[] = 'IRCC CRS on file: '.$ircc;
        }

        $drawNote = '';
        $draws = $context['immigration_knowledge']['express_entry_draws'] ?? [];
        if ($draws !== []) {
            $latest = $draws[0];
            $drawNote = ' Latest Express Entry draw: '.($latest['draw_name'] ?? 'round')
                .' on '.($latest['draw_date'] ?? '?')
                .' — cut-off CRS '.($latest['minimum_crs_score'] ?? '?').'.';
        }

        if ($parts === []) {
            return 'No CRS score is calculated yet — complete more questionnaire fields or run the pathway calculator.'.$drawNote;
        }

        return implode('; ', $parts).'.'.$drawNote;
    }

    /** @param array<string, mixed> $context */
    private function answerNoc(array $context): string
    {
        $main = $context['case_detail']['questionnaire']['main_data'] ?? [];
        $code  = $main['intendedNocCode'] ?? null;
        $teer  = $main['intendedNocTeer'] ?? null;
        $title = $main['intendedNocTitle'] ?? null;

        if (! $code && ! $title) {
            return 'No target NOC is recorded in the questionnaire yet.';
        }

        $bits = array_filter([
            $code ? "NOC {$code}" : null,
            $teer !== null && $teer !== '' ? 'TEER '.$teer : null,
            $title ? (string) $title : null,
        ]);

        return 'Target occupation on file: '.implode(' — ', $bits).'.';
    }

    /** @param array<string, mixed> $context */
    private function answerEducation(array $context): string
    {
        $main = $context['case_detail']['questionnaire']['main_data'] ?? [];
        $levels = $main['educationLevels'] ?? null;
        if (is_array($levels) && $levels !== []) {
            return 'Main applicant education levels: '.implode(', ', array_map('strval', $levels)).'.';
        }

        return 'Education details are not in the questionnaire yet.';
    }

    /** @param array<string, mixed> $context */
    private function answerLanguage(array $context): string
    {
        $main = $context['case_detail']['questionnaire']['main_data'] ?? [];
        if (strtolower((string) ($main['languageTest'] ?? '')) !== 'yes' && empty($main['scores'])) {
            return 'No English test scores are on file for the main applicant yet.';
        }

        $type = strtoupper((string) ($main['languageTestType'] ?? 'IELTS'));
        $scores = $main['scores'] ?? [];
        if (! is_array($scores)) {
            return "English test marked yes ({$type}) but scores are missing.";
        }

        $s = collect($scores)->map(fn ($v, $k) => "{$k}: {$v}")->implode(', ');

        return "Main applicant {$type} scores — {$s}.";
    }

    /** @param array<string, mixed> $context */
    private function answerWork(array $context): string
    {
        $main = $context['case_detail']['questionnaire']['main_data'] ?? [];
        $foreign = $main['workExperience'] ?? 'not specified';
        $canadian = strtolower((string) ($main['canadianWork'] ?? '')) === 'yes' ? 'yes' : 'no';

        return "Work experience on file — foreign: {$foreign}; Canadian work: {$canadian}.";
    }

    /** @param array<string, mixed> $context */
    private function answerImmigrationKnowledge(array $context, string $q): ?string
    {
        $k = $context['immigration_knowledge'] ?? [];
        $chunks = [];

        foreach ($k['pathway_guides'] ?? [] as $key => $text) {
            $chunks[] = ucfirst(str_replace('_', ' ', $key)).': '.$text;
        }
        foreach ($k['admissibility_guides'] ?? [] as $key => $text) {
            if ($this->asksAny($q, [$key, 'inadmiss', 'criminal', 'medical', 'refusal'])) {
                $chunks[] = $text;
            }
        }
        foreach ($k['crs_rules']['notes'] ?? [] as $note) {
            $chunks[] = $note;
        }

        foreach (array_slice($k['legislation_excerpts'] ?? [], 0, 2) as $ex) {
            $label = trim(($ex['act_code'] ?? '').' '.($ex['section_label'] ?? $ex['provision_key'] ?? ''));
            $chunks[] = $label.': '.mb_substr((string) ($ex['excerpt'] ?? ''), 0, 280);
        }

        if ($chunks === []) {
            return null;
        }

        return 'On Canadian immigration rules: '.implode(' ', array_slice($chunks, 0, 3))
            .' Verify against current IRCC guidance and your RCIC judgment.';
    }

    /** @param array<string, mixed> $context */
    private function answerStage(array $context): string
    {
        $status = $context['case_file']['status'] ?? 'unknown';
        $next   = $context['next_action']['title'] ?? 'continue the workflow';

        return "This case is at stage {$status}. Right now I'd focus on: {$next}.";
    }

    /** @param array<string, mixed> $context */
    private function answerNextAction(array $context): string
    {
        $next = $context['next_action'] ?? [];
        $title = $next['title'] ?? 'Continue the case workflow';
        $desc  = $next['description'] ?? '';

        return $desc !== ''
            ? "I'd focus next on: {$title}. {$desc}"
            : "I'd focus next on: {$title}.";
    }

    /** @param array<string, mixed> $context */
    private function answerQuestionnaire(array $context): string
    {
        $q = $context['questionnaire'] ?? [];

        if (! ($q['has_submission'] ?? false)) {
            return 'The client has not started the immigration questionnaire yet.';
        }

        if (! ($q['is_submitted'] ?? false)) {
            $started = ($q['has_main_profile'] ?? false) ? 'started but not submitted' : 'not substantially started';

            return "The questionnaire is {$started}. Follow up so they can submit it.";
        }

        $verified = (int) ($q['verified_count'] ?? 0);
        $pending  = (int) ($q['pending_refills'] ?? 0);
        $submitted = $context['case_facts']['questionnaire_submitted_at'] ?? 'yes';

        $msg = "The questionnaire is submitted ({$submitted}). {$verified} field(s) verified.";
        if ($pending > 0) {
            $msg .= " {$pending} refill request(s) are still pending.";
        }

        return $msg;
    }

    /** @param array<string, mixed> $context */
    private function answerGaps(array $context): string
    {
        $gaps = $context['questionnaire_gaps'] ?? [];
        if ($gaps === []) {
            return 'I do not see outstanding questionnaire gaps in the rules check for this case.';
        }

        return 'Outstanding questionnaire items: '.collect($gaps)->pluck('label')->take(6)->implode('; ').'.';
    }

    /** @param array<string, mixed> $context */
    private function answerAgreement(array $context): string
    {
        $sent   = $context['case_file']['agreement_sent_at'] ?? null;
        $signed = $context['case_file']['agreement_signed_at'] ?? null;

        if ($signed) {
            return "The retainer agreement is signed ({$signed}).";
        }
        if ($sent) {
            return "The retainer was sent on {$sent} but is not signed yet — follow up with the client.";
        }

        return 'No retainer agreement has been sent for this case yet.';
    }

    /** @param array<string, mixed> $context */
    private function answerFlags(array $context): string
    {
        $flags = $context['inadmissibility_flags'] ?? [];
        if ($flags === []) {
            $guide = $context['immigration_knowledge']['admissibility_guides']['criminal'] ?? null;

            return $guide
                ? 'No inadmissibility flags are recorded for this client. General note: '.$guide
                : 'No inadmissibility flags are recorded from the questionnaire disclosure fields.';
        }

        return 'Flags to review: '.collect($flags)->pluck('text')->take(4)->implode(' ');
    }

    /** @param array<string, mixed> $context */
    private function lookupCaseDetailField(array $context, string $q): ?string
    {
        $detail = $context['case_detail']['questionnaire'] ?? null;
        if (! is_array($detail)) {
            return null;
        }

        $flat = $this->flattenData([
            'step1' => $detail['step1_data'] ?? [],
            'main' => $detail['main_data'] ?? [],
            'spouse' => $detail['spouse_data'] ?? [],
        ]);

        foreach ($flat as $label => $value) {
            if ($value === null || $value === '' || $value === '[document on file]') {
                continue;
            }
            $labelNorm = strtolower(str_replace(['.', '_'], ' ', $label));
            if (str_contains($q, $labelNorm) || ($q !== '' && str_contains($labelNorm, $q))) {
                return ucfirst(str_replace('.', ' → ', $label)).': '.$this->stringifyValue($value).'.';
            }
        }

        return null;
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function flattenData(array $data, string $prefix = ''): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            $path = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
            if (is_array($value)) {
                $out = array_merge($out, $this->flattenData($value, $path));
            } else {
                $out[$path] = $value;
            }
        }

        return $out;
    }

    private function stringifyValue(mixed $value): string
    {
        return is_array($value) ? implode(', ', array_map('strval', $value)) : (string) $value;
    }

    /**
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $facts
     */
    private function caseSummary(array $context, array $facts, bool $unmatched = false): string
    {
        $name    = $facts['main_applicant']['display_name'] ?? $facts['account']['name'] ?? 'This client';
        $stage   = $context['case_file']['status'] ?? 'unknown';
        $next    = $context['next_action']['title'] ?? 'continue workflow';
        $pathway = $context['case_file']['immigration_pathway'] ?? 'not assigned yet';
        $crs     = $context['case_detail']['crs_estimate']['crs_total'] ?? null;

        $lead = $unmatched
            ? "I couldn't match that exact question, but here's what I have for {$name}:"
            : "Here's a quick snapshot for {$name}:";

        $crsBit = $crs !== null ? "; estimated CRS {$crs}" : '';

        return "{$lead} stage {$stage}; pathway {$pathway}{$crsBit}; next focus: {$next}. "
            .'Ask about any questionnaire field, CRS, Express Entry draws, pathways, or admissibility.';
    }
}
