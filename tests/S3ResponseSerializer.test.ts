import S3ResponseSerializer from "../src/S3ResponseSerializer";
import Bucket from "../src/S3Types/Bucket";
import ListAllMyBucketsResult from "../src/S3Types/ListAllMyBucketsResult";
import { Parser } from 'xml2js';


test("S3ResponseSerializer", async () => {
	const serializer = new S3ResponseSerializer();
	const BucketLists = new ListAllMyBucketsResult([
		new Bucket("My-Test-Bucket", new Date())
	]);

	const response = serializer.serialize(BucketLists);
	expect(response).toMatch("ListAllMyBucketsResult");
	expect(response).toMatch("Bucket");
	expect(response).toMatch("My-Test-Bucket");

	const parser = new Parser();
	const xml = await parser.parseStringPromise(response);
	expect(xml.ListAllMyBucketsResult).toBeDefined();
	expect(xml.ListAllMyBucketsResult.Buckets).toBeDefined();
	expect(xml.ListAllMyBucketsResult.Buckets.length).toBe(1);
	expect(xml.ListAllMyBucketsResult.Buckets[0].Bucket.length).toBe(1);
	expect(xml.ListAllMyBucketsResult.Buckets[0].Bucket[0].Name.length).toBe(1);
	expect(xml.ListAllMyBucketsResult.Buckets[0].Bucket[0].Name[0]).toBe("My-Test-Bucket");
});