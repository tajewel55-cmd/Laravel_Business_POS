<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class AdjustmentDetail extends Model
{
    use HasFactory;

    protected $primaryKey = 'adjustment_detail_id';

    protected $fillable = [
        'adjustment_id',
        'product_id',
        'quantity',
        'purchase_price',
        'sub_total',
    ];

    public function adjustment()
    {
        return $this->belongsTo(
            Adjustment::class,
            'adjustment_id',
            'adjustment_id'
        );
    }

    public function product()
    {
        return $this->belongsTo(
            Product::class,
            'product_id',
            'product_id'
        );
    }
}