<?php

namespace App\Implementations\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Production path: invokes the proven Java pdfXFA append-mode JAR locally.
 * HTTP processor service can replace this later without changing orchestration code.
 */
class JarGovernmentPdfEngine implements GovernmentPdfEngine
{
    /** @var list<string> */
    private const ALLOWED_SUBCOMMANDS = ['inspect', 'fill-xfa-datasets', 'flatten-xfa', 'compare'];

    public function engineId(): string
    {
        return 'itext_pdfxfa_append';
    }

    public function inspectTemplate(string $templatePath): array
    {
        $result = $this->runJar(['inspect', $templatePath]);

        return json_decode($result, true, 512, JSON_THROW_ON_ERROR);
    }

    public function fillXfaDatasets(string $templatePath, string $datasetsXml, string $outputPath): array
    {
        File::ensureDirectoryExists(dirname($outputPath));

        $tempXml = tempnam(sys_get_temp_dir(), 'rcic_xfa_');
        if ($tempXml === false) {
            throw new RuntimeException('Unable to create temporary datasets file.');
        }

        try {
            file_put_contents($tempXml, $datasetsXml);

            $output = $this->runJar([
                'fill-xfa-datasets',
                $templatePath,
                $tempXml,
                $outputPath,
                'append',
            ]);

            $report = json_decode($output, true) ?? [];

            if (! is_file($outputPath)) {
                throw new RuntimeException('Processor did not produce output PDF.');
            }

            return [
                'output_path' => $outputPath,
                'report'      => $report,
            ];
        } finally {
            @unlink($tempXml);
        }
    }

    public function flattenXfa(string $filledPdfPath, string $outputPath): array
    {
        File::ensureDirectoryExists(dirname($outputPath));

        $output = $this->runJar([
            'flatten-xfa',
            $filledPdfPath,
            $outputPath,
        ]);

        $report = json_decode($output, true) ?? [];

        if (! is_file($outputPath)) {
            throw new RuntimeException('Processor did not produce flattened preview PDF.');
        }

        return [
            'output_path' => $outputPath,
            'report'      => $report,
        ];
    }

    public function validateStructure(string $sourcePath, string $filledPath): array
    {
        $output = $this->runJar(['compare', $sourcePath, $filledPath]);

        return json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    }

    /** @param  list<string>  $args */
    private function runJar(array $args): string
    {
        if ($args === [] || ! in_array($args[0], self::ALLOWED_SUBCOMMANDS, true)) {
            throw new RuntimeException('Unsupported form processor subcommand.');
        }

        $jar = config('government_forms.processor.jar_path');
        $java = config('government_forms.processor.java_binary', 'java');

        if (! is_file($jar)) {
            throw new RuntimeException("Form processor JAR not found: {$jar}");
        }

        $timeoutSeconds = (int) config('government_forms.processor.timeout_seconds', 120);
        $licenseEnv = $this->itextLicenseEnv();

        if (PHP_OS_FAMILY === 'Windows' && PHP_SAPI === 'cli-server') {
            return $this->runJarViaWindowsShell($java, $jar, $args, $timeoutSeconds, $licenseEnv);
        }

        $command = array_merge([$java, '-jar', $jar], $args);

        $process = Process::timeout($timeoutSeconds);
        if ($licenseEnv !== []) {
            $process = $process->env($licenseEnv);
        }
        $result = $process->run($command);

        if (! $result->successful()) {
            $detail = trim($result->errorOutput() ?: $result->output() ?: 'no output');
            throw new RuntimeException("Form processor failed (exit {$result->exitCode()}): {$detail}");
        }

        return trim($result->output());
    }

    /** @param  list<string>  $args */
    private function runJarViaWindowsShell(string $java, string $jar, array $args, int $timeoutSeconds, array $licenseEnv = []): string
    {
        $java = $this->resolveWindowsJavaBinary($java);
        $jar = $this->normalizeWindowsPath($jar);
        $quotedArgs = array_map(fn (string $arg): string => self::quoteWindowsArgument($this->normalizeWindowsPath($arg)), $args);
        $command = sprintf('"%s" -jar "%s" %s', $java, $jar, implode(' ', $quotedArgs));

        $descriptors = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $env = null;
        if ($licenseEnv !== []) {
            $env = array_merge($_ENV + $_SERVER, $licenseEnv);
        }

        $process = proc_open($command, $descriptors, $pipes, base_path(), $env, ['bypass_shell' => false]);
        if (! is_resource($process)) {
            throw new RuntimeException('Unable to start form processor.');
        }

        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $startedAt = time();

        while (true) {
            $stdout .= stream_get_contents($pipes[1]);
            $stderr .= stream_get_contents($pipes[2]);

            $status = proc_get_status($process);
            if (! $status['running']) {
                $stdout .= stream_get_contents($pipes[1]);
                $stderr .= stream_get_contents($pipes[2]);
                break;
            }

            if (time() - $startedAt > $timeoutSeconds) {
                proc_terminate($process);
                throw new RuntimeException('Form processor timed out.');
            }

            usleep(100_000);
        }

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        if ($exitCode !== 0) {
            $detail = trim($stderr ?: $stdout ?: 'no output');
            throw new RuntimeException("Form processor failed (exit {$exitCode}): {$detail}");
        }

        return trim($stdout);
    }

    /** @return array<string, string> */
    private function itextLicenseEnv(): array
    {
        $configured = env('ITEXT_LICENSE_FILE');
        $candidates = array_filter([
            is_string($configured) && $configured !== '' ? $configured : null,
            dirname((string) config('government_forms.processor.jar_path')).DIRECTORY_SEPARATOR.'itextkey.json',
            base_path('../form-processor-poc/java-itext/itextkey.json'),
        ]);

        foreach ($candidates as $path) {
            if (is_string($path) && is_file($path)) {
                return ['ITEXT_LICENSE_FILE' => $path];
            }
        }

        return [];
    }

    private function normalizeWindowsPath(string $path): string
    {
        return str_replace('/', '\\', $path);
    }

    private function resolveWindowsJavaBinary(string $java): string
    {
        if (str_contains($java, '\\') || str_contains($java, '/')) {
            return $java;
        }

        $candidates = [
            'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath\\java.exe',
            'C:\\Program Files\\Java\\latest\\bin\\java.exe',
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return $java;
    }

    /** Visible for adversarial regression tests — cmd.exe quoting rules. */
    public static function quoteWindowsArgument(string $argument): string
    {
        return '"'.str_replace('"', '""', $argument).'"';
    }

    /** @return list<string> */
    public static function allowedSubcommands(): array
    {
        return self::ALLOWED_SUBCOMMANDS;
    }
}
