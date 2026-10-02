<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_settings', function (Blueprint $table) {
            $table->id('time_id');
            $table->string('hours'); 
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_settings');
    }
};