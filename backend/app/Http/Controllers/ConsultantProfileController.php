<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Models\RcicConsultant;

class ConsultantProfileController extends Controller
{
    /** Shared field list returned by show & update. */
    private function profileData($user): array
    {
        return [
            'id'                  => $user->id,
            'name'                => $user->name,
            'email'               => $user->email,
            'phone'               => $user->phone,
            'avatar'              => $user->avatar,
            'cicc_email'          => $user->cicc_email,
            'rcic_number'         => $user->rcic_number,
            'is_license_verified' => (bool) $user->is_license_verified,
            'license_verified_at' => $user->license_verified_at?->toIso8601String(),
            'created_at'          => $user->created_at?->toIso8601String(),
            // Company
            'company_name'         => $user->company_name,
            'company_logo'         => $user->company_logo,
            'company_bio'          => $user->company_bio,
            'company_website'      => $user->company_website,
            'company_phone'        => $user->company_phone,
            'company_address_line1'=> $user->company_address_line1,
            'company_address_line2'=> $user->company_address_line2,
            'company_city'         => $user->company_city,
            'company_province'     => $user->company_province,
            'company_postal_code'  => $user->company_postal_code,
            'company_country'      => $user->company_country ?? 'Canada',
            // Signature
            'digital_signature'    => $user->digital_signature,
        ];
    }

    /**
     * GET /consultant/profile
     */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profileData($request->user()));
    }

    /**
     * PUT /consultant/profile
     * Updates personal + company fields (not email or rcic_number).
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'                  => ['required', 'string', 'max:255'],
            'phone'                 => ['nullable', 'string', 'max:30'],
            'cicc_email'            => ['nullable', 'email', 'max:255',
                                        Rule::unique('users', 'cicc_email')->ignore($user->id)],
            'company_name'          => ['nullable', 'string', 'max:255'],
            'company_bio'           => ['nullable', 'string', 'max:2000'],
            'company_website'       => ['nullable', 'url', 'max:255'],
            'company_phone'         => ['nullable', 'string', 'max:30'],
            'company_address_line1' => ['nullable', 'string', 'max:255'],
            'company_address_line2' => ['nullable', 'string', 'max:255'],
            'company_city'          => ['nullable', 'string', 'max:100'],
            'company_province'      => ['nullable', 'string', 'max:100'],
            'company_postal_code'   => ['nullable', 'string', 'max:20'],
            'company_country'       => ['nullable', 'string', 'max:100'],
        ]);

        $user->fill($data);
        $user->save();

        return response()->json(array_merge(['message' => 'Profile updated successfully.'], $this->profileData($user)));
    }

    /**
     * GET /consultant/rcic-registry
     * Returns the CICC public register entry that matches the consultant's RCIC number.
     * Returns null if no RCIC number is set or no matching record exists.
     */
    public function rcicRegistry(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->rcic_number) {
            return response()->json(null);
        }

        $record = RcicConsultant::where('college_id', $user->rcic_number)->first();
        if (!$record) {
            return response()->json(null);
        }

        return response()->json([
            'full_name'         => $record->full_name,
            'first_name'        => $record->first_name,
            'last_name'         => $record->last_name,
            'type'              => $record->type,
            'status'            => $record->status,
            'company'           => $record->company,
            'address_line_1'    => $record->address_line_1,
            'address_line_2'    => $record->address_line_2,
            'city'              => $record->city,
            'province'          => $record->province,
            'country'           => $record->country,
            'postal_code'       => $record->postal_code,
            'phone'             => $record->phone,
            'fax'               => $record->fax,
            'email'             => $record->email,
            'website'           => $record->website,
            'languages'         => $record->languages,
            'entitled_to_practise' => $record->entitled_to_practise,
            'profile_url'       => $record->profile_url,
        ]);
    }

    /**
     * POST /consultant/profile/signature
     * Saves a base64 PNG data-URL as the consultant's digital signature.
     */
    public function saveSignature(Request $request): JsonResponse
    {
        $request->validate([
            'signature' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $sig  = $request->input('signature');

        // Basic safety: must be a data-URL or null
        if ($sig !== null && !str_starts_with($sig, 'data:image/')) {
            return response()->json(['message' => 'Invalid signature format.'], 422);
        }

        $user->digital_signature = $sig;
        $user->save();

        return response()->json(['message' => 'Signature saved.', 'digital_signature' => $sig]);
    }

    /**
     * POST /consultant/profile/logo
     * Uploads a company logo image to public storage and saves the URL.
     * Accepts: multipart/form-data with field "logo" (jpg/jpeg/png/webp, max 2 MB).
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();

        // Delete old logo if stored on public disk
        if ($user->company_logo) {
            $oldPath = str_replace(
                rtrim(config('app.url'), '/') . '/storage/',
                '',
                $user->company_logo
            );
            Storage::disk('public')->delete($oldPath);
        }

        $file      = $request->file('logo');
        $filename  = 'logos/' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
        $file->storeAs('', $filename, 'public');

        $url = rtrim(config('app.url'), '/') . '/storage/' . $filename;

        $user->company_logo = $url;
        $user->save();

        return response()->json(['message' => 'Logo uploaded successfully.', 'company_logo' => $url]);
    }

    /**
     * POST /consultant/profile/avatar
     * Uploads a personal profile photo to public storage and saves the URL.
     * Accepts: multipart/form-data with field "avatar" (jpg/jpeg/png/webp, max 2 MB).
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();

        // Delete old avatar if stored on public disk
        if ($user->avatar) {
            $oldPath = str_replace(
                rtrim(config('app.url'), '/') . '/storage/',
                '',
                $user->avatar
            );
            if ($oldPath !== $user->avatar && ! str_starts_with((string) $user->avatar, 'http')) {
                Storage::disk('public')->delete($user->avatar);
            } elseif (str_contains((string) $user->avatar, '/storage/')) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        $file     = $request->file('avatar');
        $filename = 'avatars/' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
        $file->storeAs('', $filename, 'public');

        $url = rtrim(config('app.url'), '/') . '/storage/' . $filename;

        $user->avatar = $url;
        $user->save();

        return response()->json(['message' => 'Profile photo uploaded successfully.', 'avatar' => $url]);
    }

    /**
     * DELETE /consultant/profile/avatar
     * Removes the uploaded profile photo (keeps Google/OAuth URL only if clearing uploaded one).
     */
    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar && str_contains((string) $user->avatar, '/storage/')) {
            $oldPath = str_replace(
                rtrim(config('app.url'), '/') . '/storage/',
                '',
                $user->avatar
            );
            Storage::disk('public')->delete($oldPath);
        }

        $user->avatar = null;
        $user->save();

        return response()->json(['message' => 'Profile photo removed.', 'avatar' => null]);
    }
}
