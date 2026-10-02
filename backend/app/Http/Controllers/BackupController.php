<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use ZipArchive;

class BackupController extends Controller
{
    protected $backupDir;

    public function __construct()
    {
        $this->backupDir = storage_path('app/backups');
        
        if (!File::exists($this->backupDir)) {
            File::makeDirectory($this->backupDir, 0755, true);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role_id, [1, 2, 3])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized access!'
            ], 403);
        }

        $files = File::files($this->backupDir);
        $backupList = [];

        foreach ($files as $file) {
            $backupList[] = [
                'name' => $file->getFilename(),
                'size' => round($file->getSize() / 1024 / 1024, 2) . ' MB',
                'date' => date('Y-m-d H:i:s', $file->getMTime()),
            ];
        }

        usort($backupList, fn($a, $b) => strtotime($b['date']) - strtotime($a['date']));

        return response()->json([
            'status' => 'success',
            'backups' => $backupList
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role_id, [1, 2, 3])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized access!'
            ], 403);
        }

        set_time_limit(0); 
        ini_set('memory_limit', '1024M');

        try {
            $this->cleanOldBackups(7);

            $dbName = config('database.connections.mysql.database');
            $dbUser = config('database.connections.mysql.username');
            $dbPass = config('database.connections.mysql.password');
            $dbHost = config('database.connections.mysql.host');
            $dbPort = config('database.connections.mysql.port', '3306');

            $fileName = 'BusinessPos-' . date('Y-m-d_H-i-s');
            $sqlPath = "{$this->backupDir}/{$fileName}.sql";
            $zipPath = "{$this->backupDir}/{$fileName}.zip";

            $command = sprintf(
                'mysqldump --user=%s --password=%s --host=%s --port=%s --single-transaction --quick --routines --triggers %s > %s',
                escapeshellarg($dbUser),
                escapeshellarg($dbPass),
                escapeshellarg($dbHost),
                escapeshellarg($dbPort),
                escapeshellarg($dbName),
                escapeshellarg($sqlPath)
            );

            exec($command, $output, $result);

            if ($result !== 0) {
                throw new \Exception('Failed to dump database. Please check mysqldump configuration or server resource limits.');
            }

            $zip = new ZipArchive;
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
                $zip->addFile($sqlPath, basename($sqlPath));
                $zip->close();
            } else {
                throw new \Exception('Failed to create ZIP archive for the backup.');
            }

            @unlink($sqlPath);

            return response()->json([
                'status' => 'success',
                'message' => 'Large database backup completed successfully!',
                'file' => "{$fileName}.zip"
            ]);

        } catch (\Exception $e) {
            Log::error('Backup Error: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    private function cleanOldBackups($daysToKeep = 7)
    {
        $files = File::files($this->backupDir);
        $cutoffTime = now()->subDays($daysToKeep)->timestamp;

        foreach ($files as $file) {
            if ($file->getMTime() < $cutoffTime) {
                File::delete($file->getPathname());
            }
        }
    }

    public function download(Request $request, $filename)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role_id, [1, 2, 3])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized access!'
            ], 403);
        }

        set_time_limit(0);
        ini_set('memory_limit', '1024M');

        $filename = basename($filename);
        $filePath = "{$this->backupDir}/{$filename}";
        
        if (File::exists($filePath)) {
            return response()->download($filePath);
        }

        return response()->json(['message' => 'File not found!'], 404);
    }

    public function destroy(Request $request, $filename)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role_id, [1, 2, 3])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized access!'
            ], 403);
        }

        $filename = basename($filename);
        $filePath = "{$this->backupDir}/{$filename}";
        
        if (File::exists($filePath)) {
            File::delete($filePath);
            return response()->json(['status' => 'success', 'message' => 'Backup deleted successfully!']);
        }

        return response()->json(['message' => 'File not found!'], 404);
    }
}