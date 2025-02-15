import { createHash, Hash } from 'node:crypto';
import { search } from 'jmespath';
import { IdempotencyRecordStatus } from '../types';
import type { BasePersistenceLayerOptions } from '../types';
import { EnvironmentVariablesService } from '../config';
import { IdempotencyRecord } from './IdempotencyRecord';
import { BasePersistenceLayerInterface } from './BasePersistenceLayerInterface';
import {
  IdempotencyItemAlreadyExistsError,
  IdempotencyValidationError,
} from '../Exceptions';
import { LRUCache } from './LRUCache';

/**
 * Base class for all persistence layers. This class provides the basic functionality for
 * saving, retrieving, and deleting idempotency records. It also provides the ability to
 * configure the persistence layer from the idempotency config.
 * @abstract
 * @class
 * @implements {BasePersistenceLayerInterface}
 */
abstract class BasePersistenceLayer implements BasePersistenceLayerInterface {
  public idempotencyKeyPrefix: string;
  private cache?: LRUCache<string, IdempotencyRecord>;
  private configured = false;
  // envVarsService is always initialized in the constructor
  private envVarsService!: EnvironmentVariablesService;
  private eventKeyJmesPath?: string;
  private expiresAfterSeconds: number = 60 * 60; // 1 hour default
  private hashFunction = 'md5';
  private payloadValidationEnabled = false;
  private throwOnNoIdempotencyKey = false;
  private useLocalCache = false;
  private validationKeyJmesPath?: string;

  public constructor() {
    this.envVarsService = new EnvironmentVariablesService();
    this.idempotencyKeyPrefix = this.getEnvVarsService().getFunctionName();
  }

  /**
   * Initialize the base persistence layer from the configuration settings
   *
   * @param {BasePersistenceLayerConfigureOptions} config - configuration object for the persistence layer
   */
  public configure(config: BasePersistenceLayerOptions): void {
    // Extracting the idempotency config from the config object for easier access
    const { config: idempotencyConfig } = config;

    if (config?.functionName && config.functionName.trim() !== '') {
      this.idempotencyKeyPrefix = `${this.idempotencyKeyPrefix}.${config.functionName}`;
    }

    // Prevent reconfiguration
    if (this.configured) {
      return;
    }
    this.configured = true;

    this.eventKeyJmesPath = idempotencyConfig?.eventKeyJmesPath;
    this.validationKeyJmesPath = idempotencyConfig?.payloadValidationJmesPath;
    this.payloadValidationEnabled =
      this.validationKeyJmesPath !== undefined || false;
    this.throwOnNoIdempotencyKey =
      idempotencyConfig?.throwOnNoIdempotencyKey || false;
    this.eventKeyJmesPath = idempotencyConfig.eventKeyJmesPath;
    this.expiresAfterSeconds = idempotencyConfig.expiresAfterSeconds; // 1 hour default
    this.useLocalCache = idempotencyConfig.useLocalCache;
    if (this.useLocalCache) {
      this.cache = new LRUCache({
        maxSize: idempotencyConfig.maxLocalCacheSize,
      });
    }
    this.hashFunction = idempotencyConfig.hashFunction;
  }

  /**
   * Deletes a record from the persistence store for the persistence key generated from the data passed in.
   *
   * @param data - the data payload that will be hashed to create the hash portion of the idempotency key
   */
  public async deleteRecord(data: Record<string, unknown>): Promise<void> {
    const idempotencyRecord = new IdempotencyRecord({
      idempotencyKey: this.getHashedIdempotencyKey(data),
      status: IdempotencyRecordStatus.EXPIRED,
    });

    await this._deleteRecord(idempotencyRecord);

    this.deleteFromCache(idempotencyRecord.idempotencyKey);
  }

  /**
   * Retrieves idempotency key for the provided data and fetches data for that key from the persistence store
   *
   * @param data - the data payload that will be hashed to create the hash portion of the idempotency key
   */
  public async getRecord(
    data: Record<string, unknown>
  ): Promise<IdempotencyRecord> {
    const idempotencyKey = this.getHashedIdempotencyKey(data);

    const cachedRecord = this.getFromCache(idempotencyKey);
    if (cachedRecord) {
      this.validatePayload(data, cachedRecord);

      return cachedRecord;
    }

    const record = await this._getRecord(idempotencyKey);
    this.saveToCache(record);
    this.validatePayload(data, record);

    return record;
  }

  public isPayloadValidationEnabled(): boolean {
    return this.payloadValidationEnabled;
  }

  /**
   * Saves a record indicating that the function's execution is currently in progress
   *
   * @param data - the data payload that will be hashed to create the hash portion of the idempotency key
   * @param remainingTimeInMillis - the remaining time left in the lambda execution context
   */
  public async saveInProgress(
    data: Record<string, unknown>,
    remainingTimeInMillis?: number
  ): Promise<void> {
    const idempotencyRecord = new IdempotencyRecord({
      idempotencyKey: this.getHashedIdempotencyKey(data),
      status: IdempotencyRecordStatus.INPROGRESS,
      expiryTimestamp: this.getExpiryTimestamp(),
      payloadHash: this.generateHash(JSON.stringify(data)),
    });

    if (remainingTimeInMillis) {
      idempotencyRecord.inProgressExpiryTimestamp =
        new Date().getTime() + remainingTimeInMillis;
    } else {
      console.warn(
        'Could not determine remaining time left. Did you call registerLambdaContext on IdempotencyConfig?'
      );
    }

    if (this.getFromCache(idempotencyRecord.idempotencyKey)) {
      throw new IdempotencyItemAlreadyExistsError();
    }

    await this._putRecord(idempotencyRecord);
  }

