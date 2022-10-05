import { createJob as createAutoABRJob, getVmaf, logger, QualityAnalysisModel } from '@eyevinn/autovmaf';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';

export enum State {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class AutoABR {
  private instanceId: string;
  private jobStatus: State;
  private startTime = new Date();
  private endTime = new Date();
  private latestJobOutput: string;

  constructor() {
    this.instanceId = nanoid();
    this.jobStatus = State.INACTIVE;
    this.latestJobOutput = '';
  }

  get id(): string {
    return this.instanceId;
  }

  get status(): State {
    return this.jobStatus;
  }

  get jobOutput(): string {
    return this.latestJobOutput;
  }

  set status(status: State) {
    if (Object.values(State).includes(status)) {
      this.jobStatus = status;
    }
  }

  getJobTimer(): number {
    if (this.jobStatus === State.ACTIVE) {
      return (new Date()).getTime() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  public async downloadFromS3(S3url: string): Promise<string> {
    const s3 = new S3({ region: process.env.AWS_REGION || 'eu-north-1' });
    const s3bucket = S3url.split('/')[2];
    const s3key = S3url.split('/').slice(3).join('/');
    console.log(`Bucket: ${s3bucket}, Key: ${s3key}`);
    const getCommand = new GetObjectCommand({ Bucket: `${s3bucket}`, Key: `${s3key}` });
    const response = await s3.send(getCommand);
    return await this.streamToString(response);
  }

  public async createJob(jobData: any, pipelineData: any, encodingProfileData: any) {
    this.latestJobOutput = jobData['output'];
    this.start(jobData, pipelineData, encodingProfileData);
  }

  public async getJobOutput(outputFolder?: string, model?: string): Promise<{}> {
    let output = {};
    let folder = outputFolder ? outputFolder : this.latestJobOutput;
    if(!folder || this.status === State.ACTIVE) return output;
    this.jobStatus = State.ACTIVE;
    output[folder] = {};
    if (model) {
      try {
        const vmafFiles = await getVmaf(`s3://vmaf-files/results/encoded-files/${folder}/${model}/`);
        output[folder][model] = {}
        vmafFiles.map(file => {
          output[folder][model][file['filename']] = file['vmaf'];
        });
        this.jobStatus = State.INACTIVE;
        return output;
      } catch (error) {
        console.error(error);
        this.jobStatus = State.INACTIVE;
        throw error;
      }
    } else {
      const models = Object.keys(QualityAnalysisModel).filter((v) => isNaN(Number(v)));

      for (const model in models) {
        output[folder][models[model]] = {}
        const vmafFiles = await getVmaf(`s3://vmaf-files/results/encoded-files/${folder}/${models[model]}/`);
        vmafFiles.map(file => {
          output[folder][models[model]][file['filename']] = file['vmaf'];
        });
      }
      this.jobStatus = State.INACTIVE;
      return output;
    }
  }

  private async start(jobData: any, pipelineData: any, encodingProfileData: any) {
    this.jobStatus = State.ACTIVE;
    this.startTime = new Date();
    await createAutoABRJob(jobData, pipelineData, encodingProfileData);
    this.endTime = new Date();
    this.jobStatus = State.INACTIVE;
  }

  private async streamToString(stream: any): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let responseDataChunks = [] as any;
      stream.Body.once('error', (err) => reject(err));
      stream.Body.on('data', (chunk) => responseDataChunks.push(chunk));
      stream.Body.once('end', () => resolve(responseDataChunks.join('')));
    });
  }
}
