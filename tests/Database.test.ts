import { createHash } from "crypto";
import { container } from "tsyringe";
import Database, { IObject } from "../src/Database";
import { cleanupAfterTest, setupConfigForTest } from "./TestHelper";

beforeAll(() => setupConfigForTest());
afterAll(() => cleanupAfterTest());

test("database init", async () => {
	const database = container.resolve(Database);
	await database.init();
	const bucketList = await database.getBucketsList();
	expect(bucketList.length).toBe(0);
});

test("bucket management in database", async () => {
	const database = container.resolve(Database);
	await database.init();

	const bucketName = "MyBucket";

	let versionId = await database.getVersionId();
	const createUpdate = await database.createBucket(bucketName);
	expect(createUpdate).toMatchObject({type: "bucket", name: bucketName});
	expect(createUpdate.versionId > versionId).toBe(true);
	await expect(database.getBucketsList()).resolves.toContain(bucketName);
	
	await expect(database.hasBucket(bucketName)).resolves.toBe(true);


	versionId = createUpdate.versionId;

	const bucket = await database.getBucket(bucketName);
	expect(bucket).toBeDefined();
	if (bucket !== undefined) {
		expect(bucket.versionId).toBe(versionId);
		expect(bucket.deleteMarker).toBeFalsy();
	}

	const deleteUpdate = await database.markBucketAsDeleted(bucketName);
	expect(deleteUpdate).toMatchObject({ type: "bucket", name: bucketName, deleteMarker: true });
	expect(deleteUpdate.versionId > versionId).toBe(true);
	await expect(database.hasBucket(bucketName)).resolves.toBe(true);

});

test("object management in database", async () => {
	const database = container.resolve(Database);
	await database.init();

	const bucketName = "MyBucketWithObjects";
	const objectKey = "my-file.txt";
	const lastModified = new Date()
	lastModified.setTime(Date.now() + Math.ceil(Math.random() * 5000000));
	const size = Math.ceil(Math.random() * 1000000);

	const objectInfo: IObject = {
		versionId: database.generateVersionId(),
		storageClass: "STANDARD",
		lastModified: lastModified,
		size: size,
		etag: createHash("md5").update(size.toString()).digest("hex"),
		backends: ["local-disk-1"],
		metadata: {
			"key1": "value1",
			"key2": "value2",
		}
	};
	
	await database.createBucket(bucketName);

	const createUpdate = await database.createObject(
		objectInfo.versionId,
		bucketName,
		objectKey,
		objectInfo.size,
		objectInfo.etag,
		objectInfo.backends,
		objectInfo.storageClass,
		objectInfo.lastModified,
		objectInfo.metadata
	);
	expect(createUpdate).toMatchObject({
		type: "object",
		bucket: bucketName,
		key: objectKey,
	});
	expect(createUpdate).toMatchObject(objectInfo);
	expect(database.getObject(bucketName, objectKey)).resolves.toMatchObject(objectInfo);
	
	const objects = await database.getObjects(bucketName);
	expect(objects).toMatchObject({
		[objectKey]: objectInfo,
	});
});