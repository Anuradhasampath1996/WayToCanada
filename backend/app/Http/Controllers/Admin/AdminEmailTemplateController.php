<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Email\EmailTemplateRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class AdminEmailTemplateController extends Controller
{
    public function index(EmailTemplateRenderer $renderer): JsonResponse
    {
        $templates = $renderer->listForAdmin();

        return response()->json([
            'data'  => $templates,
            'stats' => [
                'total'        => count($templates),
                'notification' => collect($templates)->where('kind', 'notification')->count(),
                'transactional'=> collect($templates)->where('kind', 'transactional')->count(),
                'admin'        => collect($templates)->where('audience', 'admin')->count(),
                'consultant'   => collect($templates)->where('audience', 'consultant')->count(),
                'client'       => collect($templates)->where('audience', 'client')->count(),
            ],
        ]);
    }

    public function preview(string $key, EmailTemplateRenderer $renderer): Response
    {
        $html = $renderer->renderPreview($key);

        return response($html, 200, [
            'Content-Type'  => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function previewBundle(string $key, EmailTemplateRenderer $renderer): JsonResponse
    {
        return response()->json($renderer->renderPreviewBundle($key));
    }
}
