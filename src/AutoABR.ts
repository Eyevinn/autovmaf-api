import { createJob as createAutoABRJob, getVmaf } from '@eyevinn/autoabr';
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

  get id() {
    return this.instanceId;
  }

  get status() {
    return this.jobStatus;
  }

  set status(status: State) {
    if (Object.values(State).includes(status)) {
      this.jobStatus = status;
    }
  }

  getJobTimer() {
    if (this.jobStatus === State.ACTIVE) {
      return (new Date()).getTime() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  public async downloadFromS3(S3url: string) {
    const s3 = new S3({ region: process.env.AWS_REGION || 'eu-north-1' });
    console.log('Bucket: ' + S3url.split('/')[2] + ' Key: ' + S3url.split('/')[3]);
    const getCommand = new GetObjectCommand({ Bucket: S3url.split('/')[2], Key: S3url.split('/')[3] });
    const response = await s3.send(getCommand);
    return await this.streamToString(response);
  }

  public async createJob(jobData: any, pipelineData: any, encodingProfileData: any) {
    this.latestJobOutput = jobData['output'];
    this.start(jobData, pipelineData, encodingProfileData);
  }

  public async getJobOutput(outputFolder?: string): Promise<any> {
    let output = {};
    let folder = outputFolder ? outputFolder : this.latestJobOutput;
    if(!folder || this.status === State.ACTIVE) return output;
    this.jobStatus = State.ACTIVE;
    try {
      const vmafFiles = await getVmaf(`s3://vmaf-files/${folder}/UHD/`);
      output[folder] = {};
      vmafFiles.forEach(file => {
        output[folder][file['filename']] = file['vmaf'];
      });
      this.jobStatus = State.INACTIVE;
      return output;
    } catch (error) {
      console.error(error);
      this.jobStatus = State.INACTIVE;
      throw error;
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
