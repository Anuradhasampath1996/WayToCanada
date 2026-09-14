<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lms\LmsAiGenerationJob;
use App\Services\Lms\Ai\LmsAiGuard;
use App\Services\Lms\Ai\LmsAiJobService;
use Illuminate\Http\Request;

class AdminLmsAiController extends Controller
{
    public function __construct(private LmsAiJobService $jobs) {}

    public function show(LmsAiGenerationJob $lmsAiJob)
    {
        $lmsAiJob->load(['steps', 'items.validation', 'snapshots', 'usageRecords']);

        return response()->json(['job' => $lmsAiJob]);
    }

    public function approveBlueprint(LmsAiGenerationJob $lmsAiJob)
    {
        return response()->json(['job' => $this->jobs->approveBlueprint($lmsAiJob)]);
    }

    public function retry(LmsAiGenerationJob $lmsAiJob)
    {
        return response()->json(['job' => $this->jobs->retry($lmsAiJob)]);
    }

    public function publishDenied(Request $request, LmsAiGenerationJob $lmsAiJob)
    {
        unset($request, $lmsAiJob);
        try {
            LmsAiGuard::denyPublish();
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
