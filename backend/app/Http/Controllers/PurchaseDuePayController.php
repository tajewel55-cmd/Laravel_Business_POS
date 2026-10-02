<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PurchaseDuePayController extends Controller
{
    /**
     * বাকি/ডিউ ইনভয়েসগুলোর তালিকা প্রদর্শন (সার্চ ও পেজিনেশন সহ)
     */
    public function index(Request $request)
    {
        $search = trim($request->get('search'));
        $perPage = $request->get('all') == 'true' ? 10000 : (int) $request->get('per_page', 10);

        $duePurchases = DB::table('purchases as p')
            ->join('suppliers as s', 'p.supplier_id', '=', 's.supplier_id')
            ->leftJoin('purchase_payments as pp', 'p.purchase_id', '=', 'pp.purchase_id')
            ->select(
                'p.purchase_id',
                'p.purchase_pos_no',
                'p.purchase_date',
                'p.payable_amount',
                's.supplier_name',
                's.phone as supplier_phone',
                DB::raw('COALESCE(SUM(pp.paid_amount), 0) as total_paid')
            )
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('p.purchase_pos_no', 'like', "%{$search}%")
                      ->orWhere('s.supplier_name', 'like', "%{$search}%")
                      ->orWhere('s.phone', 'like', "%{$search}%");
                });
            })
            ->groupBy(
                'p.purchase_id',
                'p.purchase_pos_no',
                'p.purchase_date',
                'p.payable_amount',
                's.supplier_name',
                's.phone'
            )
            ->havingRaw('p.payable_amount > COALESCE(total_paid, 0)')
            ->orderBy('p.purchase_date', 'desc')
            ->paginate($perPage);

        $duePurchases->getCollection()->transform(function ($purchase) {
            $purchase->payable_amount = (float) $purchase->payable_amount;
            $purchase->total_paid = (float) $purchase->total_paid;
            $purchase->due_amount = max(0, $purchase->payable_amount - $purchase->total_paid);
            return $purchase;
        });

        return response()->json([
            'success' => true,
            'data' => $duePurchases
        ]);
    }

    /**
     * নির্দিষ্ট কোনো ডিউ ইনভয়েসে পেমেন্ট জমা নেওয়া (ট্রানজ্যাকশন ও সিকিউরিটি সহ)
     */
    public function storePayment(Request $request, $purchaseId)
    {
        $request->validate([
            'paid_amount'  => ['required', 'numeric', 'min:0.01'],
            'payment_type' => ['required', 'string', 'max:50'],
            'payment_date' => ['required', 'date'],
        ]);

        DB::beginTransaction();

        try {
            $purchase = DB::table('purchases')
                ->where('purchase_id', $purchaseId)
                ->lockForUpdate()
                ->first();

            if (!$purchase) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Purchase invoice not found.'
                ], 404);
            }

            $totalPaid = DB::table('purchase_payments')
                ->where('purchase_id', $purchaseId)
                ->sum('paid_amount');

            $currentDue = round($purchase->payable_amount - $totalPaid, 2);
            $paidAmount = round((float) $request->paid_amount, 2);

            if ($paidAmount > $currentDue) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => "Payment amount cannot exceed current due amount (৳ {$currentDue})."
                ], 422);
            }

            DB::table('purchase_payments')->insert([
                'purchase_id'  => $purchaseId,
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
            Log::error('Purchase due payment error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong. Please try again later.'
            ], 500);
        }
    }
}