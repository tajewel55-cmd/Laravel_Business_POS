<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::all();
        return response()->json([
            'status' => 'success',
            'data' => $roles
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'role_name' => 'required|string|unique:roles,role_name',
        ]);

        $role = Role::create([
            'role_name' => $request->role_name,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Role created successfully',
            'data' => $role
        ], 201);
    }

    public function show($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role not found'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $role
        ]);
    }

    public function update(Request $request, $id)
    {
        $role = Role::find($id);

        if (!$role) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role not found'
            ], 404);
        }

        $request->validate([
            'role_name' => 'required|string|unique:roles,role_name,' . $id . ',role_id',
        ]);

        $role->update([
            'role_name' => $request->role_name,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Role updated successfully',
            'data' => $role
        ]);
    }


    public function destroy($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return response()->json([
                'status' => 'error',
                'message' => 'Role not found'
            ], 404);
        }

        $role->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Role deleted successfully'
        ]);
    }
}