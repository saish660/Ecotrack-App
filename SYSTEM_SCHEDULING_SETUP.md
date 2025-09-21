# System-Based Scheduling for EcoTrack FCM Notifications

Now that we've migrated from the Python scheduler to Firebase FCM, you can remove the `notification_scheduler.py` script and use system-based scheduling instead.

## Remove Python Scheduler

The `notification_scheduler.py` file is no longer needed and can be deleted or moved to a backup location.

## System-Based Scheduling Options

### Option 1: Windows Task Scheduler (Recommended for Windows)

1. **Open Task Scheduler**

   - Press `Win + R`, type `taskschd.msc`, and press Enter

2. **Create Basic Task**

   - Click "Create Basic Task..." in the right panel
   - Name: "EcoTrack Daily Notifications"
   - Description: "Send daily push notifications using Firebase FCM"

3. **Configure Trigger**

   - Select "Daily"
   - Start time: 00:00 (midnight)
   - Recur every: 1 day

4. **Configure Action**

   - Select "Start a program"
   - Program/script: `python`
   - Add arguments: `manage.py send_daily_notifications`
   - Start in: `C:\Users\saish\Computer Science\lenovo_leap_final_project\ecotrack`

5. **Additional Settings**
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"
   - Check "Configure for: Windows 10"

### Option 2: PowerShell Scheduled Job

Create a PowerShell script to schedule the job:

```powershell
# Create scheduled job for EcoTrack notifications
$trigger = New-JobTrigger -Daily -At "12:00 AM"
$action = {
    Set-Location "C:\Users\saish\Computer Science\lenovo_leap_final_project\ecotrack"
    python manage.py send_daily_notifications
}
Register-ScheduledJob -Name "EcoTrack-FCM-Notifications" -ScriptBlock $action -Trigger $trigger
```

### Option 3: Batch Script with Task Scheduler

Create a batch file `run_notifications.bat`:

```batch
@echo off
cd /d "C:\Users\saish\Computer Science\lenovo_leap_final_project\ecotrack"
python manage.py send_daily_notifications
```

Then schedule this batch file using Task Scheduler.

## How It Works

- The system scheduler runs every minute (or at your preferred interval)
- The Django management command checks the current time and only sends notifications to users whose notification time matches
- No continuous running processes needed
- More reliable and system-native approach

## Testing

To test the new system:

```bash
# Test the management command directly
python manage.py send_daily_notifications --dry-run

# Test without dry-run (will send real notifications)
python manage.py send_daily_notifications
```

## Benefits of System-Based Scheduling

1. **Reliability**: Uses the operating system's built-in scheduling
2. **No Long-Running Processes**: Eliminates the need for persistent Python processes
3. **Better Resource Management**: Only runs when needed
4. **System Integration**: Integrates with system logs and monitoring
5. **Automatic Restart**: System scheduler handles failures and restarts

## Migration Notes

- The old `notification_scheduler.py` used the `schedule` library to run continuously
- The new approach runs the Django management command periodically via system scheduler
- All notification logic remains in the Django management command
- The management command is stateless and can be run independently
