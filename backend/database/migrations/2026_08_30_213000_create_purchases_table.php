<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id('purchase_id');
            $table->string('purchase_pos_no')->unique();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->date('purchase_date');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('discount_flat', 10, 2)->default(0);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('payable_amount', 10, 2);
            $table->string('status')->default('paid'); // paid, partial, due
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchases');
    }
};