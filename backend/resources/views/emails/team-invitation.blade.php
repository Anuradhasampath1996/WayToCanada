<x-mail::message>
# You're invited to join {{ $firmName }}

{{ $ownerName }} invited you to work in their RCICMASTER practice workspace as **{{ $invitation->name }}**.

This invitation expires on {{ $invitation->expires_at?->timezone('America/Toronto')->format('F j, Y g:i A T') }}.

<x-mail::button :url="$acceptUrl">
Accept invitation and create your password
</x-mail::button>

If you were not expecting this email, you can ignore it. The link can only be used once.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
