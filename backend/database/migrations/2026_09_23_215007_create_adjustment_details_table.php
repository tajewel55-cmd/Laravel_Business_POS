<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('adjustment_details', function (Blueprint $table) {

            $table->id('adjustment_detail_id');

            $table->foreignId('adjustment_id')
                ->constrained('adjustments', 'adjustment_id')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->constrained('products', 'product_id')
                ->restrictOnDelete();

            $table->decimal('quantity', 12, 2);

            $table->decimal('purchase_price', 12, 2)->default(0);

            $table->decimal('sub_total', 12, 2)->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('adjustment_details');
    }
};
