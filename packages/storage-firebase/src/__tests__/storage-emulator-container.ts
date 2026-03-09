/**
 * Firebase Storage Emulator Container
 *
 * Reuses the shared multi-emulator Dockerfile from data-firestore.
 * Manages a Docker container running Firebase Storage emulator for testing.
 */

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import path from 'path';

const STORAGE_EMULATOR_PORT = 9199;

export class StorageEmulatorContainer {
	private container: StartedTestContainer | null = null;
	private static imageBuilt = false;

	async start(): Promise<{ emulatorHost: string; emulatorPort: number; projectId: string }> {
		if (!StorageEmulatorContainer.imageBuilt) {
			await this.buildImage();
			StorageEmulatorContainer.imageBuilt = true;
		}

		this.container = await new GenericContainer('warpkit-firebase-emulator:latest')
			.withExposedPorts(STORAGE_EMULATOR_PORT)
			.withWaitStrategy(Wait.forLogMessage(/All emulators ready/i))
			.withStartupTimeout(60_000)
			.start();

		const mappedPort = this.container.getMappedPort(STORAGE_EMULATOR_PORT);
		const host = this.container.getHost();

		return {
			emulatorHost: host,
			emulatorPort: mappedPort,
			projectId: 'test-project',
		};
	}

	async stop(): Promise<void> {
		if (this.container) {
			await this.container.stop({ remove: true, removeVolumes: true });
			this.container = null;
		}
	}

	private async buildImage(): Promise<void> {
		// Reuse the shared Dockerfile from data-firestore
		const dockerfilePath = path.resolve(__dirname, '../../../data-firestore/Dockerfile');
		const contextPath = path.resolve(__dirname, '../../../data-firestore');

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

let sharedContainer: StorageEmulatorContainer | null = null;

export async function getStorageEmulator(): Promise<{
	container: StorageEmulatorContainer;
	emulatorHost: string;
	emulatorPort: number;
	projectId: string;
}> {
	if (!sharedContainer) {
		sharedContainer = new StorageEmulatorContainer();
	}

	const { emulatorHost, emulatorPort, projectId } = await sharedContainer.start();

	return {
		container: sharedContainer,
		emulatorHost,
		emulatorPort,
		projectId,
	};
}

export async function stopStorageEmulator(): Promise<void> {
	if (sharedContainer) {
		await sharedContainer.stop();
		sharedContainer = null;
	}
}
