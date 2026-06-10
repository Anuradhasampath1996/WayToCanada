<?php

namespace App\Services;

class GstHstCalculatorService
{
    public function __construct(private GstHstRatesService $ratesService) {}

    /**
     * Calculate GST/HST/PST for a payment based on place of supply (province).
     *
     * @return array<string, mixed>
     */
    public function calculate(float $subtotal, string $province): array
    {
        $prov = $this->ratesService->getProvinceRate($province);
        if (! $prov) {
            throw new \InvalidArgumentException("Unknown province code: {$province}");
        }

        $subtotal = round($subtotal, 2);
        $type     = $prov['tax_type'];

        $gstAmount  = 0.0;
        $provAmount = 0.0;
        $totalTax   = 0.0;
        $taxLabel   = $prov['label'];

        if ($type === 'hst') {
            $totalTax = round($subtotal * (float) $prov['total_rate'], 2);
            $taxLabel = $prov['label'];
        } elseif ($type === 'gst_only') {
            $gstAmount  = round($subtotal * (float) $prov['gst_rate'], 2);
            $totalTax   = $gstAmount;
        } elseif ($type === 'gst_pst') {
            $gstAmount  = round($subtotal * (float) $prov['gst_rate'], 2);
            $provAmount = round($subtotal * (float) $prov['prov_rate'], 2);
            $totalTax   = $gstAmount + $provAmount;
        } elseif ($type === 'gst_qst') {
            $gstAmount  = round($subtotal * (float) $prov['gst_rate'], 2);
            $provAmount = round($subtotal * (float) $prov['prov_rate'], 2);
            $totalTax   = $gstAmount + $provAmount;
        } else {
            $totalTax = round($subtotal * (float) $prov['total_rate'], 2);
        }

        $total = round($subtotal + $totalTax, 2);

        return [
            'province'       => strtoupper($province),
            'province_name'  => $prov['name'],
            'tax_type'       => $type,
            'tax_label'      => $taxLabel,
            'subtotal'       => $subtotal,
            'gst_amount'     => $gstAmount,
            'provincial_tax' => $provAmount,
            'total_tax'      => round($totalTax, 2),
            'total'          => $total,
            'total_rate_pct' => round((float) $prov['total_rate'] * 100, 3),
            'disclaimer'     => 'Sales tax estimate based on CRA place-of-supply rules. Verify with your accountant.',
        ];
    }
}
