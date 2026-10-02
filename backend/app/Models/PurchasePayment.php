<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchasePayment extends Model {
    use HasFactory;

    protected $table = 'purchase_payments';
    protected $primaryKey = 'purchase_payment_id';

    protected $fillable = [
        'purchase_id',
        'payment_date',
        'paid_amount',
        'payment_type'
    ];

    public function purchase() {
        return $this->belongsTo(Purchase::class, 'purchase_id', 'purchase_id');
    }
}
