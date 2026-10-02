<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    // নির্দিষ্ট রোলের পারমিশন বা মেনু লিস্ট দেখার জন্য
    public function getPermissionsByRole($roleId)
    {
        // শুধু মেনু আইডিগুলোর একটি প্লেন অ্যারে (যেমন: [1, 2, 5]) রিটার্ন করা হলো, যা ফ্রন্টএন্ড সরাসরি পড়তে পারে
        $permissions = Permission::where('role_id', $roleId)->pluck('menu_id');
        
        return response()->json([
            'success' => true, 
            'permissions' => $permissions // ফ্রন্টএন্ডে res.data.permissions ব্যবহার করা হচ্ছে
        ]);
    }

    // রোল অনুযায়ী পারমিশন আপডেট বা সেভ করার জন্য
    public function saveRolePermissions(Request $request, $roleId)
    {
        $request->validate([
            'menu_ids' => 'present|array',
            'menu_ids.*' => 'exists:menus,menu_id'
        ]);

        // পুরানো পারমিশন মুছে নতুনগুলো অ্যাসাইন করা
        Permission::where('role_id', $roleId)->delete();

        $savedPermissions = [];
        if ($request->has('menu_ids') && is_array($request->menu_ids)) {
            foreach ($request->menu_ids as $menuId) {
                $savedPermissions[] = Permission::create([
                    'role_id' => $roleId,
                    'menu_id' => $menuId
                ]);
            }
        }

        return response()->json([
            'success' => true, 
            'message' => 'Permissions updated successfully!', 
            'data' => $savedPermissions
        ]);
    }
}