  /**
   * Saves a record of the function completing successfully. This will create a record with a COMPLETED status
   * and will save the result of the completed function in the idempotency record.
   *
   * @param data - the data payload that will be hashed to create the hash portion of the idempotency key
   * @param result - the result of the successfully completed function
   */
  public async saveSuccess(
    data: Record<string, unknown>,
    result: Record<string, unknown>
  ): Promise<void> {
    const idempotencyRecord = new IdempotencyRecord({
      idempotencyKey: this.getHashedIdempotencyKey(data),
      status: IdempotencyRecordStatus.COMPLETED,
      expiryTimestamp: this.getExpiryTimestamp(),
      responseData: result,
      payloadHash: this.generateHash(JSON.stringify(data)),
    });

    await this._updateRecord(idempotencyRecord);

    this.saveToCache(idempotencyRecord);
  }

  protected abstract _deleteRecord(record: IdempotencyRecord): Promise<void>;
  protected abstract _getRecord(
    idempotencyKey: string
  ): Promise<IdempotencyRecord>;
  protected abstract _putRecord(record: IdempotencyRecord): Promise<void>;
  protected abstract _updateRecord(record: IdempotencyRecord): Promise<void>;

  private deleteFromCache(idempotencyKey: string): void {
    if (!this.useLocalCache) return;
    // Delete from local cache if it exists
    if (this.cache?.has(idempotencyKey)) {
      this.cache?.remove(idempotencyKey);
    }
  }

  /**
   * Generates a hash of the data and returns the digest of that hash
   *
   * @param data the data payload that will generate the hash
   * @returns the digest of the generated hash
   */
  private generateHash(data: string): string {
    const hash: Hash = createHash(this.hashFunction);
    hash.update(data);

    return hash.digest('base64');
  }

  /**
   * Getter for `envVarsService`.
   * Used internally during initialization.
   */
  private getEnvVarsService(): EnvironmentVariablesService {
    return this.envVarsService;
  }

  /**
   * Creates the expiry timestamp for the idempotency record
   *
   * @returns the expiry time for the record expressed as number of seconds past the UNIX epoch
   */
  private getExpiryTimestamp(): number {
    const currentTime: number = Date.now() / 1000;

    return currentTime + this.expiresAfterSeconds;
  }

  private getFromCache(idempotencyKey: string): IdempotencyRecord | undefined {
    if (!this.useLocalCache) return undefined;
    const cachedRecord = this.cache?.get(idempotencyKey);
    if (cachedRecord) {
      // if record is not expired, return it
      if (!cachedRecord.isExpired()) return cachedRecord;
      // if record is expired, delete it from cache
      this.deleteFromCache(idempotencyKey);
    }
  }

  /**
   * Generates the idempotency key used to identify records in the persistence store.
   *
   * @param data the data payload that will be hashed to create the hash portion of the idempotency key
   * @returns the idempotency key
   */
  private getHashedIdempotencyKey(data: Record<string, unknown>): string {
    if (this.eventKeyJmesPath) {
      data = search(data, this.eventKeyJmesPath);
    }

    if (BasePersistenceLayer.isMissingIdempotencyKey(data)) {
      if (this.throwOnNoIdempotencyKey) {
        throw new Error('No data found to create a hashed idempotency_key');
      }
      console.warn(
        `No value found for idempotency_key. jmespath: ${this.eventKeyJmesPath}`
      );
    }

    return `${this.idempotencyKeyPrefix}#${this.generateHash(
      JSON.stringify(data)
    )}`;
  }

  /**
   * Extract payload using validation key jmespath and return a hashed representation
   *
   * @param data payload
   */
  private getHashedPayload(data: Record<string, unknown>): string {
    // This method is only called when payload validation is enabled.
    // For payload validation to be enabled, the validation key jmespath must be set.
    // Therefore, the assertion is safe.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    data = search(data, this.validationKeyJmesPath!);

    return this.generateHash(JSON.stringify(data));
  }

  private static isMissingIdempotencyKey(
    data: Record<string, unknown>
  ): boolean {
    if (Array.isArray(data) || typeof data === 'object') {
      if (data === null) return true;
      for (const value of Object.values(data)) {
        if (value) {
          return false;
        }
      }

      return true;
    }

    return !data;
  }

  /**
   * Save record to local cache except for when status is `INPROGRESS`.
   *
   * We can't cache `INPROGRESS` records because we have no way to reflect updates
   * that might happen to the record outside of the execution context of the function.
   *
   * @param record - record to save
   */
  private saveToCache(record: IdempotencyRecord): void {
    if (!this.useLocalCache) return;
    if (record.getStatus() === IdempotencyRecordStatus.INPROGRESS) return;
    this.cache?.add(record.idempotencyKey, record);
  }

  private validatePayload(
    data: Record<string, unknown>,
    record: IdempotencyRecord
  ): void {
    if (this.payloadValidationEnabled) {
      const hashedPayload: string = this.getHashedPayload(data);
      if (hashedPayload !== record.payloadHash) {
        throw new IdempotencyValidationError(
          'Payload does not match stored record for this event key'
        );
      }
    }
  }
}

export { BasePersistenceLayer };
