<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 28px 32px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .meta { color: #555; margin-bottom: 14px; font-size: 10px; }
        .note {
            border: 1px solid #f0c36d;
            background: #fff8e8;
            padding: 8px 10px;
            margin-bottom: 14px;
            font-size: 10px;
            line-height: 1.4;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
        th { background: #f4f4f4; text-align: left; width: 38%; font-weight: 600; }
        tr.empty td { color: #888; font-style: italic; }
        .footer { margin-top: 16px; font-size: 9px; color: #777; }
    </style>
</head>
<body>
    <h1>{{ $formCode }} — Auto-filled values preview</h1>
    <div class="meta">
        Browser-readable preview generated {{ now()->toDateTimeString() }}.
        @if(!empty($flattenedUnavailableReason))
            Official IRCC layout flatten is unavailable: {{ $flattenedUnavailableReason }}
        @endif
    </div>
    <div class="note">
        This sheet lists the values mapped into the generated government form.
        To see values on the official IRCC PDF layout in the browser, place an iText trial/commercial
        license JSON (including pdfXFA) at <code>form-processor-poc/java-itext/itextkey.json</code>
        or set <code>ITEXT_LICENSE_FILE</code>, then regenerate preview.
    </div>
    <table>
        <thead>
            <tr>
                <th>Field</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            @forelse($fields as $field)
                <tr @class(['empty' => empty($field['filled'])])>
                    <td>{{ $field['label'] }}</td>
                    <td>{{ !empty($field['filled']) ? $field['value'] : 'Not filled' }}</td>
                </tr>
            @empty
                <tr class="empty">
                    <td colspan="2">No mapped fields found.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
    <div class="footer">
        Official download remains the unflattened XFA PDF for IRCC workflows.
    </div>
</body>
</html>
