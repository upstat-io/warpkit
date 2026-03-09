# Firebase Emulator Container for Testing
#
# Multi-emulator image with Auth, Firestore, and Storage emulators.
# Used by testcontainers in @warpkit/data-firestore and @warpkit/storage-firebase tests.

FROM node:20-slim

# Install OpenJDK (required for Firebase emulators)
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Create working directory
WORKDIR /firebase

# Create firebase.json with auth, firestore, and storage emulators
RUN echo '{"emulators":{"auth":{"host":"0.0.0.0","port":9099},"firestore":{"host":"0.0.0.0","port":8080},"storage":{"host":"0.0.0.0","port":9199},"ui":{"enabled":false}}}' > firebase.json

# Create minimal firestore rules
RUN echo 'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }' > firestore.rules

# Create minimal storage rules
RUN echo 'rules_version = "2"; service firebase.storage { match /b/{bucket}/o { match /{allPaths=**} { allow read, write: if true; } } }' > storage.rules

# Expose emulator ports
EXPOSE 9099 8080 9199

# Start all emulators
CMD ["firebase", "emulators:start", "--only", "auth,firestore,storage", "--project", "test-project"]
