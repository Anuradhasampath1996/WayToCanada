<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IrccCategory;
use App\Models\IrccInteractiveForm;
use App\Support\IrccInteractiveFormSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminIrccInteractiveFormController extends Controller
{
    /** GET /api/v1/admin/application-packages/{category}/interactive-forms */
    public function index(IrccCategory $category): JsonResponse
    {
        $this->ensureLevelThree($category);

        $forms = $category->interactiveForms()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (IrccInteractiveForm $form) => IrccInteractiveFormSchema::formatForm($form));

        return response()->json(['data' => $forms]);
    }

    /** POST /api/v1/admin/application-packages/{category}/interactive-forms */
    public function store(Request $request, IrccCategory $category): JsonResponse
    {
        $this->ensureLevelThree($category);

        $data = $request->validate([
            'slug'        => 'nullable|string|max:100|alpha_dash',
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'form_schema' => 'required|array',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);

        $schema = IrccInteractiveFormSchema::validateFormSchema($data['form_schema']);
        $slug = $this->resolveSlug($category, $data['slug'] ?? null, $data['title']);

        $form = IrccInteractiveForm::create([
            'ircc_category_id' => $category->id,
            'slug'             => $slug,
            'title'            => $data['title'],
            'description'      => $data['description'] ?? null,
            'form_schema'      => $schema,
            'sort_order'       => $data['sort_order'] ?? (($category->interactiveForms()->max('sort_order') ?? 0) + 1),
            'is_active'        => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Interactive form created.',
            'data'    => IrccInteractiveFormSchema::formatForm($form),
        ], 201);
    }

    /** GET /api/v1/admin/application-packages/{category}/interactive-forms/{form} */
    public function show(IrccCategory $category, IrccInteractiveForm $form): JsonResponse
    {
        $this->ensureFormBelongsToCategory($category, $form);

        return response()->json([
            'data' => IrccInteractiveFormSchema::formatForm($form),
        ]);
    }

    /** PUT /api/v1/admin/application-packages/{category}/interactive-forms/{form} */
    public function update(Request $request, IrccCategory $category, IrccInteractiveForm $form): JsonResponse
    {
        $this->ensureFormBelongsToCategory($category, $form);

        $data = $request->validate([
            'slug'        => 'sometimes|string|max:100|alpha_dash',
            'title'       => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'form_schema' => 'sometimes|required|array',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);

        if (isset($data['form_schema'])) {
            $data['form_schema'] = IrccInteractiveFormSchema::validateFormSchema($data['form_schema']);
        }

        if (array_key_exists('slug', $data) && $data['slug'] !== $form->slug) {
            if ($category->interactiveForms()->where('slug', $data['slug'])->where('id', '!=', $form->id)->exists()) {
                throw ValidationException::withMessages(['slug' => 'Slug already exists for this package.']);
            }
        }

        $form->update($data);

        return response()->json([
            'message' => 'Interactive form updated.',
            'data'    => IrccInteractiveFormSchema::formatForm($form->fresh()),
        ]);
    }

    /** DELETE /api/v1/admin/application-packages/{category}/interactive-forms/{form} */
    public function destroy(IrccCategory $category, IrccInteractiveForm $form): JsonResponse
    {
        $this->ensureFormBelongsToCategory($category, $form);
        $form->delete();

        return response()->json(['message' => 'Interactive form deleted.']);
    }

    private function ensureLevelThree(IrccCategory $category): void
    {
        if ($category->level !== 3) {
            abort(422, 'Interactive forms can only be attached to level-3 application packages.');
        }
    }

    private function ensureFormBelongsToCategory(IrccCategory $category, IrccInteractiveForm $form): void
    {
        $this->ensureLevelThree($category);

        if ($form->ircc_category_id !== $category->id) {
            abort(404);
        }
    }

    private function resolveSlug(IrccCategory $category, ?string $slug, string $title): string
    {
        $base = Str::slug($slug ?: $title);
        if ($base === '') {
            $base = 'form';
        }

        $candidate = $base;
        $suffix = 2;

        while ($category->interactiveForms()->where('slug', $candidate)->exists()) {
            $candidate = $base . '-' . $suffix;
            $suffix++;
        }

        return $candidate;
    }
}
