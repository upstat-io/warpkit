/**
 * Firebase Auth Emulator Container
 *
 * Manages a Docker container running the Firebase Auth emulator for testing.
 * Uses testcontainers to start/stop the container automatically.
 */

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import path from 'path';

const AUTH_EMULATOR_PORT = 9099;

/**
 * Firebase Auth Emulator Container Manager
 *
 * Starts a container with Firebase Auth emulator for integration testing.
 */
export class FirebaseEmulatorContainer {
	private container: StartedTestContainer | null = null;
	private static imageBuilt = false;

	/**
	 * Start the Firebase Auth emulator container
	 *
	 * @returns The emulator URL to connect to
	 */
	async start(): Promise<{ emulatorUrl: string; projectId: string }> {
		// Build the image if not already built
		if (!FirebaseEmulatorContainer.imageBuilt) {
			await this.buildImage();
			FirebaseEmulatorContainer.imageBuilt = true;
		}

		// Start container from our pre-built image
		this.container = await new GenericContainer('warpkit-firebase-emulator:latest')
			.withExposedPorts(AUTH_EMULATOR_PORT)
			.withWaitStrategy(Wait.forLogMessage(/All emulators ready/i))
			.withStartupTimeout(60_000)
			.start();

		const mappedPort = this.container.getMappedPort(AUTH_EMULATOR_PORT);
		const host = this.container.getHost();

		return {
			emulatorUrl: `http://${host}:${mappedPort}`,
			projectId: 'test-project'
		};
	}

	/**
	 * Stop the container
	 */
	async stop(): Promise<void> {
		if (this.container) {
			await this.container.stop({ remove: true, removeVolumes: true });
			this.container = null;
		}
	}

	/**
	 * Clear all users from the emulator
	 */
	async clearUsers(): Promise<void> {
		if (!this.container) {
			throw new Error('Container not started');
		}

		const mappedPort = this.container.getMappedPort(AUTH_EMULATOR_PORT);
		const host = this.container.getHost();

		const response = await fetch(`http://${host}:${mappedPort}/emulator/v1/projects/test-project/accounts`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`Failed to clear users: ${response.status}`);
		}
	}

	/**
	 * Build the Docker image from our Dockerfile
	 */
	private async buildImage(): Promise<void> {
		const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
		const contextPath = path.resolve(__dirname, '../..');

		// Use Bun to run docker build
		const proc = Bun.spawn(
			['docker', 'build', '-t', 'warpkit-firebase-emulator:latest', '-f', dockerfilePath, contextPath],
			{
				stdout: 'inherit',
				stderr: 'inherit'
			}
		);

		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			throw new Error(`Failed to build Firebase emulator image (exit code: ${exitCode})`);
		}
	}
}

/**
 * Singleton instance for reuse across tests
 */
let sharedContainer: FirebaseEmulatorContainer | null = null;

/**
 * Get or create a shared Firebase emulator container
 *
 * Reuses the same container across all tests for speed.
 * Call clearUsers() between tests to reset state.
 */
export async function getFirebaseEmulator(): Promise<{
	container: FirebaseEmulatorContainer;
	emulatorUrl: string;
	projectId: string;
}> {
	if (!sharedContainer) {
		sharedContainer = new FirebaseEmulatorContainer();
	}

	const { emulatorUrl, projectId } = await sharedContainer.start();

	return {
		container: sharedContainer,
		emulatorUrl,
		projectId
	};
}

/**
 * Stop the shared Firebase emulator container
 *
 * Call this in globalTeardown or afterAll at the suite level.
 */
export async function stopFirebaseEmulator(): Promise<void> {
	if (sharedContainer) {
		await sharedContainer.stop();
		sharedContainer = null;
	}
}
