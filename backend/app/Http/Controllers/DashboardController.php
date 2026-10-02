<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        $todayStr     = Carbon::now('Asia/Dhaka')->toDateString();
        $currentMonth = Carbon::now('Asia/Dhaka')->month;
        $currentYear  = Carbon::now('Asia/Dhaka')->year;

        $totalProducts = DB::table('products')->where('is_active', 1)->count();

        $todaySales = DB::table('sales')
            ->whereDate('sale_date', '=', $todayStr)
            ->sum('payable_amount');

        $runningMonthSales = DB::table('sales')
            ->whereMonth('sale_date', '=', $currentMonth)
            ->whereYear('sale_date', '=', $currentYear)
            ->sum('payable_amount');

        $inventoryStockAmount = DB::table('products')
            ->where('is_active', 1)
            ->select(DB::raw('SUM(stock_qty * purchase_price) as total_stock_value'))
            ->value('total_stock_value') ?? 0;

        $stats = [
            'total_products'         => $totalProducts,
            'today_sales'            => '৳ ' . number_format($todaySales, 2),
            'running_month_sales'    => '৳ ' . number_format($runningMonthSales, 2),
            'inventory_stock_amount' => '৳ ' . number_format($inventoryStockAmount, 2),
        ];

        $lastThreeMonthsSales = [];

        // বর্তমান মাস বাদ দিয়ে পেছনের ৩ মাস (যেমন: সেপ্টেম্বর হলে আগস্ট, জুলাই, জুন) পাওয়ার জন্য ১ থেকে ৩ লুপ চালানো হয়েছে
        for ($i = 1; $i <= 3; $i++) {
            $monthObj = Carbon::now('Asia/Dhaka')->subMonths($i);
            $monthName = $monthObj->format('F Y');
            
            $targetMonth = $monthObj->month;
            $targetYear  = $monthObj->year;

            $monthlyTotal = DB::table('sales')
                ->whereMonth('sale_date', '=', $targetMonth)
                ->whereYear('sale_date', '=', $targetYear)
                ->sum('payable_amount');

            $lastThreeMonthsSales[] = [
                'month_name' => $monthName,
                'total'      => '৳ ' . number_format($monthlyTotal, 2)
            ];
        }

        return response()->json([
            'user_name' => auth()->user()->user_name,
            'stats' => $stats,
            'lastThreeMonthsSales' => $lastThreeMonthsSales
        ]);
    }

    /**
     * Profile Update
     */
    public function updateProfile(Request $request)
    {
        $user = auth()->user();

        $request->validate([
            'user_name' => ['required', 'string', 'max:255'],
            'password'  => ['nullable', 'string', 'min:6'],
        ]);

        $user->user_name = $request->user_name;

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Your account settings have been updated successfully!'
        ]);
    }
}