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
  region: "us-east-1", //
});
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

app.get("/api/s3/file/:id/upload", async (req, res) => {

  var file_id = req.params["id"];
  const myBucket = "webapp1buckett";
  const downloadPath1 = "myFile512MB";
  const downloadPath2 = "myFile1GB";
  const downloadPath3 = "myFile5GB";
  const paths = {
    1: downloadPath1,
    2: downloadPath2,
    3: downloadPath3,
  };
  const path = paths[file_id];

  const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");

  let s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: "ASIATZQTYOSCMUPRMVPC",
      secretAccessKey: "eaF3UpHKmy4jVYcz/a4E7/Tbm3UAcSdymojFLy8X",
      sessionToken:
        "FwoGZXIvYXdzEGIaDKH80KqiYK6nRsJs2yK7AV+PeSmGjbOaSBw6v3rQdxfZBw9jeb59ZBfScT+4jrh8UbOirMOfpCBX1lEr5P2Y5VYkdE4vk5HB8ilZxtsg0f0dJBme1eRZn5rlBx1DviNFPXIQQPT3tPze45PqQgUXWUcIZSDnbedc9DBWNJIY+/H9jVnPtUKE0KKVd6RgiU1FxITHWCkAym37tkHtI0ylzHzfEKqNGycO9GFLElkJAsIy00TMiacg+HaYCk0cVL1ds7rBS0LhlD45RKwosvX1oQYyLR61OoWmY3SKCTOofffS71DkYqGFinF3AV7x62KqaM+ic5pOzopG77a+5JeHBw==",
    },
  });

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
      .createWriteStream(
        // fileURLToPath(new URL(`./${key}`, import.meta.url))
        `./encrypted_${path}.dat`
      )
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

        const params = { Bucket: myBucket, Key: outputFile, Body: data };

        s3.putObject(params, function (err, data) {
          if (err) {
            console.log(err);
            throw err;
          } else {
            const endTime = performance.now();
            const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
            console.log(elapsedTime, " seconds");
            console.log("Successfully uploaded data to webapp1buckett");
            res.send({ Elapsed_time: elapsedTime });
          }
        });
      });
    });
  };

  main();
  // console.log("Download completed");

  // rs.on("error", (err) => {
  //   // file.destroy();
  //   console.error("Download failed:", err);
  // });

  // res.attachment(path);
  // var fileStream = s3.getObject({ Bucket: myBucket, Key: path }).createReadStream();
  // fileStream.pipe(res);

  // const fileStream = s3
  //   .getObject({ Bucket: myBucket, Key: path })
  //   .createReadStream();
  // // Download the file from S3 and save it to the file system
  // const file = fs.createWriteStream("file");
  // fileStream.pipe(file);
});
app.listen(PORT);
