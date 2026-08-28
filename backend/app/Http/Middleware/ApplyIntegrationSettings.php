<?php

namespace App\Http\Middleware;

use App\Services\IntegrationSettingsService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApplyIntegrationSettings
{
    public function __construct(private IntegrationSettingsService $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        try {
            $this->settings->applyRuntimeConfig();
        } catch (\Throwable) {
            // Ignore during migrate / DB down
        }

        return $next($request);
    }
}
