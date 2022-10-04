# AutoVMAF API

API to create, run and monitor [autovmaf](https://github.com/Eyevinn/autovmaf) jobs.

Current features:

- Possible to start new autoabr jobs.
- Possible to run multiple autoabr jobs in parallel.
- Monitor how long a job have been running (milliseconds) and the status i.e `ACTIVE`/`INACTIVE`.
- Download and compile VMAF results from S3 for all measured bitrates and resolutions for a specific job.

New Autoabr workers will automatically be created if all current ones are in use.
This makes it really easy to create and run jobs in parallel which wasn't possible before.

## Setup

To initialize a new `AutoabrService` do:

```typescript
import { AutoabrService } from "@eyevinn/autoabr-api";

// initialize a new instance of AutoabrService
const autoabrService = new AutoabrService();
// register the routes
autoabrService.listen(3000);
```

The following environment variables need to be set:

```bash
AWS_ACCESS_KEY_ID=MyAccessKeyID
AWS_SECRET_ACCESS_KEY=MySecretAccessKey
AWS_REGION=eu-north-1
SKIP_FILEWRITE=true //To skip writing ABR-ladder data to disk
LOAD_CREDENTIALS_FROM_ENV=true // If false, it will load credentials from ~/.aws/credentials
```

The Autoabr service is now up and running and available on port `3000`.

Available endpoints are:

| Endpoint | Method | Description |
| --------- | -------- | ----------- |
| /               | `GET`       |Heartbeat endpoint of service |
| /autoabr  | `POST`    |Create a new autoabr job. Provide JSON body with settings |
| /autoabr | `GET`       |List all active autoabr workers |
| /autoabr/:id | `GET` |List info about a specific autoabr worker |
| /autoabr/result/:output | `GET` |Download VMAF results from S3 and compile it into a JSON |
| /autoabr/cache | `DELETE` |Clear MediaConvert and AWS pipeline settings cache |

To start a new Autoabr job do a `POST` to the `/autoabr` endpoint:

```json
{
   "encodingSettingsUrl": "s3://vmaf-files/encoding-profile-h265.json",
   "pipelineUrl": "s3://vmaf-files/pipeline.json",
   "job": {
      "name": "job-name",
      "output": "output-folder-name-in-vmaf-files-bucket",
      "reference": "s3://vmaf-files/tv2-vod-references/reference.mov",
      "models": [
        "UHD"
      ],
      "bitrates": [
        10000000,
        12800000
      ],
      "resolutions": [
        {
          "width": 768,
          "height": 432
        },
        {
          "width": 1280,
          "height": 720
        },
        {
          "width": 1920,
          "height": 1080
        },
        {
          "width": 2560,
          "height": 1440
        },
        {
          "width": 3840,
          "height": 2160
        }
      ]
   }
}
```

If the `pipelineUrl` and `encodingSettingsUrl` haven't been set it will use the default settings that can be found in `src/resources`.

The `/autoabr/result/:output` (output is the output specified in the job JSON) will download and process all resulting VMAF files from AWS and return the result. This process can take a while depending on how many resolutions and bitrates that have been measured. This means that the response from the endpoint can take several seconds.
