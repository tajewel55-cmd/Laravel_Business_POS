<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'user_name' => 'tareq',
                'role_name' => 'super_admin',
                'email'     => 'tareq@example.com',
            ],
            [
                'user_name' => 'aziz',
                'role_name' => 'special_admin',
                'email'     => 'aziz@example.com',
            ],
            [
                'user_name' => 'jewel',
                'role_name' => 'admin',
                'email'     => 'jewel@example.com',
            ],
            [
                'user_name' => 'taj',
                'role_name' => 'accountant',
                'email'     => 'taj@example.com',
            ],
            [
                'user_name' => 'name',
                'role_name' => 'staff',
                'email'     => 'name@example.com',
            ],
        ];

        foreach ($users as $user) {

            $roleId = DB::table('roles')
                ->where('role_name', $user['role_name'])
                ->value('role_id');

            DB::table('users')->updateOrInsert(
                ['email' => $user['email']],
                [
                    'user_name'         => $user['user_name'],
                    'role_id'           => $roleId,
                    'email_verified_at' => Carbon::now(),
                    'password'          => Hash::make('123456789'),
                    'updated_at'        => Carbon::now(),
                ]
            );
        }
    }
}