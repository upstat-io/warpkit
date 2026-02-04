# Firebase Emulator Container for Testing
#
# Pre-built image with Firebase CLI and Auth emulator ready to go.
# Used by testcontainers in @warpkit/auth-firebase tests.

FROM node:20-slim

# Install OpenJDK (required for Firebase emulators)
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Create working directory
WORKDIR /firebase

# Create minimal firebase.json for auth emulator only
RUN echo '{"emulators":{"auth":{"host":"0.0.0.0","port":9099},"ui":{"enabled":false}}}' > firebase.json

# Expose auth emulator port
EXPOSE 9099

# Start auth emulator (runs until container is stopped)
CMD ["firebase", "emulators:start", "--only", "auth", "--project", "test-project"]
