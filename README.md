# autoabr-api

API to create, run and monitor [autoabr](https://github.com/Eyevinn/autoabr) jobs.

Current features:

- Possible to start initialize new jobs.
- Possible to run multiple autoabr jobs in parallel.
- Monitor how long a job have been running (milliseconds) and the status i.e `ACTIVE`/`INACTIVE`.

New Autoabr instances will automatically be created if all current ones are in use.
This makes it really easy to create and run jobs in parallel which wasn't possible before.

## Setup

To initialize a new `AutoabrService` do:

```typescript
import { AutoabrService } from './src/api/AutoabrService';

// initialize a new instance of AutoabrService
const autoabrService = new AutoabrService();
// register the routes
autoabrService.listen(3000);
```

The following environment variables need to be set:

```bash
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
SKIP_FILEWRITE=true //to skip writing abr-ladder data to disk
```

The Autoabr service is now up and running and available on port `3000`.

Available endpoints are:

`POST` /autoabr

`GET` /autoabr/status

`GET` /autoabr/:id/status

`GET` /healthcheck

To start a new Autoabr job do a `POST` to the `/autoabr` endpoint:

```json
{
   "encodingSettingsUrl": "s3://vmaf-files/encoding-profile-h265.json",
   "pipeline": "s3://vmaf-files/pipeline.json",
   "job": {
      "name": "output-name",
      "reference": "s3://bucket/reference.mov",
      "models": [
        "UHD"
      ],
      "bitrates": [
        12800000
      ],
      "resolutions": [
        {
          "width": 3840,
          "height": 2160
        }
      ],
      "output": "output-bucket"
   }
}
```

If the `pipeline` and `mediaConvertProfile` haven't been set it will use the default settings that can be found in `src/resources`.

## Current limitations

Currently the [autoabr](https://github.com/Eyevinn/autoabr) package isn't available on NPM, therefore it's required to link this locally to be able to run the API.
