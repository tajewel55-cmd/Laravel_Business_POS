<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Adjustment extends Model
{
    use HasFactory;

    protected $primaryKey = 'adjustment_id';

    protected $fillable = [
        'adj_invoice_no',
        'type',
        'adjustment_date',
        'remarks',
    ];

    public function adjustment_details()
    {
        return $this->hasMany(
            AdjustmentDetail::class,
            'adjustment_id',
            'adjustment_id'
        );
    }

    public static function generateInvoiceNo(string $type): string
    {
        $type   = strtoupper($type) === 'IN' ? 'IN' : 'OUT';
        $prefix = 'ADJ-' . $type . '-';

        $last = self::where('type', $type)
            ->orderByDesc('adjustment_id')
            ->lockForUpdate()
            ->first();

        $nextNumber = 1;
        if ($last && preg_match('/(\d+)$/', $last->adj_invoice_no, $matches)) {
            $nextNumber = (int) $matches[1] + 1;
        }

        return $prefix . str_pad($nextNumber, 6, '0', STR_PAD_LEFT);
    }
}