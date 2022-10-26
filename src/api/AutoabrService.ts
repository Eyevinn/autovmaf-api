import Fastify from 'fastify';
import { AutoABR, State } from '../AutoVMAF';
import { default_pipeline } from '../resources/pipelines';
import { default_profile } from '../resources/profiles';

export class AutoabrService {
  private fastify: any;
  private autoabrWorkers = [];
  private MCsettings = new Map<string, {}>();
  private pipelines = new Map<string, {}>();

  constructor() {
    this.fastify = Fastify({
      logger: true,
      ignoreTrailingSlash: true,
    });
  }

  private getAutoabrWorker(id?: string): AutoABR {
    if (id) return this.autoabrWorkers.find((client) => client.id === id);
    for (let i = 0; i < this.autoabrWorkers.length; i++) {
      if (this.autoabrWorkers[i].status === State.INACTIVE) {
        this.autoabrWorkers[i].status = State.IDLE;
        return this.autoabrWorkers[i];
      }
    }
    this.autoabrWorkers.push(new AutoABR());
    this.autoabrWorkers[this.autoabrWorkers.length - 1].status = State.IDLE;
    return this.autoabrWorkers[this.autoabrWorkers.length - 1];
  }

  private async getMCsettings(url: string, autoabrWorker: AutoABR): Promise<any> {
    if (this.MCsettings.has(url)) return this.MCsettings.get(url);
    const MCsettings = JSON.parse(await autoabrWorker.downloadFromS3(url));
    this.MCsettings.set(url, MCsettings);
    return MCsettings;
  }

  private clearAWSCache() {
    this.MCsettings.clear();
    this.pipelines.clear();
  }

  private async getPipelineSettings(url: string, autoabrWorker: AutoABR): Promise<any> {
    if (this.pipelines.has(url)) return this.pipelines.get(url);
    const pipeline = JSON.parse(await autoabrWorker.downloadFromS3(url));
    this.pipelines.set(url, pipeline);
    return pipeline;
  }

  private getAllAutoabrWorkers(): {} {
    let clients = {};
    if (this.autoabrWorkers.length < 1) return clients;
    for (let i = 0; i < this.autoabrWorkers.length; i++) {
      clients[`worker_${i}`] = {
        id: this.autoabrWorkers[i].id,
        status: this.autoabrWorkers[i].status,
        jobOutput: this.autoabrWorkers[i].jobOutput,
        runningTime: this.autoabrWorkers[i].getJobTimer(),
      };
    }
    return clients;
  }

  formatResults(result: object, jobname: string, model?: string, format?: string) {
    let separator = ""
    format === "tsv" ? separator = "\t" : separator = ","
    let headers = ["jobname", "model", "width", "height", "bitrate", "score"]
    let data = []
    if (model) {
      for (const r in result[jobname][model]) {
        const res = r.split('_')[0]
        const [ width, height ] = res.split('x')
        const bitrate = r.split('_')[1]
        const score = result[jobname][model][r]
        data.push([jobname, model, width, height, bitrate, score])
      }
    } else {
      for (const m in result[jobname]) {
        if (Object.keys(result[jobname][m]).length) {
          for (const r in result[jobname][m]) {
            const res = r.split('_')[0]
            const [ width, height ] = res.split('x')
            const bitrate = r.split('_')[1]
            const score = result[jobname][m][r]
            data.push([jobname, m, width, height, bitrate, score])
          }
        }
      }
    }
    data.sort((a, b) => (a[3] == b[3]) ? a[4] - b[4] : b[3] - a[3]); // sort by height, then bitrate
    data = [headers, ...data]
    let csv = data.map(fields => fields.join(separator)).join("\n")
    return csv
  }

  private async routes() {
    this.fastify.get('/', async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ status: 'Healthy 💖' });
    });

    this.fastify.post('/autoabr', async (request, reply) => {
      if (!request.body.job) {
        reply.code(400).send({ error: 'Missing job parameter' });
        return;
      }

      const job = request.body.job;
      const pipelineS3Url = request.body['pipelineUrl'];
      const encodingS3Url = request.body['encodingSettingsUrl'];
      const autoabrWorker = this.getAutoabrWorker();
      let mediaConvertProfile = default_profile;
      let pipeline = default_pipeline;

      try {
        if (pipelineS3Url) {
          pipeline = await this.getPipelineSettings(pipelineS3Url, autoabrWorker);
        }
      } catch (error) {
        console.error(error.message);
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: 'Failed to load pipeline settings from S3' });
        return;
      }
      try {
        if (encodingS3Url) {
          mediaConvertProfile = await this.getMCsettings(encodingS3Url, autoabrWorker);
        }
      } catch (error) {
        console.error(error.message);
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: 'Failed to load MediaConvert settings from S3' });
        return;
      }
      try {
        autoabrWorker.createJob(job, pipeline, mediaConvertProfile);
        reply
          .code(200)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({
            id: autoabrWorker.id,
            status: autoabrWorker.status,
            jobOutput: autoabrWorker.jobOutput,
            runningTime: autoabrWorker.getJobTimer(),
          });
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: 'Failed to create job' });
        return;
      }
    });

    this.fastify.get('/autoabr', async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send(this.getAllAutoabrWorkers());
    });

    this.fastify.get('/autoabr/:id/', async (request, reply) => {
      const id = request.params.id;
      const autoabrWorker = this.getAutoabrWorker(id);
      if (!autoabrWorker) {
        reply
          .code(404)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: `Autoabr worker with id: ${id} could not be found` });
        return;
      }
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({
          id: autoabrWorker.id,
          status: autoabrWorker.status,
          jobOutput: autoabrWorker.jobOutput,
          runningTime: autoabrWorker.getJobTimer(),
        });
    });

    this.fastify.get('/autoabr/result/:output/:model', async (request, reply) => {
      const output = request.params.output;
      const model = request.params.model;
      const format = request.query.format;
      const autoabrWorker = this.getAutoabrWorker();
      try {
        const result = await autoabrWorker.getJobOutput(output, model);
        if (format != undefined && model) {
          let data = this.formatResults(result, output, model, format)
          reply
          .code(200)
          .header('Content-Type', 'text/csv; charset=utf-8')
          .send(data);
        } else if (format != undefined && !model) {
          let data = this.formatResults(result, output, undefined, format)
          reply
          .code(200)
          .header('Content-Type', 'text/csv; charset=utf-8')
          .send(data);
        } else {
          reply
            .code(200)
            .header('Content-Type', 'application/json; charset=utf-8')
            .send({
              id: autoabrWorker.id,
              status: autoabrWorker.status,
              result: result,
            });
        }
      } catch (error) {
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({
            id: autoabrWorker.id,
            status: autoabrWorker.status,
            message: 'Failed to load results from S3'
          });
      }
    });

    this.fastify.delete('/autoabr/cache', async (request, reply) => {
      this.clearAWSCache();
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ message: 'Cache deleted' });
    });
  }

  /**
    * Start the server
    * @param {number} port - The port
    * @param {string} host - The host (ip) address (Optional)
    */
  async listen(port: number, host?: string) {
    await this.routes();
    this.fastify.listen(port, host, (err, address) => {
      if (err) {
        console.error(err);
        throw err;
      }
      console.log(`Server is now listening on ${address}`);
    });
  }
}
