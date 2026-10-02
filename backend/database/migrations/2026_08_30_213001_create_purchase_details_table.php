<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('purchase_details', function (Blueprint $table) {
            $table->id('purchase_detail_id');
            $table->unsignedBigInteger('purchase_id');
            $table->unsignedBigInteger('product_id');
            $table->integer('quantity');
            $table->decimal('purchase_price', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->timestamps();

            // Foreign Key Constraint
            $table->foreign('purchase_id')->references('purchase_id')->on('purchases')->onDelete('cascade');
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchase_details');
    }
};