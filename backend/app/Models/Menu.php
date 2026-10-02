<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Menu extends Model
{
    use HasFactory;

    protected $primaryKey = 'menu_id';
    
    protected $fillable = [
        'menu_title',
        'menu_slug',
        'route_name',
        'icon',
        'parent_id',
        'order_position',
        'is_active',
    ];

    public function permissions()
    {
        return $this->hasMany(Permission::class, 'menu_id', 'menu_id');
    }
}