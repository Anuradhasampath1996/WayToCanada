<?php

namespace App\Services\GovernmentForms;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FormProcessorClient
{
    /**
     * @return array<string, mixed>
     */
    public function inspect(string $templatePath): array
    {
        return $this->post('/api/v1/inspect', [
            'template_path' => $templatePath,
        ]);
    }

    /**
     * @return array{output_path: string, report: array<string, mixed>}
     */
    public function fill(string $templatePath, string $datasetsXml, string $outputPath): array
    {
        $response = $this->post('/api/v1/fill', [
            'template_path' => $templatePath,
            'datasets_xml'  => $datasetsXml,
            'output_path'   => $outputPath,
            'mode'          => 'append',
        ]);

        return [
            'output_path' => $response['output_path'] ?? $outputPath,
            'report'      => $response['report'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validateStructure(string $sourcePath, string $filledPath): array
    {
        return $this->post('/api/v1/validate-structure', [
            'source_path' => $sourcePath,
            'filled_path' => $filledPath,
        ]);
    }

    public function isHealthy(): bool
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders($this->headers())
                ->get(rtrim(config('government_forms.processor.base_url'), '/') . '/health');

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function post(string $path, array $payload): array
    {
        $url = rtrim(config('government_forms.processor.base_url'), '/') . $path;

        try {
            $response = Http::timeout(config('government_forms.processor.timeout_seconds'))
                ->connectTimeout(config('government_forms.processor.connect_timeout'))
                ->withHeaders($this->headers())
                ->post($url, $payload);

            if ($response->failed()) {
                throw new \RuntimeException(
                    'Form processor request failed: HTTP ' . $response->status()
                );
            }

            /** @var array<string, mixed> $data */
            $data = $response->json() ?? [];

            if (($data['success'] ?? true) === false) {
                throw new \RuntimeException($data['error'] ?? 'Form processor returned an error.');
            }

            return $data;
        } catch (RequestException $e) {
            Log::warning('[FormProcessor] Request failed', [
                'path'   => $path,
                'status' => $e->response?->status(),
            ]);

            throw new \RuntimeException('Form processor unavailable.', 0, $e);
        }
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        $headers = [
            'Accept'       => 'application/json',
            'Content-Type' => 'application/json',
        ];

        $token = config('government_forms.processor.api_token');
        if ($token) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }

        return $headers;
    }
}
