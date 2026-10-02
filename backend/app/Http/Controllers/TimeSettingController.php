<?php

namespace App\Http\Controllers;

use App\Models\TimeSetting;
use Illuminate\Http\Request;

class TimeSettingController extends Controller
{
    public function index()
    {
        $timeSetting = TimeSetting::first();
        return response()->json([
            'success' => true,
            'data' => $timeSetting
        ]);
    }

    public function store(Request $request)
    {
        return $this->storeOrUpdate($request);
    }

    public function update(Request $request, $id)
    {
        return $this->storeOrUpdate($request);
    }

    public function storeOrUpdate(Request $request)
    {
        $request->validate([
            'hours' => 'required|string|max:255',
        ]);

        $timeSetting = TimeSetting::first() ?? new TimeSetting();
        $timeSetting->hours = $request->hours;
        $timeSetting->save();

        return response()->json([
            'success' => true,
            'message' => 'Time settings saved successfully!',
            'data' => $timeSetting
        ]);
    }
}