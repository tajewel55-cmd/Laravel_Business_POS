<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';
    protected $primaryKey = 'product_id';

    protected $fillable = [
        'product_name',
        'barcode',
        'pack_size_id',
        'category_id',
        'manufacturer_id',
        'product_slug',
        'purchase_price',
        'sale_price',
        'stock_qty',
        'is_active',
    ];

    public function packSize()
    {
        return $this->belongsTo(PackSize::class, 'pack_size_id', 'pack_size_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id', 'category_id');
    }

    public function manufacturer()
    {
        return $this->belongsTo(Manufacturer::class, 'manufacturer_id', 'manufacturer_id');
    }

    public function saleDetails()
    {
        return $this->hasMany(SaleDetail::class, 'product_id', 'product_id');
    }
}