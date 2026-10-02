<?php

namespace App\Http\Controllers;

use App\Models\PackSize;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PackSizeController extends Controller
{
    public function index()
    {
        $packSizes = PackSize::latest('pack_size_id')->get();
        return response()->json([
            'success' => true,
            'data' => $packSizes
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'pack_size_name' => 'required|string|max:255|unique:pack_sizes,pack_size_name',
        ]);

        $packSize = PackSize::create([
            'pack_size_name' => $request->pack_size_name,
            'pack_size_slug' => Str::slug($request->pack_size_name),
            'is_active' => $request->has('is_active') ? $request->is_active : true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pack size created successfully!',
            'data' => $packSize
        ]);
    }

    public function update(Request $request, $id)
    {
        $packSize = PackSize::findOrFail($id);

        $request->validate([
            'pack_size_name' => 'required|string|max:255|unique:pack_sizes,pack_size_name,' . $id . ',pack_size_id',
        ]);

        $packSize->update([
            'pack_size_name' => $request->pack_size_name,
            'pack_size_slug' => Str::slug($request->pack_size_name),
            'is_active' => $request->has('is_active') ? $request->is_active : $packSize->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pack size updated successfully!',
            'data' => $packSize
        ]);
    }

    public function destroy($id)
    {
        $packSize = PackSize::findOrFail($id);
        $packSize->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pack size deleted successfully!'
        ]);
    }
}