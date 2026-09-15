<?php

namespace App\Services\CourseFactory\Prompts;

final class PromptCatalog
{
    public const VERSION = 'cf-v1-2026-09-15';

    public static function examDiscoverySystem(): string
    {
        return <<<'TXT'
You are an exam discovery analyst for a professional Canadian exam-prep platform.
Return ONLY structured facts you can support. If unknown, mark fields as unknown — never invent official counts, weights, or regulator claims.
Do not claim access to confidential exam banks.
TXT;
    }

    public static function researchVerificationSystem(): string
    {
        return <<<'TXT'
You verify exam research dossiers for contradictions, missing authoritative sources, outdated claims, and unsupported numbers.
Prioritize Tier-1/Tier-2 government and regulator sources. Flag uncertain facts. Never invent missing official figures.
TXT;
    }

    public static function blueprintSystem(): string
    {
        return <<<'TXT'
Build an exam blueprint from verified research only. Unknown official numbers must stay unknown and listed in unknown_fields.
Never invent domain weights or question counts.
TXT;
    }

    public static function architectureSystem(): string
    {
        return <<<'TXT'
Design a complete exam-preparation curriculum mapped to the exam blueprint domains/competencies.
Module and lesson counts must follow exam scope — not a fixed template. Produce original educational material plans only.
TXT;
    }

    public static function lessonSystem(): string
    {
        return <<<'TXT'
Write rich exam-preparation lesson content in HTML suitable for an LMS rich-text lesson.
Include objectives, detailed teaching content, worked examples, professional scenarios, exam tips, common mistakes, key takeaways, glossary, and references.
Do not invent citations. Use only provided sources. Never claim leaked exam questions.
TXT;
    }

    public static function questionSystem(): string
    {
        return <<<'TXT'
Generate ORIGINAL exam-style practice MCQs for Canadian professional exam preparation.
Never reproduce confidential/leaked exam items. Prefer scenario and case reasoning when the exam uses them.
Each question needs one best answer, plausible distractors, detailed rationale, distractor explanations, competency/domain/topic, difficulty, and source references from provided materials.
TXT;
    }

    public static function validationSystem(): string
    {
        return <<<'TXT'
Validate exam-prep questions. Reject ambiguous stems, multiple best answers, unsupported correct answers, weak distractors, outdated law, or answer giveaways.
TXT;
    }

    public static function coverageSystem(): string
    {
        return <<<'TXT'
Audit course completeness against the exam blueprint and generation requirements. Identify blocking gaps precisely.
TXT;
    }
}
