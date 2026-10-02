<?php

namespace App\Http\Controllers;

use App\Models\Menu;
use App\Models\Permission;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function index()
    {
        $menus = Menu::orderBy('order_position')->get();
        return response()->json(['success' => true, 'data' => $menus]);
    }

    // নতুন যুক্ত করা ফাংশন (রোল ও পারমিশন অনুযায়ী সাবমেনু সহ মেনু ফেচ করার জন্য)
    public function getUserMenus(Request $request)
    {
        $user = $request->user();
        
        // ১. ইউজারের রোল অনুযায়ী অনুমতিপ্রাপ্ত মেনু আইডিগুলো বের করা
        $menuIds = Permission::where('role_id', $user->role_id)->pluck('menu_id');
        
        // ২. শুধু মেইন মেনুগুলো আনা (যাদের parent_id নেই বা null)
        $parentMenus = Menu::whereIn('menu_id', $menuIds)
                            ->whereNull('parent_id') // অথবা where('parent_id', 0)
                            ->where('is_active', true)
                            ->orderBy('order_position', 'asc')
                            ->get();

        // ৩. প্রতিটি মেইন মেনুর অধীনে সাবমেনুগুলো যুক্ত করা
        $menus = $parentMenus->map(function ($menu) use ($menuIds) {
            $subMenus = Menu::whereIn('menu_id', $menuIds)
                            ->where('parent_id', $menu->menu_id)
                            ->where('is_active', true)
                            ->orderBy('order_position', 'asc')
                            ->get();
            
            $menu->sub_menus = $subMenus;
            return $menu;
        });

        return response()->json(['success' => true, 'data' => $menus]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'menu_title' => 'required|string|max:255',
            'menu_slug' => 'required|string|unique:menus,menu_slug',
        ]);

        $menu = Menu::create($request->all());
        return response()->json(['success' => true, 'message' => 'Menu created successfully!', 'data' => $menu], 201);
    }

    public function show($id)
    {
        $menu = Menu::findOrFail($id);
        return response()->json(['success' => true, 'data' => $menu]);
    }

    public function update(Request $request, $id)
    {
        $menu = Menu::findOrFail($id);
        
        $request->validate([
            'menu_title' => 'string|max:255',
            'menu_slug' => 'string|unique:menus,menu_slug,' . $id . ',menu_id',
        ]);

        $menu->update($request->all());
        return response()->json(['success' => true, 'message' => 'Menu updated successfully!', 'data' => $menu]);
    }

    public function destroy($id)
    {
        $menu = Menu::findOrFail($id);
        $menu->delete();
        return response()->json(['success' => true, 'message' => 'Menu deleted successfully!']);
    }
}