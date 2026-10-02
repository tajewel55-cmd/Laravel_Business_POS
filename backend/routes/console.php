<?php

use Illuminate\Support\Facades\Schedule;
use App\Http\Controllers\BackupController;

// An automatic backup will be created every day at 2:00 AM.
Schedule::call(function () {
    app(BackupController::class)->create();
})
->dailyAt('02:00')
->name('daily-database-backup')
->withoutOverlapping();