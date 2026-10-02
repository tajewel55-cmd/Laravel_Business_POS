<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id('purchase_payment_id');
            $table->unsignedBigInteger('purchase_id');
            $table->date('payment_date');
            $table->decimal('paid_amount', 10, 2);
            $table->string('payment_type')->default('cash'); // cash, bank, mobile banking
            $table->timestamps();

            // Foreign Key Constraint
            $table->foreign('purchase_id')->references('purchase_id')->on('purchases')->onDelete('cascade');
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchase_payments');
    }
};