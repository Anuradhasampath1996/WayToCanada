<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Services\ConsultantBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantBillingController extends Controller
{
    public function __construct(
        private ConsultantBillingService $billing,
    ) {}

    public function show(Request $request): JsonResponse
    {
        try {
            return response()->json($this->billing->overview($request->user()));
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function invoices(Request $request): JsonResponse
    {
        try {
            return response()->json(['data' => $this->billing->invoices($request->user())]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    public function cancel(Request $request): JsonResponse
    {
        try {
            $result = $this->billing->cancel($request->user());

            return response()->json($result);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
