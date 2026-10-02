<?php

namespace App\Http\Controllers;

use App\Models\Adjustment;
use App\Models\AdjustmentDetail;
use App\Models\Product;
use App\Models\TimeSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Exception;

class AdjustmentController extends Controller
{
    protected array $unrestrictedRoles = ['super_admin', 'special_admin', 'admin'];
    protected array $eagerLoad = ['adjustment_details.product.packSize', 'adjustment_details.product.manufacturer'];

    public function index()
    {
        try {
            $adjustments = Adjustment::with($this->eagerLoad)->orderBy('adjustment_id', 'DESC')->get();
            return response()->json(['success' => true, 'data' => $adjustments], 200);
        } catch (Exception $e) {
            Log::error('Adjustment index failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch adjustments!'], 500);
        }
    }

    public function show($id)
    {
        $adjustment = Adjustment::with($this->eagerLoad)->find($id);
        if (!$adjustment) {
            return response()->json(['success' => false, 'message' => 'Adjustment not found!'], 404);
        }
        return response()->json(['success' => true, 'data' => $adjustment], 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:IN,OUT',
            'adjustment_date' => 'required|date',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.purchase_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $adjustment = Adjustment::create([
                'adj_invoice_no' => Adjustment::generateInvoiceNo($validated['type']),
                'type' => $validated['type'],
                'adjustment_date' => $validated['adjustment_date'],
                'remarks' => $validated['remarks'] ?? null,
            ]);

            $this->syncDetails($adjustment->adjustment_id, $validated['items']);
            $this->applyStock($validated['type'], $validated['items']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Adjustment recorded successfully!',
                'data' => $adjustment->load($this->eagerLoad),
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment store failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to create adjustment!',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $adjustment = Adjustment::find($id);
        if (!$adjustment) {
            return response()->json(['success' => false, 'message' => 'Adjustment not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($adjustment, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        $validated = $request->validate([
            'type' => 'required|in:IN,OUT',
            'adjustment_date' => 'required|date',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.purchase_price' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            // পুরোনো এন্ট্রির স্টক-প্রভাব আগে উল্টে (reverse) দেওয়া হচ্ছে
            $oldDetails = AdjustmentDetail::where('adjustment_id', $adjustment->adjustment_id)->get();
            $this->reverseStock($adjustment->type, $oldDetails);

            $adjustment->update([
                'type' => $validated['type'],
                'adjustment_date' => $validated['adjustment_date'],
                'remarks' => $validated['remarks'] ?? null,
            ]);

            AdjustmentDetail::where('adjustment_id', $adjustment->adjustment_id)->delete();

            $this->syncDetails($adjustment->adjustment_id, $validated['items']);
            $this->applyStock($validated['type'], $validated['items']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Adjustment updated successfully!',
                'data' => $adjustment->load($this->eagerLoad),
            ], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment update failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to update adjustment!',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $adjustment = Adjustment::with('adjustment_details')->find($id);
        if (!$adjustment) {
            return response()->json(['success' => false, 'message' => 'Adjustment not found!'], 404);
        }

        $permissionCheck = $this->checkEditPermission($adjustment, $request->user());
        if ($permissionCheck !== true) {
            return $permissionCheck;
        }

        DB::beginTransaction();
        try {
            $this->reverseStock($adjustment->type, $adjustment->adjustment_details);

            AdjustmentDetail::where('adjustment_id', $id)->delete();
            $adjustment->delete();

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Adjustment deleted and stock reversed.'], 200);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment destroy failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to delete adjustment!',
            ], 500);
        }
    }

    private function checkEditPermission(Adjustment $adjustment, $user)
    {
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
        }

        $user->loadMissing('role');
        $roleName = $user->role ? strtolower($user->role->role_name) : '';

        if (in_array($roleName, $this->unrestrictedRoles, true)) {
            return true;
        }

        // Sales/Purchase মডিউলের মতো একই কনভেনশন — time_settings টেবিলে একটাই রো থাকে,
        // 'setting_name' নামে কোনো কলাম নেই (আগে এটা ব্যবহার করলে কুয়েরি এরর হতো)
        $timeSetting = TimeSetting::first();
        $allowedHours = $timeSetting ? (int) $timeSetting->hours : 24;

        if (Carbon::parse($adjustment->created_at)->diffInHours(Carbon::now()) > $allowedHours) {
            return response()->json([
                'success' => false,
                'message' => "Time limit expired! This record can only be edited or deleted within {$allowedHours} hours of its creation.",
            ], 403);
        }

        return true;
    }

    private function syncDetails(int $adjustmentId, array $items): void
    {
        $now = now();
        $detailsData = array_map(function ($item) use ($adjustmentId, $now) {
            $qty = max(0.01, (float) $item['quantity']);
            $price = max(0, (float) $item['purchase_price']);
            return [
                'adjustment_id' => $adjustmentId,
                'product_id' => $item['product_id'],
                'quantity' => $qty,
                'purchase_price' => $price,
                'sub_total' => round($qty * $price, 2),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $items);

        AdjustmentDetail::insert($detailsData);
    }

    // IN হলে স্টক বাড়বে, OUT হলে স্টক কমবে (নেগেটিভ হতে দেওয়া হবে না)
    private function applyStock(string $type, array $items): void
    {
        foreach ($items as $item) {
            $product = Product::where('product_id', $item['product_id'])->lockForUpdate()->first();
            if (!$product) {
                throw new Exception("Product not found (ID: {$item['product_id']}).");
            }

            $qty = max(0.01, (float) $item['quantity']);

            if ($type === 'IN') {
                $product->stock_qty = (float) $product->stock_qty + $qty;
            } else {
                $newQty = (float) $product->stock_qty - $qty;
                if ($newQty < 0) {
                    throw new Exception(
                        "Cannot perform adjustment! Stock cannot go negative for product: {$product->product_name} (Current Stock: {$product->stock_qty})"
                    );
                }
                $product->stock_qty = $newQty;
            }

            $product->save();
        }
    }

    // আগের এন্ট্রির স্টক-প্রভাব উল্টে দেওয়ার লজিক — এডিট/ডিলিটের সময় ব্যবহৃত হয়
    private function reverseStock(string $oldType, $details): void
    {
        foreach ($details as $detail) {
            $product = Product::where('product_id', $detail->product_id)->lockForUpdate()->first();
            if (!$product) {
                continue;
            }

            $qty = (float) $detail->quantity;

            if ($oldType === 'IN') {
                $newQty = (float) $product->stock_qty - $qty;
                if ($newQty < 0) {
                    throw new Exception(
                        "Cannot modify/delete this adjustment — product \"{$product->product_name}\" currently has only " .
                        "{$product->stock_qty} in stock, but {$qty} would need to be removed " .
                        "(some of this stock may have already been used/sold elsewhere)."
                    );
                }
                $product->stock_qty = $newQty;
            } else {
                $product->stock_qty = (float) $product->stock_qty + $qty;
            }

            $product->save();
        }
    }
}