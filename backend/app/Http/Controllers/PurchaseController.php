<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Purchase;
use App\Models\PurchaseDetail;
use App\Models\PurchasePayment;
use App\Models\TimeSetting;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Exception;

class PurchaseController extends Controller
{
    protected array $unrestrictedRoles = ['super_admin', 'special_admin', 'admin'];
    protected array $eagerLoad = ['details.product.manufacturer', 'details.product.packSize', 'payments', 'supplier'];

    public function index()
    {
        try {
            $purchases = Purchase::with($this->eagerLoad)->orderBy('purchase_id', 'DESC')->get();
            return response()->json(['success' => true, 'data' => $purchases], 200);
        } catch (Exception $e) {
            Log::error('Purchase index failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch purchases!'], 500);
        }
    }

    public function show($id)
    {
        $purchase = Purchase::with($this->eagerLoad)->find($id);
        if (!$purchase) {
            return response()->json(['success' => false, 'message' => 'Purchase not found!'], 404);
        }
        return response()->json(['success' => true, 'data' => $purchase], 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'purchase_date' => 'required|date',
            'purchase_pos_no' => 'nullable|string|max:100|unique:purchases,purchase_pos_no',
            'supplier_id' => 'required|integer|exists:suppliers,supplier_id',
            'vat_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_flat' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_type' => 'nullable|string|in:cash,bank,mobile_banking,Cash,Bank,Mobile Banking',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.purchase_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $maxSeq = Purchase::selectRaw('MAX(CAST(SUBSTRING_INDEX(purchase_pos_no, "-", -1) AS UNSIGNED)) as max_no')
                ->lockForUpdate()
                ->value('max_no');

            $nextSeq = $maxSeq ? $maxSeq + 1 : 1;
            $posNo = $validated['purchase_pos_no'] ?? ('INV-PURCHASE-' . str_pad($nextSeq, 6, '0', STR_PAD_LEFT));

            $vatPercentage = max(0, (float) ($validated['vat_percentage'] ?? 0));
            $discountFlat = max(0, (float) ($validated['discount_flat'] ?? 0));
            $discountPercentage = max(0, (float) ($validated['discount_percentage'] ?? 0));
            $paidAmount = max(0, (float) ($validated['paid_amount'] ?? 0));

            $totals = $this->calculateTotals($validated['items'], $vatPercentage, $discountFlat, $discountPercentage);

            $paidAmount = min($paidAmount, $totals['payable_amount']);
            $status = $this->resolveStatus($paidAmount, $totals['payable_amount']);

            $purchase = Purchase::create([
                'purchase_pos_no' => $posNo,
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => $validated['purchase_date'],
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

            $this->syncDetails($purchase->purchase_id, $validated['items']);
            $this->applyStockDelta([], $this->toQuantityMap($validated['items']));

            if ($paidAmount > 0) {
                PurchasePayment::create([
                    'purchase_id' => $purchase->purchase_id,
                    'payment_date' => $validated['purchase_date'],
                    'paid_amount' => $paidAmount,
                    'payment_type' => strtolower($validated['payment_type'] ?? 'cash'),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Purchase created successfully!',
                'data' => $purchase->load($this->eagerLoad),
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Purchase store failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to create purchase!',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $purchase = Purchase::find($id);
        if (!$purchase) {
            return response()->json(['success' => false, 'message' => 'Purchase not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($purchase, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        $validated = $request->validate([
            'purchase_date' => 'required|date',
            'purchase_pos_no' => 'nullable|string|max:100|unique:purchases,purchase_pos_no,' . $id . ',purchase_id',
            'supplier_id' => 'required|integer|exists:suppliers,supplier_id',
            'vat_percentage' => 'nullable|numeric|min:0|max:100',
            'discount_flat' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_type' => 'nullable|string|in:cash,bank,mobile_banking,Cash,Bank,Mobile Banking',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.purchase_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $oldDetails = PurchaseDetail::where('purchase_id', $purchase->purchase_id)->get();
            $oldQtyMap = $this->toQuantityMap($oldDetails->all());
            $newQtyMap = $this->toQuantityMap($validated['items']);

            $vatPercentage = max(0, (float) ($validated['vat_percentage'] ?? 0));
            $discountFlat = max(0, (float) ($validated['discount_flat'] ?? 0));
            $discountPercentage = max(0, (float) ($validated['discount_percentage'] ?? 0));
            $paidAmount = max(0, (float) ($validated['paid_amount'] ?? 0));

            $totals = $this->calculateTotals($validated['items'], $vatPercentage, $discountFlat, $discountPercentage);
            $paidAmount = min($paidAmount, $totals['payable_amount']);
            $status = $this->resolveStatus($paidAmount, $totals['payable_amount']);

            $purchase->update([
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => $validated['purchase_date'],
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

            // পুরনো ডিটেইলস ও পেমেন্ট সম্পূর্ণ ডিলিট না করে স্মার্ট সিঙ্ক (Upsert) করা হলো
            // এতে existing purchase_detail_id এবং purchase_payment_id অপরিবর্তিত থাকবে।
            $this->syncDetails($purchase->purchase_id, $validated['items']);
            $this->applyStockDelta($oldQtyMap, $newQtyMap);

            $payment = PurchasePayment::where('purchase_id', $purchase->purchase_id)->first();
            if ($paidAmount > 0) {
                if ($payment) {
                    $payment->update([
                        'payment_date' => $validated['purchase_date'],
                        'paid_amount' => $paidAmount,
                        'payment_type' => strtolower($validated['payment_type'] ?? 'cash'),
                    ]);
                } else {
                    PurchasePayment::create([
                        'purchase_id' => $purchase->purchase_id,
                        'payment_date' => $validated['purchase_date'],
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
                'message' => 'Purchase updated successfully!',
                'data' => $purchase->load($this->eagerLoad),
            ], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Purchase update failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to update purchase!',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $purchase = Purchase::find($id);
        if (!$purchase) {
            return response()->json(['success' => false, 'message' => 'Purchase not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($purchase, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        DB::beginTransaction();
        try {
            $oldDetails = PurchaseDetail::where('purchase_id', $id)->get();
            $oldQtyMap = $this->toQuantityMap($oldDetails->all());

            $this->applyStockDelta($oldQtyMap, []);

            PurchaseDetail::where('purchase_id', $id)->delete();
            PurchasePayment::where('purchase_id', $id)->delete();
            $purchase->delete();

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Purchase deleted successfully!'], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Purchase destroy failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage() ?: 'Failed to delete purchase!'], 500);
        }
    }

    private function checkEditPermission(Purchase $purchase, $user)
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

        if (Carbon::parse($purchase->created_at)->diffInHours(Carbon::now()) > $allowedHours) {
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
            $subtotal += max(0, (float) $item['quantity']) * max(0, (float) $item['purchase_price']);
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

    private function syncDetails(int $purchaseId, array $items): void
    {
        $now = now();
        // বিদ্যমান ডিটেইলসগুলো product_id দিয়ে কী (Key) করে রাখা হলো
        $existingDetails = PurchaseDetail::where('purchase_id', $purchaseId)->get()->keyBy('product_id');
        $incomingProductIds = [];

        foreach ($items as $item) {
            $productId = $item['product_id'];
            $incomingProductIds[] = $productId;

            $quantity = max(1, (int) $item['quantity']);
            $purchasePrice = max(0, (float) $item['purchase_price']);
            $subtotal = $quantity * $purchasePrice;

            if ($existingDetails->has($productId)) {
                // প্রোডাক্ট আগে থেকেই থাকলে পুরনো purchase_detail_id ঠিক রেখে শুধু ডেটা আপডেট হবে
                $detail = $existingDetails->get($productId);
                $detail->update([
                    'quantity' => $quantity,
                    'purchase_price' => $purchasePrice,
                    'subtotal' => $subtotal,
                    'updated_at' => $now,
                ]);
            } else {
                // নতুন প্রোডাক্ট যোগ হলে নতুন রেকর্ড তৈরি হবে
                PurchaseDetail::create([
                    'purchase_id' => $purchaseId,
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'purchase_price' => $purchasePrice,
                    'subtotal' => $subtotal,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        // এডিটের সময় যে প্রোডাক্টগুলো ইনভয়েস থেকে বাদ দেওয়া হয়েছে, কেবল সেগুলো ডিলিট হবে
        $productIdsToRemove = $existingDetails->keys()->diff($incomingProductIds);
        if ($productIdsToRemove->isNotEmpty()) {
            PurchaseDetail::where('purchase_id', $purchaseId)
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
            $delta = $newQty - $oldQty;

            if ($delta === 0) {
                continue;
            }

            $product = Product::where('product_id', $productId)->lockForUpdate()->first();
            if (!$product) {
                if ($delta > 0) {
                    throw new Exception("Product not found (ID: {$productId}).");
                }
                continue;
            }

            if ($delta < 0) {
                $requestedReduce = abs($delta);
                
                if ((int) $product->stock_qty < $requestedReduce) {
                    $maxPossibleReduce = (int) $product->stock_qty;
                    
                    throw new Exception(
                        "Cannot process — \"{$product->product_name}\" has partial sales. You can reduce at most {$maxPossibleReduce} qty."
                    );
                }
            }

            $product->stock_qty = (int) $product->stock_qty + $delta;
            $product->save();
        }
    }
}