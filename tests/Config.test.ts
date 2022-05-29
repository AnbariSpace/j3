import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import Config, { IConfigData } from "../src/Config";

test("config syntax check that fails", async () => {
	const configContent = JSON.stringify({ // missing secret-key
		"access-key": 123, // Wrong, it's should be string
		"database": ["test"], // Wrong, it's should be string,
	});
	const filePath = path.resolve(tmpdir(), "j3-config" + Math.ceil(Math.random() * 1000) + ".json");
	await writeFile(filePath, configContent);
	const consoleError = console.error;
	console.error = function(){};
	await expect(Config.fromFile(filePath)).rejects.toBeInstanceOf(Error);
	console.error = consoleError;
	await unlink(filePath);
});


test("config syntax check that success", async () => {
	const configContent = JSON.stringify({
		"node-id": "test",
		"access-key": "123",
		"access-secret": "test",
		database: path.resolve(tmpdir(), ".j3", "database"),
		backends: [{
			id: "test",
			location: tmpdir()
		}],
		"public-domain": "localhost",
		peers: [],
		server: {
			port: 8080,
			host: "0.0.0.0"
		}
	} as IConfigData);

	const filePath = path.resolve(tmpdir(), "j3-config" + Math.ceil(Math.random() * 1000) + ".json");
	await writeFile(filePath, configContent);
	const result = await Config.fromFile(filePath);
	expect(result).toBeInstanceOf(Config);
	await unlink(filePath);
});