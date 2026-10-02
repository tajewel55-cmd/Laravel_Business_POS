<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CompanyProfileSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('company_profiles')->updateOrInsert(
            ['profile_id' => 1],
            [
                'company_name' => 'Taj Company Limited',
                'mobile'       => '01915231855',
                'mail'         => 'tareqazizjewel@gmail.com',
                'address'      => 'Moghbazar, Dhaka',
                'updated_at'   => Carbon::now(),
                'created_at'   => Carbon::now(),
            ]
        );
    }
}