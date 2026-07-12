import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const csvPath = fileURLToPath(new URL("../fixtures/neutral-sales.csv", import.meta.url));
const objectName = "fixtures/neutral-sales.csv";
const bucketName = "neutral-fixtures";
const content = await readFile(csvPath);
const md5Hash = createHash("md5").update(content).digest("base64");

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1:4443");
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }

  if (
    request.method === "GET" &&
    (url.pathname === `/b/${bucketName}/o` || url.pathname === `/storage/v1/b/${bucketName}/o`)
  ) {
    const prefix = url.searchParams.get("prefix") || "";
    const items = objectName.startsWith(prefix)
      ? [{ name: objectName, md5Hash, size: String(content.length), generation: "1" }]
      : [];
    sendJson(response, 200, { kind: "storage#objects", items });
    return;
  }

  const encodedObject = encodeURIComponent(objectName);
  if (
    request.method === "GET" &&
    (url.pathname === `/b/${bucketName}/o/${encodedObject}` ||
      url.pathname === `/storage/v1/b/${bucketName}/o/${encodedObject}`)
  ) {
    if (url.searchParams.get("alt") === "media") {
      response.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Length": String(content.length),
      });
      response.end(content);
      return;
    }
    sendJson(response, 200, {
      name: objectName,
      bucket: bucketName,
      md5Hash,
      size: String(content.length),
      generation: "1",
    });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === `/download/storage/v1/b/${bucketName}/o/${encodedObject}`
  ) {
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Length": String(content.length),
    });
    response.end(content);
    return;
  }

  sendJson(response, 404, { error: { code: 404, message: "Fixture object not found" } });
});

server.listen(4443, "127.0.0.1");

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
