<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PackSize extends Model
{
    use HasFactory;

    protected $table = 'pack_sizes';
    protected $primaryKey = 'pack_size_id';

    protected $fillable = [
        'pack_size_name',
        'pack_size_slug',
        'is_active'
    ];
}