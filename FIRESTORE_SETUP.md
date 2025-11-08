# Firestore Database Setup Guide

## Required Collections

Your Firestore database needs the following collections. Most are created automatically, but you may need to manually create the `notifications` collection structure.

### 1. Notifications Collection

**Collection Name:** `notifications`

**Document Structure:**
```json
{
  "studentId": "string (student user ID)",
  "type": "string (e.g., 'job_opportunity')",
  "title": "string",
  "message": "string",
  "jobId": "string (optional, if notification is about a job)",
  "read": "boolean (default: false)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "readAt": "timestamp (optional, when notification is marked as read)"
}
```

**Index (Optional but Recommended):**
- Collection: `notifications`
- Fields: `studentId` (Ascending), `createdAt` (Descending)
- Query Scope: Collection

**To create the index:**
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `career-platform-lesotho`
3. Go to Firestore Database → Indexes
4. Click "Create Index"
5. Collection ID: `notifications`
6. Add fields:
   - Field: `studentId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
7. Click "Create"

**Note:** The code has been updated to work without the index (it sorts in memory), but having the index improves performance.

### 2. Student Documents Collection

**Collection Name:** `studentDocuments`

**Document Structure:**
```json
{
  "studentId": "string",
  "documentType": "string (additional|transcript|certificate|diploma|other)",
  "fileName": "string",
  "fileUrl": "string (optional)",
  "description": "string (optional)",
  "uploadedAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3. Other Collections (Auto-created)

These collections are created automatically when users register or perform actions:
- `users` - User accounts
- `students` - Student profiles
- `institutions` - Institution profiles
- `companies` - Company profiles
- `courses` - Course listings
- `applications` - Course applications
- `jobs` - Job postings
- `jobApplications` - Job applications
- `savedJobs` - Saved jobs
- `grades` - Student grades

## Manual Collection Creation (if needed)

If you need to manually create the `notifications` collection:

1. Go to Firebase Console
2. Select Firestore Database
3. Click "Start collection"
4. Collection ID: `notifications`
5. Click "Next" (you can add a test document or leave it empty - documents will be created automatically)

The collection will be populated automatically when:
- Companies post new jobs (notifications are created for matching students)
- Other system events occur

## Testing Notifications

To test notifications:
1. Create a student account
2. Enter grades for the student (so they have a GPA)
3. Create a company account
4. Post a job with a minimum GPA requirement that matches the student's GPA
5. The student should receive a notification on their dashboard

## Troubleshooting

**If notifications still don't work:**
1. Check that the `notifications` collection exists in Firestore
2. Verify that when a job is posted, notifications are being created (check Firestore console)
3. Check browser console for any errors
4. Verify the student's GPA is set and meets job requirements

