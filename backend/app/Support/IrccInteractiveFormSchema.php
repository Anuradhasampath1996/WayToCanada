<?php

namespace App\Support;

use App\Models\IrccInteractiveForm;
use App\Models\IrccInteractiveFormResponse;
use Illuminate\Validation\ValidationException;

class IrccInteractiveFormSchema
{
    public const FIELD_TYPES = [
        'text',
        'textarea',
        'email',
        'tel',
        'number',
        'date',
        'select',
        'checkbox',
        'radio',
        'file',
        'section',
    ];

    /** @return array<string, mixed> */
    public static function validateFormSchema(array $schema): array
    {
        $fields = $schema['fields'] ?? null;

        if (! is_array($fields) || count($fields) === 0) {
            throw ValidationException::withMessages([
                'form_schema.fields' => 'At least one field is required.',
            ]);
        }

        $keys = [];

        foreach ($fields as $index => $field) {
            if (! is_array($field)) {
                throw ValidationException::withMessages([
                    "form_schema.fields.{$index}" => 'Each field must be an object.',
                ]);
            }

            $type = $field['type'] ?? null;
            if (! in_array($type, self::FIELD_TYPES, true)) {
                throw ValidationException::withMessages([
                    "form_schema.fields.{$index}.type" => 'Invalid field type.',
                ]);
            }

            if ($type === 'section') {
                continue;
            }

            $key = $field['key'] ?? null;
            if (! is_string($key) || $key === '') {
                throw ValidationException::withMessages([
                    "form_schema.fields.{$index}.key" => 'Field key is required.',
                ]);
            }

            if (isset($keys[$key])) {
                throw ValidationException::withMessages([
                    "form_schema.fields.{$index}.key" => "Duplicate field key '{$key}'.",
                ]);
            }

            $keys[$key] = true;

            if (empty($field['label']) || ! is_string($field['label'])) {
                throw ValidationException::withMessages([
                    "form_schema.fields.{$index}.label" => 'Field label is required.',
                ]);
            }

            if (in_array($type, ['select', 'radio'], true)) {
                $options = $field['options'] ?? null;
                if (! is_array($options) || count($options) === 0) {
                    throw ValidationException::withMessages([
                        "form_schema.fields.{$index}.options" => 'Select/radio fields require options.',
                    ]);
                }
            }
        }

        return $schema;
    }

    /** @return array<string, mixed> */
    public static function formatForm(IrccInteractiveForm $form, ?IrccInteractiveFormResponse $response = null): array
    {
        return [
            'id'          => $form->id,
            'category_id' => $form->ircc_category_id,
            'slug'        => $form->slug,
            'title'       => $form->title,
            'description' => $form->description,
            'form_schema' => $form->form_schema,
            'sort_order'  => $form->sort_order,
            'is_active'   => $form->is_active,
            'response'    => $response ? self::formatResponse($response) : null,
            'created_at'  => $form->created_at,
            'updated_at'  => $form->updated_at,
        ];
    }

    /** @return array<string, mixed> */
    public static function formatResponse(IrccInteractiveFormResponse $response): array
    {
        return [
            'id'               => $response->id,
            'form_id'          => $response->ircc_interactive_form_id,
            'case_file_id'     => $response->case_file_id,
            'user_id'          => $response->user_id,
            'response_data'    => $response->response_data ?? [],
            'status'           => $response->status,
            'submitted_at'     => $response->submitted_at,
            'consultant_notes' => $response->consultant_notes,
            'verified_fields'  => $response->verified_fields ?? [],
            'reviewed_at'      => $response->reviewed_at,
            'reviewed_by'      => $response->reviewed_by,
            'updated_at'       => $response->updated_at,
        ];
    }

    /** @return array<string, mixed> */
    public static function formatFormSummary(IrccInteractiveForm $form, ?IrccInteractiveFormResponse $response = null): array
    {
        return [
            'id'           => $form->id,
            'slug'         => $form->slug,
            'title'        => $form->title,
            'description'  => $form->description,
            'sort_order'   => $form->sort_order,
            'field_count'  => count(self::inputFields($form->form_schema)),
            'response'     => $response ? [
                'id'               => $response->id,
                'status'           => $response->status,
                'submitted_at'     => $response->submitted_at,
                'reviewed_at'      => $response->reviewed_at,
                'consultant_notes' => $response->consultant_notes,
                'updated_at'       => $response->updated_at,
            ] : null,
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function inputFields(?array $schema): array
    {
        if (! is_array($schema['fields'] ?? null)) {
            return [];
        }

        return array_values(array_filter(
            $schema['fields'],
            fn ($field) => is_array($field) && ($field['type'] ?? '') !== 'section'
        ));
    }

    /**
     * Validate client response_data against form schema.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function validateResponseData(array $schema, array $data, bool $strict = false): array
    {
        $clean = [];
        $errors = [];

        foreach (self::inputFields($schema) as $field) {
            $key = $field['key'];
            $value = $data[$key] ?? null;
            $required = (bool) ($field['required'] ?? false);

            if ($strict && $required && self::isEmptyValue($value, $field['type'])) {
                $errors[$key] = "{$field['label']} is required.";
                continue;
            }

            if (self::isEmptyValue($value, $field['type'])) {
                continue;
            }

            $clean[$key] = self::normalizeValue($value, $field);
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    private static function isEmptyValue(mixed $value, string $type): bool
    {
        if ($type === 'checkbox') {
            return $value === null;
        }

        return $value === null || $value === '';
    }

    /** @param  array<string, mixed>  $field */
    private static function normalizeValue(mixed $value, array $field): mixed
    {
        $type = $field['type'];

        return match ($type) {
            'number' => is_numeric($value) ? $value + 0 : $value,
            'checkbox' => (bool) $value,
            'select', 'radio' => self::normalizeOptionValue($value, $field),
            default => is_string($value) ? trim($value) : $value,
        };
    }

    /** @param  array<string, mixed>  $field */
    private static function normalizeOptionValue(mixed $value, array $field): mixed
    {
        $allowed = array_column($field['options'] ?? [], 'value');

        if (! in_array($value, $allowed, true)) {
            throw ValidationException::withMessages([
                $field['key'] => 'Invalid option selected.',
            ]);
        }

        return $value;
    }
}
