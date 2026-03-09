/**
 * Firebase Firestore Emulator Container
 *
 * Manages a Docker container running Firebase emulators (Auth + Firestore + Storage) for testing.
 * Uses testcontainers to start/stop the container automatically.
 */

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import path from 'path';

const FIRESTORE_EMULATOR_PORT = 8080;

/**
 * Firebase Firestore Emulator Container Manager
 *
 * Starts a container with Firebase Firestore emulator for integration testing.
 */
export class FirestoreEmulatorContainer {
	private container: StartedTestContainer | null = null;
	private static imageBuilt = false;

	/**
	 * Start the Firebase Firestore emulator container.
	 *
	 * @returns Connection details for the Firestore emulator
	 */
	async start(): Promise<{ emulatorHost: string; emulatorPort: number; projectId: string }> {
		if (!FirestoreEmulatorContainer.imageBuilt) {
			await this.buildImage();
			FirestoreEmulatorContainer.imageBuilt = true;
		}

		this.container = await new GenericContainer('warpkit-firebase-emulator:latest')
			.withExposedPorts(FIRESTORE_EMULATOR_PORT)
			.withWaitStrategy(Wait.forLogMessage(/All emulators ready/i))
			.withStartupTimeout(60_000)
			.start();

		const mappedPort = this.container.getMappedPort(FIRESTORE_EMULATOR_PORT);
		const host = this.container.getHost();

		return {
			emulatorHost: host,
			emulatorPort: mappedPort,
			projectId: 'test-project',
		};
	}

	/**
	 * Stop the container.
	 */
	async stop(): Promise<void> {
		if (this.container) {
			await this.container.stop({ remove: true, removeVolumes: true });
			this.container = null;
		}
	}

	/**
	 * Clear all Firestore data via the emulator REST API.
	 */
	async clearData(): Promise<void> {
		if (!this.container) {
			throw new Error('Container not started');
		}

		const mappedPort = this.container.getMappedPort(FIRESTORE_EMULATOR_PORT);
		const host = this.container.getHost();

		const response = await fetch(
			`http://${host}:${mappedPort}/emulator/v1/projects/test-project/databases/(default)/documents`,
			{ method: 'DELETE' }
		);

		if (!response.ok) {
			throw new Error(`Failed to clear Firestore data: ${response.status}`);
		}
	}

	/**
	 * Build the Docker image from our Dockerfile.
	 */
	private async buildImage(): Promise<void> {
		const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
		const contextPath = path.resolve(__dirname, '../..');

		const proc = Bun.spawn(
			['docker', 'build', '-t', 'warpkit-firebase-emulator:latest', '-f', dockerfilePath, contextPath],
			{
				stdout: 'inherit',
				stderr: 'inherit',
			}
		);

		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			throw new Error(`Failed to build Firebase emulator image (exit code: ${exitCode})`);
		}
	}
}

/**
 * Singleton instance for reuse across tests.
 */
let sharedContainer: FirestoreEmulatorContainer | null = null;

/**
 * Get or create a shared Firebase Firestore emulator container.
 *
 * Reuses the same container across all tests for speed.
 * Call clearData() between tests to reset state.
 */
export async function getFirestoreEmulator(): Promise<{
	container: FirestoreEmulatorContainer;
	emulatorHost: string;
	emulatorPort: number;
	projectId: string;
}> {
	if (!sharedContainer) {
		sharedContainer = new FirestoreEmulatorContainer();
	}

	const { emulatorHost, emulatorPort, projectId } = await sharedContainer.start();

	return {
		container: sharedContainer,
		emulatorHost,
		emulatorPort,
		projectId,
	};
}

/**
 * Stop the shared Firebase emulator container.
 *
 * Call this in globalTeardown or afterAll at the suite level.
 */
export async function stopFirestoreEmulator(): Promise<void> {
	if (sharedContainer) {
		await sharedContainer.stop();
		sharedContainer = null;
	}
}
