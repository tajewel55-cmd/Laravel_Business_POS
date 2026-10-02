<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseDetail extends Model {
    use HasFactory;

    protected $table = 'purchase_details';
    protected $primaryKey = 'purchase_detail_id';

    protected $fillable = [
        'purchase_id',
        'product_id',
        'quantity',
        'purchase_price',
        'subtotal'
    ];

    public function purchase() {
        return $this->belongsTo(Purchase::class, 'purchase_id', 'purchase_id');
    }

    public function product() {
        return $this->belongsTo(Product::class, 'product_id', 'product_id');
    }
}