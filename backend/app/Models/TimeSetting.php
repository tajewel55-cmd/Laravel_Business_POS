<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeSetting extends Model
{
    use HasFactory;

    protected $table = 'time_settings';
    protected $primaryKey = 'time_id';

    protected $fillable = [
        'hours'
    ];
}