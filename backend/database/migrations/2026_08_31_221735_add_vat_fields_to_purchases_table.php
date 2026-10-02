<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('purchases', function (Blueprint $table) {
            // VAT_Percentage and VAT_Amount are being added after Purchase_Date.
            $table->decimal('vat_percentage', 5, 2)->default(0)->after('purchase_date');
            $table->decimal('vat_amount', 10, 2)->default(0)->after('vat_percentage');
        });
    }

    public function down(): void {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['vat_percentage', 'vat_amount']);
        });
    }
};