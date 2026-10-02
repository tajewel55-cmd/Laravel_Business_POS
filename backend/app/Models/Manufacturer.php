<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Manufacturer extends Model
{
    use HasFactory;

    protected $table = 'manufacturers';
    protected $primaryKey = 'manufacturer_id';

    protected $fillable = [
        'manufacturer_name',
        'manufacturer_slug',
        'is_active',
    ];
}