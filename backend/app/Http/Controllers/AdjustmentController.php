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
use RuntimeException;

/**
 * স্টক-সংক্রান্ত ব্যবহারকারী-দৃশ্যমান এরর (অন্য এরর ক্লায়েন্টকে দেখানো হয় না)।
 * ভালো অভ্যাস: এটাকে app/Exceptions/AdjustmentStockException.php ফাইলে সরিয়ে নেওয়া।
 */
class AdjustmentStockException extends RuntimeException
{
}

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
        $validated = $request->validate($this->rules());

        DB::beginTransaction();
        try {
            $adjustment = Adjustment::create([
                'adj_invoice_no' => Adjustment::generateInvoiceNo($validated['type']),
                'type' => $validated['type'],
                'adjustment_date' => $validated['adjustment_date'],
                'remarks' => $validated['remarks'] ?? null,
            ]);

            $this->syncDetails($adjustment->adjustment_id, $validated['items']);

            // নতুন এন্ট্রি: পুরোনো প্রভাব নেই, শুধু নতুন প্রভাব
            $this->applyStockDelta([], $this->toEffectMap($validated['type'], $validated['items']));

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Adjustment recorded successfully!',
                'data' => $adjustment->load($this->eagerLoad),
            ], 201);
        } catch (AdjustmentStockException $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment store failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Failed to create adjustment!'], 500);
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

        $validated = $request->validate($this->rules());

        DB::beginTransaction();
        try {
            // $adjustment->update()-এর আগেই পুরোনো প্রভাব (map) বানাতে হবে,
            // কারণ update করলে $adjustment->type বদলে যায়
            $oldDetails = AdjustmentDetail::where('adjustment_id', $adjustment->adjustment_id)->get();
            $oldEffectMap = $this->toEffectMap($adjustment->type, $oldDetails->all());
            $newEffectMap = $this->toEffectMap($validated['type'], $validated['items']);

            // reverse + apply একসাথে (net delta), নেগেটিভ চেক শুধু চূড়ান্ত স্টকে
            $this->applyStockDelta($oldEffectMap, $newEffectMap);

            $adjustment->update([
                'type' => $validated['type'],
                'adjustment_date' => $validated['adjustment_date'],
                'remarks' => $validated['remarks'] ?? null,
            ]);

            AdjustmentDetail::where('adjustment_id', $adjustment->adjustment_id)->delete();
            $this->syncDetails($adjustment->adjustment_id, $validated['items']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Adjustment updated successfully!',
                'data' => $adjustment->load($this->eagerLoad),
            ], 200);
        } catch (AdjustmentStockException $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment update failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Failed to update adjustment!'], 500);
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
            // ডিলিট: নতুন আইটেম নেই, শুধু পুরোনো প্রভাব উল্টে যাবে
            $oldEffectMap = $this->toEffectMap($adjustment->type, $adjustment->adjustment_details->all());
            $this->applyStockDelta($oldEffectMap, []);

            AdjustmentDetail::where('adjustment_id', $id)->delete();
            $adjustment->delete();

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Adjustment deleted and stock reversed.'], 200);
        } catch (AdjustmentStockException $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Adjustment destroy failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete adjustment!'], 500);
        }
    }

    private function rules(): array
    {
        return [
            'type' => 'required|in:IN,OUT',
            'adjustment_date' => 'required|date',
            'remarks' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1|max:1000000',
            'items.*.purchase_price' => 'required|numeric|min:0|max:100000000',
        ];
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

        // time_settings টেবিলে একটাই রো থাকে (Sales/Purchase মডিউলের মতো একই কনভেনশন)
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
            $qty = max(1, (int) $item['quantity']);
            $price = max(0, (float) $item['purchase_price']);
            return [
                'adjustment_id' => $adjustmentId,
                'product_id' => (int) $item['product_id'],
                'quantity' => $qty,
                'purchase_price' => $price,
                'sub_total' => round($qty * $price, 2),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $items);

        AdjustmentDetail::insert($detailsData);
    }

    /**
     * IN হলে +qty, OUT হলে -qty। একই প্রোডাক্ট একাধিক লাইনে থাকলে যোগ হয়ে যায়।
     * $items হতে পারে অ্যারে (request) বা মডেল (details)।
     */
    private function toEffectMap(string $type, array $items): array
    {
        $sign = $type === 'IN' ? 1 : -1;
        $map = [];

        foreach ($items as $item) {
            $productId = (int) (is_array($item) ? $item['product_id'] : $item->product_id);
            $qty = (int) (is_array($item) ? $item['quantity'] : $item->quantity);
            $map[$productId] = ($map[$productId] ?? 0) + ($sign * $qty);
        }

        return $map;
    }

    /**
     * PurchaseController-এর মতো: delta = নতুন প্রভাব - পুরোনো প্রভাব।
     * নেগেটিভ চেক হয় শুধু চূড়ান্ত স্টকে (পুরোনো প্রভাব আলাদা করে উল্টানো হয় না)।
     *
     * $oldEffectMap = [] → নতুন এন্ট্রি (store)
     * $newEffectMap = [] → ডিলিট (destroy)
     */
    private function applyStockDelta(array $oldEffectMap, array $newEffectMap): void
    {
        $productIds = array_unique(array_merge(array_keys($oldEffectMap), array_keys($newEffectMap)));
        sort($productIds); // সবসময় একই ক্রমে লক করলে deadlock কমে

        foreach ($productIds as $productId) {
            $delta = (int) (($newEffectMap[$productId] ?? 0) - ($oldEffectMap[$productId] ?? 0));

            if ($delta === 0) {
                continue;
            }

            $product = Product::where('product_id', $productId)->lockForUpdate()->first();
            if (!$product) {
                if ($delta > 0) {
                    throw new AdjustmentStockException("Product not found (ID: {$productId}).");
                }
                continue;
            }

            $current = (int) $product->stock_qty;
            $newStock = $current + $delta;

            if ($newStock < 0) {
                throw new AdjustmentStockException(
                    "Cannot save this change — stock for \"{$product->product_name}\" would become negative " .
                    "(Current Stock: {$current}). Part of this stock may have already been used or sold elsewhere."
                );
            }

            $product->stock_qty = $newStock;
            $product->save();
        }
    }
}