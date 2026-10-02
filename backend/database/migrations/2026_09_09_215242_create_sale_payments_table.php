<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id('sale_payment_id');
            $table->unsignedBigInteger('sale_id');
            $table->date('payment_date');
            $table->decimal('paid_amount', 10, 2);
            $table->string('payment_type')->default('cash'); // cash, bank, mobile banking
            $table->timestamps();

            // Foreign Key Constraint
            $table->foreign('sale_id')->references('sale_id')->on('sales')->onDelete('cascade');
        });
    }

    public function down(): void {
        Schema::dropIfExists('sale_payments');
    }
};