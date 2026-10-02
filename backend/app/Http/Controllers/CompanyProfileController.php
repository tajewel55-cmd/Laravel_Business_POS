<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use Illuminate\Http\Request;

class CompanyProfileController extends Controller
{
    public function index()
    {
        $company = CompanyProfile::first();
        return response()->json([
            'success' => true,
            'data' => $company
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
            'company_name' => 'required|string|max:255',
            'mobile' => 'nullable|string|max:20',
            'mail' => 'nullable|email|max:255',
            'address' => 'nullable|string',
        ]);

        $company = CompanyProfile::first() ?? new CompanyProfile();

        $company->company_name = $request->company_name;
        $company->mobile = $request->mobile;
        $company->mail = $request->mail;
        $company->address = $request->address;
        $company->save();

        return response()->json([
            'success' => true,
            'message' => 'Company profile saved successfully!',
            'data' => $company
        ]);
    }
}