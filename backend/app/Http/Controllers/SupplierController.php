<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::orderBy('supplier_id', 'desc')->get();
        return response()->json(['data' => $suppliers]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplier_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'is_active' => 'required|boolean',
        ]);

        Supplier::create([
            'supplier_name' => $request->supplier_name,
            'phone' => $request->phone,
            'email' => $request->email,
            'address' => $request->address,
            'supplier_slug' => Str::slug($request->supplier_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Supplier created successfully!']);
    }

    public function update(Request $request, $id)
    {
        $supplier = Supplier::findOrFail($id);

        $request->validate([
            'supplier_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'is_active' => 'required|boolean',
        ]);

        $supplier->update([
            'supplier_name' => $request->supplier_name,
            'phone' => $request->phone,
            'email' => $request->email,
            'address' => $request->address,
            'supplier_slug' => Str::slug($request->supplier_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Supplier updated successfully!']);
    }

    public function destroy($id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete();

        return response()->json(['message' => 'Supplier deleted successfully!']);
    }
}
