import Fastify from "fastify";
import AutoABR from '../autoabr';
import { default_pipeline } from '../resources/pipelines';
import { default_profile } from '../resources/profiles';

export class AutoabrService {
  private fastify: any;
  private autoabr: AutoABR;

  constructor() {
    this.autoabr = new AutoABR();
    this.fastify = Fastify({ logger: true });
  }

  private async routes() {
    this.fastify.get("/healthcheck", async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ status: "Healthy 💖" });
    });

    this.fastify.post('/create-job', async (request, reply) => {
      if (!request.body.job) {
        reply.code(400).send({ error: 'Missing job parameter' });
        return;
      }

      const job = request.body.job;
      let pipelineS3Url = request.body['pipelineUrl'];
      let encodingS3Url = request.body['encodingSettingsUrl'];
      let mediaConvertProfile = default_profile;
      let pipeline = default_pipeline;
      try {
        if (pipelineS3Url) {
          pipeline = JSON.parse(await this.autoabr.downloadFromS3(pipelineS3Url));
        }
        if (encodingS3Url) {
          mediaConvertProfile = JSON.parse(await this.autoabr.downloadFromS3(encodingS3Url));
        }
      } catch (error) {
        console.error(error);
        reply
        .code(500)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ Message: 'Failed to load settings from S3' });
      }

      this.autoabr.createJob(job, pipeline, mediaConvertProfile);
      reply
      .code(200)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send({ Message: 'Job created successfully! 🎞️' });
    });
  }

  async listen(port: number) {
    await this.routes();
    this.fastify.listen(port, (err, address) => {
      if (err) {
        console.error(err);
        throw err;
      }
      console.log(`Server is now listening on ${address}`);
    });
  }
}