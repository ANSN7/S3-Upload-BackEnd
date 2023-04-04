const express = require("express");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const fs = require("fs");
const s3 = new AWS.S3({
  region: "us-east-1",
});
const cors = require("cors");

const app = express();

app.use(cors());

app.get("/get-signed-url", async (req, res) => {
  console.log("helo");
  let myBucket = "webapp1buckett";
  const downloadPath = "./downloaded-file.pdf";

  s3.getObject(
    { Bucket: myBucket, Key: "huppler2012.pdf" },
    function (error, data) {
      if (error != null) {
        console.log("Failed to retrieve an object: " + error);
      } else {
        fs.writeFileSync(downloadPath, data.Body);
        console.log("Loaded " + data.ContentLength + " bytes");
        // do something with data.Body

        console.log("helo");
        // Generate a new RSA key pair
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

        // Write the private key to a file
        fs.writeFileSync("private.pem", privateKey);

        // Write the public key to a file
        fs.writeFileSync("public.pem", publicKey);

        const publicKeyPem = fs.readFileSync("public.pem");

        // Encrypt the file
        const inputFile = "downloaded-file.pdf";
        const outputFile = "cipher";

        const inputBuffer = fs.readFileSync(inputFile);

        let chunk_size = 214; // 214 bytes is the maximum for 2048-bit key
        let chunks = [];
        for (i = 0; i < inputBuffer.length; i = i + chunk_size) {
          chunks.push(inputBuffer.slice(i, i + chunk_size));
        }
        // chunks = [plaintext[i:i+chunk_size] for i in range(0, len(plaintext), chunk_size)]

        // Encrypt each chunk with the public key
        let encryptedBuffer;
        for (chunk in chunks)
          encryptedBuffer += crypto.publicEncrypt(publicKeyPem, chunk);
        encrypted = encryptedBuffer.toString("base64");

        fs.writeFileSync(outputFile, encrypted);

        fs.readFile(outputFile, function (err, data) {
          if (err) {
            throw err;
          }

          params = { Bucket: myBucket, Key: "cipher", Body: data };

          s3.putObject(params, function (err, data) {
            if (err) {
              console.log(err);
            } else {
              console.log("Successfully uploaded data to myBucket/myKey");
            }
          });
        });
      }
    }
  );

  res.json({ message: "Success" });

  // await s3.createPresignedPost({
  //   Fields: {
  //     key: uuidv4(),
  //   },
  //   Conditions: [
  //     ["starts-with", "$Content-Type", "image/"],
  //     ["content-length-range", 0, 1000000],
  //   ],
  //   Expires: 30,
  //   Bucket: 'webapp1buckett',
  // }, (err, signed) => {
  //   res.json(signed);
  // });
});

app.listen(8080);
