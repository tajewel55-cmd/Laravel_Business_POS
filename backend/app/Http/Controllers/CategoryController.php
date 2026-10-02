<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::orderBy('category_id', 'desc')->get();
        return response()->json(['data' => $categories]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'category_name' => 'required|string|max:255',
            'is_active' => 'required|boolean',
        ]);

        Category::create([
            'category_name' => $request->category_name,
            'category_slug' => Str::slug($request->category_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Category created successfully!']);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $request->validate([
            'category_name' => 'required|string|max:255',
            'is_active' => 'required|boolean',
        ]);

        $category->update([
            'category_name' => $request->category_name,
            'category_slug' => Str::slug($request->category_name),
            'is_active' => $request->is_active,
        ]);

        return response()->json(['message' => 'Category updated successfully!']);
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);
        $category->delete();

        return response()->json(['message' => 'Category deleted successfully!']);
    }
}