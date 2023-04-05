const express = require("express");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const fs = require("fs");
var encryptor = require("file-encryptor");
require("dotenv").config();
// env vars
AWS.config.update({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  sessionToken: process.env.sessionToken,
});

const s3 = new AWS.S3({
  region: "us-east-1",
});
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

app.get("/api/s3/encrypted-file/upload", async (req, res) => {
  const myBucket = "webapp1buckett";
  const downloadPath1 = "myFile200MB";
  const downloadPath2 = "myFile512MB";
  const paths = { 1: downloadPath1, 2: downloadPath2 };
  const t = {};
  let i = 0;
  Object.values(paths).forEach(async path => {
    console.log(path)
    i = i + 1;
    const file = fs.createWriteStream(path);

    const { ContentLength: contentLength } = await s3
      .headObject({ Bucket: myBucket, Key: path })
      .promise();

    const start = performance.now();
    const rs = s3.getObject({ Bucket: myBucket, Key: path }).createReadStream();

    let downloadedSize = 0;
    setInterval(() => {
      console.log(
        `Progress:(${Math.round((downloadedSize / contentLength) * 100)}%)`
      );
    }, 60 * 1000);

    rs.on("data", function (chunk) {
      file.write(chunk);
      downloadedSize += chunk.length;
    });

    rs.on("end", () => {
      console.log("Download completed");
      file.end();

      const outputFile = `encrypted_${path}.dat`;
      var key = crypto.randomBytes(32);
      var options = { algorithm: "aes256" };

      encryptor.encryptFile(path, outputFile, key, options, function (err) {
        fs.stat(outputFile, (err, stats) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log(`File size of cipher in bytes: ${stats.size}`);
        });

        fs.readFile(outputFile, function (err, data) {
          if (err) {
            throw err;
          }

          params = { Bucket: myBucket, Key: outputFile, Body: data };

          s3.putObject(params, function (err, data) {
            if (err) {
              console.log(err);
              throw err;
            } else {
              const end = performance.now();
              const elapsedTime = ((end - start) / 1000).toFixed(2);
              console.log(elapsedTime, " seconds");
              console.log("Successfully uploaded data to webapp1buckett");
              t.path = elapsedTime;
              if (i == 2) res.json({ Elapsed_Time: t });
            }
          });
        });
      });
    });

    rs.on("error", (err) => {
      // file.destroy();
      console.error("Download failed:", err);
    });
  })
});
app.listen(PORT);
