<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MarketingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminMarketingServiceController extends Controller
{
    public function index(): JsonResponse
    {
        $services = MarketingService::orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $services]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $service = MarketingService::create($data);

        return response()->json(['data' => $service, 'message' => 'Marketing service created.'], 201);
    }

    public function show(MarketingService $marketingService): JsonResponse
    {
        return response()->json(['data' => $marketingService]);
    }

    public function update(Request $request, MarketingService $marketingService): JsonResponse
    {
        $data = $this->validated($request, $marketingService->id);

        if ($this->priceFieldsChanged($marketingService, $data)) {
            $data['stripe_price_id'] = null;
        }

        $marketingService->update($data);

        return response()->json(['data' => $marketingService, 'message' => 'Marketing service updated.']);
    }

    public function toggle(MarketingService $marketingService): JsonResponse
    {
        $marketingService->update(['is_active' => ! $marketingService->is_active]);

        return response()->json([
            'data'    => $marketingService,
            'message' => 'Service ' . ($marketingService->is_active ? 'activated' : 'deactivated') . '.',
        ]);
    }

    public function destroy(MarketingService $marketingService): JsonResponse
    {
        $marketingService->delete();

        return response()->json(['message' => 'Marketing service deleted.']);
    }

    public function publicIndex(): JsonResponse
    {
        $services = MarketingService::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (MarketingService $s) => $this->formatPublic($s));

        return response()->json(['data' => $services]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $service = MarketingService::where('slug', $slug)->where('is_active', true)->firstOrFail();

        return response()->json(['data' => $this->formatPublic($service, true)]);
    }

    /** @return array<string, mixed> */
    private function formatPublic(MarketingService $service, bool $full = false): array
    {
        $data = [
            'id'           => $service->id,
            'slug'         => $service->slug,
            'name'         => $service->name,
            'tagline'      => $service->tagline,
            'summary'      => $service->summary,
            'features'     => $service->features ?? [],
            'price'        => (float) $service->price,
            'price_label'  => $service->price_label,
            'billing_type' => $service->billing_type,
            'sort_order'   => $service->sort_order,
        ];

        if ($full) {
            $data['detail_body'] = $service->detail_body;
        }

        return $data;
    }

    /** @param array<string, mixed> $data */
    private function priceFieldsChanged(MarketingService $service, array $data): bool
    {
        return (float) ($data['price'] ?? $service->price) !== (float) $service->price
            || ($data['billing_type'] ?? $service->billing_type) !== $service->billing_type;
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'slug'         => [
                'required', 'string', 'max:80', 'alpha_dash',
                Rule::unique('marketing_services', 'slug')->ignore($ignoreId),
            ],
            'name'         => 'required|string|max:255',
            'tagline'      => 'nullable|string|max:500',
            'summary'      => 'nullable|string|max:2000',
            'detail_body'  => 'nullable|string|max:50000',
            'features'     => 'nullable|array',
            'features.*'   => 'string|max:500',
            'price'        => 'required|numeric|min:0',
            'price_label'  => 'nullable|string|max:100',
            'billing_type' => 'required|in:one_time,monthly',
            'is_active'    => 'boolean',
            'sort_order'   => 'integer',
        ]);
    }
}
