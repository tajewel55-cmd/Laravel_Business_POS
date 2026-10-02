<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Sale;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    public function stockReport(Request $request)
    {
        try {
            $query = Product::with(['packSize', 'category', 'manufacturer']);

            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('product_name', 'LIKE', "%{$search}%")
                      ->orWhere('barcode', 'LIKE', "%{$search}%");
                });
            }

            if ($request->filled('category_id')) {
                $query->where('category_id', $request->category_id);
            }

            if ($request->filled('manufacturer_id')) {
                $query->where('manufacturer_id', $request->manufacturer_id);
            }

            if ($request->filled('stock_filter')) {
                if ($request->stock_filter == 'out_of_stock') {
                    $query->where('stock_qty', '<=', 0);
                } elseif ($request->stock_filter == 'low_stock') {
                    $query->where('stock_qty', '>', 0)->where('stock_qty', '<=', 10);
                }
            }

            $query->orderBy('product_name', 'asc');

            $products = $query->get();

            $totalStockQty = $products->sum('stock_qty');
            $totalStockValue = $products->sum(function ($product) {
                return $product->stock_qty * $product->purchase_price;
            });

            return response()->json([
                'success' => true,
                'total_products' => $products->count(),
                'total_stock_qty' => $totalStockQty,
                'total_stock_value' => $totalStockValue,
                'data' => $products
            ], 200);

        } catch (\Exception $e) {
            // ইন্টারনাল এক্সসেপশন ডিটেইল ক্লায়েন্টে পাঠানো হচ্ছে না (সিকিউরিটি) — সার্ভার লগে রাখা হচ্ছে
            Log::error('Stock report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate stock report!',
            ], 500);
        }
    }


    public function salesQtyReport(Request $request)
    {
        try {
            if (!$request->filled('start_date') && !$request->filled('end_date')) {
                return response()->json([
                    'success' => true,
                    'total_products' => 0,
                    'total_sales_qty' => 0,
                    'total_sales_value' => 0,
                    'data' => []
                ], 200);
            }

            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');
            $search = $request->input('search');
            $categoryId = $request->input('category_id');
            $manufacturerId = $request->input('manufacturer_id');

            // SaleDetails থেকে সরাসরি কুয়েরি করা হচ্ছে যাতে আলাদা বিক্রয় মূল্যের গ্রুপগুলো সঠিকভাবে আলাদা করা যায়
            $query = \App\Models\SaleDetail::with([
                'product.packSize', 
                'product.category', 
                'product.manufacturer',
                'sale'
            ])
            ->whereHas('sale', function ($saleQuery) use ($startDate, $endDate) {
                if ($startDate) {
                    $saleQuery->whereDate('sale_date', '>=', $startDate);
                }
                if ($endDate) {
                    $saleQuery->whereDate('sale_date', '<=', $endDate);
                }
            })
            ->whereHas('product', function ($productQuery) use ($search, $categoryId, $manufacturerId) {
                if ($search) {
                    $productQuery->where(function ($q) use ($search) {
                        $q->where('product_name', 'LIKE', "%{$search}%")
                        ->orWhere('barcode', 'LIKE', "%{$search}%");
                    });
                }
                if ($categoryId) {
                    $productQuery->where('category_id', $categoryId);
                }
                if ($manufacturerId) {
                    $productQuery->where('manufacturer_id', $manufacturerId);
                }
            });

            $saleDetails = $query->get();

            // Product ID এবং Sale Price অনুযায়ী গ্রুপ করা হচ্ছে
            $groupedData = [];
            $totalSalesQty = 0;
            $totalSalesValue = 0;

            foreach ($saleDetails as $detail) {
                $product = $detail->product;
                if (!$product) continue;

                $salePrice = (float) ($detail->sale_price ?? $product->sale_price ?? 0);
                $qty = (int) ($detail->quantity ?? 0);

                if ($qty <= 0) continue;

                $key = $product->product_id . '_' . number_format($salePrice, 2, '.', '');

                if (!isset($groupedData[$key])) {
                    $groupedData[$key] = [
                        'product_id' => $product->product_id,
                        'product_name' => $product->product_name,
                        'barcode' => $product->barcode,
                        'sale_price' => $salePrice,
                        'sales_qty' => 0,
                        'category' => $product->category,
                        'manufacturer' => $product->manufacturer,
                        'pack_size' => $product->packSize,
                    ];
                }

                $groupedData[$key]['sales_qty'] += $qty;
            }

            $transformedData = [];
            foreach ($groupedData as $item) {
                $salesQty = $item['sales_qty'];
                $salePrice = $item['sale_price'];
                $totalValue = $salesQty * $salePrice;

                $totalSalesQty += $salesQty;
                $totalSalesValue += $totalValue;

                $transformedData[] = [
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'barcode' => $item['barcode'],
                    'sale_price' => $salePrice,
                    'sales_qty' => $salesQty,
                    'total_value' => round($totalValue, 2),
                    'category' => $item['category'],
                    'manufacturer' => $item['manufacturer'],
                    'pack_size' => $item['pack_size'],
                ];
            }

            // Product Name অনুযায়ী সাজানো
            usort($transformedData, function ($a, $b) {
                return strcmp($a['product_name'], $b['product_name']);
            });

            $collection = collect($transformedData);

            return response()->json([
                'success' => true,
                'total_products' => $collection->count(),
                'total_sales_qty' => $totalSalesQty,
                'total_sales_value' => round($totalSalesValue, 2),
                'data' => $collection
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Sales qty report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate sales quantity report!',
            ], 500);
        }
    }


    public function profitQtyReport(Request $request)
    {
        try {
            if (!$request->filled('start_date') && !$request->filled('end_date')) {
                return response()->json([
                    'success' => true,
                    'total_products' => 0,
                    'total_sales_qty' => 0,
                    'total_profit_value' => 0,
                    'data' => []
                ], 200);
            }

            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');
            $search = $request->input('search');
            $categoryId = $request->input('category_id');
            $manufacturerId = $request->input('manufacturer_id');

            // SaleDetails থেকে সরাসরি কুয়েরি করা হচ্ছে যাতে আলাদা বিক্রয় মূল্যের গ্রুপগুলো সঠিকভাবে আলাদা করা যায়
            $query = \App\Models\SaleDetail::with([
                'product.packSize', 
                'product.category', 
                'product.manufacturer',
                'sale'
            ])
            ->whereHas('sale', function ($saleQuery) use ($startDate, $endDate) {
                if ($startDate) {
                    $saleQuery->whereDate('sale_date', '>=', $startDate);
                }
                if ($endDate) {
                    $saleQuery->whereDate('sale_date', '<=', $endDate);
                }
            })
            ->whereHas('product', function ($productQuery) use ($search, $categoryId, $manufacturerId) {
                if ($search) {
                    $productQuery->where(function ($q) use ($search) {
                        $q->where('product_name', 'LIKE', "%{$search}%")
                        ->orWhere('barcode', 'LIKE', "%{$search}%");
                    });
                }
                if ($categoryId) {
                    $productQuery->where('category_id', $categoryId);
                }
                if ($manufacturerId) {
                    $productQuery->where('manufacturer_id', $manufacturerId);
                }
            });

            $saleDetails = $query->get();

            // Product ID এবং Sale Price অনুযায়ী গ্রুপ করা হচ্ছে
            $groupedData = [];
            $totalSalesQty = 0;
            $totalProfitValue = 0;

            foreach ($saleDetails as $detail) {
                $product = $detail->product;
                if (!$product) continue;

                $salePrice = (float) ($detail->sale_price ?? $product->sale_price ?? 0);
                $purchasePrice = (float) ($product->purchase_price ?? 0);
                $qty = (int) ($detail->quantity ?? 0);

                if ($qty <= 0) continue;

                $key = $product->product_id . '_' . number_format($salePrice, 2, '.', '');

                if (!isset($groupedData[$key])) {
                    $groupedData[$key] = [
                        'product_id' => $product->product_id,
                        'product_name' => $product->product_name,
                        'barcode' => $product->barcode,
                        'purchase_price' => $purchasePrice,
                        'sale_price' => $salePrice,
                        'sales_qty' => 0,
                        'category' => $product->category,
                        'manufacturer' => $product->manufacturer,
                        'pack_size' => $product->packSize,
                    ];
                }

                $groupedData[$key]['sales_qty'] += $qty;
            }

            $transformedData = [];
            foreach ($groupedData as $item) {
                $salesQty = $item['sales_qty'];
                $salePrice = $item['sale_price'];
                $purchasePrice = $item['purchase_price'];

                // প্রফিট হিসাব: (বিক্রয় মূল্য - ক্রয় মূল্য) * মোট বিক্রয় পরিমাণ
                $profitValue = ($salePrice - $purchasePrice) * $salesQty;

                $totalSalesQty += $salesQty;
                $totalProfitValue += $profitValue;

                $transformedData[] = [
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'barcode' => $item['barcode'],
                    'purchase_price' => $purchasePrice,
                    'sale_price' => $salePrice,
                    'sales_qty' => $salesQty,
                    'profit_value' => round($profitValue, 2),
                    'category' => $item['category'],
                    'manufacturer' => $item['manufacturer'],
                    'pack_size' => $item['pack_size'],
                ];
            }

            // Product Name অনুযায়ী সাজানো
            usort($transformedData, function ($a, $b) {
                return strcmp($a['product_name'], $b['product_name']);
            });

            $collection = collect($transformedData);

            return response()->json([
                'success' => true,
                'total_products' => $collection->count(),
                'total_sales_qty' => $totalSalesQty,
                'total_profit_value' => round($totalProfitValue, 2),
                'data' => $collection
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Profit qty report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate profit quantity report!',
            ], 500);
        }
    }


    public function salesInvoiceReport(Request $request)
    {
        try {
            if (!$request->filled('start_date') && !$request->filled('end_date')) {
                return response()->json([
                    'success' => true,
                    'total_sales_amount' => 0,
                    'total_due_amount' => 0,
                    'data' => []
                ], 200);
            }

            $query = Sale::with('payments');

            if ($request->filled('start_date')) {
                $query->whereDate('sale_date', '>=', $request->start_date);
            }
            if ($request->filled('end_date')) {
                $query->whereDate('sale_date', '<=', $request->end_date);
            }

            // Live search by Invoice No, Customer Name or Phone
            if ($request->filled('search')) {
                $search = $request->search;

                $query->where(function ($q) use ($search) {
                    $q->where('sale_pos_no', 'LIKE', "%{$search}%")
                    ->orWhere('customer_name', 'LIKE', "%{$search}%")
                    ->orWhere('customer_phone', 'LIKE', "%{$search}%");
                });
            }

            $sales = $query->get();

            $reportData = $sales->map(function ($sale) {

                $salesAmount = (float) ($sale->payable_amount ?? $sale->total_amount ?? 0);

                $totalPaid = (float) $sale->payments->sum('paid_amount');
                $dueAmount = max(0, $salesAmount - $totalPaid);
                return [
                    'sale_id' => $sale->sale_id,
                    'invoice_no' => $sale->sale_pos_no,
                    'customer_name' => $sale->customer_name ?: 'Walk-in Customer',
                    'phone' => $sale->customer_phone ?: '---',
                    'sales_amount' => round($salesAmount, 2),
                    'due_amount' => round($dueAmount, 2),
                ];
            })->values();

            $totalSalesAmount = $reportData->sum('sales_amount');
            $totalDueAmount = $reportData->sum('due_amount');

            return response()->json([
                'success' => true,
                'total_sales_amount' => round($totalSalesAmount, 2),
                'total_due_amount' => round($totalDueAmount, 2),
                'data' => $reportData
            ], 200);

        } catch (\Exception $e) {
            Log::error('Sales invoice report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate sales invoice report!',
            ], 500);
        }
    }

    
    public function salesVolumeReport(Request $request)
    {
        try {
            if (!$request->filled('start_date') && !$request->filled('end_date')) {
                return response()->json([
                    'success' => true,
                    'total_sales_amount' => 0,
                    'total_due_amount' => 0,
                    'data' => []
                ], 200);
            }

            $query = Sale::with('payments');

            if ($request->filled('start_date')) {
                $query->whereDate('sale_date', '>=', $request->start_date);
            }
            if ($request->filled('end_date')) {
                $query->whereDate('sale_date', '<=', $request->end_date);
            }

            $sales = $query->get();

            $totalSalesAmount = 0;
            $totalDueAmount = 0;

            foreach ($sales as $sale) {
                $salesAmount = (float) ($sale->payable_amount ?? $sale->total_amount ?? 0);
                $totalPaid = (float) $sale->payments->sum('paid_amount');
                $dueAmount = max(0, $salesAmount - $totalPaid);

                $totalSalesAmount += $salesAmount;
                $totalDueAmount += $dueAmount;
            }

            $reportData = [];
            if ($sales->count() > 0) {
                $reportData[] = [
                    'sales_amount' => round($totalSalesAmount, 2),
                    'due_amount' => round($totalDueAmount, 2),
                ];
            }

            return response()->json([
                'success' => true,
                'total_sales_amount' => round($totalSalesAmount, 2),
                'total_due_amount' => round($totalDueAmount, 2),
                'data' => $reportData
            ], 200);

        } catch (\Exception $e) {
            Log::error('Sales volume report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate sales volume report!',
            ], 500);
        }
    }
}