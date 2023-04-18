const express = require("express");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const fs = require("fs");
var encryptor = require("file-encryptor");
const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  sessionToken: process.env.sessionToken,
});

const s3 = new AWS.S3({
  region: "us-east-1", //
});

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: "ASIATZQTYOSCMUPRMVPC",
    secretAccessKey: "eaF3UpHKmy4jVYcz/a4E7/Tbm3UAcSdymojFLy8X",
    sessionToken:
      "FwoGZXIvYXdzEGIaDKH80KqiYK6nRsJs2yK7AV+PeSmGjbOaSBw6v3rQdxfZBw9jeb59ZBfScT+4jrh8UbOirMOfpCBX1lEr5P2Y5VYkdE4vk5HB8ilZxtsg0f0dJBme1eRZn5rlBx1DviNFPXIQQPT3tPze45PqQgUXWUcIZSDnbedc9DBWNJIY+/H9jVnPtUKE0KKVd6RgiU1FxITHWCkAym37tkHtI0ylzHzfEKqNGycO9GFLElkJAsIy00TMiacg+HaYCk0cVL1ds7rBS0LhlD45RKwosvX1oQYyLR61OoWmY3SKCTOofffS71DkYqGFinF3AV7x62KqaM+ic5pOzopG77a+5JeHBw==",
  },
  httpOptions: { timeout: 1800000 },
});

const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

app.get("/api/s3/file/:id/upload", async (req, res) => {
  var file_id = req.params["id"];
  const myBucket = "webapp1buckett";
  const downloadPath1 = "myFile200MB";
  const downloadPath2 = "myFile512MB";
  const downloadPath3 = "myFile1GB";
  const paths = {
    1: downloadPath1,
    2: downloadPath2,
    3: downloadPath3,
  };
  const path = paths[file_id];
  const bucketName = "webapp1buckett";
  const objectKey = path;
  let startTime = null;
  const oneMB = 1024 * 1024;

  const getObjectRange = ({ bucket, key, start, end }) => {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    });

    return s3Client.send(command);
  };

  const getRangeAndLength = (contentRange) => {
    const [range, length] = contentRange.split("/");
    const [start, end] = range.split("-");
    return {
      start: parseInt(start),
      end: parseInt(end),
      length: parseInt(length),
    };
  };

  const isComplete = ({ end, length }) => end === length - 1;

  const downloadInChunks = async ({ bucket, key }) => {
    const writeStream = fs
      .createWriteStream(`./${path}`)
      .on("error", (err) => console.error(err));

    let rangeAndLength = { start: -1, end: -1, length: -1 };
    startTime = performance.now();

    while (!isComplete(rangeAndLength)) {
      const { end } = rangeAndLength;
      const nextRange = { start: end + 1, end: end + oneMB };

      console.log(`Downloading bytes ${nextRange.start} to ${nextRange.end}`);

      const { ContentRange, Body } = await getObjectRange({
        bucket,
        key,
        ...nextRange,
      });

      writeStream.write(await Body.transformToByteArray());
      rangeAndLength = getRangeAndLength(ContentRange);
    }
  };

  const main = async () => {
    await downloadInChunks({
      bucket: bucketName,
      key: objectKey,
    });

    const outputFile = `encrypted_${path}.dat`;
    var key = crypto.randomBytes(32);
    var options = { algorithm: "aes256" };

    encryptor.encryptFile(path, outputFile, key, options, function (err) {
      fs.stat(outputFile, (err, stats) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(
          `Encryption completed, File size of cipher in bytes: ${stats.size}`
        );
      });

      fs.readFile(outputFile, function (err, data) {
        if (err) {
          throw err;
        }

        const uploadFile = async () => {
          const stream = fs.createReadStream(outputFile);

          const paramsObj = {
            Bucket: myBucket,
            Key: outputFile,
            Body: stream,
            ACL: "public-read",
          };

          const options = {
            partSize: 10 * 1024 * 1024,
            queueSize: 1,
          };

          try {
            await s3.upload(paramsObj, options).promise();
            console.log("upload OK");
          } catch (error) {
            console.log("upload ERROR", error);
          }
        };

        var buffer = fs.readFileSync("./" + outputFile);
        var startTime = new Date();
        var partNum = 0;
        var partSize = 1024 * 1024 * 5; // Minimum 5MB per chunk (except the last part)
        var numPartsLeft = Math.ceil(buffer.length / partSize);
        var maxUploadTries = 3;
        var multiPartParams = {
          Bucket: myBucket,
          Key: outputFile,
        };
        var multipartMap = {
          Parts: [],
        };

        function completeMultipartUpload(s3, doneParams) {
          s3.completeMultipartUpload(doneParams, function (err, data) {
            if (err) {
              console.log(
                "An error occurred while completing the multipart upload"
              );
              console.log(err);
            } else {
              var delta = (new Date() - startTime) / 1000;
              console.log("Completed upload in", delta, "seconds");
              console.log("Final upload data:", data);
              const endTime = performance.now();
              const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
              console.log(elapsedTime, " seconds");
              console.log("Successfully uploaded data to webapp1buckett");
              res.send({ Elapsed_time: elapsedTime });
            }
          });
        }

        function uploadPart(s3, multipart, partParams, tryNum) {
          var tryNum = tryNum || 1;
          s3.uploadPart(partParams, function (multiErr, mData) {
            if (multiErr) {
              console.log("multiErr, upload part error:", multiErr);
              if (tryNum < maxUploadTries) {
                console.log(
                  "Retrying upload of part: #",
                  partParams.PartNumber
                );
                uploadPart(s3, multipart, partParams, tryNum + 1);
              } else {
                console.log("Failed uploading part: #", partParams.PartNumber);
              }
              return;
            }
            multipartMap.Parts[this.request.params.PartNumber - 1] = {
              ETag: mData.ETag,
              PartNumber: Number(this.request.params.PartNumber),
            };
            console.log("Completed part", this.request.params.PartNumber);
            console.log("mData", mData);
            if (--numPartsLeft > 0) return; // complete only when all parts uploaded

            var doneParams = {
              Bucket: myBucket,
              Key: outputFile,
              MultipartUpload: multipartMap,
              UploadId: multipart.UploadId,
            };

            console.log("Completing upload...");
            completeMultipartUpload(s3, doneParams);
          });
        }

        async function helo() {
          console.log("Creating multipart upload for:", outputFile);
          s3.createMultipartUpload(
            multiPartParams,
            async function (mpErr, multipart) {
              if (mpErr) {
                console.log("Error!", mpErr);
                return;
              }
              console.log("Got upload ID", multipart.UploadId);

              // Grab each partSize chunk and upload it as a part
              for (
                var rangeStart = 0;
                rangeStart < buffer.length;
                rangeStart += partSize
              ) {
                partNum++;
                var end = Math.min(rangeStart + partSize, buffer.length),
                  partParams = {
                    Body: buffer.slice(rangeStart, end),
                    Bucket: myBucket,
                    Key: outputFile,
                    PartNumber: String(partNum),
                    UploadId: multipart.UploadId,
                  };

                // Send a single part
                console.log(
                  "Uploading part: #",
                  partParams.PartNumber,
                  ", Range start:",
                  rangeStart
                );
                await uploadPart(s3, multipart, partParams);
              }
            }
          );
        }
        helo();
      });
    });
  };
  main();
});
app.timeout = 0;
app.listen(PORT);
