import { mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { container } from "tsyringe";
import { setup } from "../src/CommandsHelper";
import Config from "../src/Config";

export async function setupConfigForTest() {
	const tempPrefix = path.resolve(tmpdir(), "j3-" + Math.ceil(Math.random() * 1000));
	const config = new Config({
		"access-key": "",
		"access-secret": "",
		"public-domain": "localhost.domain",
		backends: [{
			id: "local-1",
			location: tempPrefix + "-backend-local-1",
		}],
		database: tempPrefix + "-database",
		logging: {
			console: false,
			file: tempPrefix + "-log.txt",
			level: "debug"
		},
		peers: [],
		server: {
			port: 8000,
			host: "0.0.0.0"
		},
	});
	for (const backend of config.data.backends) {
		await mkdir(backend.location, {recursive: true});
	}
	container.registerInstance(Config, config);
	Config.instance = config;
	await setup();
}

export async function cleanupAfterTest() {
	if (!container.isRegistered(Config)) {
		return;
	}
	const config = container.resolve(Config);
	const tempDir = tmpdir()
	const databaseDir = config.data.database;
	if (databaseDir.startsWith(tempDir)) {
		await rm(databaseDir, { recursive: true, force: true });
	}
	const logPath = config.data.logging?.file;
	if (logPath !== undefined && logPath.startsWith(tempDir)) {
		await rm(logPath);
	}
	for (const backend of config.data.backends) {
		if (backend.location.startsWith(tempDir)) {
			await rm(backend.location, {recursive: true, force: true});
		}
	}
}