<?php

namespace App\Http\Controllers;

use App\Models\Manufacturer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ManufacturerController extends Controller
{
    public function index()
    {
        $manufacturers = Manufacturer::orderBy('manufacturer_id', 'desc')->get();
        return response()->json(['data' => $manufacturers]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'manufacturer_name' => 'required|string|max:255',
            'is_active' => 'required|boolean',
        ]);

        Manufacturer::create([
            'manufacturer_name' => $request->manufacturer_name,
            'manufacturer_slug' => Str::slug($request->manufacturer_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Manufacturer created successfully!']);
    }

    public function update(Request $request, $id)
    {
        $manufacturer = Manufacturer::findOrFail($id);

        $request->validate([
            'manufacturer_name' => 'required|string|max:255',
            'is_active' => 'required|boolean',
        ]);

        $manufacturer->update([
            'manufacturer_name' => $request->manufacturer_name,
            'manufacturer_slug' => Str::slug($request->manufacturer_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Manufacturer updated successfully!']);
    }

    public function destroy($id)
    {
        $manufacturer = Manufacturer::findOrFail($id);
        $manufacturer->delete();

        return response()->json(['message' => 'Manufacturer deleted successfully!']);
    }
}