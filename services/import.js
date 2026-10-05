const pool = require("../configs/db");
const { generateSignedUrl } = require("./s3.service");

const bulkImport = async (req, res) => {

    const client = await pool.connect();

    try {
        
        const { fileName , contentType } = req.body;contentType
    
        if(!fileName){
            return res.status(400).json({
                message: "fileName required"
            })
        }
    
        if(!contentType){
            return res.status(400).json({
                message: "contentType required"
            })
        }
    
        const importId = crypto.randomUUID();
    
        const key = `/upload/${importId}/${fileName}`;

        await client.query("BEGIN");

        await client.query(
            `
            INSERT INTO import_jobs (
                id,
                file_name,
                s3_key,
                status
            ) VALUES ($1, $2, $3, $4)
            
            `,
            [
                importId,
                fileName,
                key,
                "CREATED"
            ]
        )
    
        const uploadUrl = await generateSignedUrl({
            key,
            contentType
        })
    
        await client.query("COMMIT");

        res.status(201).json({
            importId,
            uploadUrl,
            key
        })

    } catch (error) {

        await client.query("ROLLBACK")
        console.log("Generate upload URL error:", error);

        res.status(500).json({
        message: "Failed to generate upload URL",
        });
    }
}

module.exports = bulkImport;