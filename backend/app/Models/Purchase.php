<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Purchase extends Model {
    use HasFactory;

    protected $table = 'purchases';
    protected $primaryKey = 'purchase_id';

    protected $fillable = [
        'purchase_pos_no',
        'supplier_id',
        'purchase_date',
        'vat_percentage',
        'vat_amount',
        'total_amount',
        'discount_flat',
        'discount_percentage',
        'discount_amount',
        'payable_amount',
        'status',
        'remarks'
    ];

    public function details() {
        return $this->hasMany(PurchaseDetail::class, 'purchase_id', 'purchase_id');
    }

    public function payments() {
        return $this->hasMany(PurchasePayment::class, 'purchase_id', 'purchase_id');
    }

    public function supplier() {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'supplier_id');
    }
}