<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::with(['packSize', 'category', 'manufacturer'])
            ->orderBy('product_id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $products
        ], 200);
    }

    public function store(Request $request)
    {
        $request->validate([
            'product_name' => 'required|string|max:255',
            'barcode' => 'nullable|string|max:100|unique:products,barcode',
            'pack_size_id' => 'nullable|integer',
            'category_id' => 'nullable|integer',
            'manufacturer_id' => 'nullable|integer',
            'purchase_price' => 'required|numeric',
            'sale_price' => 'required|numeric',
            'is_active' => 'required|boolean',
        ], [
            'barcode.unique' => 'This barcode already taken.'
        ]);

        $product = Product::create([
            'product_name' => $request->product_name,
            'product_slug' => Str::slug($request->product_name),
            'barcode' => $request->barcode,
            'pack_size_id' => $request->pack_size_id,
            'category_id' => $request->category_id,
            'manufacturer_id' => $request->manufacturer_id,
            'purchase_price' => $request->purchase_price,
            'sale_price' => $request->sale_price,
            'stock_qty' => 0,
            'is_active' => $request->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully!',
            'data' => $product
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found!'
            ], 404);
        }

        $request->validate([
            'product_name' => 'required|string|max:255',
            'barcode' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('products', 'barcode')->ignore($id, 'product_id')
            ],
            'pack_size_id' => 'nullable|integer',
            'category_id' => 'nullable|integer',
            'manufacturer_id' => 'nullable|integer',
            'purchase_price' => 'required|numeric',
            'sale_price' => 'required|numeric',
            'is_active' => 'required|boolean',
        ], [
            'barcode.unique' => 'This barcode already taken.'
        ]);

        $product->update([
            'product_name' => $request->product_name,
            'product_slug' => Str::slug($request->product_name),
            'barcode' => $request->barcode,
            'pack_size_id' => $request->pack_size_id,
            'category_id' => $request->category_id,
            'manufacturer_id' => $request->manufacturer_id,
            'purchase_price' => $request->purchase_price,
            'sale_price' => $request->sale_price,
            'is_active' => $request->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully!',
            'data' => $product
        ], 200);
    }

    public function destroy($id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found!'
            ], 404);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully!'
        ], 200);
    }
}