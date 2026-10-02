<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\TimeSetting;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Exception;

class SaleController extends Controller
{
    protected array $unrestrictedRoles = ['super_admin', 'special_admin', 'admin'];
    protected array $eagerLoad = ['details.product.manufacturer', 'details.product.packSize', 'payments'];

    public function index()
    {
        try {
            $sales = Sale::with($this->eagerLoad)->orderBy('sale_id', 'DESC')->get();
            return response()->json(['success' => true, 'data' => $sales], 200);
        } catch (Exception $e) {
            Log::error('Sale index failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch sales!'], 500);
        }
    }

    public function show($id)
    {
        $sale = Sale::with($this->eagerLoad)->find($id);
        if (!$sale) {
            return response()->json(['success' => false, 'message' => 'Sale not found!'], 404);
        }
        return response()->json(['success' => true, 'data' => $sale], 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sale_date' => 'required|date',
            'sale_pos_no' => 'nullable|string|max:100|unique:sales,sale_pos_no',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'vat_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_flat' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_type' => 'nullable|string|in:cash,bank,mobile_banking,Cash,Bank,Mobile Banking',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.sale_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $maxSeq = Sale::selectRaw('MAX(CAST(SUBSTRING_INDEX(sale_pos_no, "-", -1) AS UNSIGNED)) as max_no')
                ->lockForUpdate()
                ->value('max_no');

            $nextSeq = $maxSeq ? $maxSeq + 1 : 1;
            $posNo = $validated['sale_pos_no'] ?? ('INV-SALE-' . str_pad($nextSeq, 6, '0', STR_PAD_LEFT));

            $vatPercentage = max(0, (float) ($validated['vat_percentage'] ?? 0));
            $discountFlat = max(0, (float) ($validated['discount_flat'] ?? 0));
            $discountPercentage = max(0, (float) ($validated['discount_percentage'] ?? 0));
            $paidAmount = max(0, (float) ($validated['paid_amount'] ?? 0));

            $totals = $this->calculateTotals($validated['items'], $vatPercentage, $discountFlat, $discountPercentage);

            // Paid amount কখনোই Payable Amount-এর বেশি হতে পারবে না
            $paidAmount = min($paidAmount, $totals['payable_amount']);
            $status = $this->resolveStatus($paidAmount, $totals['payable_amount']);

            $sale = Sale::create([
                'sale_pos_no' => $posNo,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'sale_date' => $validated['sale_date'],
                'vat_percentage' => $vatPercentage,
                'vat_amount' => $totals['vat_amount'],
                'total_amount' => $totals['subtotal'],
                'discount_flat' => $discountPercentage > 0 ? 0 : $discountFlat,
                'discount_percentage' => $discountPercentage,
                'discount_amount' => $totals['discount_amount'],
                'payable_amount' => $totals['payable_amount'],
                'status' => $status,
                'remarks' => $validated['remarks'] ?? null,
            ]);

            $this->syncDetails($sale->sale_id, $validated['items']);
            $this->applyStockDelta([], $this->toQuantityMap($validated['items']));

            if ($paidAmount > 0) {
                SalePayment::create([
                    'sale_id' => $sale->sale_id,
                    'payment_date' => $validated['sale_date'],
                    'paid_amount' => $paidAmount,
                    'payment_type' => strtolower($validated['payment_type'] ?? 'cash'),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Sale created successfully!',
                'data' => $sale->load($this->eagerLoad),
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Sale store failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to create sale!',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $sale = Sale::find($id);
        if (!$sale) {
            return response()->json(['success' => false, 'message' => 'Sale not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($sale, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        $validated = $request->validate([
            'sale_date' => 'required|date',
            'sale_pos_no' => 'nullable|string|max:100|unique:sales,sale_pos_no,' . $id . ',sale_id',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'vat_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_flat' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_type' => 'nullable|string|in:cash,bank,mobile_banking,Cash,Bank,Mobile Banking',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.sale_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $oldDetails = SaleDetail::where('sale_id', $sale->sale_id)->get();
            $oldQtyMap = $this->toQuantityMap($oldDetails->all());
            $newQtyMap = $this->toQuantityMap($validated['items']);

            $vatPercentage = max(0, (float) ($validated['vat_percentage'] ?? 0));
            $discountFlat = max(0, (float) ($validated['discount_flat'] ?? 0));
            $discountPercentage = max(0, (float) ($validated['discount_percentage'] ?? 0));
            $paidAmount = max(0, (float) ($validated['paid_amount'] ?? 0));

            $totals = $this->calculateTotals($validated['items'], $vatPercentage, $discountFlat, $discountPercentage);
            $paidAmount = min($paidAmount, $totals['payable_amount']);
            $status = $this->resolveStatus($paidAmount, $totals['payable_amount']);

            $sale->update([
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'sale_date' => $validated['sale_date'],
                'vat_percentage' => $vatPercentage,
                'vat_amount' => $totals['vat_amount'],
                'total_amount' => $totals['subtotal'],
                'discount_flat' => $discountPercentage > 0 ? 0 : $discountFlat,
                'discount_percentage' => $discountPercentage,
                'discount_amount' => $totals['discount_amount'],
                'payable_amount' => $totals['payable_amount'],
                'status' => $status,
                'remarks' => $validated['remarks'] ?? null,
            ]);

            // পুরনো ডিটেইলস সম্পূর্ণ ডিলিট না করে স্মার্ট সিঙ্ক (Upsert) করা হলো যাতে sale_detail_id ঠিক থাকে
            $this->syncDetails($sale->sale_id, $validated['items']);
            $this->applyStockDelta($oldQtyMap, $newQtyMap);

            // পেমেন্ট রেকর্ড আপডেট অথবা তৈরি করা হলো যাতে sale_payment_id ঠিক থাকে
            $payment = SalePayment::where('sale_id', $sale->sale_id)->first();
            if ($paidAmount > 0) {
                if ($payment) {
                    $payment->update([
                        'payment_date' => $validated['sale_date'],
                        'paid_amount' => $paidAmount,
                        'payment_type' => strtolower($validated['payment_type'] ?? 'cash'),
                    ]);
                } else {
                    SalePayment::create([
                        'sale_id' => $sale->sale_id,
                        'payment_date' => $validated['sale_date'],
                        'paid_amount' => $paidAmount,
                        'payment_type' => strtolower($validated['payment_type'] ?? 'cash'),
                    ]);
                }
            } else {
                if ($payment) {
                    $payment->delete();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Sale updated successfully!',
                'data' => $sale->load($this->eagerLoad),
            ], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Sale update failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to update sale!',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $sale = Sale::find($id);
        if (!$sale) {
            return response()->json(['success' => false, 'message' => 'Sale not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($sale, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        DB::beginTransaction();
        try {
            $oldDetails = SaleDetail::where('sale_id', $id)->get();
            $oldQtyMap = $this->toQuantityMap($oldDetails->all());

            $this->applyStockDelta($oldQtyMap, []);

            SaleDetail::where('sale_id', $id)->delete();
            SalePayment::where('sale_id', $id)->delete();
            $sale->delete();

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Sale deleted successfully!'], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Sale destroy failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete sale!'], 500);
        }
    }

    private function checkEditPermission(Sale $sale, $user)
    {
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
        }

        $user->loadMissing('role');
        $roleName = $user->role ? strtolower($user->role->role_name) : '';

        if (in_array($roleName, $this->unrestrictedRoles, true)) {
            return true;
        }

        $timeSetting = TimeSetting::first();
        $allowedHours = $timeSetting ? (int) $timeSetting->hours : 24;

        if (Carbon::parse($sale->created_at)->diffInHours(Carbon::now()) > $allowedHours) {
            return response()->json([
                'success' => false,
                'message' => "Time limit expired! This record can only be edited or deleted within {$allowedHours} hours of its creation.",
            ], 403);
        }

        return true;
    }

    private function calculateTotals(array $items, float $vatPercentage, float $discountFlat, float $discountPercentage): array
    {
        $subtotal = 0;
        foreach ($items as $item) {
            $subtotal += max(0, (float) $item['quantity']) * max(0, (float) $item['sale_price']);
        }

        $vatAmount = round($subtotal * max(0, $vatPercentage) / 100, 2);
        $afterVat = $subtotal + $vatAmount;

        $discountAmount = $discountPercentage > 0
            ? round($afterVat * max(0, $discountPercentage) / 100, 2)
            : round(max(0, $discountFlat), 2);

        $discountAmount = min($discountAmount, $afterVat);
        $payableAmount = max(0, round($afterVat - $discountAmount, 2));

        return [
            'subtotal' => round($subtotal, 2),
            'vat_amount' => $vatAmount,
            'discount_amount' => $discountAmount,
            'payable_amount' => $payableAmount,
        ];
    }

    private function resolveStatus(float $paidAmount, float $payableAmount): string
    {
        if ($paidAmount <= 0) {
            return 'due';
        }
        return $paidAmount < $payableAmount ? 'partial' : 'paid';
    }

    private function syncDetails(int $saleId, array $items): void
    {
        $now = now();
        // বিদ্যমান সেলস ডিটেইলসগুলো product_id দিয়ে কী (Key) করে রাখা হলো
        $existingDetails = SaleDetail::where('sale_id', $saleId)->get()->keyBy('product_id');
        $incomingProductIds = [];

        foreach ($items as $item) {
            $productId = $item['product_id'];
            $incomingProductIds[] = $productId;

            $quantity = max(1, (int) $item['quantity']);
            $salePrice = max(0, (float) $item['sale_price']);
            $subtotal = $quantity * $salePrice;

            if ($existingDetails->has($productId)) {
                // প্রোডাক্ট আগে থেকেই থাকলে পুরনো sale_detail_id ঠিক রেখে শুধু ডেটা আপডেট হবে
                $detail = $existingDetails->get($productId);
                $detail->update([
                    'quantity' => $quantity,
                    'sale_price' => $salePrice,
                    'subtotal' => $subtotal,
                    'updated_at' => $now,
                ]);
            } else {
                // নতুন প্রোডাক্ট যোগ হলে নতুন রেকর্ড তৈরি হবে
                SaleDetail::create([
                    'sale_id' => $saleId,
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'sale_price' => $salePrice,
                    'subtotal' => $subtotal,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        // এডিটের সময় যে প্রোডাক্টগুলো ইনভয়েস থেকে বাদ দেওয়া হয়েছে, কেবল সেগুলো ডিলিট হবে
        $productIdsToRemove = $existingDetails->keys()->diff($incomingProductIds);
        if ($productIdsToRemove->isNotEmpty()) {
            SaleDetail::where('sale_id', $saleId)
                ->whereIn('product_id', $productIdsToRemove)
                ->delete();
        }
    }

    private function toQuantityMap(array $items): array
    {
        $map = [];
        foreach ($items as $item) {
            $productId = is_array($item) ? $item['product_id'] : $item->product_id;
            $quantity = (int) (is_array($item) ? $item['quantity'] : $item->quantity);
            $map[$productId] = ($map[$productId] ?? 0) + $quantity;
        }
        return $map;
    }

    private function applyStockDelta(array $oldQtyMap, array $newQtyMap): void
    {
        $productIds = array_unique(array_merge(array_keys($oldQtyMap), array_keys($newQtyMap)));

        foreach ($productIds as $productId) {
            $oldQty = $oldQtyMap[$productId] ?? 0;
            $newQty = $newQtyMap[$productId] ?? 0;
            
            // বিক্রির ক্ষেত্রে: নতুন পরিমাণ বাড়লে স্টক কমবে, পরিমাণ কমলে স্টক বাড়বে (Purchase-এর উল্টো)
            $delta = $oldQty - $newQty;

            if ($delta === 0) {
                continue;
            }

            $product = Product::where('product_id', $productId)->lockForUpdate()->first();
            if (!$product) {
                if ($newQty > $oldQty) {
                    throw new Exception("পণ্য খুঁজে পাওয়া যায়নি (ID: {$productId})।");
                }
                continue;
            }

            // যদি নতুন কোয়ান্টিটি আগের চেয়ে বেশি বিক্রি করতে চায়, তবে স্টক চেক করতে হবে
            $additionalNeed = $newQty - $oldQty;
            if ($additionalNeed > 0) {
                if ((int) $product->stock_qty < $additionalNeed) {
                    throw new Exception(
                        "Product \"{$product->product_name}\" is out of stock! (Current Stock: {$product->stock_qty}, Required Additional: {$additionalNeed})"
                    );
                }
            }

            $product->stock_qty = (int) $product->stock_qty + $delta;
            $product->save();
        }
    }
}