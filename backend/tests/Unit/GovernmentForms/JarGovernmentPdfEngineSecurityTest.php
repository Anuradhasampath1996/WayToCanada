<?php

namespace Tests\Unit\GovernmentForms;

use App\Implementations\GovernmentForms\JarGovernmentPdfEngine;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class JarGovernmentPdfEngineSecurityTest extends TestCase
{
    public function test_allowed_subcommands_are_fixed(): void
    {
        $this->assertSame(
            ['inspect', 'fill-xfa-datasets', 'flatten-xfa', 'compare'],
            JarGovernmentPdfEngine::allowedSubcommands(),
        );
    }

    #[DataProvider('adversarialPathProvider')]
    public function test_windows_argument_quoting_wraps_adversarial_paths(string $input, string $expectedQuoted): void
    {
        $this->assertSame($expectedQuoted, JarGovernmentPdfEngine::quoteWindowsArgument($input));
    }

    public static function adversarialPathProvider(): array
    {
        return [
            'spaces' => ['C:\\temp\\file name.pdf', '"C:\\temp\\file name.pdf"'],
            'quotes' => ['C:\\temp\\file"name.pdf', '"C:\\temp\\file""name.pdf"'],
            'ampersand' => ['C:\\temp\\a&b.pdf', '"C:\\temp\\a&b.pdf"'],
            'pipe' => ['C:\\temp\\a|b.pdf', '"C:\\temp\\a|b.pdf"'],
            'semicolon' => ['C:\\temp\\a;b.pdf', '"C:\\temp\\a;b.pdf"'],
            'parentheses' => ['C:\\temp\\file (1).pdf', '"C:\\temp\\file (1).pdf"'],
            'unicode' => ['C:\\temp\\file-日本語.pdf', '"C:\\temp\\file-日本語.pdf"'],
        ];
    }

    public function test_quoted_command_does_not_split_on_shell_metacharacters(): void
    {
        $quoted = JarGovernmentPdfEngine::quoteWindowsArgument('C:\\temp\\a&b| c(d).pdf');
        $command = sprintf('"%s" -jar "%s" %s', 'C:\\Java\\java.exe', 'C:\\app\\processor.jar', implode(' ', [
            $quoted,
        ]));

        $this->assertStringNotContainsString(' a&b| ', $command);
        $this->assertStringContainsString('"C:\\temp\\a&b| c(d).pdf"', $command);
    }
}
