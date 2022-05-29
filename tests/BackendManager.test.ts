import { container } from "tsyringe";
import BackendManager from "../src/BackendManager";
import LocalDisk from "../src/Backends/LocalDisk";
import { IObject } from "../src/Database";
import NoAccessableBackendError from "../src/Errors/NoAccessableBackendError";
import SpaceAllocationError from "../src/Errors/SpaceAllocationError";
import { setupConfigForTest, cleanupAfterTest } from "./TestHelper";

beforeAll(() => setupConfigForTest());
afterAll(() => cleanupAfterTest());

test("get by id", async () => {
	const backendManager = container.resolve(BackendManager);
	await backendManager.init();
	const localDisk = backendManager.get("local-1");
	expect(localDisk).toBeInstanceOf(LocalDisk);
	if (localDisk instanceof LocalDisk) {
		expect(localDisk.id).toBe("local-1");
	}
});

test("find suitable backend for object", async () => {
	const backendManager = container.resolve(BackendManager);
	await backendManager.init();
	const localDisk = await backendManager.findSuitableBackendForObject(1024);
	expect(localDisk).toBeInstanceOf(LocalDisk);
	if (localDisk instanceof LocalDisk) {
		expect(localDisk.id).toBe("local-1");
	}
	await expect(backendManager.findSuitableBackendForObject(Number.MAX_SAFE_INTEGER)).resolves.toBeUndefined();
});

test("allocate space", async () => {
	const backendManager = container.resolve(BackendManager);
	await backendManager.init();
	const {backend, stream} = await backendManager.allocateSpace("my-bucket", "my-object.txt", 1024);
	expect(backend).toBeInstanceOf(LocalDisk);
	expect(stream).toBeDefined();
	if (backend instanceof LocalDisk) {
		expect(backend.id).toBe("local-1");
	}
	await expect(backendManager.allocateSpace("my-bucket", "my-object.txt", Number.MAX_SAFE_INTEGER)).rejects.toThrowError(SpaceAllocationError);
});

test("get object", async () => {
	const backendManager = container.resolve(BackendManager);
	await backendManager.init();
	const {backend: writeBackend, stream: writeFile} = await backendManager.allocateSpace("my-bucket", "my-object.txt", 2);
	await new Promise<void>((resolve, reject) => writeFile.write("hi", (err) => {
		if (err) {
			return reject(err);
		}
		resolve();
	}));
	await new Promise((resolve) => writeFile.end(resolve));
	await writeBackend.commitObject(writeFile);
	const object: IObject = {
		etag: "some-hash",
		size: 2,
		lastModified: new Date(),
		metadata: {},
		storageClass: "STANDARD",
		versionId: "version-id",
		backends: [writeBackend.id],
	};
	const { backend: readBackend, stream: readFile } = await backendManager.getObject("my-bucket", "my-object.txt", object);
	expect(readBackend).toBe(writeBackend);
	
	await new Promise<void>((resolve, reject) => {
		let allData = "";
		readFile.on("data", (data) => {
			allData += data;
		});
		readFile.on("end", () => {
			expect(allData).toBe("hi");
			resolve();
		});
		readFile.on("error", (err) => reject(err));
	});
	
	
	object.backends = [];
	await expect(backendManager.getObject("my-bucket", "my-object.txt", object)).rejects.toThrowError(NoAccessableBackendError);
});