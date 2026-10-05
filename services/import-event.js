const {
    ReceiveMessageCommand,
    DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const {
    HeadObjectCommand
} = require("@aws-sdk/client-s3");

const sqs = require("../configs/sqs");
const s3 = require("../configs/s3");
const pool = require("../configs/db");

async function processImportEvent(message) {
    const body = JSON.parse(message.Body);

    if (body.Event === "s3:TestEvent") {
        console.log("Ignoring S3 test event");
        return;
    }

    const record = body.Records?.[0];

    if (!record) {
        throw new Error("Invalid S3 event");
    }

    const bucket = record.s3.bucket.name;

    const key = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " ")
    );

    console.log("S3 object created:", key);

    // Verify object exists
    const object = await s3.send(
        new HeadObjectCommand({
            Bucket: bucket,
            Key: key
        })
    );

    console.log("Object verified:", object.ContentLength);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT *
            FROM import_jobs
            WHERE s3_key = $1
            FOR UPDATE
            `,
            [key]
        );

        if (result.rows.length === 0) {
            throw new Error(`Import not found: ${key}`);
        }

        const importJob = result.rows[0];

        if (importJob.status !== "CREATED") {
            console.log(
                `Import ${importJob.id} already processed`
            );

            await client.query("COMMIT");
            return;
        }

        await client.query(
            `
            UPDATE import_jobs
            SET
                status = 'PROCESSING',
                updated_at = NOW()
            WHERE id = $1
            `,
            [importJob.id]
        );

        await client.query("COMMIT");

        console.log(
            `Import ${importJob.id} → PROCESSING`
        );

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function pollImportEvents() {
    try {
        const result = await sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: process.env.IMPORT_EVENT_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20,
                VisibilityTimeout: 60
            })
        );

        const messages = result.Messages || [];

        for (const message of messages) {
            try {
                await processImportEvent(message);

                await sqs.send(
                    new DeleteMessageCommand({
                        QueueUrl: process.env.IMPORT_EVENT_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    })
                );

                console.log("SQS message deleted");

            } catch (error) {
                console.error(
                    "Import processing failed:",
                    error.message
                );

                // IMPORTANT:
                // Don't delete the message.
                // SQS will retry it after VisibilityTimeout.
            }
        }

    } catch (error) {
        console.error(
            "SQS polling error:",
            error.message
        );
    }

    // Poll again after this request finishes
    setTimeout(pollImportEvents, 1000);
}

function startImportConsumer() {
    console.log("SQS import consumer started");

    pollImportEvents();
}

module.exports = {
    startImportConsumer
};