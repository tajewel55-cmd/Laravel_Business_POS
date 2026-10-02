<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\CompanyProfileController;
use App\Http\Controllers\TimeSettingController;
use App\Http\Controllers\PackSizeController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ManufacturerController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\AdjustmentController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PurchaseDuePayController;
use App\Http\Controllers\SaleDuePayController;
use App\Http\Controllers\BackupController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Public and Protected Routes for Business POS
*/

// 1. Public routes (routes that do not require login or a token to access)
Route::post('/login', [AuthController::class, 'login']);

// 2. Protected route (any API route that requires the user to be logged in)
Route::middleware('auth:sanctum')->group(function () {
    
    // Logout and user info
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Dashboard and profile update routes
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::put('/dashboard/profile/update', [DashboardController::class, 'updateProfile']);

    Route::apiResource('roles', RoleController::class);
    Route::apiResource('users', UserController::class);
    Route::apiResource('menus', MenuController::class);

    // Route to retrieve the menu, including submenus, based on user roles and permissions
    Route::get('/user-menus', [MenuController::class, 'getUserMenus']);

    Route::get('roles/{roleId}/permissions', [PermissionController::class, 'getPermissionsByRole']);
    Route::post('roles/{roleId}/permissions', [PermissionController::class, 'saveRolePermissions']);
    
    Route::apiResource('company-profile', CompanyProfileController::class);
    Route::apiResource('time-settings', TimeSettingController::class);
    Route::apiResource('pack-sizes', PackSizeController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('manufacturers', ManufacturerController::class);
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('products', ProductController::class);

    Route::get('/purchases/due', [PurchaseDuePayController::class, 'index']);    
    Route::post('/purchases/{id}/pay-due', [PurchaseDuePayController::class, 'storePayment']);
    Route::apiResource('purchases', PurchaseController::class); 
    
    Route::get('/sales/due', [SaleDuePayController::class, 'index']);
    Route::post('/sales/{saleId}/pay-due', [SaleDuePayController::class, 'storePayment']);
    Route::apiResource('sales', SaleController::class); 

    Route::apiResource('adjustments', AdjustmentController::class);     

    Route::get('/reports/stock', [ReportController::class, 'stockReport']);
    Route::get('/reports/sales-qty', [ReportController::class, 'salesQtyReport']);
    Route::get('/reports/profit-qty', [ReportController::class, 'profitQtyReport']);
    Route::get('/reports/sales-invoice', [ReportController::class, 'salesInvoiceReport']);
    Route::get('/reports/sales-volume', [ReportController::class, 'salesVolumeReport']);

    // Database backup
    Route::get('/backups', [BackupController::class, 'index']);
    Route::post('/backups/create', [BackupController::class, 'create']);
    Route::get('/backups/download/{filename}', [BackupController::class, 'download']);
    Route::delete('/backups/{filename}', [BackupController::class, 'destroy']);
});