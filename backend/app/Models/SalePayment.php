<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalePayment extends Model
{
    use HasFactory;

    protected $table = 'sale_payments';
    protected $primaryKey = 'sale_payment_id';

    protected $fillable = [
        'sale_id',
        'payment_date',
        'paid_amount',
        'payment_type',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class, 'sale_id', 'sale_id');
    }
}