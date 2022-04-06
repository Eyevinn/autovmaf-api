# autoabr-api

API to orchestrate autoabr jobs.

Current features:

- Possible to start initialize new jobs.
- Monitor how long a job have been running and the status i.e `ACTIVE`/`INACTIVE`.

## Setup

To initialize a new `AutoabrService` do:

```typescript
import { AutoabrService } from './src/api/AutoabrService';

// initialize a new instance of AutoabrService
const autoabrService = new AutoabrService();
// register the routes
autoabrService.listen(3000);
```

The Autoabr service is now up and running and available on port `3000`.

## Current limitations

Currently the autoabr package isn't available on NPM, therefore it's required to link this locally to be able to run the service.
