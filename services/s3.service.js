const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = require('../configs/s3');

async function generateSignedUrl({key, contentType}) {
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: contentType
    })

    const url = await getSignedUrl(s3, command, {
        expiresIn: 15 * 60
    })

    return url;
}

module.exports = {
    generateSignedUrl
}