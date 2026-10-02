<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();
        return response()->json(['data' => $users]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'user_name' => 'required|string|max:255',
            'role_id'   => 'required|integer',
            'password'  => 'required|string|min:6',
        ]);

        $user = User::create([
            'user_name' => $request->user_name,
            'email'     => null, 
            'password'  => Hash::make($request->password),
            'role_id'   => $request->role_id,
        ]);

        return response()->json(['message' => 'User created successfully', 'data' => $user], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'user_name' => 'required|string|max:255',
            'role_id'   => 'required|integer',
            'password'  => 'nullable|string|min:6',
        ]);

        $user->user_name = $request->user_name;
        $user->email = null; 
        $user->role_id = $request->role_id;

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json(['message' => 'User updated successfully', 'data' => $user]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }
}