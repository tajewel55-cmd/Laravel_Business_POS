<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $table = 'sales';
    protected $primaryKey = 'sale_id';

    protected $fillable = [
        'sale_pos_no',
        'customer_name',
        'customer_phone',
        'sale_date',
        'vat_percentage',
        'vat_amount',
        'total_amount',
        'discount_flat',
        'discount_percentage',
        'discount_amount',
        'payable_amount',
        'status',
        'remarks',
    ];

    public function details()
    {
        return $this->hasMany(SaleDetail::class, 'sale_id', 'sale_id');
    }

    public function payments()
    {
        return $this->hasMany(SalePayment::class, 'sale_id', 'sale_id');
    }
}