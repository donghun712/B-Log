# Data Safety Draft

This is a draft for Play Console. Review it against the final production behavior before submission.

## Data Types

- Personal info: name, email address, user ID
- App activity: practice records, total shots, total hits, rankings, group membership
- Approximate location: used only when the user grants browser location permission to prioritize nearby archery ranges

## Collection And Use

- Firebase Authentication is used for login.
- Firestore stores profile, practice summaries, ranking-visible records, group data, and admin permission data.
- IndexedDB stores detailed shot records, notes, and local cache on the user's device.

## Security

- Cloud data is sent over HTTPS.
- Firestore Security Rules restrict access by user and admin role.

## User Controls

- Users can edit/delete practice records.
- Users can leave groups.
- Users can control ranking visibility in settings.
