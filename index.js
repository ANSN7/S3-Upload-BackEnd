const express = require("express");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const fs = require("fs");
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

app.post("/api/s3/encrypted-file/upload", async (req, res) => {
  const myBucket = "webapp1buckett";
  const downloadPath = "./downloaded-file";

  s3.getObject({ Bucket: myBucket, Key: "myFile1GB" }, function (error, data) {
    if (error != null) {
      console.log("Failed to retrieve an object: " + error);
      throw err;
    } else {
      fs.writeFileSync(downloadPath, data.Body);
      console.log("Loaded " + data.ContentLength + " bytes");

      const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });

      fs.writeFileSync("private.pem", privateKey);
      fs.writeFileSync("public.pem", publicKey);
      const publicKeyPem = fs.readFileSync("public.pem");
      console.log(publicKeyPem);
      const inputFile = "downloaded-file";
      const outputFile = "cipher";

      const inputBuffer = fs.readFileSync(inputFile);

      let chunk_size = 214; // 214 bytes is the maximum for 2048-bit key
      let chunks = [];
      for (i = 0; i < inputBuffer.length; i = i + chunk_size) {
        chunks.push(inputBuffer.slice(i, i + chunk_size));
      }

      let encryptedBuffer;
      for (chunk in chunks)
        encryptedBuffer += crypto.publicEncrypt(publicKeyPem, chunk);

      fs.writeFileSync(outputFile, encrypted);

      fs.stat(outputFile, (err, stats) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(`File size of cipher in bytes: ${stats.size}`);
      });
      fs.stat(inputBuffer, (err, stats) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(`File size of input file in bytes: ${stats.size}`);
      });


      fs.readFile(outputFile, function (err, data) {
        if (err) {
          throw err;
        }

        params = { Bucket: myBucket, Key: "cipher", Body: data };

        s3.putObject(params, function (err, data) {
          if (err) {
            console.log(err);
            throw err;
          } else {
            console.log("Successfully uploaded data to webapp1buckett");
            res.json({ message: "Success" });
          }
        });
      });
    }
  });
});

app.listen(PORT);
