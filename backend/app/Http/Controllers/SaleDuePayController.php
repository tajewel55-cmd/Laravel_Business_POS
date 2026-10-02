<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SaleDuePayController extends Controller
{
    /**
     * বাকি/ডিউ সেলস ইনভয়েসগুলোর তালিকা প্রদর্শন (সার্চ ও পেজিনেশন সহ)
     */
    public function index(Request $request)
    {
        $search = trim($request->get('search'));
        $perPage = $request->get('all') == 'true' ? 10000 : (int) $request->get('per_page', 2);

        $dueSales = DB::table('sales as s')
            ->leftJoin('sale_payments as sp', 's.sale_id', '=', 'sp.sale_id')
            ->select(
                's.sale_id',
                's.sale_pos_no',
                's.sale_date',
                's.customer_name',
                's.customer_phone',
                's.payable_amount',
                DB::raw('COALESCE(SUM(sp.paid_amount), 0) as total_paid')
            )
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('s.sale_pos_no', 'like', "%{$search}%")
                      ->orWhere('s.customer_name', 'like', "%{$search}%")
                      ->orWhere('s.customer_phone', 'like', "%{$search}%");
                });
            })
            ->groupBy(
                's.sale_id',
                's.sale_pos_no',
                's.sale_date',
                's.customer_name',
                's.customer_phone',
                's.payable_amount'
            )
            ->havingRaw('s.payable_amount > COALESCE(total_paid, 0)')
            ->orderBy('s.sale_date', 'desc')
            ->paginate($perPage);

        $dueSales->getCollection()->transform(function ($sale) {
            $sale->payable_amount = (float) $sale->payable_amount;
            $sale->total_paid = (float) $sale->total_paid;
            $sale->due_amount = max(0, $sale->payable_amount - $sale->total_paid);
            return $sale;
        });

        return response()->json([
            'success' => true,
            'data' => $dueSales
        ]);
    }

    /**
     * নির্দিষ্ট কোনো ডিউ সেলস ইনভয়েসে পেমেন্ট জমা নেওয়া (ট্রানজ্যাকশন ও সিকিউরিটি সহ)
     */
    public function storePayment(Request $request, $saleId)
    {
        $request->validate([
            'paid_amount'  => ['required', 'numeric', 'min:0.01'],
            'payment_type' => ['required', 'string', 'max:50'],
            'payment_date' => ['required', 'date'],
        ]);

        DB::beginTransaction();

        try {
            $sale = DB::table('sales')
                ->where('sale_id', $saleId)
                ->lockForUpdate()
                ->first();

            if (!$sale) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Sale invoice not found.'
                ], 404);
            }

            $totalPaid = DB::table('sale_payments')
                ->where('sale_id', $saleId)
                ->sum('paid_amount');

            $currentDue = round($sale->payable_amount - $totalPaid, 2);
            $paidAmount = round((float) $request->paid_amount, 2);

            if ($paidAmount > $currentDue) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => "Payment amount cannot exceed current due amount (৳ {$currentDue})."
                ], 422);
            }

            DB::table('sale_payments')->insert([
                'sale_id'      => $saleId,
                'payment_date' => $request->payment_date,
                'paid_amount'  => $paidAmount,
                'payment_type' => $request->payment_type,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment successfully added!'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Sale due payment error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong. Please try again later.'
            ], 500);
        }
    }
}